"""Runtime configuration (env vars, with defaults for this project)."""
import os

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "project-d5fe6dd3-2b61-40b3-932")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")  # newest Gemini models are served only from "global"
BUCKET = os.environ.get("ASSETS_BUCKET", f"{PROJECT}-assets")

MODEL_INTAKE = os.environ.get("MODEL_INTAKE", "gemini-3.8-flash")
MODEL_ARCHITECT = os.environ.get("MODEL_ARCHITECT", "gemini-4-argon")
MODEL_IMAGE = os.environ.get("MODEL_IMAGE", "gemini-3.1-flash-image")
MODEL_IMAGE_HERO = os.environ.get("MODEL_IMAGE_HERO", "gemini-3-pro-image")
# Fallbacks when the primary image model is rate-limited (each model has its own quota).
MODEL_IMAGE_FALLBACKS = os.environ.get("MODEL_IMAGE_FALLBACKS", "gemini-nano-banana-2.1,gemini-3-pro-image")

MODEL_REVIEW = os.environ.get("MODEL_REVIEW", MODEL_ARCHITECT)      # the architect's self-review of the drawn plan
MODEL_SETUP = os.environ.get("MODEL_SETUP", MODEL_INTAKE)           # the conversational setup agent (ADK)

PLAN_MAX_ATTEMPTS = int(os.environ.get("PLAN_MAX_ATTEMPTS", "4"))
SELF_REVIEW = os.environ.get("SELF_REVIEW", "1") not in ("0", "false", "no")
REVIEW_BUDGET_S = float(os.environ.get("REVIEW_BUDGET_S", "300"))  # the optional post-review revision never costs more

# Identity Platform (email + password). The browser key is public by design (it identifies the project, not a secret),
# but it is still never committed: it comes from the environment.
AUTH_API_KEY = os.environ.get("NAQSHA_AUTH_API_KEY", "")
AUTH_PROJECT = os.environ.get("NAQSHA_AUTH_PROJECT", PROJECT)

# ADK builds its own google-genai client from the environment; make local runs match Cloud Run.
os.environ.setdefault("GOOGLE_GENAI_USE_ENTERPRISE", "TRUE")
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", PROJECT)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", LOCATION)
