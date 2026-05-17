import os
import time
import re
import requests
import sys
import hashlib
import json
import ast
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from datetime import datetime


def log_aliexpress(msg: str):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'app_data')
    os.makedirs(data_dir, exist_ok=True)
    log_path = os.path.join(data_dir, 'log.txt')
    with open(log_path, 'a', encoding='utf-8') as logf:
        logf.write(f'{datetime.now().isoformat()} {msg}\n')


def get_product_id_from_url(url: str) -> str:
    # prova vari pattern comuni di AliExpress
    m = re.search(r'/item/(\d+)\.html', url)
    if m:
        return m.group(1)
    m = re.search(r'productId=(\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'/([0-9]{6,})$', url)
    return m.group(1) if m else 'unknown'


def download_rendered_html(url: str, html_path: str) -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log_aliexpress('Playwright non installato. Installa con: pip install playwright')
        return False
    # tentativi di retry perché alcune pagine possono impiegare tempo o rifiutare connessioni
    retries = 3
    timeout = 120000  # 120s
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            # crea un context con user-agent per ridurre il rischio di blocco
            context = browser.new_context(user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36')
            page = context.new_page()
            last_err = None
            for attempt in range(retries):
                try:
                    page.goto(url, timeout=timeout)
                    page.wait_for_load_state('networkidle', timeout=timeout)
                    html = page.content()
                    with open(html_path, 'w', encoding='utf-8') as f:
                        f.write(html)
                    context.close()
                    browser.close()
                    return True
                except Exception as e:
                    last_err = e
                    log_aliexpress(f'Playwright attempt {attempt+1} failed: {e}')
                    time.sleep(2)
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass
            log_aliexpress(f'Errore Playwright: {last_err}')
            return False
    except Exception as e:
        log_aliexpress(f'Errore Playwright init: {e}')
        return False


def scrape_aliexpress(url: str):
    log_aliexpress(f'Inizio scraping AliExpress per URL: {url}')
    pid = get_product_id_from_url(url)
    html_path = f'tmp/aliexpress_{pid}_rendered.html'
    xml_path = f'storage/aliexpress_{pid}.xml'
    images_dir = f'images/aliexpress_{pid}'

    os.makedirs('tmp', exist_ok=True)
    os.makedirs('storage', exist_ok=True)
    os.makedirs(images_dir, exist_ok=True)

    log_aliexpress(f'Scarico HTML renderizzato da {url}...')
    ok = download_rendered_html(url, html_path)
    if not ok:
        log_aliexpress('Errore nel download HTML.')
        return False

    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
    except Exception as e:
        log_aliexpress(f'Errore apertura HTML: {html_path} ({e})')
        return False

    # processa l'HTML salvato (parsing, estrazione immagini, salvataggio XML/YAML)
    return process_saved_html(html, pid, url, images_dir, xml_path)


def _find_balanced_json(text, start_pos):
    # trova JSON bilanciato iniziando dal primo '{' a partire da start_pos
    i = text.find('{', start_pos)
    if i == -1:
        return None
    depth = 0
    for j in range(i, len(text)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return text[i:j+1]
    return None


def extract_variants_from_html(html: str):
    """Estrae strutture SKU/variant da script embedded (es. window.runParams, skuBase, skuMap).
    Restituisce un dict con 'attributes' e 'variants' se trovati, altrimenti {}.
    """
    res = {}
    # cerca script che contengono parole chiave note
    patterns = ['window.runParams', 'skuBase', 'skuMap', 'SKU_BASE', 'productDetail']
    candidates = []
    for m in re.finditer(r'<script[^>]*>(.*?)</script>', html, flags=re.DOTALL | re.IGNORECASE):
        txt = m.group(1)
        low = txt.lower()
        if any(p.lower() in low for p in patterns):
            candidates.append(txt)

    parsed = None
    for txt in candidates:
        # prova prima window.runParams
        m = re.search(r'window\.runParams\s*=\s*', txt)
        try_json = None
        if m:
            try_json = _find_balanced_json(txt, m.end())
        if not try_json:
            # cerca presenza diretta di "skuMap" nel testo e estrai il primo JSON bilanciato
            m2 = re.search(r'(\{[^\{]*"skuMap".*)', txt, flags=re.DOTALL)
            if m2:
                try_json = _find_balanced_json(txt, m2.start())
        if not try_json:
            # fallback: cerca la prima occorrenza di '{' e prova a bilanciare
            try_json = _find_balanced_json(txt, 0)
        if not try_json:
            continue
        # pulizia: rimuovi trailing semicolon
        jtext = try_json.strip()
        # prova a caricare JSON
        try:
            parsed = json.loads(jtext)
        except Exception:
            # prova ast.literal_eval come fallback (gestisce single-quoted JS-ish)
            try:
                parsed = ast.literal_eval(jtext)
            except Exception:
                parsed = None
        if parsed:
            break

    if not parsed:
        return {}

    # naviga parsed per trovare skuBase / skuMap
    sku_base = None
    sku_map = None
    # molte pagine hanno struttura {data: {...}} oppure {product: {...}}
    if isinstance(parsed, dict):
        # ricerca ricorsiva
        def find_key(d, key):
            if isinstance(d, dict):
                if key in d:
                    return d[key]
                for v in d.values():
                    r = find_key(v, key)
                    if r is not None:
                        return r
            return None
        sku_base = find_key(parsed, 'skuBase') or find_key(parsed, 'SKU_BASE')
        sku_map = find_key(parsed, 'skuMap') or find_key(parsed, 'sku_map')

    attributes = []
    variants = []
    if sku_base and isinstance(sku_base, dict):
        # estrai props/labels se presenti
        props = sku_base.get('skuProps') or sku_base.get('props') or sku_base.get('specs')
        if isinstance(props, list):
            for p in props:
                name = p.get('propName') or p.get('name') or p.get('label') or p.get('k')
                vals = []
                for opt in p.get('values') or p.get('skuValues') or p.get('options') or []:
                    vals.append({'id': opt.get('id') or opt.get('valueId') or opt.get('value'), 'name': opt.get('name') or opt.get('value') or opt.get('label')})
                attributes.append({'name': name, 'values': vals})

    if sku_map and isinstance(sku_map, dict):
        for sku_key, sku_info in sku_map.items():
            variant = {'sku_key': sku_key}
            if isinstance(sku_info, dict):
                # prezzo e disponibilità possono trovarsi in diverse chiavi
                variant['price'] = sku_info.get('price') or sku_info.get('priceVal') or sku_info.get('actSkuPrice') or None
                variant['stock'] = sku_info.get('stock') or sku_info.get('quantity') or sku_info.get('inventory') or None
            variants.append(variant)

    # se non abbiamo skuMap ma parsed contiene 'sku' list
    if not variants:
        possible = []
        if isinstance(parsed, dict):
            for k in ['skus', 'skuList', 'sku']:
                v = find_key(parsed, k)
                if v:
                    possible = v
                    break
        if isinstance(possible, list):
            for it in possible:
                variants.append({'sku_key': it.get('skuId') or it.get('id') or None, 'price': it.get('price')})

    res = {'attributes': attributes, 'variants': variants}
    return res


def process_saved_html(html: str, pid: str, url: str, images_dir: str, xml_path: str):
    def _is_category_alt(alt: str) -> bool:
        if not alt:
            return False
        a = alt.strip().lower()
        # frasi esplicite da escludere
        category_terms = [
            'tutte le categorie', 'illuminazione', 'bricolage', 'intimo', 'abbigliamento', 'auto', 'motori',
            'gioielli', 'orologi', 'sport', 'intrattenimento', 'elettrodomestici', 'casa', 'giardino',
            'bambini', 'neonati', 'valigie', 'borse', 'scarpe', 'beauty', 'bellezza', 'salute', 'accessori',
            'ricerca per immagine', 'telefon', 'telefoni', 'telecomunicazioni'
        ]
        for t in category_terms:
            if t in a:
                return True
        # molte icone di categoria sono molto corte (<= 30) e non descrittive
        if len(a) <= 30 and (' ' in a or len(a.split()) <= 3):
            return True
        return False
    try:
        soup = BeautifulSoup(html, 'html.parser')

        title = ''
        description = ''
        price_val = 0.0

        img_candidates = []

        ogt = soup.find('meta', property='og:title')
        if ogt and ogt.get('content'):
            title = ogt.get('content').strip()
        else:
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)

        md = soup.find('meta', attrs={'name': 'description'})
        if md and md.get('content'):
            description = md.get('content').strip()
        for s in soup.find_all('script', type='application/ld+json'):
            try:
                j = json.loads(s.string or '{}')
                items = j if isinstance(j, list) else [j]
                for it in items:
                    if not title and isinstance(it, dict) and it.get('name'):
                        title = it.get('name')
                    if isinstance(it, dict) and it.get('offers'):
                        offers = it.get('offers')
                        if isinstance(offers, dict):
                            p = offers.get('price')
                            if p:
                                try:
                                    price_val = float(str(p).replace(',', '.'))
                                except Exception:
                                    pass
                    imgs = it.get('image')
                    if imgs:
                        if isinstance(imgs, str):
                            img_candidates.append((imgs, ''))
                        elif isinstance(imgs, list):
                            for im in imgs:
                                img_candidates.append((im, ''))
            except Exception:
                continue

        if not price_val:
            text = soup.get_text(' ', strip=True)
            pm = re.search(r'(\d+[\.,]\d{2})\s*(€|EUR|\$|USD)?', text)
            if pm:
                try:
                    price_val = float(pm.group(1).replace(',', '.'))
                except Exception:
                    price_val = 0.0

        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-original') or img.get('data-srcset')
            if not src:
                continue
            if src.startswith('//'):
                src = 'https:' + src
            elif src.startswith('/'):
                src = 'https://www.aliexpress.com' + src
            try:
                netloc = urlparse(src).netloc.lower()
            except Exception:
                netloc = ''
            if any(d in netloc for d in ['alicdn.com', 'alicdn', 'aliexpress-media.com', 'ae-pic-a1.aliexpress-media.com', 'ae-pic']):
                alt = (img.get('alt') or '').strip()
                cls = ' '.join(img.get('class') or [])
                # parent classes may indicate thumbnail/gallery vs header/icon
                parent_cls = ''
                try:
                    if img.parent and getattr(img.parent, 'get'):
                        parent_cls = ' '.join(img.parent.get('class') or [])
                except Exception:
                    parent_cls = ''
                # width/height attributes when available
                width = img.get('width') or img.get('data-width') or img.get('data-w')
                height = img.get('height') or img.get('data-height') or img.get('data-h')
                # escludi icone/categories non rilevanti basandoci su alt già ora
                try:
                    if _is_category_alt(alt):
                        continue
                except Exception:
                    pass
                img_candidates.append((src, alt, cls, parent_cls, width, height))

        seen = set()
        image_links = []
        image_alts = []
        image_meta_list = []
        for entry in img_candidates:
            # entry: (src, alt, class, parent_class, width, height)
            if not entry:
                continue
            if len(entry) == 2:
                u, alt = entry
                cls = ''
                parent_cls = ''
                width = None
                height = None
            else:
                u, alt, cls, parent_cls, width, height = entry
            if not u:
                continue
            if u in seen:
                continue
            seen.add(u)
            u_norm = re.sub(r'(_\d+x\d+)(?:\.[a-z0-9]{1,6}(?:\.|$))?', '', u)
            if u_norm.startswith('//'):
                u_norm = 'https:' + u_norm
            image_links.append(u_norm)
            image_alts.append(alt)
            image_meta_list.append({'url': u_norm, 'alt': alt, 'class': cls, 'parent_class': parent_cls, 'width': width, 'height': height})

        os.makedirs(images_dir, exist_ok=True)

        images_meta = []
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        }

        MIN_BYTES_PREFILTER = 4000
        for idx, img_url in enumerate(image_links, start=1):
            try:
                # quick normalizzazione per rimuovere suffissi strani (es. "q75.jpg_.avif")
                img_url = re.sub(r'\.?q\d+\.jpg', '.jpg', img_url)
                img_url = img_url.replace('_.avif', '')
                img_url = re.sub(r'(\.jpg)+', '.jpg', img_url)
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                # filtro rapido prima di scaricare: url pattern, token classname/alt, dimensioni dichiarate
                low_url = img_url.lower()
                meta = image_meta_list[idx-1] if idx-1 < len(image_meta_list) else {}
                low_alt = (meta.get('alt') or '').lower()
                low_cls = (meta.get('class') or '').lower()
                low_parent = (meta.get('parent_class') or '').lower()
                # skip immagini con pattern noti che danno 404 o sono icone
                if '.png.png' in low_url or '.svg' in low_url:
                    log_aliexpress(f'Skipping by url pattern: {img_url}')
                    continue
                skip_tokens = ['icon', 'logo', 'thumb', 'badge', 'flag', 'avatar', 'seller', 'store', 'category', 'sprite', 'spacer', 'arrow', 'rating', 'star', 'shipping', 'verified', 'payment', 'paypal', 'alipay']
                if any(t in low_url for t in skip_tokens) or any(t in low_alt for t in skip_tokens) or any(t in low_cls for t in skip_tokens) or any(t in low_parent for t in skip_tokens):
                    log_aliexpress(f'Skipping by token ({img_url}) alt/class parent: {low_alt} / {low_cls} / {low_parent}')
                    continue
                # dimensione dichiarata sugli attributi
                try:
                    w = int(meta.get('width')) if meta.get('width') and str(meta.get('width')).isdigit() else None
                    h = int(meta.get('height')) if meta.get('height') and str(meta.get('height')).isdigit() else None
                    if w and h and (w < 50 or h < 50):
                        log_aliexpress(f'Skipping by declared dims {w}x{h}: {img_url}')
                        continue
                except Exception:
                    pass

                # prova HEAD per valutare Content-Length e Content-Type (evita download di icone)
                try:
                    head = requests.head(img_url, timeout=8, headers=headers, allow_redirects=True)
                    if head.status_code == 200:
                        ctype = head.headers.get('Content-Type', '')
                        clen = int(head.headers.get('Content-Length') or 0)
                        if not ctype.startswith('image/'):
                            log_aliexpress(f'Skipping non-image Content-Type {ctype}: {img_url}')
                            continue
                        if clen and clen < MIN_BYTES_PREFILTER:
                            log_aliexpress(f'Skipping by Content-Length {clen} < {MIN_BYTES_PREFILTER}: {img_url}')
                            continue
                    else:
                        # se HEAD ritorna non 200, falliamo silenziosamente al GET
                        head = None
                except Exception:
                    head = None

                # se arriviamo qui, scarichiamo l'immagine
                resp = requests.get(img_url, stream=True, timeout=20, headers=headers)
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
                    images_meta.append({
                        'filename': os.path.join('images', f'aliexpress_{pid}', fname),
                        'url': img_url,
                        'checksum': checksum,
                        'size_bytes': size_bytes,
                        'alt': image_alts[idx-1] if idx-1 < len(image_alts) else '',
                        'class': meta.get('class'),
                        'parent_class': meta.get('parent_class')
                    })
                else:
                    log_aliexpress(f'Impossibile scaricare immagine {img_url}: status {resp.status_code}')
            except Exception as e:
                log_aliexpress(f'Errore download immagine {img_url}: {e}')

        try:
            # determina automaticamente quali immagini tenere basandosi su heuristics
            def _decide_keep(meta: dict) -> bool:
                alt = (meta.get('alt') or '').strip().lower()
                fname = (meta.get('filename') or '').lower()
                url_l = (meta.get('url') or '').lower()
                size = int(meta.get('size_bytes') or 0)
                ext = os.path.splitext(fname)[1].lower()

                # esclusione per alt di categoria
                try:
                    if _is_category_alt(alt):
                        return False
                except Exception:
                    pass

                # escludi immagini con indicatori di icona/piccole dimensioni nel nome/url
                small_tokens = ['27x27', '48x48', '24x48', '144x144', '30x30', '154x64', '232x98', '702x72', '45x60']
                for t in small_tokens:
                    if t in fname or t in url_l:
                        return False

                # preferisci JPEG maggiori: escludi PNG piccoli (icone)
                if ext == '.png' and size < 3000:
                    return False

                # filtro basato sulla dimensione (soglia in byte)
                if size < 3000:
                    return False

                return True

            for m in images_meta:
                m['tenere'] = _decide_keep(m)

            mapping_path = os.path.join(images_dir, 'images_info.json')
            with open(mapping_path, 'w', encoding='utf-8') as mf:
                json.dump(images_meta, mf, ensure_ascii=False, indent=2)

            # salva anche il mapping filtrato (solo tenere=true)
            filtered = [m for m in images_meta if m.get('tenere')]
            filtered_path = os.path.join(images_dir, 'images_info.filtered.json')
            with open(filtered_path, 'w', encoding='utf-8') as ff:
                json.dump(filtered, ff, ensure_ascii=False, indent=2)
            log_aliexpress(f'Mapping immagini salvato: totale={len(images_meta)}, tenute={len(filtered)}')
        except Exception as e:
            log_aliexpress(f'Errore salvataggio mapping immagini: {e}')

        try:
            from xml.etree.ElementTree import Element, SubElement, ElementTree
            root = Element('product')
            SubElement(root, 'id').text = pid
            SubElement(root, 'url').text = url
            SubElement(root, 'title').text = title or ''
            SubElement(root, 'description').text = description or ''
            SubElement(root, 'price').text = str(price_val)
            imgs_el = SubElement(root, 'images')
            # nell'XML includiamo solo le immagini selezionate (tenere=true)
            for meta in [m for m in images_meta if m.get('tenere')]:
                i_el = SubElement(imgs_el, 'image')
                SubElement(i_el, 'filename').text = meta.get('filename')
                SubElement(i_el, 'url').text = meta.get('url')
                SubElement(i_el, 'checksum').text = meta.get('checksum')
                SubElement(i_el, 'size_bytes').text = str(meta.get('size_bytes'))
                SubElement(i_el, 'alt').text = meta.get('alt') or ''
            ElementTree(root).write(xml_path, encoding='utf-8', xml_declaration=True)
            # Prova a salvare anche nel DB (se disponibile)
            try:
                from storage import db as storage_db
                # Assicura che le tabelle esistano
                storage_db.init_db()
                prod = storage_db.Product(
                    title=title or '',
                    description=description or '',
                    brand=None,
                    origin_type='aliexpress',
                    product_metadata=json.dumps({}),
                    scraped_at=datetime.utcnow()
                )
                images_objs = []
                for m in [mm for mm in images_meta if mm.get('tenere')]:
                    img = storage_db.Image(
                        filename=m.get('filename'),
                        width=None,
                        height=None,
                        size_bytes=m.get('size_bytes'),
                        checksum=m.get('checksum')
                    )
                    images_objs.append(img)
                prices = [storage_db.Price(amount=float(price_val or 0.0), currency='EUR', platform='aliexpress')]
                srcs = [storage_db.SourceUrl(url=url, domain=urlparse(url).netloc if url else None)]
                pid_db = storage_db.add_product(prod, images=images_objs, prices=prices, source_urls=srcs)
                log_aliexpress(f'Inserito prodotto in DB id={pid_db}')
            except Exception as e:
                log_aliexpress(f'Errore salvataggio DB: {e}')
        except Exception as e:
            log_aliexpress(f'Errore salvataggio XML: {e}')

        log_aliexpress(f'Dati AliExpress salvati localmente per pid={pid}, immagini={len(images_meta)}')

        try:
            variants = extract_variants_from_html(html)
            if variants:
                yaml_path = os.path.join('storage', f'aliexpress_{pid}.yaml')
                try:
                    with open(yaml_path, 'w', encoding='utf-8') as yf:
                        def write_yaml(obj, indent=0):
                            pad = '  ' * indent
                            if isinstance(obj, dict):
                                for k, v in obj.items():
                                    yf.write(f"{pad}{k}:\n")
                                    write_yaml(v, indent + 1)
                            elif isinstance(obj, list):
                                for item in obj:
                                    yf.write(f"{pad}- ")
                                    if isinstance(item, (dict, list)):
                                        yf.write('\n')
                                        write_yaml(item, indent + 1)
                                    else:
                                        yf.write(f"{item}\n")
                            else:
                                yf.write(f"{pad}{obj}\n")
                        write_yaml(variants)
                    log_aliexpress(f'Varianti AliExpress salvate in {yaml_path}')
                except Exception as e:
                    log_aliexpress(f'Errore salvataggio YAML varianti: {e}')
        except Exception as e:
            log_aliexpress(f'Errore estrazione varianti: {e}')

        return True
    except Exception as e:
        log_aliexpress(f'Errore process_saved_html: {e}')
        return False
