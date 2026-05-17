#!/usr/bin/env python3
import os
import glob
import json
from xml.etree import ElementTree as ET

BASE_DIR = os.path.dirname(__file__)
STORAGE = os.path.join(BASE_DIR, 'storage')

os.makedirs(STORAGE, exist_ok=True)

xml_files = glob.glob(os.path.join(STORAGE, 'aliexpress_*.xml'))
if not xml_files:
    print('Nessun file XML trovato in', STORAGE)
    raise SystemExit(2)

for xf in xml_files:
    try:
        tree = ET.parse(xf)
        root = tree.getroot()
        pid = root.findtext('id') or ''
        url = root.findtext('url') or ''
        title = root.findtext('title') or ''
        description = root.findtext('description') or ''
        price = root.findtext('price') or ''

        images = []
        imgs_el = root.find('images')
        if imgs_el is not None:
            for im in imgs_el.findall('image'):
                images.append({
                    'filename': im.findtext('filename') or '',
                    'url': im.findtext('url') or '',
                    'checksum': im.findtext('checksum') or '',
                    'size_bytes': int(im.findtext('size_bytes') or 0),
                    'alt': im.findtext('alt') or ''
                })

        # variants: try to read YAML if present (simple parser for our minimal YAML)
        variants = {}
        yaml_path = os.path.join(STORAGE, f'aliexpress_{pid}.yaml')
        if os.path.exists(yaml_path):
            try:
                with open(yaml_path, 'r', encoding='utf-8') as yf:
                    # naive YAML-to-dict: since our YAML was simple, try json-like load fallback
                    txt = yf.read()
                    # attempt to parse simple mapping by lines
                    # for safety, return raw text under 'yaml_raw'
                    variants['yaml_raw'] = txt
            except Exception:
                variants = {}

        compact = {
            'id': pid,
            'url': url,
            'title': title,
            'description': description,
            'price': price,
            'images': images,
            'variants': variants,
        }

        out_path = os.path.join(STORAGE, f'aliexpress_{pid}.json')
        with open(out_path, 'w', encoding='utf-8') as outf:
            json.dump(compact, outf, ensure_ascii=False, indent=2)
        print('Creato', out_path)
    except Exception as e:
        print('Errore elaborazione', xf, e)
