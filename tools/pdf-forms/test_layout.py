"""
Layout regression checks for a PDF-template form (fields.json + template.pdf).

  python tools/pdf-forms/test_layout.py [form_dir] [--preview out_dir]

Checks (after applying the shifts exactly like the browser does):
  1. every field / option / shift lies inside the page
  2. no fillable area covers printed ink (except `cover` fields, which sit on a
     printed sample value, and `onDots` fields, which sit on a dotted leader)
  3. every shifted segment lands on blank paper
  4. fillable areas of different fields do not overlap each other
  5. every choice option box actually contains printed text
Exit code 1 on any failure.
"""
import json, os, sys
import numpy as np
import pymupdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
argv = sys.argv[1:]
PREVIEW = None
if "--preview" in argv:
    i = argv.index("--preview")
    PREVIEW = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]
FORM_DIR = argv[0] if argv else os.path.join(ROOT, "frontend", "pdf-form", "forms", "new_contractor_license")
S = 4  # px per pt

spec = json.load(open(os.path.join(FORM_DIR, "fields.json"), encoding="utf-8"))
doc = pymupdf.open(os.path.join(FORM_DIR, spec["template"]))
W, H = spec["pageSize"]
errors = []


def px(r):
    return [int(round(v * S)) for v in r]


def render(pn):
    pix = doc[pn - 1].get_pixmap(matrix=pymupdf.Matrix(S, S), colorspace=pymupdf.csGRAY)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w).copy()


def apply_shifts(img, shifts):
    """Same algorithm as pdf-form-engine.js: copy all sources, white them out, paste at dx."""
    srcs = []
    for s in shifts:
        x0, y0, x1, y1 = px(s["rect"])
        srcs.append((img[y0:y1, x0:x1].copy(), x0, y0, x1, y1, int(round(s["dx"] * S))))
    for _, x0, y0, x1, y1, _ in srcs:
        img[y0:y1, x0:x1] = 255
    for patch, x0, y0, x1, y1, dx in srcs:
        region = img[y0:y1, x0 + dx:x1 + dx]
        np.minimum(region, patch, out=region)
    return img


def ink_ratio(img, r, pad=0.4):
    x0, y0, x1, y1 = px([r[0] + pad, r[1] + pad, r[2] - pad, r[3] - pad])
    a = img[y0:y1, x0:x1]
    return float((a < 140).mean()) if a.size else 0.0


def inside(r):
    return r[0] >= 0 and r[1] >= 0 and r[2] <= W and r[3] <= H and r[0] < r[2] and r[1] < r[3]


def overlap(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]) > 0.5 and min(a[3], b[3]) - max(a[1], b[1]) > 0.5


for pn in range(1, len(doc) + 1):
    fields = [f for f in spec["fields"] if f["page"] == pn]
    shifts = [s for s in spec["shifts"] if s["page"] == pn]
    orig = render(pn)
    img = apply_shifts(orig.copy(), shifts)

    for s in shifts:
        r = s["rect"]
        dest = [r[0] + s["dx"], r[1], r[2] + s["dx"], r[3]]
        if not inside(dest):
            errors.append(f"p{pn} shift {r} → outside page")
        # destination must be blank in the original, apart from the part the segment itself vacates
        free = orig.copy()
        x0, y0, x1, y1 = px(r)
        free[y0:y1, x0:x1] = 255
        if ink_ratio(free, dest, pad=0.2) > 0.0005:
            errors.append(f"p{pn} shift {r} dx={s['dx']} lands on printed ink")

    for f in fields:
        boxes = [o["rect"] for o in f["options"]] if f["type"] == "choice" else [f["rect"]]
        for r in boxes:
            if not inside(r):
                errors.append(f"p{pn} {f['id']} rect {r} outside page")
        if f["type"] == "choice":
            for o in f["options"]:
                if ink_ratio(img, o["rect"]) < 0.02:
                    errors.append(f"p{pn} {f['id']} option {o['value']} box has no printed text")
            continue
        if f.get("cover"):
            continue
        if f["type"] in ("photo",):
            continue  # photo boxes intentionally contain the printed placeholder text
        limit = 0.03 if f["type"] == "signature" else 0.002  # signatures sit on dotted lines
        check_img = img
        if f.get("onDots"):
            # ignore the printed dots themselves (a thin band on the baseline); anything else is a collision
            check_img = img.copy()
            b0, b1 = int((f["base"] - 2.8) * S), int((f["base"] + 1.4) * S)
            x0, x1 = int(f["rect"][0] * S), int(f["rect"][2] * S)
            check_img[b0:b1, x0:x1] = 255
        ratio = ink_ratio(check_img, f["rect"])
        if ratio > limit:
            errors.append(f"p{pn} {f['id']} covers printed ink ({ratio:.3%})")

    fill = [f for f in fields if f["type"] != "choice"]
    for i, a in enumerate(fill):
        for b in fill[i + 1:]:
            if overlap(a["rect"], b["rect"]):
                errors.append(f"p{pn} {a['id']} overlaps {b['id']}")

    if PREVIEW:
        from PIL import Image, ImageDraw
        os.makedirs(PREVIEW, exist_ok=True)
        im = Image.fromarray(img).convert("RGB")
        dr = ImageDraw.Draw(im, "RGBA")
        colors = {"text": (0, 90, 255), "date": (0, 160, 0), "photo": (255, 120, 0), "signature": (160, 0, 200),
                  "check": (220, 0, 0), "choice": (0, 150, 150)}
        for f in fields:
            c = colors.get(f["type"], (0, 0, 0))
            for r in ([o["rect"] for o in f["options"]] if f["type"] == "choice" else [f["rect"]]):
                dr.rectangle(px(r), outline=c + (255,), fill=c + (40,), width=2)
        for s in shifts:
            r = s["rect"]
            dr.rectangle(px([r[0] + s["dx"], r[1], r[2] + s["dx"], r[3]]), outline=(255, 0, 255, 160), width=1)
        im.save(os.path.join(PREVIEW, f"layout_p{pn}.png"))

print(f"{len(spec['fields'])} fields, {len(spec['shifts'])} shifts, {len(doc)} pages checked")
if errors:
    print("FAIL\n  " + "\n  ".join(errors))
    sys.exit(1)
print("OK")
