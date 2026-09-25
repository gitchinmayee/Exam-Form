document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("lang-toggle");
  if (!toggleBtn) return; // Exit if toggle not on page

  toggleBtn.addEventListener("click", () => {
    const elements = document.querySelectorAll("[data-lang-en]");
    elements.forEach(el => {
      if (el.textContent.trim() === el.getAttribute("data-lang-en")) {
        el.textContent = el.getAttribute("data-lang-mr");
      } else {
        el.textContent = el.getAttribute("data-lang-en");
      }
    });
  });
});
