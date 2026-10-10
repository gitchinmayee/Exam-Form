/**
 * payment.js
 * On form submit:
 *  1. Renders the filled form page to an A4 PDF (exact on-screen copy) and
 *     sends it with the form data to the backend → gets PDF URL back
 *  2. Auto-downloads the PDF to the user
 *  3. Backend emails the PDF to admin + CC (configured via env vars on the server)
 * Also blocks print/screenshot.
 */
(function () {
  "use strict";

  const BACKEND_URL = (typeof CONFIG !== "undefined" ? CONFIG.BACKEND_URL : null) || "http://localhost:3000";

  // ── Screenshot / print blocking ──────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      body::after {
        content: "Printing is not allowed.";
        visibility: visible !important;
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2rem; color: #c00; font-weight: bold;
      }
    }
    #screenshot-warning {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.95); z-index: 99999;
      justify-content: center; align-items: center;
      color: #fff; font-size: 1.8rem; font-weight: bold; text-align: center; padding: 40px;
    }
    #screenshot-warning.active { display: flex; }
    #submit-progress { position: fixed; inset: 0; z-index: 99990; display: none; align-items: center; justify-content: center;
      background: rgba(15, 30, 50, 0.55); font-family: Arial, "Noto Sans Devanagari", sans-serif; padding: 16px; }
    #submit-progress.show { display: flex; }
    #submit-progress .sp-card { background: #fff; border-radius: 14px; padding: 28px 26px 22px; width: 100%; max-width: 380px;
      text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
    #submit-progress .sp-spinner { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%;
      border: 5px solid #dbe6f3; border-top-color: #0056b3; animation: sp-spin 0.9s linear infinite; }
    #submit-progress .sp-icon { display: none; width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%;
      color: #fff; font-size: 32px; line-height: 56px; font-weight: bold; }
    #submit-progress.done .sp-spinner, #submit-progress.error .sp-spinner { display: none; }
    #submit-progress.done .sp-icon { display: block; background: #28a745; }
    #submit-progress.error .sp-icon { display: block; background: #d32f2f; }
    #submit-progress .sp-title { font-size: 1.1rem; font-weight: bold; color: #1a3a5c; margin-bottom: 4px; }
    #submit-progress .sp-title::after { content: ""; display: inline-block; width: 1.2em; text-align: left; animation: sp-dots 1.2s steps(4) infinite; }
    #submit-progress.done .sp-title::after, #submit-progress.error .sp-title::after { content: ""; animation: none; }
    #submit-progress .sp-sub { font-size: 0.85rem; color: #556; min-height: 1.2em; }
    #submit-progress ul { list-style: none; padding: 0; margin: 16px 0 0; text-align: left; font-size: 0.9rem; }
    #submit-progress li { padding: 6px 0 6px 30px; position: relative; color: #99a; }
    #submit-progress li::before { content: ""; position: absolute; left: 4px; top: 8px; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid #c8d3e0; box-sizing: border-box; }
    #submit-progress li.active { color: #1a3a5c; font-weight: bold; }
    #submit-progress li.active::before { border-color: #0056b3; border-top-color: transparent; animation: sp-spin 0.8s linear infinite; }
    #submit-progress li.ok { color: #2e7d32; }
    #submit-progress li.ok::before { content: "✓"; border: none; background: #28a745; color: #fff; font-size: 10px; line-height: 14px;
      text-align: center; font-weight: bold; }
    #submit-progress li.err { color: #d32f2f; font-weight: bold; }
    #submit-progress li.err::before { content: "✕"; border: none; background: #d32f2f; color: #fff; font-size: 9px; line-height: 14px;
      text-align: center; font-weight: bold; }
    #submit-progress .sp-close { display: none; margin-top: 18px; padding: 9px 22px; border: none; border-radius: 6px;
      background: #0056b3; color: #fff; font-weight: bold; cursor: pointer; font-family: inherit; }
    #submit-progress.error .sp-close { display: inline-block; }
    @keyframes sp-spin { to { transform: rotate(360deg); } }
    @keyframes sp-dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
  `;
  document.head.appendChild(style);

  document.addEventListener("keydown", function (e) {
    if (e.key === "PrintScreen") { e.preventDefault(); flashWarning(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); flashWarning(); }
  });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function flashWarning() {
    const w = document.getElementById("screenshot-warning");
    if (w) { w.classList.add("active"); setTimeout(() => w.classList.remove("active"), 2500); }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function collectFormData(form) {
    const data = {};
    new FormData(form).forEach((val, key) => {
      if (typeof val === "string") {
        data[key] = data[key] ? [].concat(data[key], val) : val;
      }
    });
    return data;
  }

  function getFormType(form) {
    return window.location.pathname.split("/").pop().replace(".html", "") || form.id || "unknown_form";
  }

  function getUserId() {
    try {
      if (window.supabase) {
        const session = window.supabase.auth.session && window.supabase.auth.session();
        if (session && session.user) return session.user.id;
      }
    } catch (e) {}
    return null;
  }

  // ── PDF: exact copy of the filled form page ──────────────────────────────
  const HTML2PDF_SRC = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = HTML2PDF_SRC;
      s.onload = () => resolve(window.html2pdf);
      s.onerror = () => reject(new Error("Could not load PDF library"));
      document.head.appendChild(s);
    });
  }

  function formatDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || "");
  }

  // Clone the form page and swap every input for static text so the PDF
  // shows exactly what the user sees on screen (values, ticks, layout).
  function buildPrintableClone(source) {
    const clone = source.cloneNode(true);
    const origFields = source.querySelectorAll("input, textarea, select");
    const cloneFields = clone.querySelectorAll("input, textarea, select");

    origFields.forEach((orig, i) => {
      const el = cloneFields[i];
      const type = (orig.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "file"].includes(type)) { el.remove(); return; }

      const span = document.createElement("span");
      if (type === "checkbox" || type === "radio") {
        span.textContent = orig.checked ? "✓" : "";
        span.style.cssText = `display:inline-block;width:16px;height:16px;line-height:14px;text-align:center;
          border:1.5px solid ${orig.checked ? "#0056b3" : "#666"};border-radius:${type === "radio" ? "50%" : "3px"};
          background:${orig.checked ? "#0056b3" : "#fff"};color:#fff;font-size:12px;font-weight:bold;vertical-align:middle;`;
        el.replaceWith(span);
        return;
      }

      let text = orig.value || "";
      if (orig.tagName === "SELECT") text = orig.selectedIndex >= 0 && orig.value ? orig.options[orig.selectedIndex].text : "";
      if (type === "date") text = formatDate(text);

      const cs = getComputedStyle(orig);
      const parentW = orig.parentElement ? orig.parentElement.clientWidth : 0;
      const fullWidth = parentW && orig.offsetWidth >= parentW - 30;
      span.textContent = text || " ";
      span.style.cssText = `display:${fullWidth ? "block" : "inline-block"};
        ${fullWidth ? "width:100%;" : `min-width:${orig.offsetWidth}px;max-width:100%;`}
        border-bottom:${cs.borderBottomWidth} solid #555;font-size:${cs.fontSize};font-family:${cs.fontFamily};
        padding:${cs.padding};color:#000;white-space:${orig.tagName === "TEXTAREA" ? "pre-wrap" : "normal"};
        word-break:break-word;vertical-align:bottom;min-height:1.4em;`;
      el.replaceWith(span);
    });

    clone.querySelectorAll(".button-group, button, script, #global-lang-toggle").forEach(n => n.remove());
    clone.style.boxShadow = "none";
    clone.style.margin = "0";
    clone.style.padding = "0 4px";
    clone.style.maxWidth = "none";
    clone.style.width = "calc(100% - 12px)"; // keep right border inside the canvas
    return clone;
  }

  async function generateFormPdf(form, fileName) {
    // Forms built on their original PDF template supply their own exact builder
    if (typeof window.MyExamBuildPdf === "function") return window.MyExamBuildPdf(form);
    const html2pdf = await loadHtml2Pdf();
    const source = form.closest(".page") || document.querySelector(".page") || form;
    const clone = buildPrintableClone(source);
    return html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: fileName,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".section-title", ".form-header", ".prose-section p", ".field-group"] },
    }).from(clone).outputPdf("blob");
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ── Submit progress overlay ───────────────────────────────────────────────
  const isMr = () => (localStorage.getItem("myexam_lang") || "mr") === "mr";
  const STEPS = [
    ["PDF तयार होत आहे", "Preparing PDF"],
    ["फॉर्म पाठवत आहे", "Submitting form"],
    ["PDF डाउनलोड होत आहे", "Downloading PDF"],
  ];
  const progress = {
    el: null, slowTimer: null,
    open() {
      if (!this.el) {
        this.el = document.createElement("div");
        this.el.id = "submit-progress";
        this.el.setAttribute("role", "status");
        this.el.setAttribute("aria-live", "polite");
        this.el.innerHTML = `<div class="sp-card"><div class="sp-spinner"></div><div class="sp-icon"></div>
          <div class="sp-title"></div><div class="sp-sub"></div><ul></ul>
          <button type="button" class="sp-close"></button></div>`;
        this.el.querySelector(".sp-close").addEventListener("click", () => this.close());
        document.body.appendChild(this.el);
      }
      const mr = isMr();
      this.el.className = "show";
      this.el.querySelector("ul").innerHTML = STEPS.map(s => `<li>${mr ? s[0] : s[1]}</li>`).join("");
      this.el.querySelector(".sp-close").textContent = mr ? "बंद करा" : "Close";
      this.el.querySelector(".sp-sub").textContent = mr ? "कृपया पान बंद करू नका" : "Please don't close this page";
    },
    step(i) {
      const mr = isMr();
      this.el.querySelectorAll("li").forEach((li, j) => { li.className = j < i ? "ok" : j === i ? "active" : ""; });
      this.el.querySelector(".sp-title").textContent = mr ? STEPS[i][0] : STEPS[i][1];
      clearTimeout(this.slowTimer);
      if (i === 1) {        // the free server can take a while to wake up
        this.slowTimer = setTimeout(() => {
          this.el.querySelector(".sp-sub").textContent = mr
            ? "सर्व्हर सुरू होत आहे… १ मिनिटापर्यंत लागू शकतो, कृपया थांबा"
            : "Server is waking up… this can take up to a minute, please wait";
        }, 8000);
      }
    },
    done() {
      clearTimeout(this.slowTimer);
      const mr = isMr();
      this.el.className = "show done";
      this.el.querySelectorAll("li").forEach(li => { li.className = "ok"; });
      this.el.querySelector(".sp-icon").textContent = "✓";
      this.el.querySelector(".sp-title").textContent = mr ? "फॉर्म सबमिट झाला!" : "Form submitted!";
      this.el.querySelector(".sp-sub").textContent = mr ? "तुमची PDF डाउनलोड झाली आहे" : "Your PDF has been downloaded";
      setTimeout(() => this.close(), 3000);
    },
    fail(msg) {
      clearTimeout(this.slowTimer);
      const mr = isMr();
      this.el.className = "show error";
      this.el.querySelectorAll("li.active").forEach(li => { li.className = "err"; });
      this.el.querySelector(".sp-icon").textContent = "!";
      this.el.querySelector(".sp-title").textContent = mr ? "सबमिट झाले नाही" : "Submission failed";
      this.el.querySelector(".sp-sub").textContent = msg;
    },
    close() { clearTimeout(this.slowTimer); if (this.el) this.el.className = ""; },
  };

  // ── Submit handler ────────────────────────────────────────────────────────
  function interceptForms() {
    document.querySelectorAll("form").forEach(form => {
      const submitBtns = [...form.querySelectorAll('[type="submit"]')];

      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        submitBtns.forEach(b => { b.disabled = true; });
        progress.open();
        progress.step(0);

        try {
          const payload = {
            form_type: getFormType(form),
            form_data: collectFormData(form),
            user_id: getUserId(),
            lang: localStorage.getItem("myexam_lang") || "mr",
          };

          // Build the PDF from the filled page itself (falls back to backend pdfkit on failure)
          let pdfBlob = null;
          try {
            pdfBlob = await generateFormPdf(form, `${payload.form_type}.pdf`);
            payload.pdf_base64 = await blobToBase64(pdfBlob);
          } catch (pdfErr) {
            console.warn("Client PDF generation failed, using server PDF:", pdfErr);
          }
          progress.step(1);

          const resp = await fetch(`${BACKEND_URL}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await resp.json();

          if (!resp.ok) throw new Error(result.message || "Submission failed");

          const pdfUrl = result.pdfUrl;
          progress.step(2);

          // 1. Auto-download PDF to user
          if (pdfBlob) {
            downloadBlob(pdfBlob, `${payload.form_type}.pdf`);
          } else if (pdfUrl) {
            const a = document.createElement("a");
            a.href = pdfUrl;
            a.download = `${payload.form_type}.pdf`;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          progress.done();

        } catch (err) {
          progress.fail(err.message === "Failed to fetch"
            ? (isMr() ? "सर्व्हरशी संपर्क झाला नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा." : "Could not reach the server. Check the internet and try again.")
            : err.message);
          console.error(err);
        } finally {
          submitBtns.forEach(b => { b.disabled = false; });
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Screenshot warning overlay
    const warn = document.createElement("div");
    warn.id = "screenshot-warning";
    warn.innerHTML = `<div>🚫 Screenshots are not allowed.<br>
      <span style="font-size:1rem;font-weight:normal;color:#ccc">Please download the PDF after submission.</span>
    </div>`;
    document.body.appendChild(warn);

    interceptForms();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
