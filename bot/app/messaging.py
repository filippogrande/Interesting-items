"""Testi dei messaggi del bot.

Tutta la policy "cosa scriviamo all'utente" sta qui: il worker e gli handler
decidono *quando* notificare, questo modulo decide *cosa* dire (e può decidere
di non dire niente ritornando None o una lista vuota).
"""
from .scrapers import OK, NOT_FOUND, ERROR


def _queue_label(site, size):
    """Le code sono separate per sito: l'etichetta dice sempre di quale coda parla."""
    return f"coda {site}: {size} link"


def enqueue_ack(site, queue_size, eta):
    """Un link accodato: un solo messaggio, senza URL.

    queue_size è la lunghezza della coda di QUEL sito (una coda per sito):
    è quella la coda in cui il link è entrato, non un totale globale.
    """
    return [f"🔗 Link in coda per {site} — {_queue_label(site, queue_size)} — stima circa {eta}"]


def enqueue_summary(added, queues):
    """Riepilogo unico quando il messaggio conteneva più link.

    Un messaggio con N link produce UNA sola risposta invece di N ack.
    `queues` è {site: (lunghezza coda, eta)} per i soli siti coinvolti in questo
    messaggio: se i link sono di siti diversi si vedono le code separate.
    Ritorna [] quando non c'è niente da riepilogare (0 o 1 link: in quel caso
    parla enqueue_ack).
    """
    if added <= 1:
        return []
    if len(queues) == 1:
        site, (size, eta) = next(iter(queues.items()))
        return [f"📥 {added} link in coda — {_queue_label(site, size)} — stima circa {eta}"]
    parts = [
        f"{_queue_label(site, size)} (circa {eta})"
        for site, (size, eta) in sorted(queues.items())
    ]
    return [f"📥 {added} link in coda — " + " — ".join(parts)]


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
