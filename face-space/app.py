"""Face worker for Confra da Firma.

Loop: ask the app's `faces` function for jobs, download each image from its short-lived link, find faces
with InsightFace (buffalo_l: RetinaFace detection + ArcFace recognition) and send back the normalized
512-number signatures. Images live only in memory.

Runs on GitHub Actions (workflow "Face worker"): with RUN_MINUTES it works for that long and exits, and
with DRAIN=1 it exits a few minutes after the queue empties. Without either it runs forever with a tiny health
server on port 7860 (for Docker hosting).
"""

import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import cv2
import numpy as np
import requests

FACES_URL = os.environ.get("FACES_URL", "https://optapzbhyhklcirdoyid.supabase.co/functions/v1/faces")
SECRET = os.environ.get("FACE_SECRET", "")
MAX_SIDE = 2400  # big group shots keep faces in the back row big enough to find
MIN_FACE = 36  # pixels; smaller faces are too blurry to recognize reliably
MIN_SCORE = 0.6  # detector confidence
DET = 1024  # detector window; a bigger photo is also read in overlapping tiles of this size

_model = None
status = {"started": time.time(), "done": 0, "errors": 0, "last": None, "note": "starting"}


def load_model():
    global _model
    if _model is None:
        from insightface.app import FaceAnalysis

        fa = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=["detection", "recognition"])
        fa.prepare(ctx_id=-1, det_size=(DET, DET))
        _model = fa
    return _model


def read_image(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    img = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("not an image")
    h, w = img.shape[:2]
    scale = min(1.0, MAX_SIDE / max(h, w))
    if scale < 1:
        img = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def keep(faces):
    return [f for f in faces if f.det_score >= MIN_SCORE and min(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]) >= MIN_FACE]


def iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def detect(img, tiles=False):
    """Faces in the photo. With tiles, a big photo is also read in overlapping tiles at full size: the
    whole-photo pass shrinks it to the detector window, and small faces in the back of a group shot get lost."""
    faces = keep(load_model().get(img))
    h, w = img.shape[:2]
    if not tiles or max(h, w) <= DET * 1.25:
        return faces
    step = int(DET * 0.75)
    for y in range(0, max(1, h - DET // 4), step):
        for x in range(0, max(1, w - DET // 4), step):
            y0, x0 = min(y, max(0, h - DET)), min(x, max(0, w - DET))
            tile = np.ascontiguousarray(img[y0 : y0 + DET, x0 : x0 + DET])
            th, tw = tile.shape[:2]
            for f in keep(load_model().get(tile)):
                b = f.bbox
                # cut by the tile edge: the neighbor tile or the whole-photo pass sees it whole
                if (b[0] < 2 and x0 > 0) or (b[1] < 2 and y0 > 0) or (b[2] > tw - 2 and x0 + tw < w) or (b[3] > th - 2 and y0 + th < h):
                    continue
                f.bbox = b + np.array([x0, y0, x0, y0], dtype=b.dtype)
                if not any(iou(f.bbox, g.bbox) > 0.3 for g in faces):
                    faces.append(f)
    return faces


def shrunk(img, side):
    """The image scaled down to `side` and centered on a gray square: a close-up face then fits the detector."""
    h, w = img.shape[:2]
    scale = side / max(h, w)
    small = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    canvas = np.full((side * 2, side * 2, 3), 127, np.uint8)
    y, x = (side * 2 - small.shape[0]) // 2, (side * 2 - small.shape[1]) // 2
    canvas[y : y + small.shape[0], x : x + small.shape[1]] = small
    return canvas


def selfie_faces(img):
    """Selfies are close-ups, sometimes sideways: the detector misses faces bigger than about half its window."""
    tries = [img, shrunk(img, 480), shrunk(img, 320)]
    tries += [cv2.rotate(t, r) for t in tries[:2] for r in (cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180)]
    for t in tries:
        faces = detect(t)
        if faces:
            return faces
    return []


def signatures(img, largest_only=False):
    faces = selfie_faces(img) if largest_only else detect(img, tiles=True)
    if largest_only and faces:
        faces = [max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))]
    h, w = img.shape[:2]
    # where each face is, in fractions of the photo, so the app can let people tap it
    boxes = [[round(float(v), 4) for v in (f.bbox[0] / w, f.bbox[1] / h, (f.bbox[2] - f.bbox[0]) / w, (f.bbox[3] - f.bbox[1]) / h)] for f in faces]
    return [[round(float(x), 6) for x in f.normed_embedding] for f in faces], boxes


def call(op, body=None):
    headers = {"x-face-secret": SECRET}
    if body is None:
        r = requests.get(FACES_URL, params={"op": op}, headers=headers, timeout=60)
    else:
        r = requests.post(FACES_URL, params={"op": op}, json=body, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()


def work_once():
    jobs = call("queue").get("jobs", [])
    for job in jobs:
        try:
            img = read_image(job["url"])
            emb, boxes = signatures(img, largest_only=job["kind"] == "selfie")
            # sizes and counts only, never the image: tells why a selfie found no face
            print(f"{job['kind']}: {img.shape[1]}x{img.shape[0]}, {len(emb)} rosto(s)", flush=True)
            del img
            call("save", {"kind": job["kind"], "id": job["id"], "embeddings": emb, "boxes": boxes})
            status["done"] += 1
        except Exception as e:  # one bad photo must not stop the queue
            status["errors"] += 1
            status["note"] = f"{type(e).__name__}"
            try:
                call("fail", {"kind": job["kind"], "id": job["id"]})
            except Exception:
                pass
    return len(jobs)


def loop():
    if not SECRET:
        status["note"] = "FACE_SECRET missing"
        return
    load_model()
    idle = 5
    while True:
        try:
            n = work_once()
            status["last"] = time.time()
            status["note"] = "ok"
            idle = 3 if n else min(idle * 2, 30)
        except Exception as e:
            status["note"] = f"queue: {type(e).__name__}"
            idle = 30
        time.sleep(idle)


class Health(BaseHTTPRequestHandler):
    def do_GET(self):
        body = (
            f"confra rostos: {status['note']} · {status['done']} feitas · {status['errors']} erros"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


LINGER = 180  # seconds


def run_for(minutes, drain):
    """GitHub Actions mode: work until the time is up (or the queue is empty with drain), then exit."""
    if not SECRET:
        print("FACE_SECRET missing")
        raise SystemExit(1)
    load_model()
    end = time.time() + minutes * 60
    idle, last_work = 3, time.time()
    while time.time() < end:
        try:
            n = work_once()
            if n:
                last_work = time.time()
            idle = 3 if n else min(idle * 2, 20)
        except Exception as e:
            print("queue:", type(e).__name__, flush=True)
            idle = 30
        # drain: stay a few minutes after the queue empties, so photos sent right after are read at once
        if drain and time.time() - last_work > LINGER:
            break
        time.sleep(idle)
    print(f"done: {status['done']} photos, {status['errors']} errors", flush=True)


if __name__ == "__main__":
    minutes = float(os.environ.get("RUN_MINUTES") or 0)
    if minutes:
        run_for(minutes, os.environ.get("DRAIN") == "1")
    else:
        threading.Thread(target=loop, daemon=True).start()
        HTTPServer(("0.0.0.0", 7860), Health).serve_forever()
