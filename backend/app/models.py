from typing import List, Optional

from pydantic import NaiveDatetime
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

# I timestamp sono colonne TIMESTAMP WITHOUT TIME ZONE (create da create_all):
# vanno dichiarati NaiveDatetime e non datetime. In sqlmodel 0.0.47 i campi
# 'datetime' mappano su UTCDateTime, che richiede valori con timezone e solleva
# "Datetime values must have timezone information" in fase di INSERT -> 500 su
# POST /api/products (e su ogni altra insert). datetime.utcnow() e' naive, quindi
# coerente con NaiveDatetime.
# IMPORTANTE: NaiveDatetime e' un tipo di PYDANTIC. sqlmodel 0.0.47 NON lo
# riesporta: 'from sqlmodel import NaiveDatetime' non importa e fa morire il BE
# in avvio (ImportError).


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    brand: Optional[str] = None
    origin_type: Optional[str] = None
    metadata: Optional[dict] = None
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    archived: bool = Field(default=False)
    scraped_at: Optional[NaiveDatetime] = None
    created_at: NaiveDatetime = Field(default_factory=datetime.utcnow)
    updated_at: NaiveDatetime = Field(default_factory=datetime.utcnow)

    images: List["Image"] = Relationship(back_populates="product")
    prices: List["Price"] = Relationship(back_populates="product")
    category: Optional["Category"] = Relationship(back_populates="category")


class Image(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: Optional[int] = Field(default=None, foreign_key="product.id")
    filename: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None
    checksum: Optional[str] = None

    product: Optional[Product] = Relationship(back_populates="images")


class Price(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: Optional[int] = Field(default=None, foreign_key="product.id")
    amount: float
    currency: str = Field(default="EUR")
    price_category: Optional[str] = None
    condition: Optional[str] = None
    platform: Optional[str] = None
    added_at: NaiveDatetime = Field(default_factory=datetime.utcnow)
    sold: bool = Field(default=False)
    source_url: Optional[str] = None

    product: Optional[Product] = Relationship(back_populates="prices")


class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: Optional[str] = None
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")
    metadata: Optional[dict] = None

    products: List[Product] = Relationship(back_populates="category")
