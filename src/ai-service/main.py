"""AI service: whiteboard/notebook photos -> organized notes.

Only the Next.js server calls this (src/lib/ai/notes.ts); it is never exposed
to browsers. All other Gemini features (flashcards, audio, explanations) live
in the Next.js app.

Run with:  uvicorn main:app --reload --port 8000
Interactive docs for teammates: http://localhost:8000/docs
"""
import asyncio
from pathlib import Path
from typing import Annotated
from uuid import UUID

from dotenv import load_dotenv

# Must run before gemini_client reads GEMINI_API_KEY / GEMINI_MODEL. Shares the Next.js app's
# .env.local at the repo root; a local .env still works. Neither overrides real env vars.
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")
load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402

from gemini_client import AIServiceError, generate_notes  # noqa: E402
from preprocess import preprocess  # noqa: E402
from schemas import NotesGeneration  # noqa: E402

app = FastAPI(
    title="Orbit Study AI service",
    version="0.2.0",
    description="Turns photos of handwritten notes into organized study notes.",
)

# Keep in sync with src/contracts/images.ts and src/contracts/uploads.ts.
MIN_IMAGES, MAX_IMAGES = 2, 5
MAX_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process-notes", response_model=NotesGeneration, response_model_exclude_none=True)
async def process_notes(
    files: Annotated[
        list[UploadFile],
        File(
            description="Images in the student's chosen order",
            # Swagger UI (/docs) only shows file pickers for array items marked
            # format: binary; FastAPI's OpenAPI 3.1 output omits it.
            json_schema_extra={"items": {"type": "string", "format": "binary"}},
        ),
    ],
    image_ids: Annotated[
        list[str],
        Form(description="One id per file, same order (repeated fields or comma-separated)"),
    ],
    enhance: bool = True,
):
    if not MIN_IMAGES <= len(files) <= MAX_IMAGES:
        raise HTTPException(422, f"Send {MIN_IMAGES}-{MAX_IMAGES} images")
    ids = _parse_ids(image_ids)
    if len(ids) != len(files):
        raise HTTPException(422, "Send exactly one image_id per file")
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Each image can appear only once")

    jpegs = []
    for f in files:
        if f.content_type not in IMAGE_MIME_TYPES:
            raise HTTPException(415, "Images must be JPG, PNG or WebP")
        data = await f.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image too large (10 MB max)")
        try:
            # OpenCV work is CPU-bound; keep it off the event loop.
            jpegs.append(await asyncio.to_thread(preprocess, data, enhance))
        except Exception:
            raise HTTPException(400, f"Could not read image {f.filename or ''}".strip())

    try:
        return await generate_notes(jpegs, ids)
    except AIServiceError as e:
        raise HTTPException(502, str(e))


def _parse_ids(values: list[str]) -> list[str]:
    """Accept repeated image_ids fields (what Next.js sends) or one comma-separated
    value (what Swagger UI at /docs sends), and normalize them to canonical UUIDs."""
    ids = []
    for part in (p.strip() for v in values for p in v.split(",")):
        if not part:
            continue
        try:
            ids.append(str(UUID(part)))
        except ValueError:
            raise HTTPException(422, f"image_ids must be UUIDs; got {part[:40]!r}")
    return ids
