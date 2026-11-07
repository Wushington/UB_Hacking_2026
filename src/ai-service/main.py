"""AI service. Run with:  uvicorn main:app --reload --port 8000
Interactive docs for your teammates: http://localhost:8000/docs
"""
from dotenv import load_dotenv

load_dotenv()  # must run before gemini_client reads GEMINI_API_KEY

from fastapi import FastAPI, HTTPException, UploadFile  # noqa: E402

from gemini_client import AIServiceError, make_flashcards, transcribe_image  # noqa: E402
from preprocess import preprocess  # noqa: E402
from schemas import FlashcardSet, NoteResult  # noqa: E402

app = FastAPI(title="Orbit Study", version="0.1.0", description="AI service for transcribing handwritten notes, generating flashcards, helping students learn, and more.")

MAX_UPLOAD = 15 * 1024 * 1024


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/process-image", response_model=NoteResult)
async def process_image(file: UploadFile, enhance: bool = True):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "Upload an image file")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Image too large (15 MB max)")
    try:
        jpeg = preprocess(data, enhance=enhance)
    except Exception:
        raise HTTPException(400, "Could not read that image")
    try:
        return await transcribe_image(jpeg)
    except AIServiceError as e:
        raise HTTPException(502, str(e))


@app.post("/flashcards", response_model=FlashcardSet)
async def flashcards(note: NoteResult, count: int = 10):
    try:
        return await make_flashcards(note, count)
    except AIServiceError as e:
        raise HTTPException(502, str(e))
