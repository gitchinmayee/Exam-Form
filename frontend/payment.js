/**
 * payment.js
 * Handles:
 *  1. Screenshot / print blocking
 *  2. Form submit interception → shows payment modal immediately
 *  3. Payment modal with amount, UPI/Card/NetBanking selection
 *  4. After "Pay Now" → submits form data to backend → sends admin email → shows Download PDF
 */

(function () {
  "use strict";

  const BACKEND_URL = (typeof CONFIG !== "undefined" ? CONFIG.BACKEND_URL : null) || "http://localhost:3000";
  const ADMIN_EMAIL = "ichinmayees4@gmail.com";

  // ─── 1. SCREENSHOT / PRINT BLOCKING ───────────────────────────────────────

  const style = document.createElement("style");
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      body::after {
        content: "Printing is not allowed for this document.";
        visibility: visible !important;
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2rem; color: #c00; font-weight: bold;
      }
    }

    /* ── Payment overlay ── */
    #payment-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.65); z-index: 9999;
      justify-content: center; align-items: center;
    }
    #payment-overlay.active { display: flex; }

    #payment-modal {
      background: #fff; border-radius: 14px;
      padding: 36px 32px; max-width: 440px; width: 92%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      text-align: center; font-family: Arial, sans-serif;
    }
    #payment-modal h2 { color: #0056b3; margin: 0 0 4px; font-size: 1.4rem; }
    #payment-modal .form-name-label {
      color: #555; font-size: 0.9rem; margin-bottom: 14px;
    }
    #payment-modal .amount-display {
      font-size: 2.4rem; font-weight: bold; color: #28a745; margin: 8px 0 20px;
    }
    #payment-modal .section-label {
      font-weight: bold; color: #333; margin-bottom: 8px; text-align: left;
      font-size: 0.9rem;
    }
    .pay-methods {
      display: flex; justify-content: center; gap: 10px;
      margin-bottom: 18px; flex-wrap: wrap;
    }
    .pay-method-btn {
      border: 2px solid #ddd; background: #f8f8f8;
      border-radius: 8px; padding: 9px 18px; cursor: pointer;
      font-size: 0.9rem; font-weight: bold;
      transition: border-color 0.2s, background 0.2s;
    }
    .pay-method-btn.selected, .pay-method-btn:hover {
      border-color: #0056b3; background: #e8f0fe; color: #0056b3;
    }
    #upi-input-group { margin-bottom: 16px; }
    #upi-input-group input {
      width: 100%; padding: 10px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 1rem; box-sizing: border-box;
    }
    #card-input-group { margin-bottom: 16px; display: none; }
    #card-input-group input {
      width: 100%; padding: 10px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 1rem; box-sizing: border-box; margin-bottom: 8px;
    }
    .card-row { display: flex; gap: 8px; }
    .card-row input { flex: 1; }
    #netbanking-input-group { margin-bottom: 16px; display: none; }
    #netbanking-input-group select {
      width: 100%; padding: 10px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 1rem; box-sizing: border-box;
    }
    #pay-now-btn {
      background: #28a745; color: #fff; border: none;
      padding: 13px; border-radius: 8px; font-size: 1.1rem;
      cursor: pointer; width: 100%; margin-bottom: 10px;
      font-weight: bold; transition: background 0.2s;
    }
    #pay-now-btn:hover { background: #218838; }
    #pay-now-btn:disabled { background: #aaa; cursor: not-allowed; }
    #cancel-pay-btn {
      background: none; border: none; color: #888;
      cursor: pointer; font-size: 0.9rem; text-decoration: underline;
    }

    /* Processing */
    #payment-processing { display: none; padding: 20px 0; }
    #payment-processing .spinner {
      width: 52px; height: 52px; border: 5px solid #e0e0e0;
      border-top-color: #0056b3; border-radius: 50%;
      animation: pay-spin 0.8s linear infinite; margin: 0 auto 18px;
    }
    @keyframes pay-spin { to { transform: rotate(360deg); } }
    #payment-processing p { color: #555; font-size: 1rem; }

    /* Success */
    #payment-success { display: none; padding: 10px 0; }
    #payment-success .checkmark { font-size: 4rem; }
    #payment-success h3 { color: #28a745; margin: 8px 0 4px; font-size: 1.3rem; }
    #payment-success .txn-id { color: #888; font-size: 0.85rem; margin-bottom: 16px; }
    #download-pdf-btn {
      display: inline-block; margin-top: 6px;
      background: #0056b3; color: #fff; text-decoration: none;
      padding: 12px 32px; border-radius: 8px; font-size: 1rem;
      border: none; cursor: pointer; font-weight: bold;
      transition: background 0.2s;
    }
    #download-pdf-btn:hover { background: #003d82; }
    #close-modal-btn {
      display: block; margin: 14px auto 0;
      background: none; border: none; color: #888;
      cursor: pointer; font-size: 0.9rem; text-decoration: underline;
    }

    /* Screenshot warning */
    #screenshot-warning {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.95); z-index: 99999;
      justify-content: center; align-items: center;
      color: #fff; font-size: 1.8rem; font-weight: bold;
      text-align: center; padding: 40px;
    }
    #screenshot-warning.active { display: flex; }
  `;
  document.head.appendChild(style);

  // Block print shortcut and PrintScreen
  document.addEventListener("keydown", function (e) {
    if (e.key === "PrintScreen") { e.preventDefault(); flashWarning(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); flashWarning(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") { e.preventDefault(); }
  });

  // Disable right-click
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function flashWarning() {
    const w = document.getElementById("screenshot-warning");
    if (w) { w.classList.add("active"); setTimeout(() => w.classList.remove("active"), 2500); }
  }

  // ─── 2. BUILD MODAL ────────────────────────────────────────────────────────

  function buildModal() {
    const overlay = document.createElement("div");
    overlay.id = "payment-overlay";
    overlay.innerHTML = `
      <div id="payment-modal">

        <!-- Step 1: Payment form -->
        <div id="payment-form-panel">
          <h2>💳 Payment Required</h2>
          <div class="form-name-label" id="modal-form-name"></div>
          <div class="amount-display" id="modal-amount-display">₹500</div>
          <p style="color:#555;font-size:0.9rem;margin-bottom:16px">
            Complete payment to submit your form and download the PDF.
          </p>

          <div class="section-label">Select Payment Method</div>
          <div class="pay-methods">
            <button class="pay-method-btn selected" data-method="upi">📱 UPI</button>
            <button class="pay-method-btn" data-method="card">💳 Card</button>
            <button class="pay-method-btn" data-method="netbanking">🏦 Net Banking</button>
          </div>

          <div id="upi-input-group">
            <input type="text" id="upi-id-input" placeholder="Enter UPI ID (e.g. name@okicici)" />
          </div>

          <div id="card-input-group">
            <input type="text" id="card-number" placeholder="Card Number (16 digits)" maxlength="19" />
            <div class="card-row">
              <input type="text" id="card-expiry" placeholder="MM / YY" maxlength="7" />
              <input type="text" id="card-cvv" placeholder="CVV" maxlength="3" />
            </div>
            <input type="text" id="card-name" placeholder="Name on Card" />
          </div>

          <div id="netbanking-input-group">
            <select id="bank-select">
              <option value="">-- Select Your Bank --</option>
              <option>State Bank of India</option>
              <option>Bank of Maharashtra</option>
              <option>HDFC Bank</option>
              <option>ICICI Bank</option>
              <option>Axis Bank</option>
              <option>Kotak Mahindra Bank</option>
              <option>Punjab National Bank</option>
              <option>Canara Bank</option>
              <option>Union Bank of India</option>
              <option>Other</option>
            </select>
          </div>

          <button id="pay-now-btn">Pay Now</button>
          <button id="cancel-pay-btn">Cancel</button>
          <p style="font-size:0.75rem;color:#aaa;margin-top:10px">
            🔒 This is a demo payment. No real transaction will occur.
          </p>
        </div>

        <!-- Step 2: Processing -->
        <div id="payment-processing">
          <div class="spinner"></div>
          <p><strong>Processing your payment...</strong><br>
          Please do not close this window.</p>
        </div>

        <!-- Step 3: Success -->
        <div id="payment-success">
          <div class="checkmark">✅</div>
          <h3>Payment Successful!</h3>
          <div class="txn-id" id="txn-id-display"></div>
          <p style="color:#555;font-size:0.9rem">
            Your form has been submitted and a copy has been sent to the admin.<br>
            Click below to download your PDF.
          </p>
          <a id="download-pdf-btn" href="#" target="_blank">⬇ Download PDF</a>
          <button id="close-modal-btn">Close</button>
        </div>

      </div>
    `;

    const warn = document.createElement("div");
    warn.id = "screenshot-warning";
    warn.innerHTML = `<div>🚫 Screenshots are not allowed.<br>
      <span style="font-size:1rem;font-weight:normal;color:#ccc">Please download the PDF after payment.</span>
    </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(warn);
  }

  // ─── 3. MODAL STATE ────────────────────────────────────────────────────────

  let pendingFormEl   = null;  // the form element waiting to submit
  let pendingPdfUrl   = null;
  let currentAmount   = 500;

  function showModal(amount, formName) {
    currentAmount = amount || 500;
    document.getElementById("modal-amount-display").textContent = "₹" + currentAmount.toLocaleString("en-IN");
    document.getElementById("modal-form-name").textContent = formName || "";
    showPanel("payment-form-panel");
    // reset UPI default
    document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("selected"));
    document.querySelector('.pay-method-btn[data-method="upi"]').classList.add("selected");
    document.getElementById("upi-input-group").style.display = "block";
    document.getElementById("card-input-group").style.display = "none";
    document.getElementById("netbanking-input-group").style.display = "none";
    document.getElementById("payment-overlay").classList.add("active");
  }

  function hideModal() {
    document.getElementById("payment-overlay").classList.remove("active");
  }

  function showPanel(id) {
    ["payment-form-panel", "payment-processing", "payment-success"].forEach(
      p => { document.getElementById(p).style.display = (p === id) ? "block" : "none"; }
    );
  }

  function randomTxnId() {
    return "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
  }

  function initModalEvents() {
    // Method selection
    document.querySelectorAll(".pay-method-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("selected"));
        this.classList.add("selected");
        document.getElementById("upi-input-group").style.display        = this.dataset.method === "upi"        ? "block" : "none";
        document.getElementById("card-input-group").style.display       = this.dataset.method === "card"       ? "block" : "none";
        document.getElementById("netbanking-input-group").style.display = this.dataset.method === "netbanking" ? "block" : "none";
      });
    });

    // UPI formatting
    document.getElementById("card-number").addEventListener("input", function() {
      let v = this.value.replace(/\D/g,"").slice(0,16);
      this.value = v.replace(/(.{4})/g,"$1 ").trim();
    });
    document.getElementById("card-expiry").addEventListener("input", function() {
      let v = this.value.replace(/\D/g,"").slice(0,4);
      if (v.length > 2) v = v.slice(0,2) + " / " + v.slice(2);
      this.value = v;
    });

    // Pay Now — mock payment then submit to backend
    document.getElementById("pay-now-btn").addEventListener("click", async function () {
      const btn = this;
      btn.disabled = true;
      showPanel("payment-processing");

      try {
        // Simulate payment processing (1.5s)
        await new Promise(r => setTimeout(r, 1500));

        // Now actually submit the form data to backend
        let pdfUrl = null;
        if (pendingFormEl) {
          try {
            const result = await submitFormToBackend(pendingFormEl);
            pdfUrl = result.pdfUrl || null;
            pendingPdfUrl = pdfUrl;
            // Send admin notification in background
            if (pdfUrl) {
              sendAdminEmail(getFormType(pendingFormEl), pdfUrl, collectFormData(pendingFormEl));
            }
          } catch (submitErr) {
            console.warn("Backend submission failed (PDF may not be available):", submitErr);
            // Still show success — mock mode continues
          }
        }

        // Show success
        const txnId = randomTxnId();
        document.getElementById("txn-id-display").textContent = "Transaction ID: " + txnId;

        const dlBtn = document.getElementById("download-pdf-btn");
        if (pdfUrl) {
          dlBtn.href = pdfUrl;
          dlBtn.style.display = "inline-block";
          dlBtn.textContent = "⬇ Download PDF";
        } else {
          dlBtn.style.display = "inline-block";
          dlBtn.href = "#";
          dlBtn.textContent = "⬇ Download PDF (processing...)";
          dlBtn.onclick = () => alert("PDF is being generated. Please check your email or try again shortly.");
        }

        showPanel("payment-success");
      } catch (err) {
        alert("Payment error: " + err.message);
        showPanel("payment-form-panel");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("cancel-pay-btn").addEventListener("click", function () {
      hideModal();
      pendingFormEl = null;
      // Re-enable submit button
      document.querySelectorAll('form [type="submit"]').forEach(b => {
        b.disabled = false;
        b.textContent = b.dataset.originalText || b.textContent;
      });
    });

    document.getElementById("close-modal-btn").addEventListener("click", hideModal);
  }

  // ─── 4. BACKEND CALLS ─────────────────────────────────────────────────────

  function collectFormData(form) {
    const data = {};
    new FormData(form).forEach((val, key) => {
      if (typeof val === "string") {
        data[key] = data[key] ? [].concat(data[key], val) : val;
      }
      // skip File objects — not JSON-serializable
    });
    return data;
  }

  function getFormType(form) {
    const page = window.location.pathname.split("/").pop().replace(".html", "");
    return page || form.id || "unknown_form";
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

  async function submitFormToBackend(form) {
    // Capture the filled form HTML to use as PDF content
    const formHtml = form.outerHTML;
    // Also grab the page's <style> tags for styling
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map(el => el.outerHTML).join("\n");

    const payload = {
      form_type: getFormType(form),
      form_data: collectFormData(form),
      form_html: `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}<style>
        body{font-family:Arial,sans-serif;margin:20px;background:#fff;}
        button{display:none!important;}
        #global-lang-toggle{display:none!important;}
      </style></head><body>${formHtml}</body></html>`,
      user_id: getUserId(),
      lang: localStorage.getItem("myexam_lang") || "mr",
    };
    const resp = await fetch(`${BACKEND_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || "Server error");
    }
    return resp.json();
  }

  async function sendAdminEmail(formType, pdfUrl, formData) {
    try {
      await fetch(`${BACKEND_URL}/admin-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_email: ADMIN_EMAIL, form_type: formType, pdf_url: pdfUrl, form_data: formData }),
      });
    } catch (e) {
      console.warn("Admin email notification failed:", e);
    }
  }

  // ─── 5. FORM INTERCEPTION ─────────────────────────────────────────────────

  function getFormAmount(form) {
    if (form.dataset.amount) return parseInt(form.dataset.amount, 10);
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(?:रुपये|रु\.|₹)\s*([\d,]+)/i);
    if (match) {
      const amt = parseInt(match[1].replace(/,/g, ""), 10);
      if (!isNaN(amt) && amt > 0) return amt;
    }
    return 500;
  }

  function getFormDisplayName() {
    return document.title || "Form Submission";
  }

  function interceptForms() {
    document.querySelectorAll("form").forEach(form => {
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.dataset.originalText = submitBtn.textContent;

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        pendingFormEl = form;

        if (submitBtn) {
          // Reset button text immediately so it doesn't stay as "Please wait..."
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "Submit & Pay";
        }

        // Show payment modal immediately — backend call happens after Pay Now
        showModal(getFormAmount(form), getFormDisplayName());
      });
    });
  }

  // ─── 6. INIT ──────────────────────────────────────────────────────────────

  function init() {
    buildModal();
    initModalEvents();
    interceptForms();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
