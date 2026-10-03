/**
 * payment.js
 * On form submit:
 *  1. Sends form data to backend → gets PDF URL back
 *  2. Auto-downloads the PDF to the user
 *  3. Backend sends email to admin + CC
 * Also blocks print/screenshot.
 */
(function () {
  "use strict";

  const BACKEND_URL = (typeof CONFIG !== "undefined" ? CONFIG.BACKEND_URL : null) || "http://localhost:3000";
  const ADMIN_EMAIL = "ichinmayees4@gmail.com";

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

          const resp = await fetch(`${BACKEND_URL}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await resp.json();

          if (!resp.ok) throw new Error(result.message || "Submission failed");

          const pdfUrl = result.pdfUrl;

          // 1. Auto-download PDF to user
          if (pdfUrl) {
            const a = document.createElement("a");
            a.href = pdfUrl;
            a.download = `${payload.form_type}.pdf`;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          // 2. Notify admin (fire and forget)
          fetch(`${BACKEND_URL}/admin-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              admin_email: ADMIN_EMAIL,
              form_type: payload.form_type,
              pdf_url: pdfUrl,
              form_data: payload.form_data,
            }),
          }).catch(err => console.warn("Admin notify failed:", err));

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
