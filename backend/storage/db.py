
from sqlmodel import SQLModel, Field, create_engine, Session, Relationship, Column, Enum
from sqlalchemy import ForeignKey
from typing import Optional, List
import enum
import os
from datetime import datetime

# Percorso file DB: usa DATABASE_URL se presente, altrimenti fallback a sqlite
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DB_URL = DATABASE_URL
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite")
    DB_URL = f"sqlite:///{DB_PATH}"

# create_engine: per sqlite serve connect_args, per Postgres no
if DB_URL.startswith("sqlite"):
    engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DB_URL, echo=False)

# Enum per condition
class ItemCondition(str, enum.Enum):
    nuovo = "nuovo"
    con_scatola = "con_scatola"
    senza_scatola = "senza_scatola"
    danneggiato = "danneggiato"
    in_cattive_condizioni = "in_cattive_condizioni"
    altro = "altro"


class TagKind(str, enum.Enum):
    taxonomy = "taxonomy"
    store = "store"
    project = "project"

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: Optional[str] = None
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")
    category_metadata: Optional[str] = None  # JSON string
    parent: Optional["Category"] = Relationship(back_populates="children", sa_relationship_kwargs={"remote_side": "Category.id"})
    children: List["Category"] = Relationship(back_populates="parent")
    products: List["Product"] = Relationship(back_populates="category")


class ProductTagLink(SQLModel, table=True):
    product_id: Optional[int] = Field(default=None, sa_column=Column(ForeignKey("product.id", ondelete="CASCADE"), primary_key=True))
    tag_id: Optional[int] = Field(default=None, sa_column=Column(ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True))


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: Optional[str] = None
    kind: TagKind = Field(default=TagKind.taxonomy, sa_column=Column(Enum(TagKind)))
    parent_id: Optional[int] = Field(default=None, foreign_key="tag.id")
    tag_metadata: Optional[str] = None  # JSON string

    parent: Optional["Tag"] = Relationship(back_populates="children", sa_relationship_kwargs={"remote_side": "Tag.id"})
    children: List["Tag"] = Relationship(back_populates="parent")
    products: List["Product"] = Relationship(back_populates="tags", link_model=ProductTagLink)

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    brand: Optional[str] = None
    origin_type: Optional[str] = None
    product_metadata: Optional[str] = None  # JSON string
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    archived: bool = Field(default=False)
    scraped_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    category: Optional[Category] = Relationship(back_populates="products")
    images: List["Image"] = Relationship(back_populates="product")
    prices: List["Price"] = Relationship(back_populates="product")
    source_urls: List["SourceUrl"] = Relationship(back_populates="product")
    tags: List[Tag] = Relationship(back_populates="products", link_model=ProductTagLink)

class Image(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(sa_column=Column(ForeignKey("product.id", ondelete="CASCADE")))
    filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None
    checksum: Optional[str] = None
    product: Optional[Product] = Relationship(back_populates="images")

class Price(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(sa_column=Column(ForeignKey("product.id", ondelete="CASCADE")))
    amount: float
    currency: str = Field(default="EUR")
    price_category: Optional[str] = None
    condition: Optional[ItemCondition] = Field(default=None, sa_column=Column(Enum(ItemCondition)))
    platform: Optional[str] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)
    sold: bool = Field(default=False)
    product: Optional[Product] = Relationship(back_populates="prices")

class SourceUrl(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(sa_column=Column(ForeignKey("product.id", ondelete="CASCADE")))
    url: str
    domain: Optional[str] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)
    product: Optional[Product] = Relationship(back_populates="source_urls")

def init_db():
    SQLModel.metadata.create_all(engine)

# CRUD helpers (esempi base)
def add_product(product: Product, images: List[Image]=[], prices: List[Price]=[], source_urls: List[SourceUrl]=[]):
    with Session(engine) as session:
        session.add(product)
        session.commit()  # commit per ottenere l'id
        session.refresh(product)  # assicura che product.id sia valorizzato
        for img in images:
            img.product_id = product.id
            session.add(img)
        for price in prices:
            price.product_id = product.id
            session.add(price)
        for src in source_urls:
            src.product_id = product.id
            session.add(src)
        session.commit()
        return product.id

def get_products():
    with Session(engine) as session:
        return session.exec(Product.select()).all()

if __name__ == "__main__":
    init_db()
    print("DB creato e tabelle pronte.")
