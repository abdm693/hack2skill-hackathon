"""Naqsha API: FastAPI app that serves /api/* and the built SPA (web/dist) from one Cloud Run service."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Naqsha API")


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "models": {
            "intake": os.environ.get("MODEL_INTAKE", "gemini-3.8-flash"),
            "architect": os.environ.get("MODEL_ARCHITECT", "gemini-4-argon"),
            "image": os.environ.get("MODEL_IMAGE", "gemini-3.1-flash-image"),
        },
    }


# --- SPA (built web app) -------------------------------------------------------------------------
WEB_DIST = Path(os.environ.get("WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist"))
if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = WEB_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(WEB_DIST / "index.html")
