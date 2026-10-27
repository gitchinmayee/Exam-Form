/**
 * renewal-autofill.js — autofill bridge between info form and renewal form.
 *
 * Phase 1 (data-role="save"): reads keyed fields + extra HTML inputs,
 *   saves to localStorage, navigates to renewal form.
 * Phase 2 (data-role="load"): polls until engine DOM elements are built,
 *   then injects saved values via the engine's input handler (propagates
 *   across all 9 pages automatically).
 */
(function () {
  "use strict";

  var LS_PREFIX = "myexam_renewal_";
  var SCRIPT_EL = document.currentScript;
  var ROLE      = SCRIPT_EL ? SCRIPT_EL.dataset.role : "";
  var NEXT_PAGE = (SCRIPT_EL && SCRIPT_EL.dataset.next) || "contractor_renewal_form.html";

  /* ── localStorage helpers ─────────────────────────────────────── */
  function save(key, value) {
    if (!key || value == null || value === "") return;
    try { localStorage.setItem(LS_PREFIX + key, value); } catch (_) {}
  }
  function load(key) {
    try { return localStorage.getItem(LS_PREFIX + key) || null; } catch (_) { return null; }
  }

  /* ── Wait until engine has built DOM elements ─────────────────── */
  // PdfForm.init() is async (fetches JSON + PDF, renders pages).
  // state.els is populated field-by-field inside makeField().
  // We check that the first text/date field has an element in state.els
  // (choice fields store the layer div — counting them is unreliable).
  function whenEngineReady(cb) {
    function check() {
      var pf = window.PdfForm;
      if (!pf || !pf._state) { setTimeout(check, 80); return; }
      var state = pf._state;
      if (!state.fields || state.fields.length === 0) { setTimeout(check, 80); return; }
      // Find the first text field and check its element exists in els
      var firstText = null;
      for (var i = 0; i < state.fields.length; i++) {
        if (state.fields[i].type === "text" || state.fields[i].type === "date") {
          firstText = state.fields[i];
          break;
        }
      }
      if (!firstText) { setTimeout(check, 80); return; }
      if (!state.els[firstText.id]) { setTimeout(check, 80); return; }
      // Engine DOM is ready; wait one more tick for renderPage to settle
      setTimeout(function () { cb(state); }, 200);
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { setTimeout(check, 100); });
    } else {
      setTimeout(check, 100);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 1 — SAVE (info form)
  ══════════════════════════════════════════════════════════════ */
  function initSave() {
    whenEngineReady(function (state) {
      addContinueButtons(state);
    });

    function addContinueButtons(state) {
      var isMr  = (localStorage.getItem("myexam_lang") || "mr") === "mr";
      var label = isMr ? "पुढे जा \u2192 नूतनीकरण फॉर्म" : "Continue \u2192 Renewal Form";

      function makeBtn() {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-continue-renewal";
        b.style.cssText = "background:#0056b3;color:#fff;padding:9px 18px;" +
          "border:none;border-radius:6px;font-size:0.92rem;" +
          "font-weight:bold;cursor:pointer;font-family:inherit;";
        b.textContent = label;
        b.addEventListener("click", function () { collectAndNavigate(state); });
        return b;
      }

      var topBar = document.querySelector(".actions");
      if (topBar) topBar.appendChild(makeBtn());
      var bottom = document.querySelector(".bottom-actions");
      if (bottom) bottom.appendChild(makeBtn());

      window.addEventListener("langchange", function () {
        var mr  = (localStorage.getItem("myexam_lang") || "mr") === "mr";
        var lbl = mr ? "पुढे जा \u2192 नूतनीकरण फॉर्म" : "Continue \u2192 Renewal Form";
        document.querySelectorAll(".btn-continue-renewal")
          .forEach(function (b) { b.textContent = lbl; });
      });
    }

    function collectAndNavigate(state) {
      if (!state || !state.fields || !state.els) {
        alert("Form not ready — please wait and try again.");
        return;
      }

      var saved = 0;

      // 1. Save every keyed text/date field from the PDF engine
      state.fields.forEach(function (f) {
        if (!f.key) return;
        if (f.type !== "text" && f.type !== "date") return;
        var el = state.els[f.id];
        if (!el) return;
        var v = (el.value || "").trim();
        if (v) { save(f.key, v); saved++; }
      });

      // 2. Save extra plain HTML inputs (data-autofill-key attribute)
      document.querySelectorAll("[data-autofill-key]").forEach(function (el) {
        var key = el.dataset.autofillKey;
        var v   = (el.value || "").trim();
        if (key && v) { save(key, v); saved++; }
      });

      console.log("[RenewalAutofill] Saved " + saved + " values:");
      Object.keys(localStorage)
        .filter(function (k) { return k.startsWith(LS_PREFIX); })
        .forEach(function (k) { console.log("  " + k + " = " + localStorage.getItem(k)); });

      window.location.href = NEXT_PAGE;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE 2 — LOAD (renewal form)
  ══════════════════════════════════════════════════════════════ */
  function initLoad() {
    // Check there is anything to load before waiting for the engine
    var anyStored = Object.keys(localStorage)
      .some(function (k) { return k.startsWith(LS_PREFIX); });
    if (!anyStored) {
      console.log("[RenewalAutofill] No stored data — skipping.");
      return;
    }

    whenEngineReady(function (state) {
      injectValues(state);
    });
  }

  function injectValues(state) {
    // Build key → first eligible field map (skip duplicates, skip non-text)
    var keyToField = {};
    state.fields.forEach(function (f) {
      if (!f.key) return;
      if (f.type === "photo" || f.type === "signature") return;
      if (f.type === "check" || f.type === "choice") return;
      if (!keyToField[f.key]) keyToField[f.key] = f;
    });

    var count = 0;

    Object.keys(keyToField).forEach(function (key) {
      var val = load(key);
      if (!val) return;

      var f  = keyToField[key];
      var el = state.els[f.id];
      if (!el) return;

      // Set the value on the input element
      el.value = val;

      // Fire the engine's own "input" event handler.
      // The handler: sanitizes → applyText (fit + font) → markManual → propagate
      // This fills every other page that shares the same key automatically.
      el.dispatchEvent(new Event("input", { bubbles: true }));

      count++;
      console.log("[RenewalAutofill] Injected " + key + " = " + val);
    });

    console.log("[RenewalAutofill] Injection complete. " + count + " keys filled.");
    showBanner(count);
  }

  function showBanner(count) {
    if (count === 0) return;
    var isMr = (localStorage.getItem("myexam_lang") || "mr") === "mr";
    var msg  = isMr
      ? "\u2713 " + count + " \u092e\u093e\u0939\u093f\u0924\u0940 \u0906\u092a\u094b\u0906\u092a \u092d\u0930\u0932\u0940 \u0917\u0947\u0932\u0940. \u0924\u092a\u093e\u0938\u093e \u0935 \u0939\u0935\u0947 \u0924\u0930 \u092c\u0926\u0932\u093e."
      : "\u2713 " + count + " field(s) pre-filled. Review and edit if needed.";

    var banner = document.createElement("div");
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;" +
      "background:#28a745;color:#fff;text-align:center;" +
      "padding:10px 48px 10px 16px;font-size:0.9rem;font-family:inherit;" +
      "box-shadow:0 2px 8px rgba(0,0,0,0.25);";
    banner.textContent = msg;

    var x = document.createElement("button");
    x.textContent = "\u00d7";
    x.style.cssText = "position:absolute;right:14px;top:50%;" +
      "transform:translateY(-50%);background:none;border:none;" +
      "color:#fff;font-size:1.5rem;cursor:pointer;line-height:1;padding:0;";
    x.addEventListener("click", function () { banner.remove(); });
    banner.appendChild(x);

    document.body.insertAdjacentElement("afterbegin", banner);
    setTimeout(function () { if (banner.parentNode) banner.remove(); }, 7000);
  }

  /* ── Entry point ──────────────────────────────────────────── */
  if (ROLE === "save") {
    initSave();
  } else if (ROLE === "load") {
    initLoad();
  }

  // Console debugging helpers
  window.RenewalAutofill = {
    dump: function () {
      Object.keys(localStorage)
        .filter(function (k) { return k.startsWith(LS_PREFIX); })
        .forEach(function (k) { console.log(k + " = " + localStorage.getItem(k)); });
    },
    clearAll: function () {
      Object.keys(localStorage)
        .filter(function (k) { return k.startsWith(LS_PREFIX); })
        .forEach(function (k) { localStorage.removeItem(k); });
      console.log("[RenewalAutofill] Cleared.");
    },
    reInject: function () {
      var state = window.PdfForm && window.PdfForm._state;
      if (state) injectValues(state);
    }
  };

})();
