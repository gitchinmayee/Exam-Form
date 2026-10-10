"""
Shared helpers for describing where the blanks of a PDF-template form are.

Every position is in PDF points with a TOP-LEFT origin (same as PyMuPDF). The resulting
fields.json drives both the on-screen overlay and the downloaded PDF.

  text/date : rect = [x0, base-9.5, x1, base+3.2]; the value is drawn on `base`,
              i.e. on the same baseline as the printed label next to it.
  cell      : a value inside a table cell (vertically centred; tall cells allow several lines).
  shift     : a printed segment moved right by `dx` to open a blank the original left too narrow.
  cover     : the template prints a sample value there (e.g. "पुणे"); a typed value whites it out.
  choice    : one printed option of "a/b/c" is circled; boxes come from real character positions.
"""
import json, os
import pymupdf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Shared meanings → same key → autofill between these fields only (within one form).
KEYS = {
    "firm_name": ("मेसर्स (संस्थेचे नाव)", "Firm name", "any"),
    "firm_address": ("संस्थेचा पत्ता", "Firm address", "any"),
    "owner_name": ("मालक / अर्जदाराचे नाव", "Owner / applicant name", "any"),
    "owner_age": ("मालकाचे वय", "Owner age", "en"),
    "owner_dob": ("मालकाची जन्म दिनांक", "Owner date of birth", "en"),
    "owner_address": ("मालकाचा पत्ता (राहणार)", "Owner address", "any"),
    "owner_mobile": ("मालकाचा मोबाइल क्र.", "Owner mobile no.", "en"),
    "owner_email": ("मालकाचा ई-मेल", "Owner e-mail", "en"),
    "owner_parent_name": ("मालकाच्या वडिलांचे नाव", "Owner's father's name", "any"),
    "owner_education": ("मालकाचे शिक्षण", "Owner education", "any"),
    "owner_pan": ("मालकाचा पॅन क्रमांक", "Owner PAN", "en"),
    "supervisor_name": ("विद्युत पर्यवेक्षकाचे नाव", "Electrical supervisor name", "any"),
    "supervisor_parent_name": ("पर्यवेक्षकाच्या वडिलांचे नाव", "Supervisor's father's name", "any"),
    "supervisor_age": ("पर्यवेक्षकाचे वय", "Supervisor age", "en"),
    "supervisor_dob": ("पर्यवेक्षकाची जन्म दिनांक", "Supervisor date of birth", "en"),
    "supervisor_address": ("पर्यवेक्षकाचा पत्ता", "Supervisor address", "any"),
    "supervisor_mobile": ("पर्यवेक्षकाचा मोबाइल क्र.", "Supervisor mobile no.", "en"),
    "supervisor_email": ("पर्यवेक्षकाचा ई-मेल", "Supervisor e-mail", "en"),
    "supervisor_aadhaar": ("पर्यवेक्षकाचा आधार क्रमांक", "Supervisor Aadhaar no.", "en"),
    "sup_license_no": ("पर्यवेक्षक परवाना क्रमांक (म.प.क्र.)", "Supervisor licence no.", "en"),
    "sup_license_date": ("पर्यवेक्षक परवाना दिनांक", "Supervisor licence date", "en"),
    "sup_join_date": ("संस्थेत रुजू / नेमणूक दिनांक", "Date supervisor joined firm", "en"),
    "contractor_license_no": ("ठेकेदार अनुज्ञप्ती क्रमांक (म.ठे.क्र.)", "Contractor licence no.", "en"),
    "contractor_license_date": ("अनुज्ञप्ती दिनांक", "Licence date", "en"),
    "prev_employer_firm": ("शेवटची नोकरी – मेसर्स", "Last employer firm", "any"),
    "prev_employer_license": ("शेवटची नोकरी – म.ठे.क्र.", "Last employer licence no.", "en"),
    "prev_from": ("शेवटची नोकरी – पासून दिनांक", "Last job – from date", "en"),
    "prev_to": ("शेवटची नोकरी – पर्यंत दिनांक", "Last job – to date", "en"),
    "megger_make": ("मेगर बनावट", "Megger make", "any"),
    "megger_serial": ("मेगर क्रमांक", "Megger serial no.", "en"),
    "megger_voltage": ("मेगर व्होल्टेज", "Megger voltage", "any"),
    "earth_make": ("अर्थ टेस्टर बनावट", "Earth tester make", "any"),
    "earth_serial": ("अर्थ टेस्टर क्रमांक", "Earth tester serial no.", "en"),
    "earth_range": ("अर्थ टेस्टर रेंज", "Earth tester range", "any"),
    "affidavit_place": ("स्थळ", "Place", "any"),
    "affidavit_date": ("दिनांक (प्रतिज्ञापत्र)", "Date (affidavit)", "en"),
    "partner1_name": ("भागीदार क्र. १ चे नाव", "Partner 1 name", "any"),
    "partner2_name": ("भागीदार क्र. २ चे नाव", "Partner 2 name", "any"),
    "candidate_name": ("उमेदवार / अर्जदाराचे नाव", "Candidate / applicant name", "any"),
    "candidate_parent_name": ("वडिलांचे / पतीचे नाव", "Father's / husband's name", "any"),
    "candidate_address": ("उमेदवाराचा पत्ता", "Candidate address", "any"),
    "candidate_mobile": ("उमेदवाराचा मोबाइल क्र.", "Candidate mobile no.", "en"),
    "candidate_email": ("उमेदवाराचा ई-मेल", "Candidate e-mail", "en"),
    "candidate_aadhaar": ("उमेदवाराचा आधार क्रमांक", "Candidate Aadhaar no.", "en"),
    "candidate_dob": ("उमेदवाराची जन्म दिनांक", "Candidate date of birth", "en"),
    "candidate_age": ("उमेदवाराचे वय", "Candidate age", "en"),
    "candidate_birthplace": ("जन्म ठिकाण", "Place of birth", "any"),
    "candidate_qualification": ("शैक्षणिक पात्रता / उत्तीर्ण परीक्षा", "Qualification / exam passed", "any"),
    "candidate_height": ("उंची", "Height", "any"),
    "candidate_idmark": ("शरीरावरील ओळख चिन्हे", "Identification mark", "any"),
    "challan_no": ("चलन क्रमांक", "Challan no.", "en"),
    "challan_date": ("चलन भरल्याचा दिनांक", "Challan date", "en"),
    "owner_photo": ("मालकाचा फोटो", "Owner photo", None),
    "supervisor_photo": ("पर्यवेक्षकाचा फोटो", "Supervisor photo", None),
    "partner1_photo": ("भागीदार क्र. १ फोटो", "Partner 1 photo", None),
    "partner2_photo": ("भागीदार क्र. २ फोटो", "Partner 2 photo", None),
    "candidate_photo": ("उमेदवाराचा फोटो", "Candidate photo", None),
    "owner_signature": ("मालकाची स्वाक्षरी", "Owner signature", None),
    "supervisor_signature": ("पर्यवेक्षकाची स्वाक्षरी", "Supervisor signature", None),
    "partner1_signature": ("भागीदार क्र. १ स्वाक्षरी", "Partner 1 signature", None),
    "partner2_signature": ("भागीदार क्र. २ स्वाक्षरी", "Partner 2 signature", None),
    "candidate_signature": ("उमेदवाराची स्वाक्षरी", "Candidate signature", None),
}
DATE_KEYS = {"sup_license_date", "sup_join_date", "contractor_license_date", "prev_from", "prev_to", "affidavit_date",
             "owner_dob", "supervisor_dob", "candidate_dob", "challan_date"}
INPUT_KIND = {"owner_mobile": "mobile", "supervisor_mobile": "mobile", "candidate_mobile": "mobile",
              "owner_email": "email", "supervisor_email": "email", "candidate_email": "email",
              "supervisor_aadhaar": "aadhaar", "candidate_aadhaar": "aadhaar",
              "owner_age": "number", "supervisor_age": "number", "candidate_age": "number"}
GOOD = ["चांगली", "समाधानकारक", "असमाधानकारक"]


def r2(v):
    return round(v, 2)


class Form:
    def __init__(self, form_dir_name, form_type, title_mr, title_en):
        self.dir = os.path.join(ROOT, "frontend", "pdf-form", "forms", form_dir_name)
        self.doc = pymupdf.open(os.path.join(self.dir, "template.pdf"))
        self.form_type, self.title_mr, self.title_en = form_type, title_mr, title_en
        self.fields, self.shifts, self.pages = [], [], []

    # ── fields ──────────────────────────────────────────────────────────
    def text(self, id, page, base, x0, x1, key=None, label=None, lang=None, kind=None, cover=False,
             lines=1, size=8.0, on_dots=False, y0=None, y1=None):
        mr, en, klang = KEYS.get(key, (None, None, "any")) if key else (None, None, "any")
        if label:
            mr, en = label
        if kind is None:
            kind = "date" if key in DATE_KEYS else INPUT_KIND.get(key, "text")
        if lang is None:
            lang = "en" if kind in ("date", "mobile", "email", "aadhaar", "number") else klang
        f = {"id": id, "page": page, "type": "date" if kind == "date" else "text", "kind": kind,
             # cover fields reach a little lower so the sample's under-vowels (ु ू) are whited out too
             "rect": [r2(x0), r2(y0 if y0 is not None else base - 9.5), r2(x1),
                      r2(y1 if y1 is not None else base + (3.9 if cover else 3.2))],
             "base": r2(base), "size": size, "lang": lang, "label_mr": mr, "label_en": en}
        if key: f["key"] = key
        if cover: f["cover"] = True
        if lines > 1: f["lines"] = lines
        if on_dots: f["onDots"] = True
        assert mr and en, id
        self.fields.append(f)
        return f

    def date(self, id, page, base, x0, x1, key=None, label=None, **kw):
        return self.text(id, page, base, x0, x1, key=key, label=label, kind="date", **kw)

    def cell(self, id, page, rect, key=None, label=None, size=9.0, max_lines=None, pad=3.0, **kw):
        """A value filling a table cell: centred vertically, several lines if the cell is tall."""
        x0, y0, x1, y1 = rect
        h = y1 - y0
        kind = kw.get("kind") or ("date" if key in DATE_KEYS else INPUT_KIND.get(key, "text"))
        if kind != "text":
            max_lines = 1                      # dates, numbers, e-mail … are always one line
        lines = max_lines or max(1, int((h - 2 * pad + 2) // (size * 1.25)))
        if lines == 1:
            base = (y0 + y1) / 2 + size * 0.36
            return self.text(id, page, base, x0 + pad, x1 - pad, key=key, label=label, size=size,
                             y0=y0 + 1.2, y1=y1 - 1.2, **kw)
        return self.text(id, page, y0 + pad + size, x0 + pad, x1 - pad, key=key, label=label, size=size,
                         lines=lines, y0=y0 + 1.2, y1=y1 - 1.2, **kw)

    def _box(self, id, page, rect, key, type_):
        mr, en, _ = KEYS[key]
        self.fields.append({"id": id, "page": page, "type": type_, "rect": [r2(v) for v in rect], "key": key,
                            "label_mr": mr, "label_en": en})

    def photo(self, id, page, outer, key, inset=1.6):
        x0, y0, x1, y1 = outer
        self._box(id, page, (x0 + inset, y0 + inset, x1 - inset, y1 - inset), key, "photo")

    def sig(self, id, page, rect, key):
        self._box(id, page, rect, key, "signature")

    def check(self, id, page, rect, label):
        self.fields.append({"id": id, "page": page, "type": "check", "rect": [r2(v) for v in rect],
                            "label_mr": label[0], "label_en": label[1]})

    def shift(self, page, base, x0, x1, dx):
        self.shifts.append({"page": page, "rect": [r2(x0), r2(base - 9.8), r2(x1), r2(base + 3.8)], "dx": dx})

    def chars(self, page, base, x0, x1, tol=1.5):
        out = []
        for b in self.doc[page - 1].get_text("rawdict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    for c in s["chars"]:
                        if abs(c["origin"][1] - base) < tol and x0 <= c["bbox"][0] and c["bbox"][2] <= x1 + 0.5:
                            out.append((c["bbox"][0], c["bbox"][2], c["c"]))
        return sorted(out)

    def choice(self, id, page, base, x0, x1, labels, label, dx=0, groups=None, sep="/"):
        """Options = printed text between x0..x1 split at '/' (a leading '*' is ignored)."""
        if groups is None:
            groups, cur = [], []
            for a, b, c in self.chars(page, base, x0, x1):
                if c in sep:
                    groups.append(cur); cur = []
                elif c not in "* ":
                    cur.append((a, b))
            groups.append(cur)
            groups = [(min(a for a, _ in g), max(b for _, b in g)) for g in groups if g]
        assert len(groups) == len(labels), (id, groups, labels)
        opts = [{"value": v, "label": v, "rect": [r2(a + dx - 1.2), r2(base - 9.2), r2(b + dx + 1.2), r2(base + 3.4)]}
                for (a, b), v in zip(groups, labels)]
        self.fields.append({"id": id, "page": page, "type": "choice", "options": opts,
                            "rect": [opts[0]["rect"][0], opts[0]["rect"][1], opts[-1]["rect"][2], opts[-1]["rect"][3]],
                            "label_mr": label[0], "label_en": label[1]})

    def colon_end(self, page, base, x0, x1):
        return [c for c in self.chars(page, base, x0, x1) if c[2] == ":"][0][1]

    # ── template inspection helpers ────────────────────────────────────
    def dot_runs(self, page, min_len=12):
        """Dotted leaders ("……", "....", ",,,,") printed as blanks: [(x0, x1, baseline)], top-to-bottom."""
        runs = []
        for b in self.doc[page - 1].get_text("rawdict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    cur = None
                    for c in s["chars"]:
                        if c["c"] in ".…,":
                            if cur and c["bbox"][0] - cur[1] < 3:
                                cur[1] = c["bbox"][2]
                            else:
                                if cur: runs.append(cur)
                                cur = [c["bbox"][0], c["bbox"][2], c["origin"][1]]
                        elif c["c"] != " ":
                            if cur: runs.append(cur); cur = None
                    if cur: runs.append(cur)
        runs = [r for r in runs if r[1] - r[0] >= min_len]
        return sorted(runs, key=lambda r: (round(r[2]), r[0]))

    def on_dots(self, id, page, run, key=None, label=None, x1=None, **kw):
        """A value written on a printed dotted line (the dots stay, like writing on paper)."""
        a, b, base = run
        x1 = x1 or b
        y0, y1 = base - 9.0, base + 2.5            # dotted lines can be only ~11.6 pt apart
        for t in self.tables(page):                 # stay inside the table cell holding the dots
            for row in t:
                for c in row:
                    if c and c[0] - 1 <= a <= c[2] and c[1] - 1 <= base <= c[3] + 1:
                        y0, y1, x1 = max(y0, c[1] + 1.2), min(y1, c[3] - 1.2), min(x1, c[2] - 2.5)
        return self.text(id, page, base, a, x1, key=key, label=label, on_dots=True, y0=y0, y1=y1, **kw)

    def tables(self, page):
        return [[[c for c in row.cells] for row in t.rows] for t in self.doc[page - 1].find_tables().tables]

    def baselines(self, page, x0, y0, x1, y1):
        """Printed text baselines inside a box (one per text line)."""
        ys = []
        for b in self.doc[page - 1].get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if s["text"].strip() and x0 <= s["bbox"][0] and s["bbox"][2] <= x1 + 1 and y0 <= s["origin"][1] <= y1:
                        if not any(abs(s["origin"][1] - y) < 2.5 for y in ys):
                            ys.append(s["origin"][1])
        return sorted(ys)

    # ── output ─────────────────────────────────────────────────────────
    def write(self, pages, schema_name=None):
        ids = [f["id"] for f in self.fields]
        dup = {i for i in ids if ids.count(i) > 1}
        assert not dup, f"duplicate field ids {dup}"
        out = {"form_type": self.form_type, "title_mr": self.title_mr, "title_en": self.title_en,
               "template": "template.pdf",
               "pageSize": [r2(self.doc[0].rect.width), r2(self.doc[0].rect.height)],
               "pages": [{"n": i + 1, "title_mr": m, "title_en": e} for i, (m, e) in enumerate(pages)],
               "shifts": self.shifts, "fields": self.fields}
        assert len(pages) == len(self.doc), "one title per template page"
        path = os.path.join(self.dir, "fields.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)
        print(f"{len(self.fields)} fields, {len(self.shifts)} shifts → {os.path.relpath(path, ROOT)}")
        # Backend schema (labels for the fallback PDF / admin e-mail) – same ids as the page sends.
        schema_fields = [{"name": f["id"], "label_en": f"{f['label_en']} (p{f['page']})",
                          "label_mr": f"{f['label_mr']} (पान {f['page']})"}
                         for f in self.fields if f["type"] in ("text", "date", "choice", "check")]
        schema = {"form_type": self.form_type, "title": self.title_en, "title_en": self.title_en,
                  "title_mr": self.title_mr, "fields": schema_fields}
        spath = os.path.join(ROOT, "backend", "schemas", f"{schema_name or self.form_type}.json")
        with open(spath, "w", encoding="utf-8") as fh:
            json.dump(schema, fh, ensure_ascii=False, indent=2)
        print(f"{len(schema_fields)} schema fields → {os.path.relpath(spath, ROOT)}")
