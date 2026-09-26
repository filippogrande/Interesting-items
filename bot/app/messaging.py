"""Testi dei messaggi del bot.

Tutta la policy "cosa scriviamo all'utente" sta qui: il worker e gli handler
decidono *quando* notificare, questo modulo decide *cosa* dire (e può decidere
di non dire niente ritornando None o una lista vuota).
"""
from .scrapers import OK, NOT_FOUND, ERROR


def enqueue_ack(site, url, position, eta):
    """Messaggi dopo l'accodamento di un link."""
    return [
        f"URL aggiunto in coda per {site}: {url}\n"
        f"Posizione in coda: {position}\n"
        f"Stima residua: circa {eta}"
    ]


def enqueue_summary(added):
    """Messaggio finale col totale dei link accodati nello stesso messaggio Telegram."""
    if not added:
        return []
    return [f"Totale link messi in coda: {added}"]


def scraping_started(url):
    """Messaggio di inizio scraping (None = non mandare nulla)."""
    return f"Inizio scraping: {url}"


def item_result(status, url, reason, remaining, eta, attempts):
    """Messaggi dopo lo scraping di un item: esito + stato della coda."""
    if status == OK:
        messages = [f"✅ Finito: {url}"]
    elif status == NOT_FOUND:
        messages = [f"🗑️ Annuncio non più disponibile (rimosso o venduto): {url}"]
    else:
        detail = f": {reason}" if reason else ""
        messages = [f"❌ Errore durante scraping{detail} — {url}"]

    if remaining > 0:
        messages.append(f"Rimangono {remaining} prodotti in coda — stima residua: circa {eta}")
    else:
        messages.append("Rimangono 0 prodotti in coda")
    return messages
