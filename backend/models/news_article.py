from datetime import datetime
from typing import List

from beanie import Document
from pydantic import Field


class NewsArticle(Document):
    slug: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    intro: str = Field(default="", max_length=300)
    preview: str = Field(default="", max_length=500)
    body: List[str] = Field(default_factory=list)
    is_published: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    class Settings:
        name = "news_articles"
