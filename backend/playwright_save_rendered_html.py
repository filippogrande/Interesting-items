import asyncio
import sys
import os
from urllib.parse import urlparse

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Devi installare Playwright: pip install playwright && playwright install")
    sys.exit(1)

async def save_rendered_html(url, out_dir="tmp"):
    os.makedirs(out_dir, exist_ok=True)
    parsed = urlparse(url)
    safe_path = parsed.path.replace("/", "_").strip("_")
    if parsed.query:
        safe_path += "_" + parsed.query.replace("/", "_").replace("=", "-")
    filename = f"{safe_path or 'index'}_rendered.html"
    out_path = os.path.join(out_dir, filename)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url)
        await page.wait_for_load_state('networkidle')
        await asyncio.sleep(2)  # attende caricamento JS
        html = await page.content()
        await browser.close()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML renderizzato salvato in: {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python playwright_save_rendered_html.py <url>")
        sys.exit(1)
    url = sys.argv[1]
    asyncio.run(save_rendered_html(url))
