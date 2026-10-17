"""Replicate the narrator's voice with Gemini 3.8 Flash TTS and voice the demo script.

Drop two recordings into submission/video/voice/ (any format ffmpeg reads):
  consent.*    : you saying, exactly: "I am the owner of this voice and I consent to Google using this voice to create a
                 synthetic voice model."
  reference.*  : 10-30 s of you speaking naturally (clean room, no music).

  python clone_voice.py create            # converts both to 24 kHz mono WAV, creates the voice, saves voice/voice_id.txt
  python clone_voice.py say "Hello"       # quick test -> voice/test.wav
  python clone_voice.py narrate lines.json out_dir   # [{"id": "01", "text": "...", "style": "..."}] -> out_dir/01.wav ...

Uses GEMINI_API_KEY from the repo's .env (Gemini Developer API; the Vertex env vars are dropped for this process).
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
VOICE_DIR = HERE / "voice"
ROOT = HERE.parents[1]
MODEL = "gemini-3.8-flash-tts"
API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_STYLE = ("Warm, confident, well-spoken product narrator; measured pace, clear diction, natural pauses; "
                 "sounds like a founder demoing their own product.")

for k in ("GOOGLE_GENAI_USE_VERTEXAI", "GOOGLE_GENAI_USE_ENTERPRISE", "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION",
          "GOOGLE_APPLICATION_CREDENTIALS"):
    os.environ.pop(k, None)


def _key() -> str:
    """GEMINI_TTS_API_KEY (a one-off AI Studio key with credits) wins over the project's GEMINI_API_KEY."""
    env = dict(ln.split("=", 1) for ln in (ROOT / ".env").read_text().splitlines() if "=" in ln and not ln.startswith("#"))
    for name in ("GEMINI_TTS_API_KEY", "GEMINI_API_KEY"):
        if v := (os.environ.get(name) or env.get(name, "")).strip().strip('"'):
            return v
    sys.exit("GEMINI_TTS_API_KEY / GEMINI_API_KEY not found in env or .env")


def _find(stem: str) -> Path:
    hits = [p for p in VOICE_DIR.glob(f"{stem}.*") if p.suffix.lower() != ".txt" and not p.name.endswith(".24k.wav")]
    if not hits:
        sys.exit(f"missing {VOICE_DIR}/{stem}.* (see the docstring)")
    return hits[0]


def _to_wav(src: Path) -> Path:
    out = src.with_name(src.stem + ".24k.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", "loudnorm=I=-18:TP=-2,silenceremove="
                    "start_periods=1:start_threshold=-45dB:start_silence=0.2", "-ac", "1", "-ar", "24000",
                    "-sample_fmt", "s16", str(out)], check=True)
    with wave.open(str(out)) as w:
        secs = w.getnframes() / w.getframerate()
    print(f"{src.name} -> {out.name} ({secs:.1f} s)")
    return out


def _b64(p: Path) -> str:
    return base64.b64encode(p.read_bytes()).decode()


def create() -> None:
    import httpx

    consent, ref = _to_wav(_find("consent")), _to_wav(_find("reference"))
    body = {"store": True,
            "voice": {"model": MODEL, "type": "replicated", "display_name": "Naqsha narrator",
                      "replicated": {"source_audio": {"mime_type": "audio/wav", "data": _b64(ref)},
                                     "consent_audio": {"mime_type": "audio/wav", "data": _b64(consent)}}}}
    r = httpx.post(f"{API}/voices", json=body, headers={"x-goog-api-key": _key()}, timeout=180)
    if r.status_code >= 400:
        sys.exit(f"voice create failed {r.status_code}: {r.text[:800]}")
    data = r.json()

    def _shape(o):  # the response without the audio payloads, for the log
        if isinstance(o, dict):
            return {k: f"<{len(v)} b64>" if k == "data" and isinstance(v, str) else _shape(v) for k, v in o.items()}
        return [_shape(x) for x in o] if isinstance(o, list) else o

    print("response:", json.dumps(_shape(data))[:1500])
    v = data.get("voice", data)
    vid = v.get("id") or v.get("name", "").split("/")[-1]
    if not vid:
        sys.exit("no voice id in the response")
    (VOICE_DIR / "voice_id.txt").write_text(vid + "\n")
    print("voice:", vid)


def _client():
    from google import genai
    return genai.Client(api_key=_key(), vertexai=False)


def _voice_id() -> str:
    p = VOICE_DIR / "voice_id.txt"
    if not p.exists():
        sys.exit("run `create` first")
    return p.read_text().strip()


def synth(text: str, out: Path, style: str = DEFAULT_STYLE, client=None) -> float:
    client = client or _client()
    it = client.interactions.create(
        model=MODEL,
        input=[{"type": "user_input", "content": [{"type": "text", "text": text,
                                                     "annotations": [{"type": "speech_metadata", "style": style}]}]}],
        response_format={"type": "audio"},
        generation_config={"speech_config": [{"voice": _voice_id()}]},
    )
    pcm = base64.b64decode(it.output_audio.data)
    if pcm[:4] == b"RIFF":
        out.write_bytes(pcm)
    else:  # raw 24 kHz 16-bit mono PCM
        with wave.open(str(out), "wb") as w:
            w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000), w.writeframes(pcm)
    with wave.open(str(out)) as w:
        return w.getnframes() / w.getframerate()


def main() -> None:
    VOICE_DIR.mkdir(exist_ok=True)
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "create":
        create()
    elif cmd == "say":
        out = VOICE_DIR / "test.wav"
        print(f"{out} ({synth(' '.join(sys.argv[2:]) or 'This is Naqsha.', out):.1f} s)")
    elif cmd == "narrate":
        lines, out_dir = json.loads(Path(sys.argv[2]).read_text()), Path(sys.argv[3])
        out_dir.mkdir(parents=True, exist_ok=True)
        client = _client()
        for ln in lines:
            secs = synth(ln["text"], out_dir / f"{ln['id']}.wav", ln.get("style") or DEFAULT_STYLE, client)
            print(f"{ln['id']}: {secs:.1f} s")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
