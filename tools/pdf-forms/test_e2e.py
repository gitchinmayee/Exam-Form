"""
End-to-end regression test: fills the real page in Chrome, builds the PDF and checks it.

  python tools/pdf-forms/test_e2e.py [--form new_contractor_license] [--page contractor_newlicense_application_form.html]
                                     [--chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"] [--keep out_dir]
  python tools/pdf-forms/test_e2e.py --all        # every form listed in FORMS

Requires: playwright (python), pymupdf, numpy, Pillow, a Chrome/Chromium.

Checks
  • the downloaded PDF has the template's page count and page sizes
  • every Latin value is real PDF text inside its own field box; every Marathi value is drawn inside its box
  • outside the field boxes the output is pixel-identical to the template (with the layout shifts applied)
  • autofill: linked fields copy values, manual edits are kept, unrelated fields are not touched
  • Marathi transliteration basic cases
"""
import base64, functools, http.server, json, os, socketserver, sys, threading
import numpy as np
import pymupdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONT = os.path.join(ROOT, "frontend")
FORMS = {  # form folder → page that shows it
    "new_contractor_license": "contractor_newlicense_application_form.html",
    "new_contractor_info": "contractor_newlicense_form.html",
    "contractor_renewal_info": "contractor_info_form.html",
    "contractor_renewal": "contractor_renewal_form.html",
    "supervisor_exam_suit": "supervisor_exam_suit_form.html",
    "wireman_suit": "wireman_suit_application.html",
}
arg = lambda name, default=None: sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default
FORM = arg("--form", "new_contractor_license")
PAGE = arg("--page", FORMS.get(FORM))
FORM_DIR = os.path.join(FRONT, "pdf-form", "forms", FORM)
CHROME = sys.argv[sys.argv.index("--chrome") + 1] if "--chrome" in sys.argv else \
    os.environ.get("CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
KEEP = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None
S = 2  # render scale for pixel comparison

spec = errors = None  # set per form in run()

FILL_JS = r"""
async () => {
  const S = PdfForm._state;
  const set = (id, v) => { const el = S.els[id]; el.focus(); el.value = v; el.dispatchEvent(new Event("input")); };
  const sample = { date: "05/10/2026", mobile: "9876543210", email: "a.b@example.in", aadhaar: "123412341234", number: "42" };
  const values = {};
  const seenKey = new Set();
  let n = 0;
  for (const f of S.fields) {
    if (f.type !== "text" && f.type !== "date") continue;
    if (f.key && seenKey.has(f.key)) continue;           // fill only the first field of each key → rest autofill
    if (f.key) seenKey.add(f.key);
    n++;
    let v = sample[f.kind] || (f.lang === "en" ? "AB-" + (1000 + n) : (n % 2 ? "रमेश" : "Pune" + n));
    set(f.id, v);
    values[f.id] = S.els[f.id].value;
  }
  // autofill expectations
  const report = { autofilled: 0, autoMissing: [], manualKept: null };
  for (const [key, list] of Object.entries(S.byKey)) {
    if (list[0].type !== "text" && list[0].type !== "date") continue;
    const src = S.els[list[0].id].value;
    for (const g of list.slice(1)) {
      if (S.els[g.id].value === src && S.els[g.id].classList.contains("pf-auto")) report.autofilled++;
      else report.autoMissing.push(g.id);
    }
  }
  // edit a linked field manually, then change the source: the manual value must survive,
  // the other linked fields must follow the source
  const group = Object.values(S.byKey).find(l => l.length >= 3 && l.every(f => f.type === "text" && f.kind === "text"));
  if (group) {
    set(group[1].id, "Manual Value");
    set(group[0].id, "Changed Value");
    report.manualKept = S.els[group[1].id].value === "Manual Value" && S.els[group[2].id].value === "Changed Value";
  } else report.manualKept = true;
  // choices / checks / pictures
  for (const f of S.fields) {
    if (f.type === "choice") document.querySelector(`input[name="${f.id}"][value="${f.options[f.options.length - 1].value}"]`).click();
    if (f.type === "check") document.querySelector(`input[name="${f.id}"]`).click();
  }
  const pic = (w, h, c) => new Promise(r => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const x = cv.getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, w, h); cv.toBlob(b => r(new File([b], c + ".png", { type: "image/png" }))); });
  const seenPic = new Set();
  for (const f of S.fields) {
    if ((f.type !== "photo" && f.type !== "signature") || seenPic.has(f.key)) continue;
    seenPic.add(f.key);
    const input = S.els[f.id].querySelector("input[type=file]");
    const dt = new DataTransfer(); dt.items.add(await pic(300, f.type === "photo" ? 380 : 90, f.type === "photo" ? "#3366aa" : "#222222"));
    input.files = dt.files; input.dispatchEvent(new Event("change"));
  }
  report.picsFilled = S.fields.filter(f => (f.type === "photo" || f.type === "signature") && S.files[f.id]).length;
  report.picsTotal = S.fields.filter(f => f.type === "photo" || f.type === "signature").length;
  report.translit = [MarathiTranslit.convert("ramesh"), MarathiTranslit.convert("sanjay"), MarathiTranslit.convert("puNe")];
  const finalValues = {};
  for (const f of S.fields) if (f.type === "text" || f.type === "date") finalValues[f.id] = S.els[f.id].value;
  const blob = await PdfForm.buildPdf();
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(blob); });
  return { report, values: finalValues, pdf: b64 };
}
"""


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=FRONT)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def render(doc, pn):
    pix = doc[pn - 1].get_pixmap(matrix=pymupdf.Matrix(S, S), colorspace=pymupdf.csGRAY)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w).copy()


def apply_shifts(img, shifts):
    srcs = []
    for s in shifts:
        x0, y0, x1, y1 = [int(round(v * S)) for v in s["rect"]]
        srcs.append((img[y0:y1, x0:x1].copy(), x0, y0, x1, y1, int(round(s["dx"] * S))))
    for _, x0, y0, x1, y1, _ in srcs:
        img[y0:y1, x0:x1] = 255
    for patch, x0, y0, x1, y1, dx in srcs:
        np.minimum(img[y0:y1, x0 + dx:x1 + dx], patch, out=img[y0:y1, x0 + dx:x1 + dx])
    return img


def run(form):
    global FORM, PAGE, FORM_DIR, spec, errors
    FORM, PAGE = form, FORMS[form]
    FORM_DIR = os.path.join(FRONT, "pdf-form", "forms", FORM)
    spec = json.load(open(os.path.join(FORM_DIR, "fields.json"), encoding="utf-8"))
    errors = []
    from playwright.sync_api import sync_playwright
    httpd = serve()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/{PAGE}"
    with sync_playwright() as p:
        kw = {"executable_path": CHROME} if CHROME and os.path.exists(CHROME) else {}
        browser = p.chromium.launch(headless=True, **kw)
        page = browser.new_page(viewport={"width": 1100, "height": 1400})
        logs = []
        page.on("pageerror", lambda e: logs.append(str(e)))
        page.goto(url)
        page.wait_for_function("document.querySelectorAll('.pf-canvas').length === %d && !document.getElementById('loading')"
                               % len(spec["pages"]), timeout=90000)
        res = page.evaluate(FILL_JS)
        browser.close()
    httpd.shutdown()
    if logs:
        errors.append("page errors: " + "; ".join(logs))

    rep = res["report"]
    if rep["autoMissing"]:
        errors.append(f"autofill missing for {rep['autoMissing']}")
    if not rep["manualKept"]:
        errors.append("manual edit was overwritten by autofill (or source change not propagated)")
    if rep["picsFilled"] != rep["picsTotal"]:
        errors.append(f"pictures shared to {rep['picsFilled']}/{rep['picsTotal']} boxes")
    if rep["translit"] != ["रमेश", "संजय", "पुणे"]:
        errors.append(f"transliteration: {rep['translit']}")

    pdf_bytes = base64.b64decode(res["pdf"])
    out = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    tpl = pymupdf.open(os.path.join(FORM_DIR, spec["template"]))
    if len(out) != len(tpl):
        errors.append(f"page count {len(out)} != template {len(tpl)}")
    for a, b in zip(out, tpl):
        if abs(a.rect.width - b.rect.width) > 0.01 or abs(a.rect.height - b.rect.height) > 0.01:
            errors.append(f"page {a.number + 1} size {a.rect} != {b.rect}")

    values = res["values"]
    for pn in range(1, len(tpl) + 1):
        fields = [f for f in spec["fields"] if f["page"] == pn]
        # values are written in Helvetica; template text (incl. the clipped copies used for shifts) is Mangal/Calibri
        spans = [sp for b in out[pn - 1].get_text("dict")["blocks"] for l in b.get("lines", []) for sp in l["spans"]
                 if "Helvetica" in sp["font"]]
        got = render(out, pn)
        exp = apply_shifts(render(tpl, pn), [s for s in spec["shifts"] if s["page"] == pn])
        mask = np.zeros_like(got, dtype=bool)
        for f in fields:
            for r in ([o["rect"] for o in f["options"]] if f["type"] == "choice" else [f["rect"]]):
                x0, y0, x1, y1 = r
                pad = 2.2 if f["type"] in ("choice", "check") else 1.0
                mask[max(0, int((y0 - pad) * S)):int((y1 + pad) * S) + 1, max(0, int((x0 - pad) * S)):int((x1 + pad) * S) + 1] = True
            v = values.get(f["id"], "")
            if not v:
                continue
            x0, y0, x1, y1 = f["rect"]
            if all(ord(c) < 256 for c in v):
                inside = " ".join(sp["text"] for sp in spans
                                  if sp["bbox"][0] >= x0 - 0.5 and sp["bbox"][2] <= x1 + 0.5 and y0 - 1 <= sp["origin"][1] <= y1 + 1)
                if inside.replace(" ", "") != v.replace(" ", ""):
                    errors.append(f"p{pn} {f['id']}: PDF text {inside!r} != {v!r}")
            else:
                region = got[int(y0 * S):int(y1 * S), int(x0 * S):int(x1 * S)]
                if (region < 128).sum() < 40:
                    errors.append(f"p{pn} {f['id']}: Marathi value not drawn")
        diff = (np.abs(got.astype(int) - exp.astype(int)) > 80) & ~mask
        if diff.mean() > 0.00002:
            ys, xs = np.nonzero(diff)
            errors.append(f"p{pn}: template changed outside fields ({diff.sum()} px, e.g. at pt {xs[0] / S:.0f},{ys[0] / S:.0f})")
        if KEEP:
            from PIL import Image
            os.makedirs(KEEP, exist_ok=True)
            Image.fromarray(got).save(os.path.join(KEEP, f"e2e_{FORM}_p{pn}.png"))
    if KEEP:
        open(os.path.join(KEEP, f"e2e_{FORM}.pdf"), "wb").write(pdf_bytes)

    print(f"[{FORM}] autofilled {rep['autofilled']} linked fields, pictures {rep['picsFilled']}/{rep['picsTotal']}, "
          f"PDF {len(pdf_bytes) // 1024} KB, {len(out)} pages")
    if errors:
        print("FAIL\n  " + "\n  ".join(errors))
        return False
    print("OK")
    return True


if __name__ == "__main__":
    forms = list(FORMS) if "--all" in sys.argv else [FORM]
    results = [run(f) for f in forms]
    sys.exit(0 if all(results) else 1)
