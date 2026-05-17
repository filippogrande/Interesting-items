from db import Product, Image, get_products

if __name__ == "__main__":
    prodotti = get_products()
    print(f"Trovati {len(prodotti)} prodotti nel database:\n")
    for p in prodotti:
        print(f"ID: {p.id}\nTitolo: {p.title}\nPrezzo: {p.price} {p.currency}\nDescrizione: {p.description}\nURL: {p.url}\nStatus: {p.status}\nData: {p.date}\n---")
