"""Testi dei messaggi del bot.

Tutta la policy "cosa scriviamo all'utente" sta qui: il worker e gli handler
decidono *quando* notificare, questo modulo decide *cosa* dire (e può decidere
di non dire niente ritornando None o una lista vuota).
"""
from .scrapers import OK, NOT_FOUND, ERROR


def enqueue_ack(site, url, position, eta):
    """Un solo messaggio per link accodato, senza URL: l'utente sa cosa ha mandato."""
    return [f"🔗 Link in coda per {site} — posizione {position} — stima circa {eta}"]


def enqueue_summary(added):
    """Nessun messaggio di totale: la posizione è già nell'ack di ogni link."""
    return []


def scraping_started(url):
    """Niente messaggio di inizio: lo scraping si deduce dall'esito."""
    return None


def item_result(status, url, reason, remaining, eta, attempts):
    """Un solo messaggio per item: esito + stato della coda accorpato.

    L'URL compare solo quando serve: esito OK no (l'utente sa cos'ha mandato),
    annuncio sparito/errore sì (per capire quale link è andato male).
    """
    if status == OK:
        head = "✅ Aggiunto al catalogo"
    elif status == NOT_FOUND:
        head = f"🗑️ Annuncio non più disponibile (rimosso o venduto): {url}"
    else:
        detail = f": {reason}" if reason else ""
        head = f"❌ Errore durante lo scraping{detail} — {url}"
        if attempts > 1:
            head += f" (dopo {attempts} tentativi)"

    if remaining > 0:
        return [f"{head} — restano {remaining} in coda (circa {eta})"]
    return [f"{head} — coda vuota"]
