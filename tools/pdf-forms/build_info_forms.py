"""
Builds fields.json (+ backend schema) for the two "information" table forms:
  • Information for new contractor license.pdf        → forms/new_contractor_info      (contractor_newlicense_form)
  • Information for  contractor license renewal.pdf   → forms/contractor_renewal_info  (contractor_info_form)
The value goes in the right-hand cell of each row; rows with several sub-items get one
field per printed sub-line.

Run:  python tools/pdf-forms/build_info_forms.py
"""
from pdf_layout import Form


def value_cells(F, page):
    return [row[2] for t in F.tables(page) for row in t]


def split2(F, id1, id2, page, base, cell, k1=None, k2=None, l1=None, l2=None, at=0.55):
    """Two values side by side in one cell (e.g. number + date)."""
    x0, _, x1, _ = cell
    mid = x0 + (x1 - x0) * at
    F.text(id1, page, base, x0 + 3, mid - 3, key=k1, label=l1, size=9)
    F.text(id2, page, base, mid + 3, x1 - 3, key=k2, label=l2, size=9, kind="date")


def mid_base(cell, size=9):
    return (cell[1] + cell[3]) / 2 + size * 0.36


def prev_job(F, page, cell, b, pre):
    """Row 20: previous job of the supervisor – firm / MC no. + date / from–to dates."""
    x0, _, x1, _ = cell
    F.text(f"{pre}_prev_firm", page, b[1], x0 + 3, x1 - 3, key="prev_employer_firm", size=9,
           lines=2, y0=b[1] - 9.5, y1=b[2] + 3.2)
    split2(F, f"{pre}_prev_mc", f"{pre}_prev_mc_date", page, (b[3] + b[4]) / 2, cell,
           k1="prev_employer_license", l2=("शेवटची नोकरी – ठेकेदार क्रमांकाचा दिनांक", "Last employer MC date"))
    x_mid = x0 + (x1 - x0) * 0.5
    F.date(f"{pre}_prev_from", page, (b[5] + b[6]) / 2, x0 + 3, x_mid - 3, key="prev_from", size=9)
    F.date(f"{pre}_prev_to", page, (b[5] + b[6]) / 2, x_mid + 3, x1 - 3, key="prev_to", size=9)


def owner_and_supervisor(F, page, cells, i0, pre):
    """Rows: owner name … PAN, then supervisor name … licence no./date (shared by both forms)."""
    c = cells
    F.cell(f"{pre}_owner_name", page, c[i0], key="owner_name")
    F.cell(f"{pre}_owner_address", page, c[i0 + 1], key="owner_address")
    F.cell(f"{pre}_owner_father", page, c[i0 + 2], key="owner_parent_name")
    F.cell(f"{pre}_owner_dob", page, c[i0 + 3], key="owner_dob")
    F.cell(f"{pre}_owner_email", page, c[i0 + 4], key="owner_email")
    F.cell(f"{pre}_owner_education", page, c[i0 + 5], key="owner_education")
    F.cell(f"{pre}_owner_pan", page, c[i0 + 6], key="owner_pan", max_lines=1)


def supervisor(F, page, cells, i0, pre):
    c = cells
    F.cell(f"{pre}_sup_name", page, c[i0], key="supervisor_name")
    F.cell(f"{pre}_sup_father", page, c[i0 + 1], key="supervisor_parent_name")
    F.cell(f"{pre}_sup_address", page, c[i0 + 2], key="supervisor_address")
    F.cell(f"{pre}_sup_dob", page, c[i0 + 3], key="supervisor_dob")
    F.cell(f"{pre}_sup_email", page, c[i0 + 4], key="supervisor_email")
    F.cell(f"{pre}_sup_mobile", page, c[i0 + 5], key="supervisor_mobile")
    F.cell(f"{pre}_sup_aadhaar", page, c[i0 + 6], key="supervisor_aadhaar")
    F.cell(f"{pre}_sup_appoint", page, c[i0 + 7], key="sup_join_date",
           label=("पर्यवेक्षकाची सध्याची नेमणूक दिनांक", "Supervisor appointment date"))
    lic = c[i0 + 8]
    split2(F, f"{pre}_sup_lic_no", f"{pre}_sup_lic_date", page, mid_base(lic), lic,
           k1="sup_license_no", k2="sup_license_date")


# ───────────── Information for New Contractor License (2 pages) ─────────────
F = Form("new_contractor_info", "contractor_newlicense_form",
         "नवीन विद्युत ठेकेदार लायसन्स करीता आवश्यक माहिती", "Information for New Contractor License")
c = value_cells(F, 1)
F.cell("n_firm", 1, c[0], key="firm_name")
F.cell("n_firm_address", 1, c[1], key="firm_address")
owner_and_supervisor(F, 1, c, 2, "n")
bank = c[9]
bb = F.baselines(1, 96, bank[1], 305, bank[3])          # header + 4 sub-lines
for bid, base, lab in [("n_bank_name", bb[1], ("बँकेचे नाव", "Name of bank")),
                       ("n_bank_branch", bb[2], ("बँकेची शाखा", "Bank branch")),
                       ("n_bank_account", bb[3], ("खाते क्रमांक", "Account number")),
                       ("n_bank_balance", bb[4], ("शिल्लक रक्कम", "Balance"))]:
    F.text(bid, 1, base, bank[0] + 3, bank[2] - 3, label=lab, size=9, lang="en" if bid != "n_bank_name" and bid != "n_bank_branch" else None)
supervisor(F, 1, c, 10, "n")
prev_job(F, 1, c[19], F.baselines(1, 96, c[19][1], 305, c[19][3]), "n")
c2 = value_cells(F, 2)                                    # row 0 is the "21 मेगर व अर्थ टेस्टर तपशील" heading
F.cell("n_shop_name", 2, c2[1], label=("खरेदी दुकानाचे नाव", "Purchase shop name"))
F.cell("n_shop_address", 2, c2[2], label=("दुकानाचा पत्ता", "Shop address"))
split2(F, "n_receipt_no", "n_receipt_date", 2, mid_base(c2[3]), c2[3],
       l1=("खरेदी पावती क्रमांक", "Purchase receipt no."), l2=("खरेदी पावती दिनांक", "Purchase receipt date"))
F.cell("n_megger_make", 2, c2[4], key="megger_make")
F.cell("n_earth_make", 2, c2[5], key="earth_make")
F.cell("n_megger_serial", 2, c2[6], key="megger_serial")
F.cell("n_earth_serial", 2, c2[7], key="earth_serial", max_lines=1)
F.write([("माहिती १", "Information 1"), ("माहिती २", "Information 2")])

# ───────────── Information for Contractor License Renewal (2 pages) ─────────────
F = Form("contractor_renewal_info", "contractor_info_form",
         "विद्युत ठेकेदार लायसन्स नुतनीकरणा करीता आवश्यक माहिती", "Information for Contractor License Renewal")
c = value_cells(F, 1)
b0 = F.baselines(1, 96, c[0][1], 305, c[0][3])           # "Firm Name" / "म.ठे क्रमांक व दिनांक"
F.text("r_firm", 1, b0[0], c[0][0] + 3, c[0][2] - 3, key="firm_name", size=9)
split2(F, "r_lic_no", "r_lic_date", 1, b0[1], c[0], k1="contractor_license_no", k2="contractor_license_date")
F.cell("r_firm_address", 1, c[1], key="firm_address")
owner_and_supervisor(F, 1, c, 2, "r")
supervisor(F, 1, c, 9, "r")
prev_job(F, 1, c[18], F.baselines(1, 96, c[18][1], 305, c[18][3]), "r")
F.cell("r_megger_make", 1, c[20], key="megger_make")       # row 19 is the heading
c2 = value_cells(F, 2)
F.cell("r_earth_make", 2, c2[0], key="earth_make")
F.cell("r_megger_serial", 2, c2[1], key="megger_serial")
F.cell("r_earth_serial", 2, c2[2], key="earth_serial", max_lines=1)
F.write([("माहिती १", "Information 1"), ("माहिती २", "Information 2")])
