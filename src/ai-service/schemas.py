"""The JSON contract between this service and the Next.js backend.

`NotesGeneration` mirrors `notesGenerationSchema` in src/contracts/notes.ts
(camelCase on purpose, so the JSON matches 1:1). If you change it, change the
TypeScript contract too and tell the team, because they are building against it.
"""
from typing import Literal

from pydantic import BaseModel, Field

# Keep in sync with NOTE_BLOCK_KINDS in src/contracts/notes.ts.
BlockKind = Literal["paragraph", "bullet", "definition", "example", "equation"]


# ---- What this service returns --------------------------------------------

class SourceRef(BaseModel):
    imageId: str


class NoteBlock(BaseModel):
    kind: BlockKind
    text: str = Field(min_length=1)
    sourceRefs: list[SourceRef]


class NoteSection(BaseModel):
    heading: str = Field(min_length=1)
    blocks: list[NoteBlock] = Field(min_length=1)


class NotesGeneration(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    sections: list[NoteSection] = Field(min_length=1)
    suggestedCategoryName: str | None = Field(default=None, max_length=60)


# ---- What we ask Gemini for ------------------------------------------------
# The model cites images by their 1-based number in the prompt instead of by
# UUID: models mangle long ids, and numbers let us drop out-of-range refs.

class _GeminiBlock(BaseModel):
    kind: BlockKind
    text: str = Field(
        description="Markdown for prose. For kind 'equation', LaTeX without $ delimiters."
    )
    source_images: list[int] = Field(
        description="1-based numbers of the images this block was read from"
    )


class _GeminiSection(BaseModel):
    heading: str
    blocks: list[_GeminiBlock]


class GeminiNotes(BaseModel):
    title: str = Field(description="Short title inferred from the content")
    sections: list[_GeminiSection]
    suggested_category_name: str | None = Field(
        default=None,
        description="Subject area, e.g. 'Organic Chemistry'. A suggestion only.",
    )
