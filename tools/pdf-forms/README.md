# PDF-template forms

Every form is filled **on top of its original government PDF**: the screen shows the original pages
(PDF.js) with inputs placed on the printed blanks, and the download is the original PDF with the
values written in (pdf-lib). One `fields.json` per form drives both.

| Page (frontend/)                              | Form folder (frontend/pdf-form/forms/) | Built by                          |
|-----------------------------------------------|----------------------------------------|-----------------------------------|
| contractor_newlicense_application_form.html   | new_contractor_license (11 pages)      | build_new_contractor_fields.py    |
| contractor_newlicense_form.html               | new_contractor_info (2 pages)          | build_info_forms.py               |
| contractor_info_form.html                     | contractor_renewal_info (2 pages)      | build_info_forms.py               |
| contractor_renewal_form.html                  | contractor_renewal (9 pages)           | build_contractor_renewal.py       |
| supervisor_exam_suit_form.html                | supervisor_exam_suit (1 page)          | build_supervisor_exam_suit.py     |
| wireman_suit_application.html                 | wireman_suit (8 pages)                 | build_wireman_suit.py             |

Each form folder holds `template.pdf` (the original, unchanged) and `fields.json` (GENERATED).
The build scripts also write the matching `backend/schemas/<form_type>.json` (labels for the
fallback PDF / admin e-mail). Shared helpers and the autofill keys live in `pdf_layout.py`.

## Change a field / regenerate

```
python tools/pdf-forms/build_wireman_suit.py                                   # (or any build_*.py)
python tools/pdf-forms/test_layout.py frontend/pdf-form/forms/wireman_suit --preview out/
python tools/pdf-forms/test_e2e.py --form wireman_suit                         # or --all
```

* `test_layout.py` – no blank covers printed text, shifted segments land on blank paper, no two blanks
  overlap, choice options sit on printed words. `--preview` writes a PNG per page with every box drawn.
* `test_e2e.py` – fills the real page in Chrome, builds the PDF, checks page count/size, that each value
  is inside its box, that nothing outside the blanks changed (pixel diff) and that autofill works.

Requires Python with `pymupdf numpy pillow playwright` and Chrome (`--chrome <path>` or `CHROME_PATH`).

## Adding a form page

1. Put the original PDF in `frontend/pdf-form/forms/<folder>/template.pdf`.
2. Write `build_<folder>.py` using `Form` from `pdf_layout.py` (`text`, `date`, `cell`, `on_dots`, `choice`,
   `check`, `photo`, `sig`, `shift`; `dot_runs()` / `tables()` / `baselines()` help find the blanks).
3. Add the page to `make_pages.py` and `FORMS` in `test_e2e.py`, then run both tests.

Field kinds: `text`/`date` sit on a printed baseline; `cell` fills a table cell; `on_dots` writes on a
printed dotted line; `shift` moves a printed segment right when the original left no room for a blank;
`cover=True` replaces a sample value printed in the template; `choice` circles one printed option;
fields with the same `key` autofill each other within the form.
