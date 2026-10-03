/**
 * lang-toggle.js
 * - Floating toggle button on all form pages
 * - Translates elements with data-mr / data-en attributes
 * - Translates placeholder text with data-ph-mr / data-ph-en attributes
 * - Persists language in localStorage "myexam_lang"
 */
(function () {
  const LANG_KEY = "myexam_lang";
  function getLang() { return localStorage.getItem(LANG_KEY) || "mr"; }
  function setLang(l) { localStorage.setItem(LANG_KEY, l); }

  const style = document.createElement("style");
  style.textContent = `
    #global-lang-toggle {
      position: fixed; top: 14px; right: 16px; z-index: 8888;
      background: #0056b3; color: #fff; border: none;
      border-radius: 20px; padding: 7px 18px; font-size: 0.9rem;
      font-weight: bold; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: background 0.2s; font-family: Arial, sans-serif;
    }
    #global-lang-toggle:hover { background: #003d82; }
  `;
  document.head.appendChild(style);

  function applyLang(lang) {
    // Translate elements with data-mr / data-en
    document.querySelectorAll("[data-mr]").forEach(el => {
      el.textContent = lang === "mr" ? el.dataset.mr : (el.dataset.en || el.dataset.mr);
    });
    // Translate placeholders
    document.querySelectorAll("[data-ph-mr]").forEach(el => {
      el.placeholder = lang === "mr" ? el.dataset.phMr : (el.dataset.phEn || el.dataset.phMr);
    });
    // auth.js pages
    if (typeof window.updateTexts === "function") window.updateTexts();
  }

  function createToggleBtn() {
    const btn = document.createElement("button");
    btn.id = "global-lang-toggle";
    const update = () => {
      btn.textContent = getLang() === "mr" ? "🌐 English" : "🌐 मराठी";
    };
    update();
    btn.addEventListener("click", function () {
      const newLang = getLang() === "mr" ? "en" : "mr";
      setLang(newLang);
      update();
      applyLang(newLang);
      window.dispatchEvent(new CustomEvent("langchange", { detail: { lang: newLang } }));
    });
    document.body.appendChild(btn);
    // Apply saved lang on load
    applyLang(getLang());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggleBtn);
  } else {
    createToggleBtn();
  }
})();
