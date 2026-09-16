"""Scraper Vinted.

Nota architetturale: NON scrive sul database. Persiste i dati tramite le API
del BE (vedi bot/app/api_client.py).

Ritorna uno stato (OK / NOT_FOUND / ERROR) così il bot può dire all'utente se
l'annuncio non esiste più invece di mostrare un errore generico.

Delle immagini vengono tenute SOLO quelle dell'annuncio: la foto profilo del
venditore (e in generale gli avatar) va esclusa.
"""
import os
import re
import requests
import hashlib
import json
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, ElementTree
import traceback

from .. import api_client
from . import OK, NOT_FOUND, ERROR

# Vinted risponde 404 (a volte 410) per annunci rimossi o venduti.
NOT_FOUND_HTTP_STATUSES = {404, 410}

# Fallback: a volte la pagina "non trovato" arriva con HTTP 200.
NOT_FOUND_MARKERS = (
    "non trouv",
    "introuvable",
    "pagina non trovata",
    "página no encontrada",
    "not found",
    "nicht gefunden",
    "nie znaleziono",
)

# Token che indicano un'immagine NON di prodotto (foto profilo/avatar venditore).
AVATAR_TOKENS = (
    "avatar",
    "user",
    "profil",
    "member",
    "seller",
    "owner",
)


def get_item_id_from_url(url: str) -> str:
    match = re.search(r'/items?/(\d+)-', url)
    return match.group(1) if match else 'unknown'


def log_vinted(msg: str):
    entry = f'{datetime.now().isoformat()} {msg}'
    print(entry, flush=True)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'app_data')
    os.makedirs(data_dir, exist_ok=True)
    log_path = os.path.join(data_dir, 'log.txt')
    with open(log_path, 'a', encoding='utf-8') as logf:
        logf.write(entry + '\n')


def download_rendered_html(url: str, html_path: str):
    """Scarica l'HTML renderizzato della pagina annuncio.

    Ritorna ``(status, http_status)`` con status in {OK, NOT_FOUND, ERROR}.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log_vinted('Playwright non installato. Installa con: pip install playwright')
        return (ERROR, None)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            # NON usare 'networkidle': Vinted ricarica in continuo e va in timeout.
            response = page.goto(url, timeout=60000, wait_until="domcontentloaded")
            http_status = response.status if response is not None else None
            if http_status in NOT_FOUND_HTTP_STATUSES:
                log_vinted(f'HTTP {http_status}: annuncio non più disponibile ({url})')
                browser.close()
                return (NOT_FOUND, http_status)
            try:
                page.wait_for_selector("h1", timeout=15000)
            except Exception:
                pass
            page.wait_for_timeout(2500)  # lascia renderizzare banner e immagini lazy
            html = page.content()
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            browser.close()
        return (OK, http_status)
    except Exception as e:
        log_vinted(f'Errore Playwright: {e} - ' + traceback.format_exc())
        return (ERROR, None)


def _image_blob(img) -> str:
    """Testo su cui cercare indizi di "avatar": alt, testid, aria-label, classi."""
    parts = [
        img.get('alt') or '',
        img.get('data-testid') or '',
        img.get('aria-label') or '',
        ' '.join(img.get('class') or []),
    ]
    return ' '.join(parts).lower()


def _inside_seller_block(img) -> bool:
    """True se l'immagine sta dentro il blocco del venditore.

    Su Vinted il venditore è linkato come ``/member/<id>-<username>``; l'avatar
    sta normalmente dentro quel link o in contenitori con classi tipo "avatar".
    """
    for parent in img.parents:
        name = getattr(parent, 'name', None)
        if not name:
            continue
        if name == 'a':
            href = (parent.get('href') or '').lower()
            if '/member/' in href or '/users/' in href:
                return True
        classes = ' '.join(parent.get('class') or []).lower()
        if any(token in classes for token in ('avatar', 'member', 'seller', 'profile', 'user-card')):
            return True
    return False


def collect_product_images(soup):
    """Raccoglie SOLO le immagini dell'annuncio.

    Esclude la foto profilo/avatar del venditore. Se la pagina espone le foto
    dell'annuncio con ``data-testid="item-photo-…"`` ci si limita a quelle.
    """
    all_images = soup.find_all('img')
    tagged = [
        img for img in all_images
        if (img.get('data-testid') or '').lower().startswith('item-photo')
    ]
    candidates = tagged if tagged else all_images

    collected = []
    for img in candidates:
        if _inside_seller_block(img):
            log_vinted('Immagine scartata (blocco venditore)')
            continue
        if any(token in _image_blob(img) for token in AVATAR_TOKENS):
            log_vinted('Immagine scartata (sembra un avatar)')
            continue

        src = img.get('src') or img.get('data-src') or img.get('data-original')
        if not src:
            continue
        if src.startswith('//'):
            src = 'https:' + src
        elif src.startswith('/'):
            src = 'https://www.vinted.it' + src
        try:
            parsed = urlparse(src)
            netloc = parsed.netloc.lower()
        except Exception:
            continue
        if not (
            'images1.vinted.net' in netloc
            or 'images.vinted.net' in netloc
            or 'images.vinted' in netloc
        ):
            continue
        path = parsed.path.lower()
        if '/t/' in path or '/f800/' in src or re.search(r'/f\d+/', path):
            alt = (img.get('alt') or '').strip()
            collected.append((src, alt))
    return collected


def scrape_vinted(url: str):
    """Scrapa un annuncio Vinted. Ritorna OK / NOT_FOUND / ERROR."""
    log_vinted(f'Inizio scraping per URL: {url}')
    item_id = get_item_id_from_url(url)
    html_path = f'tmp/item_{item_id}_rendered.html'
    xml_path = f'storage/product_{item_id}.xml'
    images_dir = f'images/product_{item_id}'

    os.makedirs('tmp', exist_ok=True)
    os.makedirs('storage', exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)

    log_vinted(f'Scarico HTML renderizzato da {url}...')
    status, http_status = download_rendered_html(url, html_path)
    if status != OK:
        return status

    title = ''
    description = ''
    price_val = 0.0
    condition = ''
    image_links = []
    image_filenames = []

    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
    except Exception as e:
        log_vinted(f'Errore apertura HTML: {html_path} ({e})')
        return ERROR

    soup = BeautifulSoup(html, 'html.parser')

    h1 = soup.find('h1')
    if h1:
        title = h1.get_text(strip=True)
    log_vinted(f'Parsed title: "{title}"')

    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        description = meta_desc.get('content').strip()
    else:
        p = None
        if h1:
            p = h1.find_next('p')
        if not p:
            p = soup.find('p')
        if p:
            description = p.get_text(strip=True)

    text = soup.get_text(' ', strip=True)
    price_match = re.search(r'(\d+[\.,]\d{2})\s*€', text)
    if price_match:
        price_val = float(price_match.group(1).replace(',', '.'))

    cond_label = soup.find(string=re.compile(r'Condizion|Condizioni', re.I))
    if cond_label:
        parent = cond_label.parent
        next_span = parent.find_next('span') if parent else None
        if next_span:
            condition = next_span.get_text(strip=True)
        else:
            sp = soup.find('span', string=re.compile(r'Ottim|Buon|Nuov|Danneggi', re.I))
            if sp:
                condition = sp.get_text(strip=True)

    img_urls = collect_product_images(soup)

    seen = set()
    image_links = []
    image_alts = []
    for u, alt in img_urls:
        if u in seen:
            continue
        seen.add(u)
        image_links.append(u)
        image_alts.append(alt)

    log_vinted(f'Immagini di prodotto trovate: {len(image_links)}')

    image_filenames = []
    images_meta = []
    for idx, img_url in enumerate(image_links, start=1):
        try:
            resp = requests.get(img_url, stream=True, timeout=20)
            if resp.status_code == 200:
                hasher = hashlib.sha1()
                chunks = []
                for chunk in resp.iter_content(8192):
                    if not chunk:
                        continue
                    hasher.update(chunk)
                    chunks.append(chunk)
                checksum = hasher.hexdigest()
                parsed = urlparse(img_url)
                base = os.path.basename(parsed.path)
                base = re.sub(r'[^A-Za-z0-9_.-]', '_', base) or f'image_{idx}'
                ext = os.path.splitext(base)[1]
                if not ext or len(ext) > 5:
                    ext = '.jpg'
                fname = f'{idx}_{checksum[:8]}_{base}'
                if not fname.lower().endswith(ext.lower()):
                    fname = fname + ext
                fpath = os.path.join(images_dir, fname)
                with open(fpath, 'wb') as imgf:
                    for c in chunks:
                        imgf.write(c)
                size_bytes = os.path.getsize(fpath)
                image_filenames.append(fname)
                log_vinted(f'Immagine scaricata: {fname}')
                inferred = 'product_image' if 'images1.vinted.net' in img_url or 'images.vinted' in img_url else 'asset'
                images_meta.append({
                    'filename': os.path.join('images', f'product_{item_id}', fname),
                    'url': img_url,
                    'checksum': checksum,
                    'size_bytes': size_bytes,
                    'alt': image_alts[idx-1] if idx-1 < len(image_alts) else '',
                    'inferred_type': inferred
                })
            else:
                log_vinted(f'Impossibile scaricare immagine {img_url}: status {resp.status_code}')
        except Exception as e:
            log_vinted(f'Errore download immagine {img_url}: {e}')

    try:
        mapping_path = os.path.join(images_dir, 'images_info.json')
        with open(mapping_path, 'w', encoding='utf-8') as mf:
            json.dump(images_meta, mf, ensure_ascii=False, indent=2)
    except Exception as e:
        log_vinted(f'Errore salvataggio mapping immagini: {e}')

    try:
        root = Element('product')
        SubElement(root, 'id').text = item_id
        SubElement(root, 'url').text = url
        SubElement(root, 'title').text = title or ''
        SubElement(root, 'description').text = description or ''
        SubElement(root, 'price').text = str(price_val)
        SubElement(root, 'condition').text = condition or ''
        imgs_el = SubElement(root, 'images')
        for meta in images_meta:
            i_el = SubElement(imgs_el, 'image')
            SubElement(i_el, 'filename').text = meta.get('filename')
            SubElement(i_el, 'url').text = meta.get('url')
            SubElement(i_el, 'checksum').text = meta.get('checksum')
            SubElement(i_el, 'size_bytes').text = str(meta.get('size_bytes'))
            SubElement(i_el, 'alt').text = meta.get('alt') or ''
        ElementTree(root).write(xml_path, encoding='utf-8', xml_declaration=True)
    except Exception as e:
        log_vinted(f'Errore salvataggio XML: {e}')

    # Nessun titolo: distinguere "annuncio non più disponibile" da un errore vero.
    if not title:
        lowered = (text or '').lower()
        if any(marker in lowered for marker in NOT_FOUND_MARKERS):
            log_vinted('Pagina di annuncio non trovato: rimosso o venduto.')
            return NOT_FOUND
        log_vinted('Titolo non trovato: pagina non renderizzata correttamente.')
        return ERROR

    try:
        product_data = {
            "title": title,
            "description": description,
            "brand": None,
            "origin_type": "vinted",
            "product_metadata": None,
            "category_id": None,
            "archived": False,
        }

        product_id = api_client.create_product(product_data)
        if product_id is None:
            log_vinted('Errore API creazione prodotto')
            return ERROR

        for fname, img_url in zip(image_filenames, image_links):
            image_data = {
                "product_id": product_id,
                "filename": os.path.join(images_dir, fname),
                "width": None, "height": None,
                "size_bytes": None, "checksum": None
            }
            if not api_client.add_image(image_data):
                log_vinted(f'Errore API creazione immagine per {img_url}')

        price_data = {
            "product_id": product_id, "amount": price_val, "currency": "EUR",
            "price_category": None, "condition": None, "platform": None, "sold": False
        }
        if not api_client.add_price(price_data):
            log_vinted('Errore API creazione prezzo')

        sourceurl_data = {"product_id": product_id, "url": url, "domain": None}
        if not api_client.add_source_url(sourceurl_data):
            log_vinted('Errore API creazione sourceurl')

        log_vinted(f'Dati salvati. Prodotto id={product_id}, immagini={len(image_filenames)}')
    except Exception as e:
        log_vinted(f'Errore chiamate API: {e}')
        return ERROR

    return OK
