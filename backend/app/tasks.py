import time
import logging
import requests
from bs4 import BeautifulSoup
import json
import os
import re
import hashlib
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


def _safe_filename_from_url(url: str) -> str:
    parsed = urlparse(url)
    slug = parsed.path.strip('/').replace('/', '-') or 'item'
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    h = hashlib.sha1(url.encode('utf-8')).hexdigest()[:12]
    return f"{ts}-{slug}-{h}.json"


def _extract_json_from_script_text(text: str):
    objs = []
    for m in re.finditer(r'\{', text):
        i = m.start()
        window = text[max(0, i - 200): i + 800]
        if not re.search(r'"photos"|"images"|"price"|"item"|"offers"|"items"', window):
            continue
        depth = 0
        j = i
        while j < len(text):
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
                if depth == 0:
                    try:
                        cand = text[i:j + 1]
                        obj = json.loads(cand)
                        objs.append(obj)
                    except Exception:
                        pass
                    break
            j += 1
    return objs


def _gather_json_objects(soup: BeautifulSoup):
    results = []
    for script in soup.find_all('script'):
        txt = script.string or ''
        if not txt or len(txt) < 200:
            continue
        try:
            objs = _extract_json_from_script_text(txt)
            results.extend(objs)
        except Exception:
            continue
    return results


def _find_in_obj(obj, keys):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys:
                yield v
            for sub in _find_in_obj(v, keys):
                yield sub
    elif isinstance(obj, list):
        for item in obj:
            for sub in _find_in_obj(item, keys):
                yield sub


def _extract_price_from_vinted_objects(json_objs):
    for o in json_objs:
        for candidate in _find_in_obj(o, {'price', 'price_amount', 'amount', 'total_item_price', 'service_fee'}):
            try:
                if isinstance(candidate, dict):
                    for k in ('amount', 'price', 'value'):
                        if k in candidate and candidate.get(k):
                            return (str(candidate.get(k)), candidate.get('currency') or candidate.get('currency_code') or candidate.get('currencyCode'))
                elif isinstance(candidate, (int, float)):
                    return (str(candidate), None)
                elif isinstance(candidate, str) and re.search(r'\d', candidate):
                    return (candidate, None)
            except Exception:
                continue
    return (None, None)


def _collect_vinted_photo_urls(json_objs, base_url=''):
    photos = []
    for o in json_objs:
        for candidate in _find_in_obj(o, {'photos', 'photos_urls', 'images'}):
            if isinstance(candidate, list):
                for it in candidate:
                    if isinstance(it, dict):
                        urlv = it.get('full_size_url') or it.get('full') or it.get('url') or it.get('image_url')
                        img_no = it.get('image_no') or it.get('imageNo') or 0
                        is_main = bool(it.get('is_main') or it.get('isMain'))
                        if urlv:
                            photos.append((is_main, int(img_no or 0), urljoin(base_url, urlv)))
                    elif isinstance(it, str):
                        photos.append((False, 0, urljoin(base_url, it)))
    photos.sort(key=lambda x: (0 if x[0] else 1, x[1]))
    out = []
    seen = set()
    for _, _, u in photos:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _filter_product_images(urls):
    out = []
    for u in urls:
        if not u:
            continue
        if 'marketplace-web-assets' in u or '/assets/' in u or u.endswith('.svg'):
            continue
        out.append(u)
    # prefer vinted hosts first
    out.sort(key=lambda x: (0 if ('vinted.net' in x or 'vinted.com' in x) else 1))
    return out


def scrape_job(url: str, sender_id=None, chat_id=None):
    """
    Estrae TUTTO quello che trova dalla pagina (meta, immagini, JSON inline, XHR Playwright, ecc)
    e salva un file YAML con ipotesi su cosa potrebbe essere ogni campo.
    """
    import yaml
    from bs4 import BeautifulSoup
    data = {}
    headers = {"User-Agent": os.getenv('SCRAPER_USER_AGENT', 'product-scraper/1.0'), 'Accept-Language': 'it-IT,it;q=0.9'}
    normalized = url
    html = ''
    # 1. Prova Playwright se disponibile
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=headers['User-Agent'])
            collected_jsons = []
            def _on_response(response):
                try:
                    ct = response.headers.get('content-type', '')
                    if 'application/json' in ct:
                        txt = response.text()
                        try:
                            obj = json.loads(txt)
                            collected_jsons.append({'url': response.url, 'json': obj})
                        except Exception:
                            pass
                except Exception:
                    pass
            page.on('response', _on_response)
            page.goto(normalized, wait_until='networkidle', timeout=30000)
            page.wait_for_timeout(1200)
            html = page.content()
            browser.close()
            data['playwright_json_xhr'] = collected_jsons
    except Exception as e:
        data['playwright_error'] = str(e)
        # fallback requests
        try:
            resp = requests.get(normalized, headers=headers, timeout=15)
            resp.raise_for_status()
            html = resp.text
        except Exception as e2:
            data['requests_error'] = str(e2)
            html = ''

    soup = BeautifulSoup(html, 'html.parser')
    # 2. Meta tag
    meta = {}
    for m in soup.find_all('meta'):
        k = m.get('property') or m.get('name')
        v = m.get('content')
        if k and v:
            meta[k] = v
    data['meta_tags'] = meta

    # 3. Titoli
    data['h1'] = [h.get_text(strip=True) for h in soup.find_all('h1')]
    data['h2'] = [h.get_text(strip=True) for h in soup.find_all('h2')]
    data['title_tag'] = soup.title.get_text(strip=True) if soup.title else None

    # 4. Immagini
    imgs = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src')
        if src:
            imgs.append(src)
    data['all_img_src'] = imgs

    # 5. Script JSON inline
    scripts = []
    for script in soup.find_all('script'):
        txt = script.string or ''
        if txt and len(txt) > 100:
            try:
                js = json.loads(txt)
                scripts.append({'type': 'json', 'json': js})
            except Exception:
                scripts.append({'type': 'text', 'text': txt[:400]})
    data['inline_scripts'] = scripts

    # 6. Tutti i link
    data['all_links'] = [a.get('href') for a in soup.find_all('a') if a.get('href')]

    # 7. Ipotesi su cosa potrebbe essere
    hints = {
        'meta_tags': 'potrebbero contenere titolo, descrizione, prezzo, immagini principali',
        'h1': 'probabile titolo prodotto',
        'all_img_src': 'tutte le immagini trovate nella pagina, alcune potrebbero essere gallery prodotto, altre UI',
        'playwright_json_xhr': 'JSON ricevuti via XHR, spesso contengono dati strutturati come prezzo, immagini, seller',
        'inline_scripts': 'potrebbero contenere oggetti JS con dati prodotto',
        'all_links': 'tutti i link, a volte link a immagini o varianti',
        'title_tag': 'titolo tab browser',
        'h2': 'sottotitoli, a volte categoria o dettagli',
    }
    data['hints'] = hints

    # 8. Salva YAML
    out_dir = Path.cwd() / 'storage' / 'scrapes'
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = _safe_filename_from_url(normalized).replace('.json', '.yaml')
    out_path = out_dir / filename
    with out_path.open('w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)
    return data
