import sys
import os
from bs4 import BeautifulSoup

# Percorso file HTML da "rendere leggibile"
def beautify_html(input_path, output_path=None):
    with open(input_path, "r", encoding="utf-8") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    pretty = soup.prettify()
    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = base + "_pretty" + ext
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(pretty)
    print(f"HTML leggibile salvato in: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python beautify_html.py <input_file.html>")
        sys.exit(1)
    beautify_html(sys.argv[1])
