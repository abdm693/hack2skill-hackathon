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

PLAN_MAX_ATTEMPTS = int(os.environ.get("PLAN_MAX_ATTEMPTS", "3"))
# Thinking level for fix rounds ("" = the model's default). MEDIUM was tried: a 1 kanal fix round came back fast but with 45
# failures, so fix rounds keep full thinking; time is saved by fewer rounds, the shorter review and the parallel build.
FIX_THINKING = os.environ.get("FIX_THINKING", "") or None
SELF_REVIEW = os.environ.get("SELF_REVIEW", "1") not in ("0", "false", "no")
REVIEW_BUDGET_S = float(os.environ.get("REVIEW_BUDGET_S", "150"))  # the optional post-review revision never costs more
# The post-review revision edits a checked plan against a concrete list, and is checked again: it thinks less to land in time.
REVIEW_THINKING = os.environ.get("REVIEW_THINKING", "LOW") or None
# When planning already took this long or used every attempt, the review still critiques the drawings (its open issues are
# listed with the checks) but makes no revision: the checked plan is built as it is.
REVIEW_SKIP_AFTER_S = float(os.environ.get("REVIEW_SKIP_AFTER_S", "360"))
# The critique (Argon looking at the drawn floors) has its own timeout; it overlaps the 3D build, and the run goes on without
# it when it runs over.
REVIEW_CRITIQUE_S = float(os.environ.get("REVIEW_CRITIQUE_S", "90"))

# Identity Platform (email + password). The browser key is public by design (it identifies the project, not a secret),
# but it is still never committed: it comes from the environment.
AUTH_API_KEY = os.environ.get("NAQSHA_AUTH_API_KEY", "")
AUTH_PROJECT = os.environ.get("NAQSHA_AUTH_PROJECT", PROJECT)
# Key for the opaque comment-author handles in share payloads (set it in production; the fallback still never reveals ids).
HANDLE_SECRET = os.environ.get("NAQSHA_HANDLE_SECRET", "")

# ADK builds its own google-genai client from the environment; make local runs match Cloud Run.
os.environ.setdefault("GOOGLE_GENAI_USE_ENTERPRISE", "TRUE")
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", PROJECT)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", LOCATION)
