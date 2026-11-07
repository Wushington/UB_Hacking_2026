"""All Gemini calls live here, so swapping models or providers touches one file."""
import asyncio
import os

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from schemas import FlashcardSet, NoteResult

# Use the alias so you are not hardcoding a version that gets retired.
# To pin a specific model, set GEMINI_MODEL in .env (copy the ID from AI Studio).
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

# Reads GEMINI_API_KEY from the environment.
client = genai.Client()

TRANSCRIBE_PROMPT = """You are transcribing a photo of handwritten notes \
(notebook, whiteboard, chalkboard, etc.) for a student.

Rules:
1. Transcribe FAITHFULLY. Do not fix spelling, grammar, or math inside `content`. \
Copy mistakes exactly as written.
2. Put every suggested fix in `corrections` instead, quoting the exact original substring.
3. Equations go in their own block as LaTeX without $ delimiters.
4. If you cannot read something, do not invent it. Mark the block `unsure` or \
`illegible` and list the guessed substrings in `unsure_spans`.
5. Ignore content that is clearly not notes (room background, erased smudges).
6. Keep reading order: top to bottom, left to right, respecting columns.
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


async def transcribe_image(jpeg_bytes: bytes) -> NoteResult:
    contents = [
        types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
        TRANSCRIBE_PROMPT,
    ]
    result = await _generate(contents, NoteResult)
    return _drop_bad_corrections(result)


async def make_flashcards(note: NoteResult, count: int = 10) -> FlashcardSet:
    # Built from the transcribed text, not the image, so OCR errors don't compound.
    text = "\n\n".join(b.content for b in note.blocks if b.legibility != "illegible")
    prompt = (
        f"Make up to {count} study flashcards from these {note.category} notes. "
        "Only use facts that appear in the notes. Equations in LaTeX.\n\n" + text
    )
    return await _generate([prompt], FlashcardSet)


def _drop_bad_corrections(note: NoteResult) -> NoteResult:
    """Throw out corrections whose `original` isn't actually in the block.

    The frontend highlights `original` inside the block text, so a correction
    that points at text that doesn't exist would break the UI (and usually
    means the model hallucinated it).
    """
    by_id = {b.id: b.content for b in note.blocks}
    note.corrections = [
        c for c in note.corrections
        if c.block_id in by_id and c.original and c.original in by_id[c.block_id]
    ]
    return note
