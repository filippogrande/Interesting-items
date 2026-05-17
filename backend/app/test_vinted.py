


import time
from vinted import scrape_vinted

if __name__ == "__main__":

		# URL dei prodotti
		urls = [
			'https://www.vinted.it/items/8126866415-spilla-olimpiadi-sovietiche-1980-in-mosca?referrer=catalog',
			'https://www.vinted.it/items/8126907592-spilla-sovietica',
			'https://www.vinted.it/items/6575041549-hitman-complete-first-season-steelcase-ps4-playstation-4'
		]

		for i, url in enumerate(urls):
			if url:
				scrape_vinted(url)
			if i < len(urls) - 1:
				print('Attesa 1 minuto prima del prossimo scraping...')
				time.sleep(60)

