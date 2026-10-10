"""
Writes the PDF-template form pages from the new-contractor page (the reference layout),
changing only the title, the form folder and the form id.

Run:  python tools/pdf-forms/make_pages.py
"""
import os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONT = os.path.join(ROOT, "frontend")
REF = "contractor_newlicense_application_form.html"
REF_DIR = "new_contractor_license"
REF_MR, REF_EN = "नवीन विद्युत ठेकेदार अनुज्ञप्ती अर्ज", "New Electrical Contractor Licence Application"

PAGES = {
    # page file                      : (form folder,             Marathi title,                                         English title)
    "contractor_newlicense_form.html": ("new_contractor_info", "नवीन विद्युत ठेकेदार लायसन्स करीता आवश्यक माहिती", "Information for New Contractor License"),
    "contractor_info_form.html": ("contractor_renewal_info", "विद्युत ठेकेदार लायसन्स नुतनीकरणा करीता आवश्यक माहिती", "Information for Contractor License Renewal"),
    "contractor_renewal_form.html": ("contractor_renewal", "विद्युत ठेकेदार अनुज्ञप्ती नूतनीकरण अर्ज", "Electrical Contractor Licence Renewal"),
    "supervisor_exam_suit_form.html": ("supervisor_exam_suit", "पर्यवेक्षक सूट करीता उमेदवाराची माहिती", "Supervisor Exam Suit – Candidate Information"),
    "wireman_suit_application.html": ("wireman_suit", "विद्युत तारतंत्री सूट अर्ज", "Wireman Exam Suit Application"),
}

ref = open(os.path.join(FRONT, REF), encoding="utf-8").read()
for page, (folder, mr, en) in PAGES.items():
    html = ref.replace(REF_MR, mr).replace(REF_EN, en)
    html = html.replace(f"pdf-form/forms/{REF_DIR}/", f"pdf-form/forms/{folder}/")
    form_id = re.sub(r"(^|_)([a-z])", lambda m: m.group(2).upper(), page[:-5]) + "Form"
    html = html.replace('id="newContractorForm"', f'id="{form_id}"').replace(
        'getElementById("newContractorForm")', f'getElementById("{form_id}")')
    assert folder in html and mr in html
    with open(os.path.join(FRONT, page), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print("wrote", page, "→", folder)
