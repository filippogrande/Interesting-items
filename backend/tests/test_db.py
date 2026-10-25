"""Smoke test dei modelli: create_all + insert/read su uno sqlite temporaneo."""
from storage.db import Product, Session, engine, init_db


def test_init_db_and_product_roundtrip():
    init_db()
    with Session(engine) as session:
        product = Product(title="Prova", description="Descrizione di prova")
        session.add(product)
        session.commit()
        session.refresh(product)

        assert product.id is not None
        loaded = session.get(Product, product.id)
        assert loaded is not None
        assert loaded.title == "Prova"
