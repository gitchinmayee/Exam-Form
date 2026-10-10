/**
 * pdf-form-engine.js — fill a government form directly on top of its original PDF.
 *
 * One field-definition file (fields.json, PDF points, top-left origin) drives both:
 *   • the screen: PDF.js renders the original pages, inputs are overlaid on the blanks
 *   • the download: pdf-lib loads the SAME original PDF and writes values at the same
 *     coordinates, so page size, page count, fonts and Marathi text stay untouched.
 *
 * Marathi values are drawn by the browser (correct conjuncts/matras) into a high-res
 * image placed on the field's baseline; plain Latin values are written as real PDF text.
 *
 * Needs (globals): pdfjsLib (pdf.js 3.x), PDFLib (pdf-lib 1.17), MarathiTranslit (optional).
 *
 *   PdfForm.init({ mount, form, formDir })   → renders everything
 *   PdfForm.buildPdf()                       → Promise<Blob> of the filled PDF
 */
(function (global) {
  "use strict";

  const MIN_SIZE = 5;              // smallest font (pt) a value may shrink to
  const DEVA_FONT = '"Noto Sans Devanagari", "Nirmala UI", Mangal, sans-serif';
  const LATIN_FONT = "Arial, Helvetica, sans-serif";
  const PDFJS_FONTS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/";
  const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const S = {
    spec: null, formDir: "", templateBytes: null, pdf: null,
    pages: [], fields: [], byId: {}, byKey: {}, els: {}, files: {},
    form: null, mount: null, active: null,
  };

  const lang = () => (localStorage.getItem("myexam_lang") || "mr");
  const label = (f) => (lang() === "mr" ? f.label_mr : f.label_en) || f.label_mr || f.id;
  const isLatin = (t) => /^[\x20-\x7E -ÿ]*$/.test(t);   // WinAnsi-safe → real PDF text
  const fontFor = (t) => (isLatin(t) ? LATIN_FONT : DEVA_FONT + ", " + LATIN_FONT);

  // ── measuring / fitting (shared by screen and PDF) ────────────────────────
  const mctx = document.createElement("canvas").getContext("2d");
  function measure(text, size) {
    mctx.font = `${size * 10}px ${fontFor(text)}`;
    return mctx.measureText(text).width / 10;
  }
  function wrap(text, size, width, maxLines) {
    if (maxLines <= 1) return measure(text, size) <= width ? [text] : null;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      if (measure(w, size) > width) return null;
      const t = cur ? cur + " " + w : w;
      if (measure(t, size) <= width) cur = t;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length <= maxLines ? lines : null;
  }
  /** Largest size (≤ field size) at which the value fits the blank, or null if it never fits. */
  function fit(f, text) {
    const width = f.rect[2] - f.rect[0] - 2;
    if (!text) return { size: f.size, lines: [] };
    for (let s = f.size; s >= MIN_SIZE - 1e-6; s -= 0.25) {
      const lines = wrap(text, s, width, f.lines || 1);
      if (lines) return { size: s, lines };
    }
    return null;
  }

  // ── values ────────────────────────────────────────────────────────────────
  function valueOf(f) {
    const el = S.els[f.id];
    if (f.type === "check") return el.checked;
    if (f.type === "choice") {
      const c = S.form.querySelector(`input[name="${f.id}"]:checked`);
      return c ? c.value : "";
    }
    if (f.type === "photo" || f.type === "signature") return S.files[f.id] || null;
    return el.value.trim();
  }

  function formatDate(raw) {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
  }
  function validDate(v) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return false;
    const dt = new Date(+m[3], +m[2] - 1, +m[1]);
    return dt.getDate() === +m[1] && dt.getMonth() === +m[2] - 1;
  }
  function sanitize(f, v) {
    switch (f.kind) {
      case "date": return formatDate(v);
      case "mobile": return v.replace(/[^\d+ ]/g, "").slice(0, 15);
      case "aadhaar": return v.replace(/\D/g, "").slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1 ");
      case "number": return v.replace(/[^\d.]/g, "").slice(0, 3);
      case "email": return v.replace(/\s/g, "");
      default: return v;
    }
  }
  function invalid(f, v) {
    if (!v) return false;
    if (f.kind === "date") return !validDate(v);
    if (f.kind === "email") return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    if (f.kind === "mobile") return v.replace(/\D/g, "").length < 10;
    if (f.kind === "aadhaar") return v.replace(/\D/g, "").length !== 12;
    return false;
  }

  /** Put text into a field's input, shrinking the font; returns false if it cannot fit. */
  function applyText(f, v) {
    const el = S.els[f.id];
    const r = fit(f, v);
    if (!r) return false;
    el.value = v;
    el.style.fontSize = `calc(var(--k) * ${r.size}px)`;
    el.style.fontFamily = v && !isLatin(v) ? DEVA_FONT : LATIN_FONT;
    el.classList.toggle("pf-filled", !!v);
    el.classList.toggle("pf-invalid", invalid(f, v));
    return true;
  }

  // ── autofill (same key = same meaning, within this form only) ─────────────
  function propagate(f) {
    if (!f.key) return;
    for (const g of S.byKey[f.key]) {
      if (g === f || S.els[g.id].dataset.manual === "1") continue;
      if (f.type === "photo" || f.type === "signature") setFile(g, S.files[f.id] || null, true);
      else if (applyText(g, valueOf(f))) S.els[g.id].classList.toggle("pf-auto", !!valueOf(f));
    }
  }
  function markManual(f) {
    const el = S.els[f.id];
    const empty = f.type === "photo" || f.type === "signature" ? !S.files[f.id] : !valueOf(f);
    // a cleared field becomes "free" again so it can be auto-filled later
    el.dataset.manual = empty ? "" : "1";
    el.classList.remove("pf-auto");
  }

  // ── photos & signatures ───────────────────────────────────────────────────
  function setFile(f, file, auto) {
    const wrapEl = S.els[f.id];
    const img = wrapEl.querySelector("img");
    S.files[f.id] = file;
    if (file) {
      if (!file._url) file._url = URL.createObjectURL(file);
      img.src = file._url;
      wrapEl.classList.add("pf-filled");
    } else {
      img.removeAttribute("src");
      wrapEl.classList.remove("pf-filled");
    }
    wrapEl.classList.toggle("pf-auto", !!(auto && file));
  }

  // ── building the overlay ──────────────────────────────────────────────────
  const pct = (v, total) => (v / total * 100) + "%";
  function place(el, rect) {
    const [W, H] = S.spec.pageSize;
    el.style.left = pct(rect[0], W);
    el.style.top = pct(rect[1], H);
    el.style.width = pct(rect[2] - rect[0], W);
    el.style.height = pct(rect[3] - rect[1], H);
  }

  function makeField(f, layer) {
    let el;
    if (f.type === "text" || f.type === "date") {
      el = document.createElement(f.lines > 1 ? "textarea" : "input");
      if (el.tagName === "INPUT") el.type = "text";
      el.name = f.id;
      el.className = "pf-field pf-text" + (f.cover ? " pf-cover" : "") + (f.lines > 1 ? " pf-multi" : "");
      el.autocomplete = "off";
      el.spellcheck = false;
      if (f.kind === "date") { el.inputMode = "numeric"; el.placeholder = "dd/mm/yyyy"; }
      if (f.kind === "mobile" || f.kind === "aadhaar" || f.kind === "number") el.inputMode = "numeric";
      if (f.kind === "email") el.inputMode = "email";
      el.style.fontSize = `calc(var(--k) * ${f.size}px)`;
      if (f.lines > 1) el.style.lineHeight = `calc(var(--k) * ${f.size * 1.25}px)`;
      // on touch screens typing happens in the large assist box (no keyboard/zoom on the tiny blank)
      if (matchMedia("(pointer: coarse)").matches) el.readOnly = true;
      let last = "";
      el.addEventListener("focus", () => { last = el.value; openAssist(f); });
      el.addEventListener("input", () => {
        const v = sanitize(f, el.value);
        if (!applyText(f, v)) { el.value = last; flash(el, lang() === "mr" ? "या जागेत एवढा मजकूर बसत नाही" : "Too long for this space"); return; }
        last = el.value;
        markManual(f);
        propagate(f);
        syncAssist();
      });
    } else if (f.type === "check") {
      el = document.createElement("label");
      el.className = "pf-field pf-check";
      el.innerHTML = `<input type="checkbox" name="${f.id}"><span>✓</span>`;
      el.title = label(f);
      S.els[f.id] = el.querySelector("input");
      place(el, f.rect);
      layer.appendChild(el);
      return;
    } else if (f.type === "choice") {
      for (const o of f.options) {
        const opt = document.createElement("label");
        opt.className = "pf-field pf-choice";
        opt.title = `${label(f)}: ${o.label}`;
        opt.innerHTML = `<input type="radio" name="${f.id}" value="${o.value}"><span></span>`;
        const radio = opt.querySelector("input");
        // click a selected option again to clear it
        opt.addEventListener("mousedown", () => { radio.dataset.was = radio.checked ? "1" : ""; });
        opt.addEventListener("click", (e) => {
          if (radio.dataset.was === "1") { e.preventDefault(); radio.checked = false; radio.dataset.was = ""; }
        });
        place(opt, o.rect);
        layer.appendChild(opt);
      }
      S.els[f.id] = layer;
      return;
    } else {          // photo / signature
      el = document.createElement("label");
      el.className = `pf-field pf-${f.type}`;
      el.title = label(f);
      el.innerHTML = `<img alt=""><input type="file" accept="image/*" hidden>
        <span class="pf-hint">${f.type === "photo" ? "📷" : "✍"}</span>
        <button type="button" class="pf-remove" title="Remove">×</button>`;
      const input = el.querySelector("input");
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        setFile(f, file, false);
        markManual(f);
        propagate(f);
        input.value = "";
      });
      el.querySelector(".pf-remove").addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        setFile(f, null, false);
        markManual(f);
        propagate(f);
      });
    }
    el.dataset.id = f.id;
    if (f.type === "text" || f.type === "date") el.setAttribute("aria-label", label(f));
    place(el, f.rect);
    layer.appendChild(el);
    S.els[f.id] = el;
  }

  function flash(el, msg) {
    el.classList.add("pf-reject");
    setTimeout(() => el.classList.remove("pf-reject"), 600);
    const tip = S.assist && S.assist.querySelector(".pf-assist-msg");
    if (tip) { tip.textContent = msg; setTimeout(() => { tip.textContent = ""; }, 2500); }
  }

  // ── assist bar: label, large mirror input, Marathi typing, date picker ────
  function buildAssist() {
    const a = document.createElement("div");
    a.className = "pf-assist";
    a.innerHTML = `
      <div class="pf-assist-label"></div>
      <div class="pf-assist-row">
        <input class="pf-assist-input" type="text" autocomplete="off">
        <button type="button" class="pf-btn pf-mr" title="English → मराठी">अ</button>
        <button type="button" class="pf-btn pf-cal" title="Calendar">📅</button>
        <input type="date" class="pf-date-native" tabindex="-1">
        <button type="button" class="pf-btn pf-done" title="Done">✓</button>
      </div>
      <div class="pf-translit" hidden>
        <input class="pf-roman" type="text" placeholder="Type in English, e.g. ramesh aapTe">
        <input class="pf-deva" type="text" placeholder="मराठी">
        <div class="pf-translit-help">T=ट D=ड N=ण L=ळ sh=श Sh=ष aa=ा ee=ी oo=ू M=ं</div>
        <div class="pf-assist-row"><button type="button" class="pf-btn pf-apply">लागू करा / Apply</button>
        <button type="button" class="pf-btn pf-cancel">रद्द / Cancel</button></div>
      </div>
      <div class="pf-assist-msg" aria-live="polite"></div>`;
    S.assist = a;
    const big = a.querySelector(".pf-assist-input");
    big.addEventListener("input", () => {
      const f = S.active; if (!f) return;
      const el = S.els[f.id];
      const before = el.value;
      el.value = big.value;
      el.dispatchEvent(new Event("input"));
      if (el.value === before && big.value !== before) big.value = el.value;   // rejected (too long)
      else big.value = el.value;
    });
    big.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); closeAssist(); } });
    a.querySelector(".pf-done").addEventListener("click", closeAssist);

    const native = a.querySelector(".pf-date-native");
    a.querySelector(".pf-cal").addEventListener("click", () => {
      const f = S.active; if (!f) return;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(S.els[f.id].value);
      native.value = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
      try { native.showPicker(); } catch (e) { native.focus(); native.click(); }
    });
    native.addEventListener("change", () => {
      const f = S.active; if (!f || !native.value) return;
      const [y, mo, d] = native.value.split("-");
      setAndPropagate(f, `${d}/${mo}/${y}`);
    });

    const box = a.querySelector(".pf-translit");
    const roman = a.querySelector(".pf-roman"), deva = a.querySelector(".pf-deva");
    a.querySelector(".pf-mr").addEventListener("click", () => {
      box.hidden = !box.hidden;
      if (!box.hidden) { roman.value = ""; deva.value = ""; roman.focus(); }
    });
    roman.addEventListener("input", () => { deva.value = global.MarathiTranslit ? MarathiTranslit.convert(roman.value) : roman.value; });
    a.querySelector(".pf-apply").addEventListener("click", () => {
      const f = S.active; if (!f) return;
      if (setAndPropagate(f, deva.value.trim())) { box.hidden = true; big.value = S.els[f.id].value; }
    });
    a.querySelector(".pf-cancel").addEventListener("click", () => { box.hidden = true; });
    a.addEventListener("mousedown", (e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
    return a;
  }
  function setAndPropagate(f, v) {
    if (!applyText(f, sanitize(f, v))) { flash(S.els[f.id], lang() === "mr" ? "या जागेत एवढा मजकूर बसत नाही" : "Too long for this space"); return false; }
    markManual(f); propagate(f); syncAssist();
    return true;
  }
  function openAssist(f) {
    S.active = f;
    const el = S.els[f.id];
    const pageEl = el.closest(".pf-page");
    if (S.assist.parentElement !== pageEl) pageEl.appendChild(S.assist);
    S.assist.querySelector(".pf-assist-label").textContent = label(f);
    S.assist.querySelector(".pf-mr").hidden = f.lang === "en";
    S.assist.querySelector(".pf-cal").hidden = f.kind !== "date";
    S.assist.querySelector(".pf-translit").hidden = true;
    const big = S.assist.querySelector(".pf-assist-input");
    big.inputMode = el.inputMode || "text";
    big.placeholder = el.placeholder || "";
    syncAssist();
    const [W, H] = S.spec.pageSize;
    const below = f.rect[3] / H * 100;
    S.assist.style.top = `calc(${below}% + 4px)`;
    S.assist.style.left = `min(${f.rect[0] / W * 100}%, calc(100% - 320px))`;
    S.assist.hidden = false;
    if (matchMedia("(pointer: coarse)").matches) setTimeout(() => big.focus(), 0);
  }
  function syncAssist() {
    if (!S.active || !S.assist) return;
    const big = S.assist.querySelector(".pf-assist-input");
    if (document.activeElement !== big) big.value = S.els[S.active.id].value;
  }
  function closeAssist() { if (S.assist) S.assist.hidden = true; S.active = null; }

  // ── page rendering (original PDF + shifts) ────────────────────────────────
  async function renderPage(p) {
    const pageEl = S.pages[p - 1];
    const cssW = pageEl.clientWidth;
    if (!cssW || pageEl.dataset.renderedW === String(cssW)) return;
    pageEl.dataset.renderedW = String(cssW);
    const page = await S.pdf.getPage(p);
    const [W] = S.spec.pageSize;
    // sharp on HiDPI screens, but capped so 11 pages don't exhaust memory on phones
    const scale = Math.min(cssW * Math.max(window.devicePixelRatio || 1, 1.5), 1800) / W;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    applyShiftsToCanvas(ctx, p, scale);
    canvas.className = "pf-canvas";
    const old = pageEl.querySelector(".pf-canvas");
    old ? old.replaceWith(canvas) : pageEl.prepend(canvas);
  }
  function applyShiftsToCanvas(ctx, p, k) {
    const list = S.spec.shifts.filter(s => s.page === p).map(s => {
      const [x0, y0, x1, y1] = s.rect.map(v => Math.round(v * k));
      const c = document.createElement("canvas");
      c.width = x1 - x0; c.height = y1 - y0;
      c.getContext("2d").drawImage(ctx.canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      return { c, x0, y0, w: c.width, h: c.height, dx: Math.round(s.dx * k) };
    });
    ctx.fillStyle = "#fff";
    list.forEach(s => ctx.fillRect(s.x0, s.y0, s.w, s.h));
    list.forEach(s => ctx.drawImage(s.c, s.x0 + s.dx, s.y0));
  }

  // ── PDF output (original template + values) ───────────────────────────────
  function textImage(text, sizePt) {
    const k = 8;                                   // px per pt → ~576 dpi
    const fontPx = sizePt * k;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    ctx.font = `${fontPx}px ${fontFor(text)}`;
    c.width = Math.ceil(ctx.measureText(text).width + 2 * k);
    c.height = Math.ceil(fontPx * 1.7);
    ctx.font = `${fontPx}px ${fontFor(text)}`;
    ctx.fillStyle = "#000";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, k, fontPx * 1.2);
    return { canvas: c, k, ascent: 1.2 * sizePt, w: c.width / k, h: c.height / k, padL: 1 };
  }
  const canvasBytes = (c, type, q) => new Promise(res => c.toBlob(b => b.arrayBuffer().then(res), type, q));

  function loadImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = file._url || URL.createObjectURL(file);
    });
  }
  /** Fit an uploaded picture into a box: photos fill (crop), signatures fit whole. */
  async function boxImage(file, w, h, cover) {
    const img = await loadImage(file);
    const k = 4;                                   // ~288 dpi
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext("2d");
    const sc = cover ? Math.max(c.width / img.width, c.height / img.height) : Math.min(c.width / img.width, c.height / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    if (cover) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    return cover ? { bytes: await canvasBytes(c, "image/jpeg", 0.9), png: false }
                 : { bytes: await canvasBytes(c, "image/png"), png: true };
  }

  async function buildPdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const out = await PDFDocument.load(S.templateBytes.slice(0));
    const src = await PDFDocument.load(S.templateBytes.slice(0));
    out.setTitle(S.spec.title_mr || S.spec.title_en || "Form");
    const helv = await out.embedFont(StandardFonts.Helvetica);
    const pages = out.getPages();
    const [, H] = S.spec.pageSize;
    const white = rgb(1, 1, 1), black = rgb(0, 0, 0);

    // 1. shifts: copy the original vector segment, white out the source, redraw at dx
    // (one embedPages call shares a single object copier, so the template's fonts are copied once)
    const shifts = S.spec.shifts;
    const clips = shifts.length ? await out.embedPages(
      shifts.map(s => src.getPage(s.page - 1)),
      shifts.map(({ rect: [x0, y0, x1, y1] }) => ({ left: x0, bottom: H - y1, right: x1, top: H - y0 }))) : [];
    const embeds = shifts.map((s, i) => ({ s, e: clips[i] }));
    for (const { s } of embeds) {
      const [x0, y0, x1, y1] = s.rect;
      pages[s.page - 1].drawRectangle({ x: x0, y: H - y1, width: x1 - x0, height: y1 - y0, color: white });
    }
    for (const { s, e } of embeds) {
      pages[s.page - 1].drawPage(e, { x: s.rect[0] + s.dx, y: H - s.rect[3] });
    }

    // 2. values
    const cache = new Map();
    for (const f of S.fields) {
      const page = pages[f.page - 1];
      const v = valueOf(f);
      if (!v) continue;
      const [x0, y0, x1, y1] = f.rect;
      if (f.type === "check") {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        page.drawSvgPath("M -3.2 0 L -1 2.6 L 3.6 -3", { x: cx, y: H - cy, borderColor: black, borderWidth: 1.1 });
        continue;
      }
      if (f.type === "choice") {
        const o = f.options.find(o => o.value === v);
        if (!o) continue;
        const [a, b, c, d] = o.rect;
        page.drawEllipse({ x: (a + c) / 2, y: H - (b + d) / 2, xScale: (c - a) / 2 + 0.2, yScale: (d - b) / 2 - 0.4,
                           borderColor: black, borderWidth: 0.8 });
        continue;
      }
      if (f.type === "photo" || f.type === "signature") {
        // the same picture in same-sized boxes (e.g. owner photo on several pages) is embedded once
        const ck = `${v._url}|${f.type}|${(x1 - x0).toFixed(1)}x${(y1 - y0).toFixed(1)}`;
        let emb = cache.get(ck);
        if (!emb) {
          const im = await boxImage(v, x1 - x0, y1 - y0, f.type === "photo");
          emb = im.png ? await out.embedPng(im.bytes) : await out.embedJpg(im.bytes);
          cache.set(ck, emb);
        }
        page.drawImage(emb, { x: x0, y: H - y1, width: x1 - x0, height: y1 - y0 });
        continue;
      }
      // text / date
      const r = fit(f, v) || { size: MIN_SIZE, lines: [v] };
      if (f.cover) page.drawRectangle({ x: x0, y: H - y1, width: x1 - x0, height: y1 - y0, color: white });
      const lh = r.size * 1.25;
      const firstBase = (f.lines || 1) > 1 ? y0 + r.size * 1.15 : f.base;
      for (let i = 0; i < r.lines.length; i++) {
        const t = r.lines[i];
        const base = firstBase + i * lh;
        if (isLatin(t)) {
          let size = r.size;
          while (size > MIN_SIZE && helv.widthOfTextAtSize(t, size) > x1 - x0 - 2) size -= 0.25;
          page.drawText(t, { x: x0 + 1, y: H - base, size, font: helv, color: black });
        } else {
          const ti = textImage(t, r.size);
          const png = await out.embedPng(await canvasBytes(ti.canvas, "image/png"));
          page.drawImage(png, { x: x0 + 1 - ti.padL, y: H - (base - ti.ascent + ti.h), width: ti.w, height: ti.h });
        }
      }
    }
    const bytes = await out.save();
    return new Blob([bytes], { type: "application/pdf" });
  }

  // ── navigation ────────────────────────────────────────────────────────────
  function buildNav() {
    const nav = document.createElement("nav");
    nav.className = "pf-nav";
    const titles = () => S.spec.pages.map(p => (lang() === "mr" ? p.title_mr : p.title_en));
    nav.innerHTML = `<button type="button" class="pf-btn pf-prev" aria-label="Previous page">‹</button>
      <div class="pf-tabs"></div>
      <button type="button" class="pf-btn pf-next" aria-label="Next page">›</button>
      <label class="pf-preview-toggle"><input type="checkbox"> <span></span></label>`;
    const tabs = nav.querySelector(".pf-tabs");
    const draw = () => {
      tabs.innerHTML = titles().map((t, i) => `<button type="button" class="pf-tab" data-p="${i + 1}"><b>${i + 1}</b> ${t}</button>`).join("");
      nav.querySelector(".pf-preview-toggle span").textContent = lang() === "mr" ? "छापील दृश्य" : "Print view";
      markCurrent();
    };
    const go = (p) => S.pages[Math.max(0, Math.min(S.pages.length - 1, p - 1))].scrollIntoView({ behavior: "smooth", block: "start" });
    tabs.addEventListener("click", (e) => { const b = e.target.closest(".pf-tab"); if (b) go(+b.dataset.p); });
    nav.querySelector(".pf-prev").addEventListener("click", () => go(S.current - 1));
    nav.querySelector(".pf-next").addEventListener("click", () => go(S.current + 1));
    nav.querySelector(".pf-preview-toggle input").addEventListener("change", (e) => {
      S.mount.classList.toggle("pf-print-view", e.target.checked);
      closeAssist();
    });
    function markCurrent() {
      tabs.querySelectorAll(".pf-tab").forEach(b => {
        const on = +b.dataset.p === S.current;
        b.classList.toggle("pf-on", on);
        if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    }
    S.current = 1;
    const io = new IntersectionObserver((ents) => {
      const vis = ents.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) { S.current = +vis.target.dataset.page; markCurrent(); }
    }, { threshold: [0.25, 0.5, 0.75] });
    S.pages.forEach(p => io.observe(p));
    window.addEventListener("langchange", () => { draw(); if (S.active) openAssist(S.active); });
    draw();
    return nav;
  }

  // ── init ──────────────────────────────────────────────────────────────────
  async function init({ mount, form, formDir }) {
    S.mount = mount; S.form = form; S.formDir = formDir.replace(/\/?$/, "/");
    const [spec, bytes] = await Promise.all([
      fetch(S.formDir + "fields.json").then(r => r.json()),
      fetch(S.formDir + "template.pdf").then(r => r.arrayBuffer()),
    ]);
    S.spec = spec; S.templateBytes = bytes; S.fields = spec.fields;
    for (const f of spec.fields) {
      S.byId[f.id] = f;
      if (f.key) (S.byKey[f.key] = S.byKey[f.key] || []).push(f);
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    S.pdf = await pdfjsLib.getDocument({ data: bytes.slice(0), standardFontDataUrl: PDFJS_FONTS }).promise;

    const [W, H] = spec.pageSize;
    const doc = document.createElement("div");
    doc.className = "pf-doc";
    for (let p = 1; p <= S.pdf.numPages; p++) {
      const pageEl = document.createElement("section");
      pageEl.className = "pf-page";
      pageEl.dataset.page = p;
      pageEl.style.aspectRatio = `${W} / ${H}`;
      pageEl.setAttribute("aria-label", `Page ${p}`);
      const layer = document.createElement("div");
      layer.className = "pf-layer";
      pageEl.appendChild(layer);
      doc.appendChild(pageEl);
      S.pages.push(pageEl);
      spec.fields.filter(f => f.page === p).forEach(f => makeField(f, layer));
    }
    mount.appendChild(buildNav());
    mount.appendChild(doc);
    buildAssist().hidden = true;

    const ro = new ResizeObserver(() => {
      S.pages.forEach(pg => pg.style.setProperty("--k", pg.clientWidth / W));
      clearTimeout(S.rt);
      S.rt = setTimeout(() => S.pages.forEach((_, i) => renderPage(i + 1)), 120);
    });
    ro.observe(doc);
    S.pages.forEach(pg => pg.style.setProperty("--k", pg.clientWidth / W));
    for (let p = 1; p <= S.pdf.numPages; p++) await renderPage(p);

    document.addEventListener("mousedown", (e) => {
      if (S.assist && !S.assist.hidden && !e.target.closest(".pf-assist") && !e.target.closest(".pf-text")) closeAssist();
    });
    if (document.fonts && document.fonts.load) document.fonts.load(`16px ${DEVA_FONT}`, "अ").catch(() => {});
    return S;
  }

  global.PdfForm = { init, buildPdf, fit, _state: S };
})(window);
