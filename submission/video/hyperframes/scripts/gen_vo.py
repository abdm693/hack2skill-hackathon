"""Voice the demo with Gemini 2.5 Pro TTS on the hackathon Vertex project (ADC). Usage: python gen_vo.py [ids...]"""
import json, os, sys, wave, concurrent.futures as cf
from pathlib import Path
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.expanduser("~/.config/gcloud-hack2skill-adc/application_default_credentials.json")
from google import genai
from google.genai import types
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "voice"
MODEL, VOICE = "gemini-2.5-pro-tts", os.environ.get("VO_VOICE", "Charon")
BASE = ("Read this as a warm, confident product narrator demoing their own product to hackathon judges: "
        "brisk, energetic pace of about 165 words per minute, crisp diction, short natural pauses, upbeat but never salesy")
client = genai.Client(vertexai=True, project="project-d5fe6dd3-2b61-40b3-932", location="global")
import time
def synth(ln, tries=6):
  for k in range(tries):
    try:
      return _synth(ln)
    except Exception as e:
      if '429' not in str(e) or k==tries-1: raise
      time.sleep(20*(k+1))
def _synth(ln):
    style = BASE + (f"; {ln['style']}" if ln.get("style") else "")
    r = client.models.generate_content(model=MODEL, contents=f"{style}:\n{ln['text']}",
        config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)))))
    data = r.candidates[0].content.parts[0].inline_data.data
    out = OUT / f"{ln['id']}.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
    return ln["id"], len(data) / 48000
lines = json.loads((HERE / "vo_lines.json").read_text())
if len(sys.argv) > 1: lines = [l for l in lines if l["id"] in sys.argv[1:]]
with cf.ThreadPoolExecutor(2) as ex:
    for i, d in ex.map(synth, lines): print(f"{i}: {d:.2f}s")
