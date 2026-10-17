"""Make coloured SVG variants (for the HTML diagrams) and PNG rasters (for the PPTX) from the downloaded icons.

Sources live in submission/assets/icons/{gcp,firebase,gemini,adk,simple-icons,material}; see ICON_SOURCES.md.
Outputs: submission/assets/icons/derived/*.svg and submission/assets/icons/png/*.png (192 px).
Run: python3 -I submission/assets/src/make_icons.py (needs rsvg-convert and Pillow).
"""
import os
import re
import subprocess

from PIL import Image

I = "/Users/abdullahmoazzam/Code/hack2skill-hackathon/submission/assets/icons"
DER = f"{I}/derived"
PNG = f"{I}/png"
os.makedirs(DER, exist_ok=True)
os.makedirs(PNG, exist_ok=True)
PX = 192

# simple-icons brand colours from simple-icons@16.33.0 data/simple-icons.json
SI = {"react": "61DAFB", "typescript": "3178C6", "vite": "9135FF", "tailwindcss": "06B6D4", "threedotjs": "000000",
      "python": "3776AB", "fastapi": "009688", "pydantic": "E92063", "pytest": "0A9EDC", "uv": "DE5FE9",
      "docker": "2496ED", "googlegemini": "8E75B2"}
GREY = "5F6368"   # Google grey 700, as in Google Cloud diagrams


def tint(src, dst, hexcol):
    s = open(src, encoding="utf-8").read()
    s = re.sub(r"<svg\b", f'<svg fill="#{hexcol}"', s, count=1)
    open(dst, "w", encoding="utf-8").write(s)


def raster(src, dst, px=PX):
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "--keep-aspect-ratio", "-o", dst, src], check=True)
    # pad to a square canvas so every icon places at the same size
    im = Image.open(dst).convert("RGBA")
    if im.size != (px, px):
        c = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        c.paste(im, ((px - im.size[0]) // 2, (px - im.size[1]) // 2), im)
        c.save(dst)


for n, col in SI.items():
    d = f"{DER}/si-{n}.svg"
    tint(f"{I}/simple-icons/{n}.svg", d, col)
    raster(d, f"{PNG}/si-{n}.png")

for f in sorted(os.listdir(f"{I}/material")):
    if not f.endswith(".svg"):
        continue
    n = f[:-4]
    for col, tag in ((GREY, "grey"),):
        d = f"{DER}/ms-{n}-{tag}.svg"
        tint(f"{I}/material/{f}", d, col)
        raster(d, f"{PNG}/ms-{n}-{tag}.png")

for f in ("cloud_run", "firestore", "cloud_storage", "vertexai", "cloud_build", "identity_platform", "artifact_registry"):
    raster(f"{I}/gcp/{f}.svg", f"{PNG}/gcp-{f}.png")
raster(f"{I}/firebase/firebase-logomark-full-color.svg", f"{PNG}/firebase-logomark.png")
raster(f"{I}/gemini/gemini-sparkle.svg", f"{PNG}/gemini-sparkle.png")
subprocess.run(["rsvg-convert", "-h", "96", "--keep-aspect-ratio", "-o", f"{PNG}/google-cloud-logo.png",
                f"{I}/gcp/google-cloud-logo-fullcolor.svg"], check=True)
Image.open(f"{I}/adk/agent-development-kit.png").convert("RGBA").resize((PX, PX), Image.LANCZOS).save(f"{PNG}/adk.png")
print(len(os.listdir(PNG)), "pngs;", len(os.listdir(DER)), "derived svgs")
