"""
KP Astro Webapp - FastAPI entry point.

Run with:  uvicorn main:app --reload
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.ephemeris import current_ayanamsa, SUPPORTED_AYANAMSAS
from api import (
    routes_chart,
    routes_significators,
    routes_dasha,
    routes_horary,
    routes_profile,
)

app = FastAPI(
    title="KP Astro Webapp",
    description="Krishnamurti Paddhati (KP) astrology calculation API",
    version="0.1.0",
)

# Allow frontend (React/HTML) to call this API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



class AyanamsaMiddleware:
    """Pure-ASGI middleware: reads X-Ayanamsa (KRISHNAMURTI | LAHIRI) into a
    context variable so every calculation in the request uses it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            value = dict(scope["headers"]).get(b"x-ayanamsa", b"").decode().strip().upper()
            token = current_ayanamsa.set(value if value in SUPPORTED_AYANAMSAS else None)
            try:
                await self.app(scope, receive, send)
            finally:
                current_ayanamsa.reset(token)
        else:
            await self.app(scope, receive, send)


app.add_middleware(AyanamsaMiddleware)

app.include_router(routes_chart.router, prefix="/chart", tags=["Chart"])
app.include_router(routes_significators.router, prefix="/significators", tags=["Significators"])
app.include_router(routes_dasha.router, prefix="/dasha", tags=["Dasha"])
app.include_router(routes_horary.router, prefix="/horary", tags=["Horary"])
app.include_router(routes_profile.router, prefix="/profile", tags=["Profile"])


FRONTEND_DIR = Path(__file__).parent / "frontend"

# Serve the whole frontend/ folder (index.html, styles.css, js/*.js) at
# /app. html=True means /app itself resolves to /app/index.html, and
# every other file (styles.css, js/app.js, js/sections/*.js, ...) is
# served at its matching path underneath /app/.
app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


@app.get("/")
def root():
    return {
        "status": "ok",
        "app": "KP Astro Webapp",
        "message": "See /docs for API reference, or /app for the web UI.",
    }


if __name__ == "__main__":
    # Allows running directly: `python main.py` (or double-click on Windows
    # if .py files are associated with python.exe).
    # Note: --reload (auto-restart on code changes) only works via the
    # `uvicorn main:app --reload` command line, not this block.
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
