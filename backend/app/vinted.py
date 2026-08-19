import os
import re
import requests
import hashlib
import json
from urllib.parse import urlparse, quote
from bs4 import BeautifulSoup
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, ElementTree
import traceback

from storage import db as storage_db

API_BASE = os.getenv("API_BASE", "http://localhost:8004")


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
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log_vinted('Playwright non installato. Installa con: pip install playwright')
        return False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            # NON usare 'networkidle': Vinted ricarica in continuo e va in timeout.
            page.goto(url, timeout=60000, wait_until="domcontentloaded")
            try:
                page.wait_for_selector("h1", timeout=15000)
            except Exception:
                pass
            page.wait_for_timeout(2500)  # lascia renderizzare banner e immagini lazy
            html = page.content()
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            browser.close()
        return True
    except Exception as e:
        log_vinted(f'Errore Playwright: {e} - ' + traceback.format_exc())
        return False


def _create_product(product_data: dict):
    resp = requests.post(f"{API_BASE}/api/products", json=product_data, timeout=30)
    if resp.status_code != 201:
        log_vinted(f'Errore API creazione prodotto: {resp.status_code} {resp.text}')
        return None
    return resp.json()["id"]


def scrape_vinted(url: str):
    log_vinted(f'Inizio scraping per URL: {url}')
    item_id = get_item_id_from_url(url)
    html_path = f'tmp/item_{item_id}_rendered.html'
    xml_path = f'storage/product_{item_id}.xml'
    images_dir = f'images/product_{item_id}'

    os.makedirs('tmp', exist_ok=True)
    os.makedirs('storage', exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)

    try:
        storage_db.init_db()
    except Exception:
        pass

    log_vinted(f'Scarico HTML renderizzato da {url}...')
    ok = download_rendered_html(url, html_path)
    if not ok:
        log_vinted('Errore nel download HTML.')
        return False

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
        return False

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

    cond = None
    cond_label = soup.find(string=re.compile(r'Condizion|Condizioni', re.I))
    if cond_label:
        next_span = None
        parent = cond_label.parent
        if parent:
            next_span = parent.find_next('span')
        if next_span:
            condition = next_span.get_text(strip=True)
        else:
            sp = soup.find('span', string=re.compile(r'Ottim|Buon|Nuov|Danneggi', re.I))
            if sp:
                condition = sp.get_text(strip=True)

    img_urls = []
    for img in soup.find_all('img'):
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
            netloc = ''
        if 'images1.vinted.net' in netloc or 'images.vinted.net' in netloc or 'images.vinted' in netloc:
            path = parsed.path.lower()
            if '/t/' in path or '/f800/' in src or re.search(r'/f\d+/', path):
                alt = (img.get('alt') or '').strip()
                img_urls.append((src, alt))

    seen = set()
    image_links = []
    image_alts = []
    for u, alt in img_urls:
        if u in seen:
            continue
        seen.add(u)
        image_links.append(u)
        image_alts.append(alt)

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

    # Se non abbiamo un titolo la pagina non e' stata renderizzata: errore.
    if not title:
        log_vinted('Titolo non trovato: pagina non renderizzata correttamente.')
        return False

    try:
        product_data = {
            "url": url,
            "title": title,
            "description": description,
            "brand": None,
            "origin_type": "vinted",
            "product_metadata": None,
            "category_id": None,
            "archived": False,
        }

        product_id = _create_product(product_data)
        if product_id is None:
            return False

        for fname, img_url in zip(image_filenames, image_links):
            image_data = {
                "product_id": product_id,
                "filename": os.path.join(images_dir, fname),
                "width": None, "height": None,
                "size_bytes": None, "checksum": None
            }
            img_resp = requests.post(f"{API_BASE}/api/images", json=image_data, timeout=30)
            if img_resp.status_code != 201:
                log_vinted(f'Errore API creazione immagine: {img_resp.status_code} {img_resp.text}')

        price_data = {
            "product_id": product_id, "amount": price_val, "currency": "EUR",
            "price_category": None, "condition": None, "platform": None, "sold": False
        }
        price_resp = requests.post(f"{API_BASE}/api/prices", json=price_data, timeout=30)
        if price_resp.status_code != 201:
            log_vinted(f'Errore API creazione prezzo: {price_resp.status_code} {price_resp.text}')

        sourceurl_data = {"product_id": product_id, "url": url, "domain": None}
        sourceurl_resp = requests.post(f"{API_BASE}/api/sourceurls", json=sourceurl_data, timeout=30)
        if sourceurl_resp.status_code != 201:
            log_vinted(f'Errore API creazione sourceurl: {sourceurl_resp.status_code} {sourceurl_resp.text}')

        log_vinted(f'Dati salvati. Prodotto id={product_id}, immagini={len(image_filenames)}')
    except Exception as e:
        log_vinted(f'Errore chiamate API: {e}')
        return False

    return True
