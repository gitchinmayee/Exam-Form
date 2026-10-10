"""
Builds fields.json (+ backend schema) for "Supervisor Exam Suit information.pdf" (1 page table)
→ forms/supervisor_exam_suit  (supervisor_exam_suit_form)

Run:  python tools/pdf-forms/build_supervisor_exam_suit.py
"""
from pdf_layout import Form

F = Form("supervisor_exam_suit", "supervisor_exam_suit_form",
         "पर्यवेक्षक सूट करीता उमेदवाराची माहिती", "Supervisor Exam Suit – Candidate Information")
rows = [r for t in F.tables(1) for r in t]
v = [r[2] for r in rows]
S = 8.0
F.cell("c_name", 1, v[0], key="candidate_name", size=S)
F.cell("c_father", 1, v[1], key="candidate_parent_name", size=S)
F.cell("c_address", 1, v[2], key="candidate_address", size=S, max_lines=2, pad=1.5)
F.cell("c_mobile", 1, v[3], key="candidate_mobile", size=S)
F.cell("c_email", 1, v[4], key="candidate_email", size=S)
F.cell("c_aadhaar", 1, v[5], key="candidate_aadhaar", size=S)
F.cell("c_pan", 1, v[6], label=("पॅन कार्ड क्रमांक", "PAN card number"), lang="en", size=S)
F.cell("c_exam", 1, v[7], key="candidate_qualification", size=S, max_lines=3, pad=1.5)
x0, y0, x1, y1 = v[8]
mid = x0 + (x1 - x0) * 0.45
base = (y0 + y1) / 2 + S * 0.36
F.date("c_dob", 1, base, x0 + 3, mid - 3, key="candidate_dob", size=S, y0=y0 + 1.2, y1=y1 - 1.2)
F.text("c_birthplace", 1, base, mid + 3, x1 - 3, key="candidate_birthplace", size=S, y0=y0 + 1.2, y1=y1 - 1.2)
F.cell("c_height", 1, v[9], key="candidate_height", size=S)
F.cell("c_idmark", 1, v[10], key="candidate_idmark", size=S)
# row 11 = "Information For MCVC candidate only" (heading)
F.cell("c_mcvc_firm", 1, v[12], label=("ठेकेदाराचे / कंपनीचे नाव व MC क्रमांक", "Company / contractor firm with MC no."), size=S)


def two_dates(i, pre, labels):
    lab = rows[i][1]
    b = F.baselines(1, lab[0], lab[1], lab[2], lab[3])
    x0, _, x1, _ = v[i]
    F.date(f"{pre}_join", 1, b[0], x0 + 3, x1 - 3, size=S, label=labels[0])
    F.date(f"{pre}_end", 1, b[1], x0 + 3, x1 - 3, size=S, label=labels[1])


two_dates(13, "c_mcvc", [("जॉइनिंग तारीख", "Joining date"), ("सेवा समाप्त तारीख", "Service end date")])
x0, _, x1, _ = v[14]
F.text("c_sup_name", 1, 343.8, 322, x1 - 3, size=S, y0=335.5, y1=346.0, label=("पर्यवेक्षक / विद्युत अभियंता यांचे नांव", "Supervisor / electrical engineer name"))
F.text("c_sup_ms", 1, 354.5, 344, x1 - 3, size=S, y0=346.2, y1=357.4, lang="en", label=("पर्यवेक्षक MS क्रमांक", "Supervisor MS number"))
two_dates(15, "c_mcvc2", [("जॉइनिंग तारीख (MCVC)", "Joining date (MCVC)"), ("सेवा समाप्त तारीख (MCVC)", "Service end date (MCVC)")])
for i, n in ((16, 16), (17, 17)):          # two blank rows: label and value are both free
    F.cell(f"c_extra{n}_label", 1, rows[i][1], size=S, label=(f"ओळ {n} – माहिती", f"Row {n} – item"))
    F.cell(f"c_extra{n}_value", 1, v[i], size=S, label=(f"ओळ {n} – तपशील", f"Row {n} – details"))
F.write([("उमेदवाराची माहिती", "Candidate information")])
