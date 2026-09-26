"""Coda di scraping e stato "in coda / in lavorazione" su Redis.

Estratto da main.py per essere condiviso fra gli handler (che accodano) e il
worker (che consuma) senza import circolari.
"""
import json
import logging
import os
from collections import defaultdict, deque

from dotenv import load_dotenv
from redis import Redis

load_dotenv()

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

redis_conn = Redis.from_url(REDIS_URL)

# Set Redis con gli URL "in coda o in lavorazione".
# Serve perché il controllo anti-duplicato sul DB vede solo i prodotti GIÀ SALVATI:
# un link ancora in coda (o in fase di scraping) non è nel DB e verrebbe riaccodato.
PENDING_SET_KEY = "scrape_pending"

QUEUE_KEY_PREFIX = "scrape_queue:"

# Fallback in memoria, usato solo se Redis non risponde all'accodamento.
site_queues = defaultdict(deque)


def queue_key(site):
    return f"{QUEUE_KEY_PREFIX}{site}"


def _site_from_key(key):
    text = key.decode() if isinstance(key, bytes) else str(key)
    return text.split(":", 1)[1] if ":" in text else text


# --- Stato "in coda / in lavorazione" (anti-duplicato) ---

def mark_pending(url):
    try:
        redis_conn.sadd(PENDING_SET_KEY, url)
    except Exception:
        logger.exception("Impossibile marcare come pending: %s", url)


def unmark_pending(url):
    try:
        redis_conn.srem(PENDING_SET_KEY, url)
    except Exception:
        logger.exception("Impossibile rimuovere il pending: %s", url)


def is_pending(url):
    try:
        return bool(redis_conn.sismember(PENDING_SET_KEY, url))
    except Exception:
        # se Redis non risponde non blocchiamo l'utente
        logger.exception("Impossibile verificare il pending: %s", url)
        return False


def rebuild_pending_set():
    """Ricostruisce il set dei pending dalle code Redis.

    All'avvio le voci "in lavorazione" di un run interrotto (crash/riavvio) non
    esistono più: ricostruire il set dalle sole code evita di lasciare un URL
    bloccato per sempre come pending.
    """
    try:
        redis_conn.delete(PENDING_SET_KEY)
        for k in redis_conn.keys(f"{QUEUE_KEY_PREFIX}*"):
            for raw in redis_conn.lrange(k, 0, -1):
                try:
                    payload = json.loads(raw)
                    url = payload.get("url")
                    if url:
                        redis_conn.sadd(PENDING_SET_KEY, url)
                except Exception:
                    continue
        count = redis_conn.scard(PENDING_SET_KEY)
        logger.info("Set pending ricostruito dalle code (%d voci)", count)
        # print (non logger) per vederlo in `docker compose logs bot` senza configurare logging
        print(f'Set pending ricostruito dalle code ({count} voci)', flush=True)
    except Exception:
        logger.exception("Errore nella ricostruzione del set pending")


# --- Coda persistente su Redis (una lista per sito) ---

def enqueue(site, url, user_id, chat_id):
    payload = {"url": url, "user_id": user_id, "chat_id": chat_id}
    try:
        redis_conn.rpush(queue_key(site), json.dumps(payload))
    except Exception:
        logger.exception("Redis non disponibile, accodo solo in memoria: %s", url)
        site_queues[site].append(payload)


def dequeue(site):
    raw = redis_conn.lpop(queue_key(site))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        logger.exception("Payload non valido nella coda %s: %s", site, raw)
        return None


def queue_length(site=None):
    if site is None:
        total = 0
        for k in redis_conn.keys(f"{QUEUE_KEY_PREFIX}*"):
            try:
                total += int(redis_conn.llen(k))
            except Exception:
                continue
        return total
    return int(redis_conn.llen(queue_key(site)))


def total_queue_size(site=None):
    try:
        return queue_length(site)
    except Exception:
        if site is None:
            return sum(len(queue) for queue in site_queues.values())
        return len(site_queues[site])


def sites_with_items():
    """Nomi dei siti con almeno un item in coda (avvio del bot e watchdog)."""
    sites = []
    try:
        for k in redis_conn.keys(f"{QUEUE_KEY_PREFIX}*"):
            try:
                if int(redis_conn.llen(k)) > 0:
                    sites.append(_site_from_key(k))
            except Exception:
                continue
    except Exception:
        logger.exception("Errore nella lettura delle code Redis")
    return sites
