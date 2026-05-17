import os
import requests
from urllib.parse import urlparse

def download_html(url: str, out_dir: str = "tmp"):
    os.makedirs(out_dir, exist_ok=True)
    response = requests.get(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    })
    response.raise_for_status()
    parsed = urlparse(url)
    # Usa solo path e query per il nome file, sostituendo / e ?
    safe_path = parsed.path.replace("/", "_").strip("_")
    if parsed.query:
        safe_path += "_" + parsed.query.replace("/", "_").replace("=", "-")
    filename = f"{safe_path or 'index'}.html"
    out_path = os.path.join(out_dir, filename)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(response.text)
    print(f"Salvato: {out_path}")

if __name__ == "__main__":
    # Inserisci qui le URL che vuoi scaricare
    urls = [
        "https://www.vinted.it/items/8126866415-spilla-olimpiadi-sovietiche-1980-in-mosca?referrer=catalog"
    ]
    for url in urls:
        download_html(url, out_dir="tmp")
