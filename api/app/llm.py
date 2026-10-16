"""Robust JSON generation: streaming with a degeneration guard (e.g. `35.0000000…` loops seen with constrained decoding),
output caps, timeouts and retries. Returns the parsed object plus the raw text."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import AsyncIterator

from google.genai import types

from .gemini import client

log = logging.getLogger("naqsha.llm")
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


START_TIMEOUT = 420.0   # waiting for the stream to open (includes the client's own 429 back-off)
FIRST_CHUNK_TIMEOUT = 240.0  # thinking models can be quiet for a while before the first token
IDLE_TIMEOUT = 90.0     # between chunks once text is flowing


class Stalled(RuntimeError):
    pass


async def guarded_stream(model: str, contents, config) -> AsyncIterator:
    """generate_content_stream with timeouts, so a stalled stream is retried instead of hanging a run."""
    try:
        stream = await asyncio.wait_for(client().aio.models.generate_content_stream(model=model, contents=contents, config=config),
                                        timeout=START_TIMEOUT)
    except asyncio.TimeoutError as e:
        raise Stalled("the model didn't start answering") from e
    it = stream.__aiter__()
    first = True
    while True:
        try:
            chunk = await asyncio.wait_for(it.__anext__(), timeout=FIRST_CHUNK_TIMEOUT if first else IDLE_TIMEOUT)
        except StopAsyncIteration:
            return
        except asyncio.TimeoutError as e:
            raise Stalled("the model stopped answering") from e
        first = False
        yield chunk


async def stream_json(model: str, contents, system: str, max_tokens: int, attempts: int = 2,
                      on_progress=None, thinking: str | None = None) -> AsyncIterator[tuple[str, object]]:
    """Yields ("progress", chars) while streaming and finally ("result", (obj, text)). `thinking` sets the thinking level
    ("LOW" for quick calls). Degenerate, unparsable or stalled output is retried."""
    last_err: Exception | None = None
    for attempt in range(attempts):
        cfg = types.GenerateContentConfig(system_instruction=system + "\n" + NUM_RULE, response_mime_type="application/json",
                                          max_output_tokens=max_tokens,
                                          thinking_config=types.ThinkingConfig(thinking_level=thinking) if thinking else None)
        text = ""
        try:
            async for chunk in guarded_stream(model, contents, cfg):
                if not chunk.text:
                    continue
                text += chunk.text
                if degenerate(text):
                    raise Degenerate(f"degenerate output after {len(text)} chars")
                if len(text) // 2000 != (len(text) - len(chunk.text)) // 2000:
                    yield "progress", len(text)
            yield "result", (parse_json(text), text)
            return
        except (Degenerate, Stalled, json.JSONDecodeError) as e:
            log.warning("model output attempt %d failed: %s", attempt + 1, e)
            last_err = e
            continue
    raise RuntimeError(f"model output unusable after {attempts} attempts: {last_err}")
