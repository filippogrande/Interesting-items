"""Scraper per sito.

Ogni modulo espone ``scrape_<sito>(url)`` che ritorna uno **stato** (vedi costanti
qui sotto) invece di un semplice bool, così il bot può dare un messaggio utile:

- ``OK``        -> prodotto salvato correttamente
- ``NOT_FOUND`` -> annuncio non più disponibile (rimosso o venduto): l'utente va avvisato
- ``ERROR``     -> errore generico (rete, parsing, anti-bot, API, ...)
"""

OK = "ok"
NOT_FOUND = "not_found"
ERROR = "error"
