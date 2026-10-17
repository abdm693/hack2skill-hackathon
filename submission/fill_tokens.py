#!/usr/bin/env python3
"""Fill the remaining tokens in the submission deck and re-export the PDF.

    python3 submission/fill_tokens.py --video-url "https://youtu.be/..."

The team name (Pivot Analytix), leader and members are already written by the deck build, so only
{{VIDEO_URL}} is left; --team-name and --team-leader still replace {{TEAM_NAME}} / {{TEAM_LEADER}} if a
rebuilt deck carries them. Replaces the tokens (the video link also becomes clickable),
writes the .pptx in place, then exports the .pdf next to it with LibreOffice. Google Sans Flex must be
installed as the static families the template names (Google Sans Flex, Google Sans Flex Medium, Google Sans
Flex SemiBold; they are in ~/Library/Fonts on the build Mac), or the PDF falls back to another font.

LibreOffice re-encodes every picture as JPEG, which rings around the thin lines and small type of the
diagrams. After the export, the diagram pictures (PNGs at least 1000 px wide: the process flow, the
architecture, the benchmarks and the personas) are put back into the PDF losslessly from the .pptx itself,
using PyMuPDF and Pillow if they are installed. `--sharpen-only` does just that step on an existing PDF.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(HERE, "Naqsha_AI_Builder_Cup_Submission.pptx")
HLINK = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"


def add_video_link(slide_xml, rels_xml, url):
    m = re.search(r"(<a:rPr[^>]*>(?:(?!</a:rPr>).)*)(</a:rPr><a:t>)(\{\{VIDEO_URL\}\})(</a:t>)", slide_xml, re.S)
    if not m:
        return slide_xml, rels_xml
    ids = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels_xml)]
    rid = f"rId{max(ids) + 1 if ids else 1}"
    rels_xml = rels_xml.replace(
        "</Relationships>",
        f'<Relationship Id="{rid}" Type="{HLINK}" Target="{escape(url, {chr(34): "&quot;"})}" '
        f'TargetMode="External"/></Relationships>')
    run = m.group(1) + f'<a:hlinkClick r:id="{rid}"/>' + m.group(2) + escape(url) + m.group(4)
    return slide_xml[:m.start()] + run + slide_xml[m.end():], rels_xml


def find_soffice():
    for c in (shutil.which("soffice"), shutil.which("libreoffice"),
              "/Applications/LibreOffice.app/Contents/MacOS/soffice"):
        if c and os.path.exists(c):
            return c
    return None


def sharpen_pdf(pdf, pptx):
    """Swap the JPEG copies of the deck's diagram PNGs in the exported PDF for lossless ones (same pixels).
    LibreOffice shares one resource dictionary across pages, so each JPEG is matched to its PNG by content."""
    try:
        import io
        import fitz  # PyMuPDF
        from PIL import Image, ImageChops, ImageStat
    except ImportError:
        print("PyMuPDF or Pillow missing: diagrams stay JPEG in the PDF")
        return
    thumb = (96, 48)
    pngs = []  # (size, thumbnail, png bytes) for every PNG of at least 1000 px in the deck
    with zipfile.ZipFile(pptx) as z:
        for name in z.namelist():
            if name.startswith("ppt/media/") and name.endswith(".png"):
                im = Image.open(io.BytesIO(z.read(name))).convert("RGB")
                if im.size[0] >= 1000:
                    buf = io.BytesIO()
                    im.save(buf, "PNG", optimize=True)
                    pngs.append((im.size, im.resize(thumb), buf.getvalue()))
    doc = fitz.open(pdf)
    seen, done = set(), 0
    for page in doc:
        for img in page.get_images(full=True):
            xref, w, h, filt = img[0], img[2], img[3], img[8]
            if xref in seen or filt != "DCTDecode" or w < 1000:
                continue
            seen.add(xref)
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha != 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            jt = Image.frombytes("RGB", (pix.width, pix.height), pix.samples[:pix.width * pix.height * 3]
                                 if not pix.alpha else fitz.Pixmap(pix, 0).samples).resize(thumb)
            best = None
            for size, t, data in pngs:
                if size != (w, h):
                    continue
                diff = sum(ImageStat.Stat(ImageChops.difference(jt, t)).mean) / 3
                if best is None or diff < best[0]:
                    best = (diff, data)
            if best and best[0] < 6:
                page.replace_image(xref, stream=best[1])
                done += 1
    tmp = pdf + ".tmp"
    doc.save(tmp, garbage=3, deflate=True)
    doc.close()
    os.replace(tmp, pdf)
    print(f"sharpened {done} diagram picture(s) in", pdf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--team-name")
    ap.add_argument("--team-leader")
    ap.add_argument("--video-url")
    ap.add_argument("--pptx", default=DEFAULT)
    ap.add_argument("--no-pdf", action="store_true")
    ap.add_argument("--sharpen-only", action="store_true", help="only make the diagrams lossless in the existing PDF")
    a = ap.parse_args()
    if a.sharpen_only:
        sharpen_pdf(os.path.splitext(a.pptx)[0] + ".pdf", a.pptx)
        return
    values = {"{{TEAM_NAME}}": a.team_name, "{{TEAM_LEADER}}": a.team_leader}
    with zipfile.ZipFile(a.pptx) as z:
        items = [(i, z.read(i.filename)) for i in z.infolist()]
    files = {i.filename: d for i, d in items}
    for name in list(files):
        if not re.match(r"ppt/slides/slide\d+\.xml$", name):
            continue
        xml = files[name].decode("utf-8")
        for tok, val in values.items():
            if val:
                xml = xml.replace(tok, escape(val))
        if a.video_url and "{{VIDEO_URL}}" in xml:
            rels_name = name.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels"
            xml, rels = add_video_link(xml, files[rels_name].decode("utf-8"), a.video_url)
            files[rels_name] = rels.encode("utf-8")
        files[name] = xml.encode("utf-8")
    tmp = a.pptx + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for info, _ in items:
            z.writestr(info, files[info.filename])
    os.replace(tmp, a.pptx)
    left = [t for t in ("{{TEAM_NAME}}", "{{TEAM_LEADER}}", "{{VIDEO_URL}}")
            if any(t.encode() in d for n, d in files.items() if n.startswith("ppt/slides/slide"))]
    print("updated", a.pptx, "| tokens still open:", ", ".join(left) or "none")
    if a.no_pdf:
        return
    soffice = find_soffice()
    if not soffice:
        sys.exit("LibreOffice not found: export the PDF from PowerPoint, Keynote or Google Slides instead.")
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([soffice, f"-env:UserInstallation=file://{profile}", "--headless", "--convert-to", "pdf",
                        "--outdir", os.path.dirname(os.path.abspath(a.pptx)), a.pptx], check=True)
    print("exported", os.path.splitext(a.pptx)[0] + ".pdf")
    sharpen_pdf(os.path.splitext(a.pptx)[0] + ".pdf", a.pptx)


if __name__ == "__main__":
    main()
