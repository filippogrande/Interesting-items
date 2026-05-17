from pathlib import Path
from itertools import zip_longest
from urllib.parse import urlparse
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select
from storage.db import engine, Product, Image, Price, SourceUrl, Category, Tag, ProductTagLink, TagKind, init_db
from typing import Dict
from sqlalchemy import func

app = FastAPI(title="Product Scraper API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
IMAGES_DIR = Path(__file__).resolve().parents[1] / "images"

if IMAGES_DIR.exists():
    app.mount("/media", StaticFiles(directory=str(IMAGES_DIR)), name="media")


class ImageOut(BaseModel):
    id: int
    product_id: int
    filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None
    checksum: Optional[str] = None
    url: Optional[str] = None


class PriceOut(BaseModel):
    id: int
    product_id: int
    amount: float
    currency: str
    price_category: Optional[str] = None
    condition: Optional[str] = None
    platform: Optional[str] = None
    added_at: Optional[str] = None
    sold: bool = False


class SourceUrlOut(BaseModel):
    id: int
    product_id: int
    url: str
    domain: Optional[str] = None
    added_at: Optional[str] = None


class TagOut(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None
    kind: TagKind
    parent_id: Optional[int] = None
    tag_metadata: Optional[str] = None


class TagWithCount(TagOut):
    count: int = 0


class SourceWebsiteOut(BaseModel):
    name: str
    count: int = 0


class SourceWebsitesStatsOut(BaseModel):
    websites: List[SourceWebsiteOut]


class TagsStatsOut(BaseModel):
    tags: List[TagWithCount]
    untagged_count: int = 0


class ProductTagAssignmentIn(BaseModel):
    tag_ids: List[int]


class ProductSummaryOut(BaseModel):
    id: int
    title: str
    description: str
    brand: Optional[str] = None
    origin_type: Optional[str] = None
    archived: bool = False
    scraped_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    images_count: int = 0
    prices_count: int = 0
    source_urls_count: int = 0
    source_links_count: int = 0
    tags_count: int = 0
    cover_image_url: Optional[str] = None
    latest_price: Optional[float] = None
    latest_currency: Optional[str] = None
    latest_platform: Optional[str] = None
    latest_source_url: Optional[str] = None


class ProductDetailOut(ProductSummaryOut):
    images: List[ImageOut] = []
    prices: List[PriceOut] = []
    source_urls: List[SourceUrlOut] = []
    tags: List[TagOut] = []


def _to_media_url(filename: Optional[str]) -> Optional[str]:
    if not filename:
        return None
    normalized = filename.replace("\\", "/")
    if normalized.startswith("images/"):
        normalized = normalized[len("images/") :]
    return f"/media/{normalized}"


def _collect_descendant_tag_ids(session: Session, tag_id: int) -> List[int]:
    tag_ids = [tag_id]
    queue = [tag_id]
    while queue:
        current_id = queue.pop(0)
        children = session.exec(select(Tag).where(Tag.parent_id == current_id)).all()
        for child in children:
            if child.id not in tag_ids:
                tag_ids.append(child.id)
                queue.append(child.id)
    return tag_ids


def _collect_ancestor_tag_ids(session: Session, tag_id: int) -> List[int]:
    """Get tag and all ancestors (parent, grandparent, etc.)"""
    tag_ids = [tag_id]
    current_id = tag_id
    while current_id:
        tag = session.get(Tag, current_id)
        if not tag or not tag.parent_id:
            break
        tag_ids.append(tag.parent_id)
        current_id = tag.parent_id
    return tag_ids


def _serialize_tag(tag: Tag) -> TagOut:
    return TagOut(
        id=tag.id,
        name=tag.name,
        slug=tag.slug,
        kind=tag.kind,
        parent_id=tag.parent_id,
        tag_metadata=tag.tag_metadata,
    )


def _platform_label_for_pair(price: Optional[Price], source: Optional[SourceUrl]) -> Optional[str]:
    if price and price.platform:
        label = price.platform.strip().lower()
        return label or None
    if not source:
        return None
    value = (source.domain or source.url or "").strip()
    if not value:
        return None
    parsed = urlparse(value if value.startswith("http") else f"https://{value}")
    host = (parsed.hostname or parsed.netloc or value).lower().strip()
    host = host.replace("www.", "")
    if "vinted" in host:
        return "vinted"
    parts = [part for part in host.split(".") if part]
    return parts[0] if parts else None


def _product_source_labels(session: Session, product_id: int) -> List[str]:
    prices = session.exec(select(Price).where(Price.product_id == product_id).order_by(Price.added_at.desc())).all()
    source_urls = session.exec(select(SourceUrl).where(SourceUrl.product_id == product_id).order_by(SourceUrl.added_at.desc())).all()
    labels: List[str] = []
    for price, source in zip_longest(prices, source_urls):
        label = _platform_label_for_pair(price, source)
        if label:
            labels.append(label)
    return labels


def _serialize_summary(product: Product, session: Session) -> ProductSummaryOut:
    images = session.exec(select(Image).where(Image.product_id == product.id)).all()
    prices = session.exec(select(Price).where(Price.product_id == product.id).order_by(Price.added_at.desc())).all()
    source_urls = session.exec(select(SourceUrl).where(SourceUrl.product_id == product.id).order_by(SourceUrl.added_at.desc())).all()
    tags = session.exec(
        select(Tag).join(ProductTagLink, ProductTagLink.tag_id == Tag.id).where(ProductTagLink.product_id == product.id)
    ).all()

    latest_price = prices[0] if prices else None
    latest_source = source_urls[0] if source_urls else None
    cover = images[0] if images else None

    return ProductSummaryOut(
        id=product.id,
        title=product.title,
        description=product.description,
        brand=product.brand,
        origin_type=product.origin_type,
        archived=product.archived,
        scraped_at=product.scraped_at.isoformat() if product.scraped_at else None,
        created_at=product.created_at.isoformat() if product.created_at else None,
        updated_at=product.updated_at.isoformat() if product.updated_at else None,
        images_count=len(images),
        prices_count=len(prices),
        source_urls_count=len(source_urls),
        source_links_count=len(source_urls),
        tags_count=len(tags),
        cover_image_url=_to_media_url(cover.filename) if cover else None,
        latest_price=latest_price.amount if latest_price else None,
        latest_currency=latest_price.currency if latest_price else None,
        latest_platform=latest_price.platform if latest_price else None,
        latest_source_url=latest_source.url if latest_source else None,
    )


def _serialize_detail(product: Product, session: Session) -> ProductDetailOut:
    images = session.exec(select(Image).where(Image.product_id == product.id)).all()
    prices = session.exec(select(Price).where(Price.product_id == product.id).order_by(Price.added_at.desc())).all()
    source_urls = session.exec(select(SourceUrl).where(SourceUrl.product_id == product.id).order_by(SourceUrl.added_at.desc())).all()

    summary = _serialize_summary(product, session)
    return ProductDetailOut(
        **summary.model_dump(),
        images=[
            ImageOut(
                id=image.id,
                product_id=image.product_id,
                filename=image.filename,
                width=image.width,
                height=image.height,
                size_bytes=image.size_bytes,
                checksum=image.checksum,
                url=_to_media_url(image.filename),
            )
            for image in images
        ],
        prices=[
            PriceOut(
                id=price.id,
                product_id=price.product_id,
                amount=price.amount,
                currency=price.currency,
                price_category=price.price_category,
                condition=price.condition.value if getattr(price, "condition", None) else None,
                platform=price.platform,
                added_at=price.added_at.isoformat() if price.added_at else None,
                sold=price.sold,
            )
            for price in prices
        ],
        source_urls=[
            SourceUrlOut(
                id=source.id,
                product_id=source.product_id,
                url=source.url,
                domain=source.domain,
                added_at=source.added_at.isoformat() if source.added_at else None,
            )
            for source in source_urls
        ],
        tags=[_serialize_tag(tag) for tag in session.exec(select(Tag).join(ProductTagLink, ProductTagLink.tag_id == Tag.id).where(ProductTagLink.product_id == product.id)).all()],
    )

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/products", response_model=List[Product])
def list_products(q: Optional[str] = None, limit: int = 20, offset: int = 0):
    with Session(engine) as session:
        query = select(Product)
        if q:
            query = query.where(Product.title.contains(q))
        products = session.exec(query.offset(offset).limit(limit)).all()
        return products


@app.get("/api/dashboard/products", response_model=List[ProductSummaryOut])
def dashboard_products(q: Optional[str] = None, tag_id: Optional[int] = None, tag_kind: Optional[TagKind] = None, source_site: Optional[str] = None, limit: int = 50, offset: int = 0):
    with Session(engine) as session:
        query = select(Product)
        if q:
            query = query.where(Product.title.contains(q))
        if tag_id:
            tag_ids = _collect_descendant_tag_ids(session, tag_id)
            query = query.join(ProductTagLink, ProductTagLink.product_id == Product.id).where(ProductTagLink.tag_id.in_(tag_ids))
        if tag_kind:
            query = query.join(ProductTagLink, ProductTagLink.product_id == Product.id).join(Tag, Tag.id == ProductTagLink.tag_id).where(Tag.kind == tag_kind)
        if source_site:
            source_site_lower = source_site.strip().lower()
            matching_product_ids = [
                product.id
                for product in session.exec(query.distinct()).all()
                if source_site_lower in _product_source_labels(session, product.id)
            ]
            query = query.where(Product.id.in_(matching_product_ids or [-1]))
        products = session.exec(query.distinct().order_by(Product.created_at.desc()).offset(offset).limit(limit)).all()
        return [_serialize_summary(product, session) for product in products]

@app.get("/api/products/{product_id}", response_model=Product)
def get_product(product_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product

@app.post("/api/products", response_model=Product, status_code=201)
def create_product(product: Product):
    # Ignora eventuale id passato dall'utente
    product.id = None
    with Session(engine) as session:
        session.add(product)
        session.commit()
        session.refresh(product)
        return product

@app.patch("/api/products/{product_id}", response_model=Product)
def update_product(product_id: int, product_data: Product):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        product_data_dict = product_data.dict(exclude_unset=True)
        for k, v in product_data_dict.items():
            setattr(product, k, v)
        session.add(product)
        session.commit()
        session.refresh(product)
        return product

@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int):
    from sqlmodel import delete, select
    # prima verifichiamo l'esistenza senza caricare l'oggetto con relazioni
    with Session(engine) as session:
        exists = session.exec(select(Product.id).where(Product.id == product_id)).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Product not found")

    # Usiamo una nuova sessione per eseguire DELETE diretti in DB, evitando
    # che istanze ORM già caricate provochino flush che imposta FK a NULL.
    with Session(engine) as session:
        session.exec(delete(Price).where(Price.product_id == product_id))
        session.exec(delete(Image).where(Image.product_id == product_id))
        session.exec(delete(SourceUrl).where(SourceUrl.product_id == product_id))
        session.exec(delete(ProductTagLink).where(ProductTagLink.product_id == product_id))
        session.exec(delete(Product).where(Product.id == product_id))
        session.commit()
        return

# Endpoint per immagini, prezzi, source_urls, categorie possono essere aggiunti in modo simile
# Esempio: GET prezzi di un prodotto
@app.get("/api/products/{product_id}/prices", response_model=List[Price])
def get_product_prices(product_id: int):
    with Session(engine) as session:
        prices = session.exec(select(Price).where(Price.product_id == product_id)).all()
        return prices

# Esempio: GET immagini di un prodotto
@app.get("/api/products/{product_id}/images", response_model=List[Image])
def get_product_images(product_id: int):
    with Session(engine) as session:
        images = session.exec(select(Image).where(Image.product_id == product_id)).all()
        return images

# Esempio: GET source_urls di un prodotto
@app.get("/api/products/{product_id}/source_urls", response_model=List[SourceUrl])
def get_product_source_urls(product_id: int):
    with Session(engine) as session:
        urls = session.exec(select(SourceUrl).where(SourceUrl.product_id == product_id)).all()
        return urls

# CRUD IMMAGINI
@app.post("/api/images", response_model=Image, status_code=201)
def create_image(image: Image):
    image.id = None
    with Session(engine) as session:
        session.add(image)
        session.commit()
        session.refresh(image)
        return image


@app.patch("/api/images/{image_id}", response_model=Image)
def update_image(image_id: int, image_data: Image):
    with Session(engine) as session:
        image = session.get(Image, image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        data = image_data.dict(exclude_unset=True)
        for k, v in data.items():
            setattr(image, k, v)
        session.add(image)
        session.commit()
        session.refresh(image)
        return image


@app.delete("/api/images/{image_id}", status_code=204)
def delete_image(image_id: int):
    with Session(engine) as session:
        image = session.get(Image, image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        session.delete(image)
        session.commit()
        return

# CRUD PREZZI
@app.post("/api/prices", response_model=Price, status_code=201)
def create_price(price: Price):
    price.id = None
    with Session(engine) as session:
        session.add(price)
        session.commit()
        session.refresh(price)
        return price


@app.patch("/api/prices/{price_id}", response_model=Price)
def update_price(price_id: int, price_data: Price):
    with Session(engine) as session:
        price = session.get(Price, price_id)
        if not price:
            raise HTTPException(status_code=404, detail="Price not found")
        data = price_data.dict(exclude_unset=True)
        for k, v in data.items():
            setattr(price, k, v)
        session.add(price)
        session.commit()
        session.refresh(price)
        return price


@app.delete("/api/prices/{price_id}", status_code=204)
def delete_price(price_id: int):
    with Session(engine) as session:
        price = session.get(Price, price_id)
        if not price:
            raise HTTPException(status_code=404, detail="Price not found")
        session.delete(price)
        session.commit()
        return

# CRUD SOURCEURL
@app.post("/api/sourceurls", response_model=SourceUrl, status_code=201)
def create_sourceurl(sourceurl: SourceUrl):
    sourceurl.id = None
    with Session(engine) as session:
        session.add(sourceurl)
        session.commit()
        session.refresh(sourceurl)
        return sourceurl


@app.patch("/api/sourceurls/{source_id}", response_model=SourceUrl)
def update_sourceurl(source_id: int, source_data: SourceUrl):
    with Session(engine) as session:
        src = session.get(SourceUrl, source_id)
        if not src:
            raise HTTPException(status_code=404, detail="SourceUrl not found")
        data = source_data.dict(exclude_unset=True)
        for k, v in data.items():
            setattr(src, k, v)
        session.add(src)
        session.commit()
        session.refresh(src)
        return src


@app.delete("/api/sourceurls/{source_id}", status_code=204)
def delete_sourceurl(source_id: int):
    with Session(engine) as session:
        src = session.get(SourceUrl, source_id)
        if not src:
            raise HTTPException(status_code=404, detail="SourceUrl not found")
        session.delete(src)
        session.commit()
        return


@app.get("/api/tags", response_model=List[TagOut])
def list_tags(kind: Optional[TagKind] = None):
    with Session(engine) as session:
        query = select(Tag)
        if kind:
            query = query.where(Tag.kind == kind)
        tags = session.exec(query.order_by(Tag.kind, Tag.parent_id, Tag.name)).all()
        return [_serialize_tag(tag) for tag in tags]


@app.post("/api/tags", response_model=TagOut, status_code=201)
def create_tag(tag: Tag):
    tag.id = None
    with Session(engine) as session:
        session.add(tag)
        session.commit()
        session.refresh(tag)
        return _serialize_tag(tag)


@app.get("/api/tags/stats", response_model=TagsStatsOut)
def tags_stats():
    with Session(engine) as session:
        tags = session.exec(select(Tag).order_by(Tag.kind, Tag.name)).all()
        links = session.exec(select(ProductTagLink)).all()
        counts: Dict[int, int] = {}
        product_ids_with_tag = set()
        for l in links:
            counts[l.tag_id] = counts.get(l.tag_id, 0) + 1
            product_ids_with_tag.add(l.product_id)

        tag_list = [
            TagWithCount(
                id=t.id,
                name=t.name,
                slug=t.slug,
                kind=t.kind,
                parent_id=t.parent_id,
                tag_metadata=t.tag_metadata,
                count=counts.get(t.id, 0),
            )
            for t in tags
        ]

        products = session.exec(select(Product)).all()
        untagged_count = sum(1 for p in products if p.id not in product_ids_with_tag)

        return TagsStatsOut(tags=tag_list, untagged_count=untagged_count)


@app.get("/api/sourcewebsites/stats", response_model=SourceWebsitesStatsOut)
def source_websites_stats():
    with Session(engine) as session:
        counts: Dict[str, int] = {}
        products = session.exec(select(Product)).all()
        for product in products:
            for name in _product_source_labels(session, product.id):
                counts[name] = counts.get(name, 0) + 1

        websites = [
            SourceWebsiteOut(name=name, count=count)
            for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        ]
        return SourceWebsitesStatsOut(websites=websites)


@app.get("/api/dashboard/products/untagged", response_model=List[ProductSummaryOut])
def dashboard_products_untagged(limit: int = 50, offset: int = 0):
    with Session(engine) as session:
        subq = select(ProductTagLink.product_id)
        products = session.exec(
            select(Product)
            .where(~Product.id.in_(subq))
            .order_by(Product.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return [_serialize_summary(product, session) for product in products]


@app.get("/api/dashboard/products/{product_id}", response_model=ProductDetailOut)
def dashboard_product(product_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return _serialize_detail(product, session)


@app.patch("/api/tags/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, tag_data: Tag):
    with Session(engine) as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        data = tag_data.dict(exclude_unset=True)
        for k, v in data.items():
            setattr(tag, k, v)
        session.add(tag)
        session.commit()
        session.refresh(tag)
        return _serialize_tag(tag)


@app.delete("/api/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int):
    with Session(engine) as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        links = session.exec(select(ProductTagLink).where(ProductTagLink.tag_id == tag_id)).all()
        for link in links:
            session.delete(link)
        session.delete(tag)
        session.commit()
        return


@app.put("/api/products/{product_id}/tags", response_model=ProductDetailOut)
def set_product_tags(product_id: int, payload: ProductTagAssignmentIn):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        existing_links = session.exec(select(ProductTagLink).where(ProductTagLink.product_id == product_id)).all()
        for link in existing_links:
            session.delete(link)
        for tag_id in dict.fromkeys(payload.tag_ids):
            tag = session.get(Tag, tag_id)
            if not tag:
                raise HTTPException(status_code=404, detail=f"Tag {tag_id} not found")
            session.add(ProductTagLink(product_id=product_id, tag_id=tag_id))
        session.commit()
        session.refresh(product)
        return _serialize_detail(product, session)


@app.post("/api/products/{product_id}/tags/{tag_id}", response_model=ProductDetailOut)
def add_product_tag(product_id: int, tag_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        tag = session.get(Tag, tag_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if not tag:
            raise HTTPException(status_code=404, detail="Tag not found")
        
        # Collect tag + all ancestors
        tag_ids_to_add = _collect_ancestor_tag_ids(session, tag_id)
        
        # Add all (skip if already exists)
        for tid in tag_ids_to_add:
            existing = session.get(ProductTagLink, (product_id, tid))
            if not existing:
                session.add(ProductTagLink(product_id=product_id, tag_id=tid))
        
        session.commit()
        return _serialize_detail(product, session)


@app.delete("/api/products/{product_id}/tags/{tag_id}", response_model=ProductDetailOut)
def remove_product_tag(product_id: int, tag_id: int):
    with Session(engine) as session:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        link = session.get(ProductTagLink, (product_id, tag_id))
        if link:
            session.delete(link)
            session.commit()
        return _serialize_detail(product, session)

# CRUD CATEGORIE
@app.post("/api/categories", response_model=Category, status_code=201)
def create_category(category: Category):
    category.id = None
    with Session(engine) as session:
        session.add(category)
        session.commit()
        session.refresh(category)
        return category
