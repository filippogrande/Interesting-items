"""Worker di scraping: consuma le code Redis, un task per sito.

Due garanzie nate dalla diagnosi di robustezza:

1. il loop non può morire per un errore di notifica: bastava un `send_message`
   fallito dopo l'ultimo item per uscire dal `while`, togliere il sito da
   `site_processing` e lasciare la coda piena e il bot muto;
2. se il task muore comunque, il watchdog lo rilancia finché la coda non è vuota.

Il delay fra uno scraping e il successivo è configurabile e non viene applicato
quando la coda è vuota (prima era fisso a 180s per item).
"""
import asyncio
import logging
import os

from . import messaging, queue_store
from .durations import (
    BETWEEN_SCRAPES_SECONDS,
    estimate_remaining_seconds,
    format_duration,
)
from .scrapers import OK, NOT_FOUND, ERROR

logger = logging.getLogger(__name__)

# Tentativi per item: 1 + i retry elencati in RETRY_BACKOFF_SECONDS.
# NOT_FOUND non si ritenta: l'annuncio non tornerebbe disponibile.
SCRAPE_MAX_ATTEMPTS = int(os.getenv("SCRAPE_MAX_ATTEMPTS", "3"))
RETRY_BACKOFF_SECONDS = [
    float(value) for value in os.getenv("RETRY_BACKOFF_SECONDS", "5,15").split(",") if value.strip()
]
# Ogni quanto il watchdog verifica che i worker siano vivi.
WATCHDOG_INTERVAL_SECONDS = int(os.getenv("WORKER_WATCHDOG_INTERVAL_SECONDS", "60"))

# Un task per sito: {site: asyncio.Task}
site_processing = {}


def _normalize_result(raw):
    """Uniforma il risultato di uno scraper a OK / NOT_FOUND / ERROR.

    Gli scraper nuovi ritornano già uno di questi stati; quelli vecchi (AliExpress)
    ritornano un bool.
    """
    if raw is True:
        return OK
    if raw is False:
        return ERROR
    return raw


async def run_scraper(site, url):
    """Esegue lo scraper del sito. Ritorna (status, motivo dell'errore o None)."""
    if site == 'vinted':
        from .scrapers.vinted import scrape_vinted
        return _normalize_result(await asyncio.to_thread(scrape_vinted, url)), None
    if site == 'aliexpress':
        from .scrapers.aliexpress import scrape_aliexpress
        return _normalize_result(await asyncio.to_thread(scrape_aliexpress, url)), None
    if site == 'wallapop':
        return ERROR, "funzione wallapop non ancora implementata"
    return ERROR, "sito non supportato"


def _backoff_after(attempt):
    if not RETRY_BACKOFF_SECONDS:
        return 0.0
    return RETRY_BACKOFF_SECONDS[min(attempt - 1, len(RETRY_BACKOFF_SECONDS) - 1)]


async def _send(bot, chat_id, text):
    try:
        await bot.send_message(chat_id, text)
    except Exception:
        # Un messaggio non recapitato non deve fermare la coda.
        logger.exception("Invio del messaggio fallito (chat_id=%s)", chat_id)


async def _process_item(site, item, bot):
    url = item.get("url")
    chat_id = item.get("chat_id")
    status, reason, attempt = ERROR, None, 0

    try:
        started = messaging.scraping_started(url)
        if started:
            await _send(bot, chat_id, started)

        while attempt < SCRAPE_MAX_ATTEMPTS:
            attempt += 1
            try:
                status, reason = await run_scraper(site, url)
            except Exception as exc:
                status, reason = ERROR, str(exc)
            if status != ERROR or attempt >= SCRAPE_MAX_ATTEMPTS:
                break
            backoff = _backoff_after(attempt)
            logger.warning(
                "Scraping fallito (%s, tentativo %d/%d): %s — riprovo fra %.0fs",
                url, attempt, SCRAPE_MAX_ATTEMPTS, reason, backoff,
            )
            if backoff > 0:
                await asyncio.sleep(backoff)
    finally:
        # Il prodotto è finito nel DB (se ok) o ha esaurito i tentativi: in ogni
        # caso non è più "in coda / in lavorazione".
        queue_store.unmark_pending(url)

    remaining = queue_store.total_queue_size(site)
    eta = format_duration(estimate_remaining_seconds(remaining))
    for text in messaging.item_result(status, url, reason, remaining, eta, attempt):
        await _send(bot, chat_id, text)


async def process_site_queue(site, bot):
    try:
        while True:
            item = queue_store.dequeue(site)
            if item is None:
                break
            try:
                await _process_item(site, item, bot)
            except Exception:
                # Rete di sicurezza: nessun item può fermare la coda.
                logger.exception("Errore imprevisto su un item della coda %s", site)
            # Pausa solo se in questo sito c'è ancora qualcosa da fare.
            if queue_store.total_queue_size(site) > 0:
                await asyncio.sleep(BETWEEN_SCRAPES_SECONDS)
    except Exception:
        # Es. Redis irraggiungibile: usciamo e sarà il watchdog a rilanciarci.
        logger.exception("Worker del sito %s terminato con errore", site)
    finally:
        site_processing.pop(site, None)


def ensure_worker(site, bot):
    """Avvia il worker del sito se non c'è (o se è morto). Ritorna il task."""
    current = site_processing.get(site)
    if current is not None and not current.done():
        return current
    task = asyncio.create_task(process_site_queue(site, bot))
    site_processing[site] = task
    return task


def resume_queues(bot):
    """All'avvio riprende i siti che hanno ancora item in coda. Ritorna la lista."""
    resumed = []
    for site in queue_store.sites_with_items():
        if site not in site_processing:
            ensure_worker(site, bot)
            resumed.append(site)
            print(f'Coda riavviata per {site}', flush=True)
    return resumed


async def _watchdog(bot):
    """Rilancia il worker di un sito se è morto con la coda ancora piena."""
    while True:
        await asyncio.sleep(WATCHDOG_INTERVAL_SECONDS)
        for site in queue_store.sites_with_items():
            current = site_processing.get(site)
            if current is None or current.done():
                logger.warning("Worker del sito %s non attivo con coda piena: lo rilancio", site)
                print(f'Watchdog: rilancio il worker per {site}', flush=True)
                ensure_worker(site, bot)


def start_watchdog(bot):
    return asyncio.create_task(_watchdog(bot))
