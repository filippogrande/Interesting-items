#!/usr/bin/env python3
import json
from pathlib import Path

# Percorso al file images_info.json (modifica se necessario)
IMG_JSON = Path('images/aliexpress_1005006124271098/images_info.json')
OUT_JSON = IMG_JSON.with_name('images_info.filtered.json')

if not IMG_JSON.exists():
    print(f'File non trovato: {IMG_JSON}')
    raise SystemExit(1)

with IMG_JSON.open('r', encoding='utf-8') as f:
    data = json.load(f)

kept = [item for item in data if bool(item.get('tenere'))]

with OUT_JSON.open('w', encoding='utf-8') as f:
    json.dump(kept, f, ensure_ascii=False, indent=2)

print(f'Trovati {len(data)} elementi, conservati {len(kept)}. Salvato in {OUT_JSON}')
