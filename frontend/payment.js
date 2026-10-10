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

  // ── Submit handler ────────────────────────────────────────────────────────
  function interceptForms() {
    document.querySelectorAll("form").forEach(form => {
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.dataset.originalText = submitBtn.textContent;

      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting..."; }

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
            if (submitBtn) submitBtn.textContent = "Preparing PDF...";
            pdfBlob = await generateFormPdf(form, `${payload.form_type}.pdf`);
            payload.pdf_base64 = await blobToBase64(pdfBlob);
          } catch (pdfErr) {
            console.warn("Client PDF generation failed, using server PDF:", pdfErr);
          }
          if (submitBtn) submitBtn.textContent = "Submitting...";

          const resp = await fetch(`${BACKEND_URL}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await resp.json();

          if (!resp.ok) throw new Error(result.message || "Submission failed");

          const pdfUrl = result.pdfUrl;

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

          alert("✅ Form submitted! Your PDF is downloading.");

        } catch (err) {
          alert("Submission failed: " + err.message);
          console.error(err);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || "Submit";
          }
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
