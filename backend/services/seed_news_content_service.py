import json
from pathlib import Path
from typing import Any

from models.news_article import NewsArticle


NEWS_FIXTURE_PATH = Path(__file__).resolve().parent.parent / "data" / "news_seed.json"


def load_news_fixture() -> list[dict[str, Any]]:
    with NEWS_FIXTURE_PATH.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, list):
        raise ValueError("Invalid news fixture format")

    return payload


async def ensure_default_news_articles() -> None:
    for item in load_news_fixture():
        article = await NewsArticle.find_one(NewsArticle.slug == item["slug"])
        if not article:
            article = NewsArticle(
                slug=item["slug"],
                title=item["title"],
                intro=item.get("intro", ""),
                preview=item.get("preview", ""),
                body=item.get("body", []),
                is_published=item.get("is_published", True),
            )
            await article.insert()
            continue

        changed = False
        for field in ["title", "intro", "preview", "body", "is_published"]:
            value = item.get(field, getattr(article, field))
            if getattr(article, field) != value:
                setattr(article, field, value)
                changed = True

        if changed:
            article.touch()
            await article.save()
