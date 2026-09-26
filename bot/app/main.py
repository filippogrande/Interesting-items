"""Bot Telegram: riceve link, controlla i duplicati via API, accoda e scrapa.

Nota architetturale: questo componente NON accede al database. Tutto passa
attraverso il BE (FastAPI) tramite app/api_client.py.

In questo modulo restano gli handler Telegram e l'orchestrazione: la coda Redis
sta in queue_store.py, il worker di scraping in worker.py, i testi dei messaggi
in messaging.py.
"""
import os
import re
import logging
import asyncio
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

from aiogram import Bot, Dispatcher, types, Router
from aiogram.filters import Command
from dotenv import load_dotenv

from . import api_client, messaging, queue_store, worker
from .durations import estimate_remaining_seconds, format_duration

load_dotenv()

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
ALLOWED_TELEGRAM_USER_IDS = os.getenv("ALLOWED_TELEGRAM_USER_IDS")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002")

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


def is_allowed_domain(netloc):
    host = netloc.split(':')[0].lower()
    for d in ALLOWED_DOMAINS:
        if host == d or host.endswith('.' + d):
            return True
    return False


def normalize_url(raw_url):
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


def is_authorized(user_id):
    if ALLOWED_USERS is None:
        return True
    return user_id in ALLOWED_USERS


def get_site_type(url):
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


async def _reply_all(message, texts):
    for text in texts:
        await message.reply(text)


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
    seen_in_message = set()  # dedup: stesso link ripetuto nello stesso messaggio
    for raw_url in urls:
        normalized = normalize_url(raw_url)
        if not normalized:
            await message.reply(f"URL non valido: {raw_url}")
            continue

        if normalized in seen_in_message:
            await message.reply(f"⚠️ Link ripetuto nello stesso messaggio, ignorato: {normalized}")
            continue
        seen_in_message.add(normalized)

        # Anti-duplicato 1) già salvato nel DB (prodotto esistente)
        existing = api_client.find_existing_product(normalized)
        if existing:
            product_id = existing.get("product_id")
            internal_ui, internal_api = api_client.internal_product_links(product_id, BASE_URL)
            await message.reply(
                f"⚠️ Il prodotto è già presente nel database (id={product_id}).\n"
                f"Lo trovi qui: {internal_ui}\nAPI: {internal_api}"
            )
            continue

        # Anti-duplicato 2) già in coda o in lavorazione
        if queue_store.is_pending(normalized):
            await message.reply(f"⚠️ Link già in coda o in lavorazione, non lo riaccodo: {normalized}")
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

        queue_store.enqueue(site_type, normalized, user.id, message.chat.id)
        queue_store.mark_pending(normalized)
        added += 1

        queue_size = queue_store.total_queue_size(site_type)
        eta = format_duration(estimate_remaining_seconds(queue_size))
        await _reply_all(message, messaging.enqueue_ack(site_type, normalized, queue_size, eta))
        worker.ensure_worker(site_type, bot)

    if added:
        await _reply_all(message, messaging.enqueue_summary(added))


def run_polling():
    async def on_startup():
        print('Bot avviato: notifico gli utenti e riprendo le code persistenti...', flush=True)
        if ALLOWED_USERS:
            for uid in ALLOWED_USERS:
                try:
                    await bot.send_message(uid, "Il bot si è avviato e sono pronto a ricevere link.")
                except Exception as e:
                    logger.warning("Impossibile notificare l'utente %s: %s", uid, e)
        # ricostruisce lo stato "in coda / in lavorazione" dalle code persistenti
        queue_store.rebuild_pending_set()
        resumed = worker.resume_queues(bot)
        # watchdog: rilancia il worker di un sito se muore con la coda ancora piena
        worker.start_watchdog(bot)
        print(f'Avvio completato: code in lavorazione={len(resumed)}', flush=True)

    dp.include_router(router)
    # IMPORTANTE (aiogram v3): gli hook di avvio NON si passano a `start_polling`,
    # che ignora il parametro. Vanno registrati sull'oggetto `dp.startup`.
    # Senza questa registrazione il bot non notificava l'avvio e, soprattutto,
    # NON riprendeva le code in Redis dopo un riavvio: restavano piene e mute
    # finché non arrivava un nuovo link (che è handle_message a far ripartire).
    dp.startup.register(on_startup)

    async def _main():
        await dp.start_polling(bot, skip_updates=True)

    asyncio.run(_main())


if __name__ == "__main__":
    run_polling()
