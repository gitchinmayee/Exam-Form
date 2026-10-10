"""
Builds fields.json (+ backend schema) for "Wireman suit all combine form.pdf" (8 pages)
→ forms/wireman_suit  (wireman_suit_application)

Run:  python tools/pdf-forms/build_wireman_suit.py
"""
from pdf_layout import Form

F = Form("wireman_suit", "wireman_suit_application", "विद्युत तारतंत्री सूट अर्ज", "Wireman Exam Suit Application")
D = {p: F.dot_runs(p) for p in range(1, 9)}


def dots(id, p, i, key=None, label=None, x1=None, **kw):
    return F.on_dots(id, p, D[p][i], key=key, label=label, x1=x1, **kw)


YESNO = ["जोडले आहे", "नाही"]

# ── Page 1 – तपासणी सूची ─────────────────────────────────────────────
P = 1
F.text("ck_name", P, 117.4, 157.5, 384, key="candidate_name", cover=True)   # sits on the printed "-----" line
tables = F.tables(P)
n = 0
for ti, t in enumerate(tables):
    for ri, row in enumerate(t):
        if ti == 0 and ri == 0:
            continue                                                   # header row
        n += 1
        cell = row[2]
        bl = F.baselines(P, cell[0], cell[1], cell[2], cell[3])
        label = (f"मुद्दा {n} – जोडले आहे/नाही", f"Item {n} – attached / not")
        if bl:
            F.choice(f"ck_{n}", P, bl[0], cell[0], cell[2], YESNO, label)
        else:                                                          # empty remark cell → tick
            x0, y0, x1, y1 = cell
            F.check(f"ck_{n}", P, (x0 + 2, y0 + 2, x1 - 2, y1 - 2), (f"मुद्दा {n} पूर्ण", f"Item {n} done"))
for i, (mr, en) in enumerate([("शाखा/सहा. अभियंता", "Branch / asst. engineer"),
                              ("सहाय्यक विद्युत निरीक्षक", "Asst. electrical inspector"),
                              ("विद्युत निरीक्षक", "Electrical inspector")]):
    a, b, base = D[P][i]
    F.on_dots(f"ck_officer{i + 1}", P, (a - 25, b + 25, base), label=(f"{mr} – नांव", f"{en} – name"))

# ── Page 2 – अर्ज (पत्र) ──────────────────────────────────────────────
P = 2
dots("l_name", P, 0, key="candidate_name", x1=560)
dots("l_address", P, 1, key="candidate_address", x1=560)
dots("l_address2", P, 2, x1=560, label=("पत्ता (ओळ २)", "Address (line 2)"))
dots("l_date", P, 3, x1=560, label=("अर्जाचा दिनांक", "Letter date"), kind="date")
dots("l_name2", P, 4, key="candidate_name", x1=447)
dots("l_mobile", P, 5, key="candidate_mobile", x1=560)

# ── Page 3 – अनुज्ञापक मंडळ तपशील (अभिलेखार्थ) ───────────────────────
P = 3
F.text("r_name", P, 147.6, 205, 560, key="candidate_name", label=("उमेदवाराचे नांव व आडनाव", "Candidate name & surname"))
F.text("r_parent", P, 164.4, 261, 560, key="candidate_parent_name")
F.text("r_address", P, 181.2, 201, 560, key="candidate_address", lines=2, y0=171.7, y1=200.5)
F.text("r_email", P, 211.5, 201, 560, key="candidate_email")
F.text("r_mobile", P, 228.3, 202, 560, key="candidate_mobile")
F.text("r_certificate", P, 245.1, 236, 560, label=("उमेदवारास कोणते प्रमाणपत्र पाहिजे", "Certificate required"))
F.text("r_exam_experience", P, 295.5, 276, 560, label=("परवानगी वेळचा कामाचा अनुभव, कालावधी व ठिकाण", "Experience at permission – period & place"))
F.text("r_seat_no", P, 312.2, 200, 560, label=("परीक्षा आसन क्रमांक", "Exam seat no."), lang="en")
F.date("r_exam_date", P, 329.0, 200, 560, label=("परीक्षेचा दिनांक", "Exam date"))
F.text("r_exam_place", P, 345.8, 200, 560, label=("परीक्षेचे ठिकाण", "Exam place"))
F.text("r_result", P, 362.6, 200, 560, label=("निकाल", "Result"))
F.text("r_exam_passed", P, 396.2, 290, 560, key="candidate_qualification")
F.text("r_experience", P, 413.0, 289, 560, label=("प्रत्यक्ष कामाचा अनुभव, कालावधी व ठिकाण", "Work experience – period & place"))
F.text("r_dob", P, 460.0, 257.5, 338.5, key="candidate_dob", cover=True)          # over the printed «Date_of__Birth»
F.text("r_birthplace", P, 460.0, 379, 560, key="candidate_birthplace")
F.text("r_height", P, 476.8, 258, 560, key="candidate_height")
F.choice("r_complexion", P, 493.6, 0, 0, ["गोरा", "सावळा"], ("वर्ण", "Complexion"), groups=[(260, 277), (285, 311)])
F.text("r_idmark", P, 510.4, 258, 560, key="candidate_idmark")
F.sig("r_sig", P, (72, 564, 172, 588), "candidate_signature")

# ── Page 4 – नमुना बी १ ───────────────────────────────────────────────
P = 4
F.photo("b1_photo", P, (483.5, 163.2, 531.1, 210.6), "candidate_photo", inset=0.8)
F.sig("b1_sig", P, (427.5, 225.8, 576.8, 253.7), "candidate_signature")
dots("b1_name", P, 0, key="candidate_name", x1=525)
dots("b1_address", P, 1, key="candidate_address", x1=525)
dots("b1_address2", P, 2, x1=525, label=("पत्ता (ओळ २)", "Address (line 2)"))
F.text("b1_mobile", P, 361.4, 340, 525, key="candidate_mobile")
F.text("b1_email", P, 378.2, 340, 525, key="candidate_email")
F.date("b1_dob", P, 398.8, 340, 525, key="candidate_dob")
dots("b1_age", P, 3, key="candidate_age")
dots("b1_qualification", P, 4, key="candidate_qualification", x1=525)
dots("b1_training_period", P, 5, x1=525, label=("प्रशिक्षण कालावधी", "Training period"))
dots("b1_training_place", P, 6, x1=525, label=("प्रशिक्षण ठिकाण व संस्थेचे नांव", "Training place & institute"))
dots("b1_challan_no", P, 7, key="challan_no", x1=525)
dots("b1_challan_date", P, 8, key="challan_date", x1=525)

# ── Page 5 – घोषणापत्र ────────────────────────────────────────────────
P = 5
dots("d_name", P, 0, key="candidate_name", x1=525)
dots("d_parent", P, 1, key="candidate_parent_name", x1=236)
F.choice("d_yanchi", P, 144.3, 0, 0, ["यांचा", "यांची"], ("यांचा / यांची", "Of (his / her)"), groups=[(239, 258), (265, 285)])
F.choice("d_relation", P, 144.3, 0, 0, ["मुलगा", "मुलगी"], ("मुलगा / मुलगी", "Son / daughter"), groups=[(288, 312), (319, 344)])
dots("d_age", P, 2, key="candidate_age")
dots("d_address", P, 3, key="candidate_address", x1=525)
dots("d_aadhaar", P, 4, key="candidate_aadhaar")
F.text("d_place", P, 288.6, 105.5, 250, key="affidavit_place", cover=True)
F.date("d_date", P, 305.5, 107, 250, key="affidavit_date")

# ── Page 6 – नमुना ई ──────────────────────────────────────────────────
P = 6
dots("e_name", P, 0, key="candidate_name", x1=560)
dots("e_join_date", P, 1, x1=560, label=("प्रवेशाचा दिनांक", "Date of joining"), kind="date")
dots("e_work", P, 2, x1=560, label=("कामाचे स्वरूप", "Nature of work"))
dots("e_leave_date", P, 3, x1=560, label=("काम सोडल्याचा दिनांक", "Date of leaving"), kind="date")
dots("e_sup", P, 4, x1=560, label=("विद्युत पर्यवेक्षक / अभियंता यांचे नांव", "Supervisor / engineer name"))
dots("e_sup_lic", P, 5, x1=560, label=("परवाना क्रमांक / तांत्रिक अर्हता", "Licence no. / technical qualification"))
dots("e_contractor_lic", P, 6, key="contractor_license_no", x1=560)
dots("e_contractor_lic2", P, 7, x1=560, label=("ठेकेदारीचा अनुज्ञप्ती क्रमांक (ओळ २)", "Contractor licence no. (line 2)"))
F.date("e_date", P, 390.9, 118, 186, label=("प्रमाणपत्र दिनांक", "Certificate date"))
F.sig("e_sup_sig", P, (190, 396, 290, 418), "supervisor_signature")
F.sig("e_owner_sig", P, (372, 396, 480, 418), "owner_signature")

# ── Page 7 – जोडपत्र ──────────────────────────────────────────────────
P = 7
dots("j_name", P, 0, key="candidate_name", x1=400)
dots("j_inward", P, 1, x1=400, label=("आवक क्रमांक / दिनांक", "Inward no. / date"), lang="en")
dots("j_dob", P, 2, key="candidate_dob", x1=400)
dots("j_qualification", P, 3, key="candidate_qualification", x1=400)
F.sig("j_sig", P, (96, 210, 240, 228), "candidate_signature")

# ── Page 8 – प्रपत्र ब ────────────────────────────────────────────────
P = 8
F.photo("pb_photo", P, (478.4, 183.1, 512.8, 220.0), "candidate_photo")
dots("pb_name", P, 1, key="candidate_name", x1=400)
dots("pb_parent", P, 2, key="candidate_parent_name", x1=224)
F.choice("pb_relation", P, 271.8, 0, 0, ["मुलगा", "मुलगी"], ("मुलगा / मुलगी", "Son / daughter"), groups=[(249, 273), (280, 305)])
dots("pb_age", P, 3, key="candidate_age")
dots("pb_address", P, 4, key="candidate_address", x1=525)
F.text("pb_place", P, 429.6, 105.5, 250, key="affidavit_place", cover=True)
F.date("pb_date", P, 446.5, 107, 250, key="affidavit_date")
F.sig("pb_sig", P, (358, 432, 470, 449), "candidate_signature")
dots("pb_name2", P, 5, key="candidate_name", x1=560)
dots("pb_mobile", P, 6, key="candidate_mobile", x1=560)

F.write([("तपासणी सूची", "Checklist"), ("अर्ज", "Application letter"), ("प्रमाणपत्र तपशील", "Certificate record"),
         ("नमुना बी १", "Form B-1"), ("घोषणापत्र", "Declaration"), ("नमुना ई", "Form E – Experience"),
         ("जोडपत्र", "Attachment"), ("प्रपत्र ब", "Self declaration")])
