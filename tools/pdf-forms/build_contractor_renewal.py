"""
Builds fields.json (+ backend schema) for "Contractor License renewal form.pdf" (9 pages)
→ forms/contractor_renewal  (contractor_renewal_form)

Most blanks in this template are printed dotted leaders; values are written on them
(extended to the free space after the dots where the line allows).

Run:  python tools/pdf-forms/build_contractor_renewal.py
"""
from pdf_layout import Form, GOOD

F = Form("contractor_renewal", "contractor_renewal_form",
         "विद्युत ठेकेदार अनुज्ञप्ती नूतनीकरण अर्ज", "Electrical Contractor Licence Renewal")
D = {p: F.dot_runs(p) for p in range(1, 10)}


def dots(id, p, i, key=None, label=None, x1=None, **kw):
    return F.on_dots(id, p, D[p][i], key=key, label=label, x1=x1, **kw)


def place_and_date(p, pre, base_place, x_place, base_date, x_date, cover=True):
    F.text(f"{pre}_place", p, base_place, x_place, 250, key="affidavit_place", cover=cover)
    F.date(f"{pre}_date", p, base_date, x_date, 250, key="affidavit_date")


# ── Page 1 – तपासणी सूची ──────────────────────────────────────────────
P = 1
F.text("ck_year", P, 83.8, 428, 540, label=("तपासणी सूची सन", "Checklist year"), lang="en")
dots("ck_firm", P, 0, key="firm_name")
dots("ck_lic_no", P, 1, key="contractor_license_no", x1=545)
rows = F.tables(P)[0]
for i, row in enumerate(rows[1:], 1):
    for col, (mr, en) in ((2, ("वि. नि.", "V.N.")), (3, ("अ. अ.", "A.A."))):
        x0, y0, x1, y1 = row[col]
        F.check(f"ck_{i}_{'vn' if col == 2 else 'aa'}", P, (x0 + 2, y0 + 2, x1 - 2, y1 - 2),
                (f"मुद्दा {i} – {mr}", f"Item {i} – {en}"))
F.text("ck_jawak", P, 584.3, 188, 278, label=("विद्युत निरीक्षक कार्यालय जावक", "Inspector office outward no."), lang="en")
F.date("ck_jawak_date", P, 584.3, 309, 450, label=("जावक दिनांक", "Outward date"))

# ── Page 2 – अर्ज (पत्र) ──────────────────────────────────────────────
P = 2
F.date("l_date", P, 82.0, 463, 560, label=("अर्जाचा दिनांक", "Letter date"))
dots("l_office", P, 0, label=("विद्युत निरीक्षक कार्यालय (ठिकाण)", "Inspector office (place)"), x1=280)
dots("l_name", P, 1, key="owner_name", x1=300)
dots("l_firm", P, 2, key="firm_name", x1=215)
dots("l_lic_no", P, 3, key="contractor_license_no", x1=430)
dots("l_name2", P, 4, key="owner_name", x1=560)
dots("l_firm2", P, 5, key="firm_name", x1=560)
dots("l_mobile", P, 6, key="owner_mobile", x1=560)

# ── Pages 3 & 4 – नमुना एस / टी ───────────────────────────────────────
for P, pre, kind_mr, kind_en, mk, sk in [(3, "s", "मेगर", "Megger", "megger_make", "megger_serial"),
                                        (4, "t", "अर्थ टेस्टर", "Earth tester", "earth_make", "earth_serial")]:
    o = 0 if P == 3 else 3.0                       # page 4 runs 3 pt lower
    dots(f"{pre}_firm", P, 0, key="firm_name", x1=525)
    dots(f"{pre}_lic_no", P, 1, key="contractor_license_no", x1=268 if P == 3 else 262)
    dots(f"{pre}_lic_date", P, 2, key="contractor_license_date", x1=525)
    dots(f"{pre}_applicant", P, 3, key="owner_name", x1=525,
         label=("नवीन अनुज्ञाचे अर्जदार", "Applicant"))
    dots(f"{pre}_sup_name", P, 4, key="supervisor_name", x1=525)
    dots(f"{pre}_sup_lic_no", P, 5, key="sup_license_no", x1=268 if P == 3 else 290)
    dots(f"{pre}_sup_lic_date", P, 6, key="sup_license_date", x1=525)
    F.date(f"{pre}_test_date", P, 262.2 + o, 261, 326, label=(f"{kind_mr} परीक्षण दिनांक", f"{kind_en} test date"))
    F.shift(P, 275.6 + o, 87.5, 272, 45)            # "(ठिकाण) येथे केले …" → room for the place
    F.text(f"{pre}_test_place", P, 275.6 + o, 71.6, 131, cover=True,
           label=(f"{kind_mr} परीक्षण ठिकाण", f"{kind_en} test place"))
    dots(f"{pre}_make", P, 7, key=mk, x1=560)
    dots(f"{pre}_serial", P, 8, key=sk, x1=560)
    F.choice(f"{pre}_covering", P, 315.9 + o, 306, 412, ["धातू", "अधातू", "प्लास्टिक"], ("आवरणाचा तपशील", "Body material"))
    F.choice(f"{pre}_type", P, 329.3 + o, 306, 412, ["हाताने फिरवणारे", "इलेक्ट्रॉनिक"], ("प्रकार", "Type"))
    if P == 3:
        F.choice("s_voltage", P, 342.8, 306, 384, ["५००", "१००", "२५००", "५०००"], ("कार्यदाब (वोल्ट)", "Working voltage (V)"))
        F.choice("s_range", P, 356.2, 0, 0, ["० ते 200 मेगा ओहम", "इन्फिनिटी"], ("तबकडील परिमाण", "Dial range"),
                 groups=[(312, 386), (395, 427)])
    else:
        F.text("t_voltage", P, 345.8, 308, 560, label=("कार्यदाब", "Working voltage"))
        F.choice("t_range", P, 359.2, 319, 359, ["१०", "१००", "२००"], ("तबकडील परिमाण (ओहम)", "Dial range (ohm)"))
    F.choice(f"{pre}_condition", P, 369.6 + o, 306, 441, GOOD, ("सर्वसाधारण स्थिती", "General condition"))
    F.choice(f"{pre}_working", P, 383.1 + o, 306, 441, GOOD, ("कार्यस्थिती", "Working condition"))
    F.text(f"{pre}_remarks", P, 396.5 + o, 308, 560, label=("शेरा", "Remarks"))
    F.text(f"{pre}_place", P, 452.7 + o, 106, 255, label=("ठिकाण (स्वाक्षरीचे)", "Place (signing)"))
    F.date(f"{pre}_date", P, 476.0 + o, 105, 255, label=("दिनांक (स्वाक्षरीचे)", "Date (signing)"))
    F.text(f"{pre}_inspector", P, 476.0 + o, 286, 560, label=("सहाय्यक विद्युत निरीक्षकाचे नांव", "Asst. electrical inspector name"))

# ── Page 5 – नमुना यु ─────────────────────────────────────────────────
P = 5
dots("u_owner", P, 0, key="owner_name", x1=525)
dots("u_lic_no", P, 1, key="contractor_license_no", x1=405)
dots("u_lic_date", P, 2, key="contractor_license_date", x1=525)
dots("u_firm", P, 3, key="firm_name", x1=420)
dots("u_firm_address", P, 4, key="firm_address", x1=525)
dots("u_owner_mobile", P, 5, key="owner_mobile", x1=232)
dots("u_owner_email", P, 6, key="owner_email", x1=232)
a, b, base = D[P][7]
F.sig("u_owner_sig", P, (a, base - 14, a + 150, base + 2), "owner_signature")
F.text("u_inspector1", P, 342.2, 293, 560, label=("विद्युत निरीक्षकाचे नांव", "Electrical inspector name"))
dots("u_sup_name", P, 8, key="supervisor_name", x1=525)
dots("u_sup_lic_no", P, 9, key="sup_license_no", x1=400)
dots("u_sup_lic_date", P, 10, key="sup_license_date", x1=525)
dots("u_sup_address", P, 11, key="supervisor_address", x1=525)
dots("u_sup_address2", P, 12, x1=525, label=("पर्यवेक्षकाचा पत्ता (ओळ २)", "Supervisor address (line 2)"))
dots("u_sup_mobile", P, 13, key="supervisor_mobile", x1=525)
dots("u_sup_email", P, 14, key="supervisor_email", x1=525)
a, b, base = D[P][15]
F.sig("u_sup_sig", P, (a, base - 14, a + 150, base + 2), "supervisor_signature")
F.text("u_inspector2", P, 556.0, 285, 560, label=("विद्युत निरीक्षकाचे नांव (२)", "Electrical inspector name (2)"))

# ── Page 6 – नमुना व्ही ───────────────────────────────────────────────
P = 6
dots("v_name", P, 0, key="supervisor_name", x1=368)
dots("v_age", P, 1, key="supervisor_age", x1=416)
dots("v_address", P, 2, key="supervisor_address", x1=525)
dots("v_address2", P, 3, x1=525, label=("पर्यवेक्षकाचा पत्ता (ओळ २)", "Supervisor address (line 2)"))
dots("v_firm", P, 4, key="firm_name", x1=560)
dots("v_lic_no", P, 5, key="contractor_license_no", x1=380)
dots("v_lic_date", P, 6, key="contractor_license_date", x1=525)
dots("v_join_date", P, 7, key="sup_join_date", x1=265)
dots("v_sup_lic_no", P, 8, key="sup_license_no", x1=380)
dots("v_sup_lic_date", P, 9, key="sup_license_date", x1=525)
dots("v_prev_firm", P, 10, key="prev_employer_firm", x1=525)
dots("v_prev_lic", P, 11, key="prev_employer_license", x1=380)
dots("v_prev_from", P, 12, key="prev_from", x1=525)
dots("v_prev_to", P, 13, key="prev_to")
F.sig("v_sig", P, (300, 416, 420, 438), "supervisor_signature")
place_and_date(P, "v", 459.2, F.colon_end(P, 459.2, 90, 100) + 0.3, 472.6, 100)
dots("v_name2", P, 14, key="supervisor_name", x1=560)
dots("v_mobile", P, 15, key="supervisor_mobile", x1=560)

# ── Page 7 – नमुना डब्लु ──────────────────────────────────────────────
P = 7
dots("w_name", P, 0, key="owner_name", x1=310)
dots("w_age", P, 1, key="owner_age")
dots("w_address", P, 2, key="owner_address", x1=525)
F.text("w_firm", P, 237.1, 237, 525, key="firm_name")
dots("w_lic_date", P, 3, key="contractor_license_date", x1=400)
dots("w_sup_name", P, 4, key="supervisor_name", x1=525)
dots("w_sup_lic_no", P, 5, key="sup_license_no", x1=525)
dots("w_sup_lic_date", P, 6, key="sup_license_date")
dots("w_appoint_date", P, 7, key="sup_join_date", x1=525)
F.sig("w_sig", P, (370, 386, 480, 408), "owner_signature")
place_and_date(P, "w", 428.3, F.colon_end(P, 428.3, 126, 134) + 0.3, 441.8, 138)
dots("w_name2", P, 8, key="owner_name", x1=560)
dots("w_mobile", P, 9, key="owner_mobile", x1=560)

# ── Page 8 – नमुना एक्स ───────────────────────────────────────────────
P = 8
dots("x_name", P, 0, key="owner_name", x1=205)
dots("x_firm", P, 1, key="firm_name", x1=268)
dots("x_sup_lic_no", P, 2, key="sup_license_no", x1=525)
dots("x_sup_lic_date", P, 3, key="sup_license_date", x1=205)
dots("x_prev_firm", P, 4, key="prev_employer_firm", x1=525)
dots("x_prev_lic", P, 5, key="prev_employer_license", x1=320)
dots("x_prev_from", P, 6, key="prev_from", x1=525)
dots("x_prev_to", P, 7, key="prev_to")
F.sig("x_sig", P, (340, 416, 460, 438), "owner_signature")
place_and_date(P, "x", 460.3, F.colon_end(P, 460.3, 90, 100) + 0.3, 475.6, 100)
dots("x_name2", P, 8, key="owner_name", x1=560)
dots("x_mobile", P, 9, key="owner_mobile", x1=560)

# ── Page 9 – नमुना वाय ───────────────────────────────────────────────
P = 9
dots("y_partner1", P, 0, key="partner1_name", x1=525)
dots("y_partner2", P, 1, key="partner2_name", x1=525)
dots("y_firm", P, 2, key="firm_name", x1=525)
dots("y_lic_no", P, 3, key="contractor_license_no", x1=235)
dots("y_lic_date", P, 4, key="contractor_license_date", x1=525)
dots("y_sup_name", P, 5, key="supervisor_name", x1=525)
dots("y_sup_lic_no", P, 6, key="sup_license_no", x1=525)
dots("y_sup_lic_date", P, 7, key="sup_license_date")
F.photo("y_photo1", P, (149.1, 440.6, 209.6, 498.8), "partner1_photo")
F.photo("y_photo2", P, (277.0, 442.1, 337.5, 500.3), "partner2_photo")
place_and_date(P, "y", 553.8, F.colon_end(P, 553.8, 90, 100) + 0.3, 569.1, 100)
F.sig("y_sig1", P, (300, 542, 420, 557.5), "partner1_signature")
F.sig("y_sig2", P, (300, 573, 420, 588.5), "partner2_signature")
dots("y_partner1_2", P, 8, key="partner1_name", x1=560)
dots("y_partner2_2", P, 9, key="partner2_name", x1=560)

F.write([("तपासणी सूची", "Checklist"), ("अर्ज", "Application letter"), ("नमुना एस", "Form S – Megger"),
         ("नमुना टी", "Form T – Earth tester"), ("नमुना यु", "Form U – Signatures"), ("नमुना व्ही", "Form V – Supervisor"),
         ("नमुना डब्लु", "Form W – Contractor"), ("नमुना एक्स", "Form X – Owner-supervisor"), ("नमुना वाय", "Form Y – Partners")])
