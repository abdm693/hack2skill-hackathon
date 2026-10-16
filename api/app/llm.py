"""Robust JSON generation: streaming with a degeneration guard (e.g. `35.0000000…` loops seen with constrained decoding),
output caps, timeouts and retries. Returns the parsed object plus the raw text."""
from __future__ import annotations

import json
import re
from typing import AsyncIterator

from google.genai import types

from .gemini import client

NUM_RULE = "Write numbers with at most 2 decimal places (e.g. 35 or 52.5, never 35.000000)."


class Degenerate(RuntimeError):
    pass


def degenerate(text: str) -> bool:
    tail = text[-160:]
    return len(tail) >= 160 and (len(set(tail)) <= 2 or re.search(r"(\d)\1{40,}$", tail) is not None)


def parse_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        s, e = t.find("{"), t.rfind("}")
        if s >= 0 and e > s:
            return json.loads(t[s:e + 1])
        raise


async def stream_json(model: str, contents, system: str, max_tokens: int, attempts: int = 2,
                      on_progress=None) -> AsyncIterator[tuple[str, object]]:
    """Yields ("progress", chars) while streaming and finally ("result", (obj, text))."""
    last_err: Exception | None = None
    for attempt in range(attempts):
        cfg = types.GenerateContentConfig(system_instruction=system + "\n" + NUM_RULE, response_mime_type="application/json",
                                          max_output_tokens=max_tokens)
        text = ""
        try:
            async for chunk in await client().aio.models.generate_content_stream(model=model, contents=contents, config=cfg):
                if not chunk.text:
                    continue
                text += chunk.text
                if degenerate(text):
                    raise Degenerate(f"degenerate output after {len(text)} chars")
                if len(text) // 2000 != (len(text) - len(chunk.text)) // 2000:
                    yield "progress", len(text)
            yield "result", (parse_json(text), text)
            return
        except (Degenerate, json.JSONDecodeError) as e:
            last_err = e
            continue
    raise RuntimeError(f"model output unusable after {attempts} attempts: {last_err}")
