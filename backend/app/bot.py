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
import json
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
ALLOWED_TELEGRAM_USER_IDS = os.getenv("ALLOWED_TELEGRAM_USER_IDS")  # comma separated ints
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002")

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

SCRAPE_MAX_SECONDS = 10
BETWEEN_SCRAPES_SECONDS = 180



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
site_queues = defaultdict(deque)  # in-memory mirrors (used for quick access)
site_processing = {}  # {site_type: asyncio.Task}


def redis_queue_key(site: str) -> str:
    return f"scrape_queue:{site}"


def enqueue_to_redis(site: str, url: str, user_id: int, chat_id: int):
    key = redis_queue_key(site)
    payload = json.dumps({"url": url, "user_id": user_id, "chat_id": chat_id})
    redis_conn.rpush(key, payload)


def pop_from_redis(site: str) -> dict | None:
    key = redis_queue_key(site)
    raw = redis_conn.lpop(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        logger.exception("Invalid payload in redis queue for %s: %s", site, raw)
        return None


def redis_queue_length(site: str | None = None) -> int:
    if site is None:
        total = 0
        for k in redis_conn.keys("scrape_queue:*"):
            try:
                total += int(redis_conn.llen(k))
            except Exception:
                continue
        return total
    return int(redis_conn.llen(redis_queue_key(site)))


def total_queue_size(site: str | None = None) -> int:
    try:
        return redis_queue_length(site)
    except Exception:
        # fallback to in-memory representation
        if site is None:
            return sum(len(queue) for queue in site_queues.values())
        return len(site_queues[site])


def estimate_remaining_seconds(pending_items: int) -> int:
    if pending_items <= 0:
        return 0
    return pending_items * (SCRAPE_MAX_SECONDS + BETWEEN_SCRAPES_SECONDS)


def format_duration(seconds: int) -> str:
    if seconds <= 0:
        return "0s"
    minutes, secs = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if secs or not parts:
        parts.append(f"{secs}s")
    return " ".join(parts)

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
    """Pop items from Redis-backed list and process them sequentially.

    This keeps the queue persistent across restarts. Each item is a JSON
    object with keys: url, user_id, chat_id.
    """
    try:
        while True:
            item = pop_from_redis(site)
            if item is None:
                break
            url = item.get("url")
            user_id = item.get("user_id")
            chat_id = item.get("chat_id")
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

            remaining = total_queue_size(site)
            if remaining > 0:
                eta = format_duration(estimate_remaining_seconds(remaining))
                await bot.send_message(
                    chat_id,
                    f"Rimangono {remaining} prodotti in coda — stima residua: circa {eta}",
                )
            else:
                await bot.send_message(chat_id, "Rimangono 0 prodotti in coda")

            await asyncio.sleep(BETWEEN_SCRAPES_SECONDS)
    finally:
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
        # prima di aggiungere in coda, controlla se esiste già nel DB
        try:
            from storage.db import engine, SourceUrl
            from sqlmodel import Session, select
            with Session(engine) as session:
                existing = session.exec(select(SourceUrl).where(SourceUrl.url == normalized)).first()
                if existing:
                    product_id = existing.product_id
                    # costruisci link interno usando BASE_URL (configurabile via .env)
                    internal_ui = BASE_URL.rstrip('/') + f"/dashboard/products/{product_id}"
                    internal_api = BASE_URL.rstrip('/') + f"/api/dashboard/products/{product_id}"
                    await message.reply(
                        f"⚠️ Il prodotto è già presente nel database (id={product_id}).\nLo trovi qui: {internal_ui}\nAPI: {internal_api}")
                    continue
        except Exception:
            # in caso di errore nel controllo DB, loggare ma proseguire con l'aggiunta in coda
            logger.exception("Errore controllo duplicati URL")
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
        # push to persistent Redis-backed queue
        try:
            enqueue_to_redis(site_type, normalized, user.id, message.chat.id)
        except Exception:
            # fallback to in-memory queue if Redis unavailable
            site_queues[site_type].append((normalized, user.id, message.chat.id))
        added += 1
        queue_size = total_queue_size(site_type)
        eta = format_duration(estimate_remaining_seconds(queue_size))
        await message.reply(
            f"URL aggiunto in coda per {site_type}: {normalized}\n"
            f"Posizione in coda: {queue_size}\n"
            f"Stima residua: circa {eta}"
        )
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
        # ripristina eventuali code persistenti in Redis all'avvio
        try:
            keys = redis_conn.keys("scrape_queue:*")
            for k in keys:
                try:
                    site = k.decode().split(":", 1)[1] if isinstance(k, bytes) else str(k).split(":", 1)[1]
                    length = int(redis_conn.llen(k))
                    if length > 0 and site not in site_processing:
                        site_processing[site] = asyncio.create_task(process_site_queue(site))
                        logger.info("Riavviata coda persistente per sito %s (items=%d)", site, length)
                except Exception:
                    logger.exception("Errore nel ripristinare la chiave di coda %s", k)
        except Exception:
            logger.exception("Errore nel controllare le code persistenti in Redis")

    dp.include_router(router)

    async def _main():
        await dp.start_polling(bot, skip_updates=True, on_startup=on_startup)

    asyncio.run(_main())


if __name__ == "__main__":
    run_polling()
