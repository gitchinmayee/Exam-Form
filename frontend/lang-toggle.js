/**
 * lang-toggle.js
 * Injects a floating Marathi/English language toggle button on any page.
 * Persists language choice in localStorage under key "myexam_lang".
 * Pages using auth.js already call updateTexts() — this script calls it too if available.
 * For form pages that don't have auth.js, this script handles the toggle independently.
 */
(function () {
  const LANG_KEY = "myexam_lang";

  function getLang() { return localStorage.getItem(LANG_KEY) || "mr"; }
  function setLang(l) { localStorage.setItem(LANG_KEY, l); }

  // Inject toggle button styles
  const style = document.createElement("style");
  style.textContent = `
    #global-lang-toggle {
      position: fixed;
      top: 14px;
      right: 16px;
      z-index: 8888;
      background: #0056b3;
      color: #fff;
      border: none;
      border-radius: 20px;
      padding: 7px 18px;
      font-size: 0.9rem;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: background 0.2s;
      font-family: Arial, sans-serif;
    }
    #global-lang-toggle:hover { background: #003d82; }
  `;
  document.head.appendChild(style);

  function createToggleBtn() {
    const btn = document.createElement("button");
    btn.id = "global-lang-toggle";
    updateBtnLabel(btn);
    btn.addEventListener("click", function () {
      const newLang = getLang() === "mr" ? "en" : "mr";
      setLang(newLang);
      updateBtnLabel(btn);
      // If auth.js updateTexts is available, call it
      if (typeof window.toggleLang === "function") {
        // auth.js already handles toggle on its own pages (login/register)
        // don't double-fire; just update label
      }
      // Dispatch a custom event so pages can listen if needed
      window.dispatchEvent(new CustomEvent("langchange", { detail: { lang: newLang } }));
    });
    document.body.appendChild(btn);
  }

  function updateBtnLabel(btn) {
    btn.textContent = getLang() === "mr" ? "🌐 English" : "🌐 मराठी";
    btn.title = getLang() === "mr" ? "Switch to English" : "मराठीत बदला";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggleBtn);
  } else {
    createToggleBtn();
  }
})();
