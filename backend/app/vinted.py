
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

from storage import db as storage_db

def get_item_id_from_url(url: str) -> str:
	# Supporta sia /item/ID- che /items/ID-
	match = re.search(r'/items?/(\d+)-', url)
	return match.group(1) if match else 'unknown'

def log_vinted(msg: str):
       base_dir = os.path.dirname(os.path.abspath(__file__))
       data_dir = os.path.join(base_dir, 'app_data')
       os.makedirs(data_dir, exist_ok=True)
       log_path = os.path.join(data_dir, 'log.txt')
       with open(log_path, 'a', encoding='utf-8') as logf:
	       logf.write(f'{datetime.now().isoformat()} {msg}\n')

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
			page.goto(url, timeout=60000)
			page.wait_for_load_state('networkidle')
			html = page.content()
			with open(html_path, 'w', encoding='utf-8') as f:
				f.write(html)
			browser.close()
		return True
	except Exception as e:
		log_vinted(f'Errore Playwright: {e} - ' + traceback.format_exc())
		return False

def scrape_vinted(url: str):
	log_vinted(f'Inizio scraping per URL: {url}')
	item_id = get_item_id_from_url(url)
	html_path = f'tmp/item_{item_id}_rendered.html'
	xml_path = f'storage/product_{item_id}.xml'
	images_dir = f'images/product_{item_id}'

	os.makedirs('tmp', exist_ok=True)
	os.makedirs('storage', exist_ok=True)
	os.makedirs(images_dir, exist_ok=True)

	# Inizializza DB se serve
	try:
		storage_db.init_db()
	except Exception:
		pass

	log_vinted(f'Scarico HTML renderizzato da {url}...')
	ok = download_rendered_html(url, html_path)
	if not ok:
		log_vinted('Errore nel download HTML.')
		return False


	# Inizializza variabili a default per evitare errori se parsing fallisce
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
	# Parsing HTML per estrarre dati
	soup = BeautifulSoup(html, 'html.parser')

	# Titolo
	h1 = soup.find('h1')
	if h1:
		title = h1.get_text(strip=True)
	log_vinted(f'Parsed title: "{title}"')

	# Descrizione: fallback meta description o primo paragrafo dopo titolo
	meta_desc = soup.find('meta', attrs={'name': 'description'})
	if meta_desc and meta_desc.get('content'):
		description = meta_desc.get('content').strip()
	else:
		# cerca primo <p> utile
		p = None
		if h1:
			p = h1.find_next('p')
		if not p:
			p = soup.find('p')
		if p:
			description = p.get_text(strip=True)

	# Prezzo: cerca pattern tipo 5,00 € o 5.00€
	text = soup.get_text(' ', strip=True)
	price_match = re.search(r'(\d+[\.,]\d{2})\s*€', text)
	if price_match:
		price_val = float(price_match.group(1).replace(',', '.'))

	# Condizione: cerca parole comuni vicino a 'Condizioni' o span singoli
	cond = None
	cond_label = soup.find(string=re.compile(r'Condizion|Condizioni', re.I))
	if cond_label:
		# prendi lo span successivo
		next_span = None
		parent = cond_label.parent
		if parent:
			next_span = parent.find_next('span')
		if next_span:
			condition = next_span.get_text(strip=True)
		else:
			# fallback: cerca span con testo breve tipo 'Ottime'
			sp = soup.find('span', string=re.compile(r'Ottim|Buon|Nuov|Danneggi', re.I))
			if sp:
				condition = sp.get_text(strip=True)

	# Immagini: trova tag <img> con src che contiene 'vinted' o 'images'
	img_urls = []
	# Raccogli tuple (url, alt) per ogni immagine utile
	for img in soup.find_all('img'):
		src = img.get('src') or img.get('data-src') or img.get('data-original')
		if not src:
			continue
		# normalizza URL (aggiungi schema se necessario)
		if src.startswith('//'):
			src = 'https:' + src
		elif src.startswith('/'):
			src = 'https://www.vinted.it' + src
		# whitelist domini immagini prodotto
		try:
			parsed = urlparse(src)
			netloc = parsed.netloc.lower()
		except Exception:
			netloc = ''
		if 'images1.vinted.net' in netloc or 'images.vinted.net' in netloc or 'images.vinted' in netloc:
			# Heuristica: mantieni solo immagini prodotto (path con '/t/' o indicatori di resizing come '/f800/')
			path = parsed.path.lower()
			if '/t/' in path or '/f800/' in src or re.search(r'/f\d+/', path):
				alt = (img.get('alt') or '').strip()
				# Non escludere immagini solo perché l'alt è vuoto: alcuni annunci non popolano alt
				# Mantieni comunque l'alt (può essere vuoto)
				img_urls.append((src, alt))

	# de-dup e mantieni ordine
	seen = set()
	image_links = []
	image_alts = []
	for u, alt in img_urls:
		if u in seen:
			continue
		seen.add(u)
		image_links.append(u)
		image_alts.append(alt)

	# Scarica immagini in images_dir
	image_filenames = []
	images_meta = []
	for idx, img_url in enumerate(image_links, start=1):
		try:
			resp = requests.get(img_url, stream=True, timeout=20)
			if resp.status_code == 200:
				# legge contenuto per checksum
				hasher = hashlib.sha1()
				chunks = []
				for chunk in resp.iter_content(8192):
					if not chunk:
						continue
					hasher.update(chunk)
					chunks.append(chunk)
				checksum = hasher.hexdigest()
				# determina estensione e basename
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
				# scrive file
				with open(fpath, 'wb') as imgf:
					for c in chunks:
						imgf.write(c)
				size_bytes = os.path.getsize(fpath)
				image_filenames.append(fname)
				log_vinted(f'Immagine scaricata: {fname}')
				# infer type
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

	# Salva mapping JSON delle immagini
	try:
		mapping_path = os.path.join(images_dir, 'images_info.json')
		with open(mapping_path, 'w', encoding='utf-8') as mf:
			json.dump(images_meta, mf, ensure_ascii=False, indent=2)
	except Exception as e:
		log_vinted(f'Errore salvataggio mapping immagini: {e}')

	# Salva dati estratti in XML locale
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

	# Orari
	now = datetime.now().isoformat()

	# Evita di creare prodotti per pagine non disponibili o con titoli vuoti/404
	bad_title = False
	if not title or title.strip() == "":
		bad_title = True
	elif re.search(r"\b404\b", title, re.I) or re.search(r"not found|pagina non trovata|non trovato|not available", title, re.I):
		bad_title = True
	# Controllo anche il contenuto HTML per indicatori di pagina mancante
	if not bad_title:
		if re.search(r"\b404\b|not found|pagina non trovata|item not found|non disponibile", html, re.I):
			bad_title = True
	if bad_title:
		log_vinted(f'Skipping creation: page appears unavailable or invalid title (title="{title}")')
		# salva HTML per ispezione
		try:
			problem_path = f'storage/problem_item_{item_id}.html'
			with open(problem_path, 'w', encoding='utf-8') as pf:
				pf.write(html)
			log_vinted(f'HTML salvato per ispezione: {problem_path}')
		except Exception as e:
			log_vinted(f'Errore salvataggio HTML per ispezione: {e}')
		return False

	# Salva tramite API
	try:
		# 1. Crea prodotto
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
		resp = requests.post("http://localhost:8004/api/products", json=product_data)
		if resp.status_code != 201:
			log_vinted(f'Errore API creazione prodotto: {resp.status_code} {resp.text}')
			return False
		product_id = resp.json()["id"]

		# 2. Crea immagini collegate
		for fname, img_url in zip(image_filenames, image_links):
			image_data = {
				"product_id": product_id,
				"filename": os.path.join(images_dir, fname),
				"width": None,
				"height": None,
				"size_bytes": None,
				"checksum": None
			}
			img_resp = requests.post("http://localhost:8004/api/images", json=image_data)
			if img_resp.status_code != 201:
				log_vinted(f'Errore API creazione immagine: {img_resp.status_code} {img_resp.text}')

		# 3. Crea prezzo collegato
		price_data = {
			"product_id": product_id,
			"amount": price_val,
			"currency": "EUR",
			"price_category": None,
			"condition": None,
			"platform": None,
			"sold": False
		}
		price_resp = requests.post("http://localhost:8004/api/prices", json=price_data)
		if price_resp.status_code != 201:
			log_vinted(f'Errore API creazione prezzo: {price_resp.status_code} {price_resp.text}')

		# 4. Crea sourceurl collegata
		sourceurl_data = {
			"product_id": product_id,
			"url": url,
			"domain": None
		}
		sourceurl_resp = requests.post("http://localhost:8004/api/sourceurls", json=sourceurl_data)
		if sourceurl_resp.status_code != 201:
			log_vinted(f'Errore API creazione sourceurl: {sourceurl_resp.status_code} {sourceurl_resp.text}')

		log_vinted(f'Dati salvati tramite API. Prodotto id={product_id}, immagini={len(image_filenames)}, prezzo e sourceurl salvati')
	except Exception as e:
		log_vinted(f'Errore chiamate API: {e}')
		return False

	return True
