"""
Builds frontend/pdf-form/forms/new_contractor_license/fields.json (+ backend schema) for
"New contractor license application form.pdf" (11 pages). Helpers: see pdf_layout.py.

Run:  python tools/pdf-forms/build_new_contractor_fields.py
"""
from pdf_layout import Form, GOOD

F = Form("new_contractor_license", "contractor_newlicense_application_form",
         "नवीन विद्युत ठेकेदार अनुज्ञप्ती अर्ज", "New Electrical Contractor Licence Application")

# ───────────────────────── Page 1 – तपासणी सूची ─────────────────────────
P = 1
F.text("p1_contractor_no", P, 108.3, 408, 560, label=("महाराष्ट्र ठेकेदार क्रमांक", "Maharashtra contractor no."), lang="en")
F.date("p1_date", P, 121.7, 352, 560, label=("दिनांक", "Date"))
F.text("p1_firm", P, 135.1, 99, 560, key="firm_name")
F.text("p1_sup_lic_no", P, 175.5, 130, 250, key="sup_license_no")
F.date("p1_sup_lic_date", P, 175.5, 285, 560, key="sup_license_date")
F.text("p1_sup_name", P, 188.9, 169, 560, key="supervisor_name")
F.text("p1_owner", P, 202.3, 220, 560, key="owner_name",
     label=("मुखत्यारधारक / भागीदारक / मालक", "Power-of-attorney holder / partner / owner"))
F.text("p1_megger_make", P, 215.8, 120.5, 172, key="megger_make", cover=True)
F.text("p1_megger_volt", P, 215.8, F.colon_end(P, 215.8, 200, 212) + 0.3, 245, key="megger_voltage", cover=True)
F.text("p1_megger_serial", P, 215.8, 275.6, 400, key="megger_serial", cover=True)
F.shift(P, 229.2, 144, 256, 90)                                   # "रेंज : ०-१०-१०० ओहम्स क्रमांक :" → room for make
F.text("p1_earth_make", P, 229.2, 139, 232, key="earth_make")
F.text("p1_earth_range", P, 229.2, 255.5, 288.5, key="earth_range", cover=True)
F.text("p1_earth_serial", P, 229.2, 347, 560, key="earth_serial")
CHECK_BASES = [242.7, 256.1, 283.0, 309.9, 336.8, 350.2, 363.6, 377.1, 390.5, 404.0, 417.3, 430.7, 444.2, 457.6, 471.1, 484.5, 497.9]
for i, b in enumerate(CHECK_BASES, 1):
    F.check(f"p1_check_{i}", P, (520, b - 8.5, 531, b + 2.5), (f"तपासणी मुद्दा {i} पूर्ण", f"Checklist item {i} done"))
F.text("p1_challan_no", P, 323.3, 143, 250, label=("चलन क्रमांक", "Challan no."), lang="en")
F.date("p1_challan_date", P, 323.3, 282, 560, label=("चलन दिनांक", "Challan date"))
F.text("p1_megger_receipt_no", P, 336.8, 215, 266, label=("मेगर पावती क्रमांक", "Megger receipt no."), lang="en")
F.date("p1_megger_receipt_date", P, 336.8, 299, 512, label=("मेगर पावती दिनांक", "Megger receipt date"))
F.text("p1_earth_receipt_no", P, 350.2, 232, 268, label=("अर्थ टेस्टर पावती क्रमांक", "Earth tester receipt no."), lang="en")
F.date("p1_earth_receipt_date", P, 350.2, 301, 512, label=("अर्थ टेस्टर पावती दिनांक", "Earth tester receipt date"))

# ───────────────────────── Pages 2 & 3 – नमुना एस / टी ─────────────────────────
for P, pre, kind_mr, kind_en, mk, sk in [(2, "s", "मेगर", "Megger", "megger_make", "megger_serial"),
                                        (3, "t", "अर्थ टेस्टर", "Earth tester", "earth_make", "earth_serial")]:
    o = 0 if P == 2 else -9.7          # page 3 runs ~1 line higher than page 2
    F.text(f"{pre}_firm", P, 191.3 + o, 186 if P == 2 else 184, 560, key="firm_name")
    F.date(f"{pre}_lic_date", P, 204.7 + o, 212, 330, key="contractor_license_date", on_dots=True)
    F.text(f"{pre}_applicant", P, 218.2 + o, 186 if P == 2 else 191, 560, key="owner_name",
         label=("नवीन अनुज्ञाचे अर्जदार", "Applicant (new licence)"))
    if P == 2:
        F.shift(P, 231.6, 202.5, 210, 170)                          # ")," after the supervisor name
        F.text("s_sup_name", P, 231.6, 196, 370, key="supervisor_name")
    else:
        F.text("t_sup_name", P, 221.9, 161, 279, key="supervisor_name")
    F.text(f"{pre}_sup_lic_no", P, 245.1 + o, 181 if P == 2 else 179, 282 if P == 2 else 293, key="sup_license_no")
    F.date(f"{pre}_sup_lic_date", P, 245.1 + o, 314 if P == 2 else 325, 560, key="sup_license_date")
    F.date(f"{pre}_test_date", P, 272.0 if P == 2 else 262.2, 260 if P == 2 else 252, 326 if P == 2 else 294,
         label=(f"{kind_mr} परीक्षण दिनांक", f"{kind_en} test date"))
    F.text(f"{pre}_test_place", P, 285.4 + o, 72, 124, label=(f"{kind_mr} परीक्षण ठिकाण", f"{kind_en} test place"))
    rows = [308.6, 322.0, 335.4, 348.9, 362.3, 375.8, 389.2, 402.6, 416.1] if P == 2 else \
           [298.8, 312.3, 325.7, 339.2, 352.6, 366.0, 379.5, 392.9, 406.4]
    F.text(f"{pre}_make", P, rows[0], 258, 560, key=mk)
    F.text(f"{pre}_serial", P, rows[1], 258, 560, key=sk)
    F.choice(f"{pre}_covering", P, rows[2], 262, 340, ["धातू", "अधातू", "प्लास्टिक"], ("आवरणाचा तपशील", "Body material"))
    F.choice(f"{pre}_type", P, rows[3], 262, 370, ["हाताने फिरवणारे", "इलेक्ट्रॉनिक"], ("प्रकार", "Type"))
    if P == 2:
        F.choice("s_voltage", P, rows[4], 262, 338, ["५००", "१००", "२५००", "५०००"], ("कार्यदाब (वोल्ट)", "Working voltage (V)"))
        F.choice("s_range", P, rows[5], 0, 0, ["० ते 200 मेगा ओहम", "इन्फिनिटी"], ("तबकडील परिमाण", "Dial range"),
               groups=[(265.0, 338.8), (347.6, 379.6)])
    else:
        F.text("t_voltage", P, rows[4], 258, 560, label=("कार्यदाब", "Working voltage"))
        F.choice("t_range", P, rows[5], 276.5, 318, ["१०", "१००", "२००"], ("तबकडील परिमाण (ओहम)", "Dial range (ohm)"))
    F.choice(f"{pre}_condition", P, rows[6], 255, 386, GOOD, ("सर्वसाधारण स्थिती", "General condition"))
    F.choice(f"{pre}_working", P, rows[7], 255, 386, GOOD, ("कार्यस्थिती", "Working condition"))
    F.text(f"{pre}_remarks", P, rows[8], 258, 560, label=("शेरा", "Remarks"))
    fb = [462.5, 485.7] if P == 2 else [452.7, 476.0]
    F.text(f"{pre}_place", P, fb[0], 106, 255, label=("ठिकाण (स्वाक्षरीचे)", "Place (signing)"))
    F.date(f"{pre}_date", P, fb[1], 105, 255, label=("दिनांक (स्वाक्षरीचे)", "Date (signing)"))
    F.text(f"{pre}_inspector", P, fb[1], 286, 560, label=("सहाय्यक विद्युत निरीक्षकाचे नांव", "Asst. electrical inspector name"))

# ───────────────────────── Page 4 – नमुना यु ─────────────────────────
P = 4
F.text("u_owner", P, 195.0, 228, 560, key="owner_name")
F.text("u_lic_no", P, 208.5, 156, 242, key="contractor_license_no")
F.date("u_lic_date", P, 208.5, 270, 450, key="contractor_license_date")
F.text("u_firm", P, 235.3, 145, 450, key="firm_name")
F.text("u_firm_address", P, 248.8, 146, 450, key="firm_address")
F.text("u_owner_mobile", P, 262.2, 114, 450, key="owner_mobile")
F.text("u_owner_email", P, 275.6, 134, 450, key="owner_email")
F.sig("u_owner_sig", P, (205, 279, 340, 292), "owner_signature")
F.photo("u_owner_photo", P, (457.0, 227.4, 511.1, 280.8), "owner_photo")
F.text("u_inspector", P, 329.3, 312, 560, label=("विद्युत निरीक्षकाचे नांव", "Electrical inspector name"))
F.text("u_sup_name", P, 356.2, 199, 560, key="supervisor_name")
F.text("u_sup_lic_no", P, 369.6, 180, 450, key="sup_license_no")
F.date("u_sup_lic_date", P, 383.1, 166, 450, key="sup_license_date")
F.text("u_sup_address", P, 396.5, 163, 560, key="supervisor_address", lines=2, y0=387.0, y1=410.0)
F.text("u_sup_email", P, 419.8, 128, 460, key="supervisor_email")
F.text("u_sup_mobile", P, 433.3, 114, 460, key="supervisor_mobile")
F.sig("u_sup_sig", P, (190, 451, 330, 468), "supervisor_signature")
F.photo("u_sup_photo", P, (465.5, 428.4, 524.5, 487.6), "supervisor_photo")

# ───────────────────────── Page 5 – नमुना व्ही (पर्यवेक्षकाचे प्रतिज्ञापत्र) ─────────────────────────
P = 5
F.shift(P, 175.5, 124, 142, 180)                                  # "वय :"
F.text("v_name", P, 175.5, 119, 300, key="supervisor_name")
F.text("v_age", P, 175.5, 325, 380, key="supervisor_age")
F.text("v_address", P, 188.9, 102, 560, key="supervisor_address")
F.text("v_firm", P, 212.1, 198, 560, key="firm_name")
F.date("v_lic_date", P, 225.5, 206, 300, key="contractor_license_date", on_dots=True)
F.shift(P, 238.9, 145, 356, 40)                                   # "पासून … म.प.क्र."
F.text("v_join_date", P, 238.9, 136, 183, key="sup_join_date", kind="date")
F.text("v_sup_lic_no", P, 238.9, 396, 446, key="sup_license_no")
F.date("v_sup_lic_date", P, 238.9, 473, 525, key="sup_license_date")
F.text("v_prev_firm", P, 252.4, 328, 560, key="prev_employer_firm")
F.text("v_prev_lic", P, 265.8, 105, 300, key="prev_employer_license")
F.shift(P, 279.3, 213.2, 256, 48)                                 # "पर्यंत केली ."
F.date("v_prev_from", P, 279.3, 118, 165, key="prev_from")
F.date("v_prev_to", P, 279.3, 214, 259, key="prev_to")
F.photo("v_photo", P, (198.9, 376.0, 252.9, 430.9), "supervisor_photo")
F.sig("v_sig", P, (300, 411, 420, 433), "supervisor_signature")
F.text("v_place", P, 455.2, 98, 250, key="affidavit_place")
F.date("v_date", P, 468.7, 100, 250, key="affidavit_date")
F.text("v_name2", P, 468.7, 364, 560, key="supervisor_name")
F.text("v_mobile", P, 482.2, 365, 560, key="supervisor_mobile")

# ───────────────────────── Page 6 – नमुना डब्लु (ठेकेदाराचे प्रतिज्ञापत्र) ─────────────────────────
P = 6
F.shift(P, 181.6, 235, 249, 30)                                   # "वर्ष"
F.text("w_name", P, 181.6, 122, 215, key="owner_name")
F.text("w_age", P, 181.6, 234, 264, key="owner_age")
F.text("w_address", P, 195.0, 102, 560, key="owner_address")
F.text("w_firm", P, 218.2, 198, 560, key="firm_name")
F.date("w_lic_date", P, 231.6, 173, 211, key="contractor_license_date", on_dots=True)
F.text("w_sup_name", P, 258.5, 109, 560, key="supervisor_name")
F.text("w_sup_lic_no", P, 272.0, 215, 560, key="sup_license_no")
F.shift(P, 285.4, 97.5, 249, 50)                                  # "यांना माझ्या … पर्यवेक्षक"
F.date("w_sup_lic_date", P, 285.4, 98, 146, key="sup_license_date")
F.shift(P, 298.8, 121, 443, 48)                                   # "पासून नेमले आहे …"
F.date("w_appoint_date", P, 298.8, 122, 168, key="sup_join_date")
F.photo("w_photo", P, (198.9, 361.3, 252.9, 416.2), "owner_photo")
F.sig("w_sig", P, (300, 396, 420, 418), "owner_signature")
F.text("w_place", P, 440.5, 98, 250, key="affidavit_place")
F.date("w_date", P, 453.9, 100, 250, key="affidavit_date")
F.text("w_name2", P, 453.9, 364, 560, key="owner_name")
F.text("w_mobile", P, 467.3, 365, 560, key="owner_mobile")

# ───────────────────────── Page 7 – नमुना एक्स (पर्यवेक्षक स्वतः मालक) ─────────────────────────
P = 7
F.shift(P, 195.0, 192, 282, 60)                                   # "असे जाहीर करतो/करते कि"
F.text("x_name", P, 195.0, 122, 250, key="owner_name")
F.shift(P, 210.4, 168, 464, 30)                                   # "या नावाची … क्रमांक :"
F.text("x_firm", P, 210.4, 106, 197, key="firm_name")
F.text("x_sup_lic_no", P, 210.4, 496, 575, key="sup_license_no")
F.shift(P, 225.9, 99, 118, 50)                                    # "आहे."
F.date("x_sup_lic_date", P, 225.9, 99, 147, key="sup_license_date")
F.text("x_prev_firm", P, 241.3, 179, 560, key="prev_employer_firm")
F.text("x_prev_lic", P, 256.8, 112, 560, key="prev_employer_license")
F.shift(P, 272.2, 135, 195, 32)                                   # "पासून ते दिनांक :"
F.shift(P, 272.2, 229, 458, 45)                                   # "पर्यंत केली आहे …"
F.date("x_prev_from", P, 272.2, 120, 166, key="prev_from")
F.date("x_prev_to", P, 272.2, 230, 273, key="prev_to")
F.photo("x_photo", P, (183.1, 364.6, 231.9, 417.2), "owner_photo")
F.sig("x_sig", P, (285, 412, 405, 435), "owner_signature")
F.text("x_place", P, 459.1, 98.5, 250, key="affidavit_place", cover=True)
F.date("x_date", P, 474.5, 100, 250, key="affidavit_date")
F.text("x_name2", P, 474.5, 324, 560, key="owner_name")
F.text("x_mobile", P, 490.0, 329, 560, key="owner_mobile")

# ───────────────────────── Page 8 – नमुना वाय (भागीदारी) ─────────────────────────
P = 8
F.text("y_partner1", P, 220.2, 151, 560, key="partner1_name")
F.text("y_partner2", P, 235.7, 151, 560, key="partner2_name")
F.text("y_firm", P, 251.1, 210, 560, key="firm_name")
F.shift(P, 266.6, 199, 401, 22)                                   # "चे भागीदार … कोणत्याच"
F.date("y_lic_date", P, 266.6, 165, 219, key="contractor_license_date", on_dots=True)
F.text("y_sup_name", P, 297.5, 88, 560, key="supervisor_name")
F.text("y_sup_lic_no", P, 312.9, 219, 288, key="sup_license_no")
F.shift(P, 312.9, 347, 452, 25)                                   # "धारक हे वरील …"
F.date("y_sup_lic_date", P, 312.9, 321, 370, key="sup_license_date")
F.photo("y_photo1", P, (97.6, 382.4, 137.4, 418.2), "partner1_photo")
F.photo("y_photo2", P, (225.1, 383.9, 265.5, 420.7), "partner2_photo")
F.sig("y_sig1", P, (300, 484, 420, 497.5), "partner1_signature")
F.sig("y_sig2", P, (300, 515, 420, 528.5), "partner2_signature")
F.text("y_partner1_2", P, 511.0, 326, 560, key="partner1_name")
F.text("y_partner2_2", P, 542.0, 326, 560, key="partner2_name")
F.text("y_place", P, 495.5, 98, 250, key="affidavit_place")
F.date("y_date", P, 511.0, 100, 250, key="affidavit_date")

# ───────────────────────── Page 9 – नमुना झेड (खंडित कालावधी) ─────────────────────────
P = 9
F.text("z_name", P, 185.2, 123, 560, key="supervisor_name")
F.shift(P, 198.6, 90, 144, 25)                                    # "वर्षे, राहणार"
F.text("z_age", P, 198.6, 90, 114, key="supervisor_age")
F.text("z_address", P, 198.6, 171, 560, key="supervisor_address")
F.shift(P, 221.9, 135, 264, 50)                                   # "असे जाहीर … मेसर्स ."
F.shift(P, 221.9, 381, 418, 60)                                   # "यांच्या कडे"
F.text("z_aadhaar", P, 221.9, 121, 183, key="supervisor_aadhaar")
F.text("z_firm", P, 221.9, 317, 440, key="firm_name")
F.shift(P, 235.3, 97, 324, 48)                                    # "पासून काम … क्र :"
F.date("z_join_date", P, 235.3, 97, 143, key="sup_join_date")
F.text("z_sup_lic_no", P, 235.3, 373, 419, key="sup_license_no")
F.date("z_sup_lic_date", P, 235.3, 448, 525, key="sup_license_date")
F.text("z_prev_firm", P, 262.2, 167, 290, key="prev_employer_firm")
F.text("z_prev_lic", P, 262.2, 333, 560, key="prev_employer_license")
F.shift(P, 275.6, 241, 446, 18)                                   # "पर्यंत केली. …"
F.date("z_prev_from", P, 275.6, 118, 159, key="prev_from")
F.date("z_prev_to", P, 275.6, 210, 258, key="prev_to")
F.photo("z_photo", P, (180.0, 356.6, 236.3, 411.3), "supervisor_photo")
F.sig("z_sig", P, (260, 410, 380, 432), "supervisor_signature")
F.text("z_place", P, 453.8, 102, 250, key="affidavit_place")
F.date("z_sig_date", P, 453.8, 360, 560, key="affidavit_date")
F.date("z_date", P, 467.2, 100, 250, key="affidavit_date")
F.text("z_name2", P, 467.2, 308, 560, key="supervisor_name")
F.text("z_mobile", P, 480.8, 311, 560, key="supervisor_mobile")

# ───────────────────────── Page 10 – फोटो / स्वाक्षरी ─────────────────────────
P = 10
F.text("ph_firm", P, 120.3, 106, 560, key="firm_name")
F.text("ph_owner", P, 143.4, 86, 270, key="owner_name")
F.text("ph_sup", P, 143.4, 288, 560, key="supervisor_name")
F.photo("ph_owner_photo", P, (138.6, 191.4, 214.0, 268.5), "owner_photo", inset=1)
F.photo("ph_sup_photo", P, (399.4, 193.0, 474.8, 270.1), "supervisor_photo", inset=1)
F.sig("ph_owner_sig", P, (70.3, 307.2, 276.7, 344.3), "owner_signature")
F.sig("ph_sup_sig", P, (331.3, 308.8, 537.7, 345.9), "supervisor_signature")

# ───────────────────────── Page 11 – प्रपत्र ब (स्वयं घोषणापत्र) ─────────────────────────
P = 11
F.shift(P, 199.8, 304, 376, 60)                                   # "यांची मुलगा /मुलगी ,"
F.text("b_name", P, 199.8, 120, 213, key="owner_name")
F.text("b_parent", P, 199.8, 254, 363, key="owner_parent_name", label=("वडील / आईचे नाव", "Father's / mother's name"))
F.choice("b_relation", P, 199.8, 322, 370, ["मुलगा", "मुलगी"], ("मुलगा / मुलगी", "Son / daughter"), dx=60)
F.shift(P, 213.3, 88, 198, 28)                                    # "वर्ष , व्यवसाय : विद्युत ठेकेदार"
F.text("b_age", P, 213.3, 88, 114, key="owner_age")
F.text("b_address", P, 226.7, 102, 560, key="owner_address")
F.text("b_place", P, 323.2, F.colon_end(P, 323.2, 95, 102) + 0.3, 250, key="affidavit_place", cover=True)
F.date("b_date", P, 336.6, 100, 250, key="affidavit_date")
F.sig("b_sig", P, (345, 324, 470, 339), "owner_signature")
F.text("b_name2", P, 350.1, 384, 560, key="owner_name")
F.text("b_mobile", P, 363.5, 345, 560, key="owner_mobile")
F.photo("b_photo", P, (478.4, 148.6, 512.8, 185.5), "owner_photo")


PAGES = [
    ("तपासणी सूची", "Checklist"), ("नमुना एस", "Form S – Megger"), ("नमुना टी", "Form T – Earth tester"),
    ("नमुना यु", "Form U – Signatures"), ("नमुना व्ही", "Form V – Supervisor"), ("नमुना डब्लु", "Form W – Contractor"),
    ("नमुना एक्स", "Form X – Owner-supervisor"), ("नमुना वाय", "Form Y – Partners"), ("नमुना झेड", "Form Z – Broken period"),
    ("फोटो", "Photos"), ("प्रपत्र ब", "Self declaration"),
]


F.write(PAGES)
