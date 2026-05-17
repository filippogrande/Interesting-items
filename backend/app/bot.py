import os
import re
import logging
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
# aiogram v3
from aiogram import Bot, Dispatcher, types, Router
from aiogram.filters import Command
# aiogram v3 uses Dispatcher.start_polling instead of executor
from rq import Queue
from redis import Redis

from .tasks import scrape_job
import asyncio
from collections import defaultdict, deque
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
ALLOWED_TELEGRAM_USER_IDS = os.getenv("ALLOWED_TELEGRAM_USER_IDS")  # comma separated ints

redis_conn = Redis.from_url(REDIS_URL)
q = Queue(connection=redis_conn)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()

# naive URL extractor for incoming messages
URL_RE = re.compile(r"https?://[\w\-.:/?#\[\]@!$&'()*+,;=%]+")


def parse_allowed_user_ids(env_value: str | None):
    if not env_value:
        return None
    ids = []
    for part in env_value.split(','):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError:
            logger.warning("Invalid allowed user id in ALLOWED_TELEGRAM_USER_IDS: %s", part)
    return ids


ALLOWED_USERS = parse_allowed_user_ids(ALLOWED_TELEGRAM_USER_IDS)
if ALLOWED_USERS is None:
    logger.warning("ALLOWED_TELEGRAM_USER_IDS not set — bot will accept links from any user.")

# Allowed domains for scraping (comma separated). If not set, defaults to common marketplaces.
ALLOWED_DOMAINS_ENV = os.getenv("ALLOWED_DOMAINS")

# sensible default whitelist
DEFAULT_ALLOWED_DOMAINS = [
    "vinted.it",
    "wallapop.com",
    "it.wallapop.com",
    "subito.it",
    "ebay.it",
    "aliexpress.com",
    "it.aliexpress.com",
]

def parse_allowed_domains(env_value: str | None):
    if not env_value:
        return []
    return [p.strip().lower() for p in env_value.split(",") if p.strip()]

def build_allowed_domains(env_value: str | None):
    merged = []
    seen = set()
    for domain in DEFAULT_ALLOWED_DOMAINS + parse_allowed_domains(env_value):
        if domain not in seen:
            merged.append(domain)
            seen.add(domain)
    return merged

ALLOWED_DOMAINS = build_allowed_domains(ALLOWED_DOMAINS_ENV)



def is_allowed_domain(netloc: str) -> bool:
    host = netloc.split(':')[0].lower()
    for d in ALLOWED_DOMAINS:
        if host == d or host.endswith('.' + d):
            return True
    return False


def normalize_url(raw_url: str) -> str | None:
    try:
        p = urlparse(raw_url)
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    # remove common tracking params
    qsl = parse_qsl(p.query, keep_blank_values=True)
    filtered = [(k, v) for (k, v) in qsl if not (k.startswith('utm_') or k in ('fbclid', 'gclid'))]
    # sort params for deterministic URL
    filtered.sort()
    new_query = urlencode(filtered, doseq=True)
    # normalize netloc to lowercase
    netloc = p.netloc.lower()
    # remove default port
    if netloc.endswith(':80') and p.scheme == 'http':
        netloc = netloc[:-3]
    if netloc.endswith(':443') and p.scheme == 'https':
        netloc = netloc[:-4]
    path = p.path.rstrip('/') or '/'
    normalized = urlunparse((p.scheme, netloc, path, '', new_query, ''))
    return normalized


def is_authorized(user_id: int) -> bool:
    if ALLOWED_USERS is None:
        return True
    return user_id in ALLOWED_USERS


@router.message(Command(commands=["start", "help"]))
async def cmd_start(message: types.Message):
    await message.answer("Ciao — invia un link di prodotto e lo processerò. Assicurati di essere autorizzato.")



# --- Coda centrale per sito web ---
# Coda per tipologia (es. vinted, wallapop)
site_queues = defaultdict(deque)  # {site_type: deque[(url, user_id, chat_id)]}
site_processing = {}  # {site_type: asyncio.Task}

def get_site_type(url: str) -> str:
    try:
        netloc = urlparse(url).netloc.lower()
        if 'vinted' in netloc:
            return 'vinted'
        elif 'wallapop' in netloc:
            return 'wallapop'
        elif 'aliexpress' in netloc:
            return 'aliexpress'
        # aggiungi altri siti qui
        else:
            return 'unsupported'
    except Exception:
        return 'unsupported'

async def process_site_queue(site: str):
    while site_queues[site]:
        url, user_id, chat_id = site_queues[site][0]
        try:
            await bot.send_message(chat_id, f"Inizio scraping: {url}")
            if site == 'vinted':
                from .vinted import scrape_vinted
                result = await asyncio.to_thread(scrape_vinted, url)
            elif site == 'wallapop':
                await bot.send_message(chat_id, "❌ Funzione wallapop non ancora implementata.")
                result = False
            elif site == 'aliexpress':
                try:
                    from .aliexpress import scrape_aliexpress
                    result = await asyncio.to_thread(scrape_aliexpress, url)
                except Exception as e:
                    await bot.send_message(chat_id, f"❌ Errore AliExpress: {e}")
                    result = False
            else:
                await bot.send_message(chat_id, f"❌ Sito non supportato: {url}")
                result = False
            if result:
                await bot.send_message(chat_id, f"✅ Finito: {url}")
            else:
                await bot.send_message(chat_id, f"❌ Errore durante scraping: {url}")
        except Exception as e:
            await bot.send_message(chat_id, f"❌ Errore imprevisto su {url}: {e}")
        site_queues[site].popleft()
        await asyncio.sleep(180)  # 3 minuti tra uno scraping e l'altro per tipologia
    site_processing.pop(site, None)

@router.message()
async def handle_message(message: types.Message):
    text = message.text or ""
    urls = URL_RE.findall(text)
    if not urls:
        await message.reply("Nessun URL trovato nel messaggio.")
        return

    user = message.from_user
    if not is_authorized(user.id):
        await message.reply("Non sei autorizzato a usare questo bot.")
        return

    added = 0
    for raw_url in urls:
        normalized = normalize_url(raw_url)
        if not normalized:
            await message.reply(f"URL non valido: {raw_url}")
            continue
        try:
            parsed = urlparse(normalized)
            if not is_allowed_domain(parsed.netloc):
                await message.reply(f"Dominio non supportato: {parsed.netloc}")
                continue
        except Exception:
            await message.reply(f"Errore nel processare l'URL: {normalized}")
            continue
        site_type = get_site_type(normalized)
        if site_type == 'unsupported':
            await message.reply(f"❌ Sito non supportato: {normalized}")
            continue
        site_queues[site_type].append((normalized, user.id, message.chat.id))
        added += 1
        await message.reply(f"URL aggiunto in coda per {site_type}: {normalized}")
        # Se non c'è già un task attivo per questa tipologia, avvialo
        if site_type not in site_processing:
            site_processing[site_type] = asyncio.create_task(process_site_queue(site_type))
    if added:
        await message.reply(f"Totale link messi in coda: {added}")


def run_polling():
    async def on_startup():
        if ALLOWED_USERS:
            for uid in ALLOWED_USERS:
                try:
                    await bot.send_message(uid, "Il bot si è avviato e sono pronto a ricevere link.")
                except Exception as e:
                    logger.warning("Impossibile notificare l'utente %s: %s", uid, e)

    dp.include_router(router)

    async def _main():
        await dp.start_polling(bot, skip_updates=True, on_startup=on_startup)

    asyncio.run(_main())


if __name__ == "__main__":
    run_polling()
