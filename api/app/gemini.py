"""Shared Gemini client (Gemini Enterprise Agent Platform / Vertex AI, `global` location)."""
from functools import lru_cache

from google import genai

from . import config


@lru_cache(maxsize=1)
def client() -> genai.Client:
    try:
        return genai.Client(enterprise=True, project=config.PROJECT, location=config.LOCATION)
    except TypeError:  # older SDKs
        return genai.Client(vertexai=True, project=config.PROJECT, location=config.LOCATION)
