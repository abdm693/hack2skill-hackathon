"""Runtime configuration (env vars, with defaults for this project)."""
import os

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "project-d5fe6dd3-2b61-40b3-932")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")  # newest Gemini models are served only from "global"
BUCKET = os.environ.get("ASSETS_BUCKET", f"{PROJECT}-assets")

MODEL_INTAKE = os.environ.get("MODEL_INTAKE", "gemini-3.8-flash")
MODEL_ARCHITECT = os.environ.get("MODEL_ARCHITECT", "gemini-4-argon")
MODEL_IMAGE = os.environ.get("MODEL_IMAGE", "gemini-3.1-flash-image")
MODEL_IMAGE_HERO = os.environ.get("MODEL_IMAGE_HERO", "gemini-3-pro-image")

PLAN_MAX_ATTEMPTS = int(os.environ.get("PLAN_MAX_ATTEMPTS", "3"))

# ADK builds its own google-genai client from the environment; make local runs match Cloud Run.
os.environ.setdefault("GOOGLE_GENAI_USE_ENTERPRISE", "TRUE")
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", PROJECT)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", LOCATION)
