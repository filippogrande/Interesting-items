"""Stime e formattazione delle durate usate nei messaggi del bot."""
import os

# Budget di tempo attribuito a un singolo scraping quando stimiamo la coda.
SCRAPE_MAX_SECONDS = int(os.getenv("SCRAPE_MAX_SECONDS", "5"))

# Pausa fra uno scraping e il successivo.
# Prima era fissa a 180s: ~3 minuti per prodotto anche a sistema sano
# (8 item = ~25 min). Ora è configurabile e non si applica a coda vuota.
BETWEEN_SCRAPES_SECONDS = int(os.getenv("BETWEEN_SCRAPES_SECONDS", "20"))


def estimate_remaining_seconds(pending_items):
    if pending_items <= 0:
        return 0
    return pending_items * (SCRAPE_MAX_SECONDS + BETWEEN_SCRAPES_SECONDS)


def format_duration(seconds):
    """Durata in minuti, senza secondi: "22min", "1h 20min".

    Si arrotonda per eccesso: sotto il minuto si dice comunque "1min".
    """
    if seconds <= 0:
        return "0min"
    minutes = -(-int(seconds) // 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h {minutes}min" if minutes else f"{hours}h"
    return f"{minutes}min"
