from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    brand: Optional[str] = None
    origin_type: Optional[str] = None
    metadata: Optional[dict] = None
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    archived: bool = Field(default=False)
    scraped_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    images: List["Image"] = Relationship(back_populates="product")
    prices: List["Price"] = Relationship(back_populates="product")
    category: Optional["Category"] = Relationship(back_populates="products")


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
    added_at: datetime = Field(default_factory=datetime.utcnow)
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
