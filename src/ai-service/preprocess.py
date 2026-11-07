"""Image cleanup before sending to Gemini.

Kept deliberately simple: fix phone rotation, cap the size, even out contrast.
Perspective correction (finding the board/page corners) is a stretch goal;
test whether it actually helps on your photos before spending time on it.
"""
import io

import cv2
import numpy as np
from PIL import Image, ImageOps

MAX_SIDE = 2048  # big enough for small handwriting, small enough to upload fast


def preprocess(image_bytes: bytes, enhance: bool = True) -> bytes:
    """Return JPEG bytes ready for the model."""
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)  # phones store rotation in EXIF
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))

    arr = np.array(img)
    if enhance:
        # CLAHE on the lightness channel: helps glare and dim whiteboards
        # without wrecking colored ink.
        lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        arr = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)

    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(arr, cv2.COLOR_RGB2BGR),
                           [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise ValueError("Could not encode image")
    return buf.tobytes()
