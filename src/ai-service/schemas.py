"""The JSON contract between this service and the Node backend.

Share this shape with the backend/frontend team early. If you change it,
tell them, because they are building against it.
"""
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "algebra", "calculus", "statistics", "probability", "physics", "chemistry", "biology",
    "computer_science", "english", "history", "other",
]


class Block(BaseModel):
    id: int = Field(description="Sequential id starting at 0, in reading order")
    type: Literal["heading", "text", "equation", "list", "diagram"]
    content: str = Field(
        description="Faithful transcription. Markdown for text, LaTeX (no $ delimiters) "
                    "for equations, a short description for diagrams."
    )
    legibility: Literal["clear", "unsure", "illegible"] = Field(
        description="'unsure' if any word or symbol was a guess"
    )
    unsure_spans: list[str] = Field(
        default_factory=list,
        description="Exact substrings of content that were guessed",
    )


class Correction(BaseModel):
    block_id: int
    kind: Literal["spelling", "grammar", "math"]
    original: str = Field(description="Exact substring from the block's content")
    suggested: str
    reason: str = Field(description="One short sentence")


class NoteResult(BaseModel):
    title: str = Field(description="Short title inferred from the content")
    category: Category
    blocks: list[Block]
    corrections: list[Correction] = Field(
        default_factory=list,
        description="Suggested fixes. Never applied to blocks.",
    )


class Flashcard(BaseModel):
    front: str
    back: str


class FlashcardSet(BaseModel):
    cards: list[Flashcard]
