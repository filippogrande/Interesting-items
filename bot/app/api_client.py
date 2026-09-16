"""Client HTTP verso il Backend (BE).

Il bot NON accede mai al database: parla solo con l'API FastAPI.
Questo mantiene il BE come unico proprietario dello schema dati.
"""
import os
import requests

API_BASE = os.getenv("API_BASE", "http://app:8004")
TIMEOUT = int(os.getenv("API_TIMEOUT", "30"))


def _url(path: str) -> str:
    return f"{API_BASE.rstrip('/')}{path}"


def find_existing_product(url: str):
    """Controlla se l'URL esiste gia' nel DB (anti-duplicato).

    Ritorna il dict {found, product_id, product_title} oppure None se non trovato/errore.
    """
    try:
        resp = requests.get(
            _url("/api/sourceurls/lookup"), params={"url": url}, timeout=TIMEOUT
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("found"):
                return data
        return None
    except Exception:
        return None


def create_product(product_data: dict):
    """Crea un prodotto. Ritorna l'id oppure None."""
    resp = requests.post(_url("/api/products"), json=product_data, timeout=TIMEOUT)
    if resp.status_code != 201:
        return None
    return resp.json().get("id")


def add_image(image_data: dict) -> bool:
    resp = requests.post(_url("/api/images"), json=image_data, timeout=TIMEOUT)
    return resp.status_code == 201


def add_price(price_data: dict) -> bool:
    resp = requests.post(_url("/api/prices"), json=price_data, timeout=TIMEOUT)
    return resp.status_code == 201


def add_source_url(sourceurl_data: dict) -> bool:
    resp = requests.post(_url("/api/sourceurls"), json=sourceurl_data, timeout=TIMEOUT)
    return resp.status_code == 201


def internal_product_links(product_id: int, base_url: str):
    """Costruisce i link interni (UI + API) per un prodotto."""
    base = (base_url or "").rstrip("/")
    return f"{base}/dashboard/products/{product_id}", f"{base}/api/dashboard/products/{product_id}"
