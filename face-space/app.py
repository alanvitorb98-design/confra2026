"""Face worker for Confra da Firma.

Loop: ask the app's `faces` function for jobs, download each image from its short-lived link, find faces
with InsightFace (buffalo_l: RetinaFace detection + ArcFace recognition) and send back the normalized
512-number signatures. Images live only in memory.

Runs on GitHub Actions (workflow "Face worker"): with RUN_MINUTES it works for that long and exits, and
with DRAIN=1 it exits as soon as the queue is empty. Without either it runs forever with a tiny health
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
MAX_SIDE = 1600  # enough to find faces in group shots; bigger only costs time
MIN_FACE = 36  # pixels; smaller faces are too blurry to recognize reliably
MIN_SCORE = 0.6  # detector confidence

_model = None
status = {"started": time.time(), "done": 0, "errors": 0, "last": None, "note": "starting"}


def load_model():
    global _model
    if _model is None:
        from insightface.app import FaceAnalysis

        fa = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"], allowed_modules=["detection", "recognition"])
        fa.prepare(ctx_id=-1, det_size=(1024, 1024))
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


def detect(img):
    return [
        f
        for f in load_model().get(img)
        if f.det_score >= MIN_SCORE and min(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]) >= MIN_FACE
    ]


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
    faces = selfie_faces(img) if largest_only else detect(img)
    if largest_only and faces:
        faces = [max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))]
    return [[round(float(x), 6) for x in f.normed_embedding] for f in faces]


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
            emb = signatures(img, largest_only=job["kind"] == "selfie")
            # sizes and counts only, never the image: tells why a selfie found no face
            print(f"{job['kind']}: {img.shape[1]}x{img.shape[0]}, {len(emb)} rosto(s)", flush=True)
            del img
            call("save", {"kind": job["kind"], "id": job["id"], "embeddings": emb})
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


def run_for(minutes, drain):
    """GitHub Actions mode: work until the time is up (or the queue is empty with drain), then exit."""
    if not SECRET:
        print("FACE_SECRET missing")
        raise SystemExit(1)
    load_model()
    end = time.time() + minutes * 60
    idle, empty = 3, 0
    while time.time() < end:
        try:
            n = work_once()
            empty = 0 if n else empty + 1
            idle = 3 if n else min(idle * 2, 20)
        except Exception as e:
            print("queue:", type(e).__name__, flush=True)
            idle = 30
        if drain and empty >= 2:
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
