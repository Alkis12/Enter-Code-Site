import re
import unicodedata
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from models.news_article import NewsArticle
from models.user import User, UserType
from schemas.requests import CreateNewsArticleRequest, UpdateNewsArticleRequest
from schemas.responses import NewsArticleResponse
from services.auth_service import require_role
from services.serializer_service import serialize_news_article


router = APIRouter(prefix="/news", tags=["Новости"])


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized or "news-item"


async def ensure_unique_slug(base_slug: str, exclude_id: str | None = None) -> str:
    slug = base_slug
    suffix = 2
    while True:
        existing = await NewsArticle.find_one(NewsArticle.slug == slug)
        if not existing or str(existing.id) == exclude_id:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


@router.get("/public", response_model=List[NewsArticleResponse])
async def public_news_list():
    items = await NewsArticle.find(NewsArticle.is_published == True).sort("-created_at").to_list()
    return [serialize_news_article(item, editable=False) for item in items]


@router.get("/public/{slug}", response_model=NewsArticleResponse)
async def public_news_detail(slug: str):
    article = await NewsArticle.find_one(NewsArticle.slug == slug)
    if not article or not article.is_published:
        raise HTTPException(status_code=404, detail="Новость не найдена")
    return serialize_news_article(article, editable=False)


@router.get("/manage", response_model=List[NewsArticleResponse])
async def manage_news_list(
    user: User = Depends(require_role(UserType.TEACHER)),
):
    items = await NewsArticle.find_all().sort("-created_at").to_list()
    return [serialize_news_article(item, editable=True) for item in items]


@router.get("/manage/{slug}", response_model=NewsArticleResponse)
async def manage_news_detail(
    slug: str,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    article = await NewsArticle.find_one(NewsArticle.slug == slug)
    if not article:
        raise HTTPException(status_code=404, detail="Новость не найдена")
    return serialize_news_article(article, editable=True)


@router.post("", response_model=NewsArticleResponse)
async def create_news_article(
    payload: CreateNewsArticleRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    base_slug = slugify(payload.slug or payload.title)
    article = NewsArticle(
        slug=await ensure_unique_slug(base_slug),
        title=payload.title,
        intro=payload.intro,
        preview=payload.preview,
        body=payload.body,
        is_published=payload.is_published,
    )
    await article.insert()
    return serialize_news_article(article, editable=True)


@router.put("/{article_id}", response_model=NewsArticleResponse)
async def update_news_article(
    article_id: str,
    payload: UpdateNewsArticleRequest,
    user: User = Depends(require_role(UserType.TEACHER)),
):
    article = await NewsArticle.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Новость не найдена")

    for field in ["title", "intro", "preview", "body", "is_published"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(article, field, value)

    if payload.slug is not None or payload.title is not None:
        slug_source = payload.slug or article.slug or article.title
        article.slug = await ensure_unique_slug(
            slugify(slug_source),
            exclude_id=str(article.id),
        )

    article.touch()
    await article.save()
    return serialize_news_article(article, editable=True)
