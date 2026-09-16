"""Bot Telegram: riceve link, controlla i duplicati via API, accoda e scrapa.

Nota architetturale: questo componente NON accede al database. Tutto passa
attraverso il BE (FastAPI) tramite app/api_client.py.
"""
import os
import re
import logging
import asyncio
import json
from collections import defaultdict, deque
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

from aiogram import Bot, Dispatcher, types, Router
from aiogram.filters import Command
from redis import Redis
from dotenv import load_dotenv

from . import api_client

load_dotenv()

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
ALLOWED_TELEGRAM_USER_IDS = os.getenv("ALLOWED_TELEGRAM_USER_IDS")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002")

redis_conn = Redis.from_url(REDIS_URL)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()

URL_RE = re.compile(r"https?://[\w\-.:/?#\[\]@!$&'()*+,;=%]+")

DEFAULT_ALLOWED_DOMAINS = [
    "vinted.it",
    "wallapop.com",
    "it.wallapop.com",
    "subito.it",
    "ebay.it",
    "aliexpress.com",
    "it.aliexpress.com",
]

SCRAPE_MAX_SECONDS = 10
BETWEEN_SCRAPES_SECONDS = 180


def parse_allowed_user_ids(env_value):
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
            logger.warning("Invalid allowed user id: %s", part)
    return ids


ALLOWED_USERS = parse_allowed_user_ids(ALLOWED_TELEGRAM_USER_IDS)
if ALLOWED_USERS is None:
    logger.warning("ALLOWED_TELEGRAM_USER_IDS not set — bot accepts links from any user.")


def parse_allowed_domains(env_value):
    if not env_value:
        return []
    return [p.strip().lower() for p in env_value.split(",") if p.strip()]


def build_allowed_domains(env_value):
    merged, seen = [], set()
    for domain in DEFAULT_ALLOWED_DOMAINS + parse_allowed_domains(env_value):
        if domain not in seen:
            merged.append(domain)
            seen.add(domain)
    return merged


ALLOWED_DOMAINS = build_allowed_domains(os.getenv("ALLOWED_DOMAINS"))


def is_allowed_domain(netloc: str) -> bool:
    host = netloc.split(':')[0].lower()
    for d in ALLOWED_DOMAINS:
        if host == d or host.endswith('.' + d):
            return True
    return False


def normalize_url(raw_url: str):
    try:
        p = urlparse(raw_url)
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.netloc:
        return None
    qsl = parse_qsl(p.query, keep_blank_values=True)
    filtered = [(k, v) for (k, v) in qsl if not (k.startswith('utm_') or k in ('fbclid', 'gclid'))]
    filtered.sort()
    new_query = urlencode(filtered, doseq=True)
    netloc = p.netloc.lower()
    if netloc.endswith(':80') and p.scheme == 'http':
        netloc = netloc[:-3]
    if netloc.endswith(':443') and p.scheme == 'https':
        netloc = netloc[:-4]
    path = p.path.rstrip('/') or '/'
    return urlunparse((p.scheme, netloc, path, '', new_query, ''))


def is_authorized(user_id: int) -> bool:
    if ALLOWED_USERS is None:
        return True
    return user_id in ALLOWED_USERS


def get_site_type(url: str) -> str:
    try:
        netloc = urlparse(url).netloc.lower()
        if 'vinted' in netloc:
            return 'vinted'
        elif 'wallapop' in netloc:
            return 'wallapop'
        elif 'aliexpress' in netloc:
            return 'aliexpress'
        return 'unsupported'
    except Exception:
        return 'unsupported'


# --- Coda persistente su Redis (una lista per sito) ---
site_queues = defaultdict(deque)
site_processing = {}


def redis_queue_key(site: str) -> str:
    return f"scrape_queue:{site}"


def enqueue_to_redis(site: str, url: str, user_id: int, chat_id: int):
    redis_conn.rpush(redis_queue_key(site), json.dumps({"url": url, "user_id": user_id, "chat_id": chat_id}))


def pop_from_redis(site: str):
    raw = redis_conn.lpop(redis_queue_key(site))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        logger.exception("Invalid payload in redis queue for %s: %s", site, raw)
        return None


def redis_queue_length(site=None) -> int:
    if site is None:
        total = 0
        for k in redis_conn.keys("scrape_queue:*"):
            try:
                total += int(redis_conn.llen(k))
            except Exception:
                continue
        return total
    return int(redis_conn.llen(redis_queue_key(site)))


def total_queue_size(site=None) -> int:
    try:
        return redis_queue_length(site)
    except Exception:
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


async def process_site_queue(site: str):
    try:
        while True:
            item = pop_from_redis(site)
            if item is None:
                break
            url = item.get("url")
            chat_id = item.get("chat_id")
            try:
                await bot.send_message(chat_id, f"Inizio scraping: {url}")
                if site == 'vinted':
                    from .scrapers.vinted import scrape_vinted
                    result = await asyncio.to_thread(scrape_vinted, url)
                elif site == 'wallapop':
                    await bot.send_message(chat_id, "❌ Funzione wallapop non ancora implementata.")
                    result = False
                elif site == 'aliexpress':
                    try:
                        from .scrapers.aliexpress import scrape_aliexpress
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
                await bot.send_message(chat_id, f"Rimangono {remaining} prodotti in coda — stima residua: circa {eta}")
            else:
                await bot.send_message(chat_id, "Rimangono 0 prodotti in coda")

            await asyncio.sleep(BETWEEN_SCRAPES_SECONDS)
    finally:
        site_processing.pop(site, None)


@router.message(Command(commands=["start", "help"]))
async def cmd_start(message: types.Message):
    await message.answer("Ciao — invia un link di prodotto e lo processerò. Assicurati di essere autorizzato.")


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

        # Anti-duplicato: chiede al BE (niente accesso diretto al DB)
        existing = api_client.find_existing_product(normalized)
        if existing:
            product_id = existing.get("product_id")
            internal_ui, internal_api = api_client.internal_product_links(product_id, BASE_URL)
            await message.reply(
                f"⚠️ Il prodotto è già presente nel database (id={product_id}).\n"
                f"Lo trovi qui: {internal_ui}\nAPI: {internal_api}"
            )
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

        try:
            enqueue_to_redis(site_type, normalized, user.id, message.chat.id)
        except Exception:
            site_queues[site_type].append((normalized, user.id, message.chat.id))
        added += 1
        queue_size = total_queue_size(site_type)
        eta = format_duration(estimate_remaining_seconds(queue_size))
        await message.reply(
            f"URL aggiunto in coda per {site_type}: {normalized}\n"
            f"Posizione in coda: {queue_size}\n"
            f"Stima residua: circa {eta}"
        )
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
