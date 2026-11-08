"""All Gemini calls for the AI service live here, so swapping models or providers touches one file."""
import asyncio
import os

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from schemas import GeminiNotes, NoteBlock, NoteSection, NotesGeneration, SourceRef

# Use the alias to prevent hardcoding a version that gets retired.
# To pin a specific model, set GEMINI_MODEL in .env.local (shared with the Next.js app).
MODEL = os.getenv("GEMINI_MODEL", "").strip() or "gemini-flash-latest"

# Reads GEMINI_API_KEY from the environment.
client = genai.Client()

NOTES_PROMPT = """You are turning photos of handwritten lecture notes \
(notebook, whiteboard, chalkboard, etc.) into organized study notes for a student.
The {count} images are numbered 1 to {count} in the order the student chose; \
treat them as one continuous set of notes.

Rules:
1. Transcribe faithfully. Do not invent facts that are not in the images. \
If something is unreadable, leave it out rather than guessing.
2. Group the content into sections with short headings, in reading order \
(image order, then top to bottom, left to right, respecting columns).
3. Choose the block kind that fits: paragraph, bullet, definition, example, or equation.
4. Equations go in their own `equation` block as LaTeX without $ delimiters.
5. For every block, list in `source_images` the number(s) of the image(s) it came from.
6. Ignore content that is clearly not notes (room background, erased smudges).
"""


class AIServiceError(Exception):
    pass


async def _generate(contents, schema: type[BaseModel], retries: int = 2) -> BaseModel:
    """Call Gemini with a response schema, validate, retry on bad JSON or 429."""
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
    )
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            resp = await client.aio.models.generate_content(
                model=MODEL, contents=contents, config=config
            )
            if isinstance(resp.parsed, schema):
                return resp.parsed
            # parsed can be None if the SDK couldn't map it; validate ourselves
            return schema.model_validate_json(resp.text or "")
        except ValidationError as e:
            last_err = e  # malformed JSON: just try again
        except errors.APIError as e:
            last_err = e
            if e.code == 429:  # free-tier rate limit
                await asyncio.sleep(2 ** attempt * 5)
            elif e.code is not None and e.code < 500:
                raise AIServiceError(f"Gemini rejected the request: {e}") from e
        await asyncio.sleep(0.5)
    raise AIServiceError(f"Gemini failed after {retries + 1} attempts: {last_err}")


async def generate_notes(jpegs: list[bytes], image_ids: list[str]) -> NotesGeneration:
    """One Gemini call over the whole batch, so sections can span images."""
    contents: list = []
    for n, jpeg in enumerate(jpegs, start=1):
        contents.append(f"Image {n}:")
        contents.append(types.Part.from_bytes(data=jpeg, mime_type="image/jpeg"))
    contents.append(NOTES_PROMPT.format(count=len(jpegs)))

    raw = await _generate(contents, GeminiNotes)
    return _to_contract(raw, image_ids)


def _to_contract(raw: GeminiNotes, image_ids: list[str]) -> NotesGeneration:
    """Map image numbers to ids and drop anything the contract would reject.

    Out-of-range image numbers are discarded (the model made them up), as are
    empty blocks and sections left with no blocks.
    """
    sections = []
    for s in raw.sections:
        blocks = []
        for b in s.blocks:
            text = b.text.strip()
            if not text:
                continue
            nums = sorted({n for n in b.source_images if 1 <= n <= len(image_ids)})
            blocks.append(NoteBlock(
                kind=b.kind,
                text=text,
                sourceRefs=[SourceRef(imageId=image_ids[n - 1]) for n in nums],
            ))
        if blocks:
            sections.append(NoteSection(heading=s.heading.strip() or "Notes", blocks=blocks))
    if not sections:
        raise AIServiceError("Gemini found no readable notes in these images")

    category = (raw.suggested_category_name or "").strip()[:60] or None
    return NotesGeneration(
        title=raw.title.strip()[:200] or "Untitled notes",
        sections=sections,
        suggestedCategoryName=category,
    )
