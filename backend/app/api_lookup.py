"""Endpoint aggiuntivi del BE registrati sull'app esistente.

Il bot ha bisogno di sapere se un URL e' gia' presente (anti-duplicato) SENZA
accedere al database: questo endpoint glielo permette via HTTP.
"""
from typing import Optional

from pydantic import BaseModel
from sqlmodel import Session, select

from storage.db import engine, SourceUrl, Product
from .api import app


class SourceUrlLookupOut(BaseModel):
    found: bool
    product_id: Optional[int] = None
    product_title: Optional[str] = None


@app.get("/api/sourceurls/lookup", response_model=SourceUrlLookupOut)
def lookup_sourceurl(url: str):
    """Cerca un URL (normalizzato come fa il bot) tra le SourceUrl esistenti."""
    with Session(engine) as session:
        existing = session.exec(
            select(SourceUrl).where(SourceUrl.url == url)
        ).first()
        if not existing:
            return SourceUrlLookupOut(found=False)
        product = session.get(Product, existing.product_id)
        return SourceUrlLookupOut(
            found=True,
            product_id=existing.product_id,
            product_title=product.title if product else None,
        )
