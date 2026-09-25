// auth.js  (module)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// --- CONFIG: replace these with your project values ---
const SUPABASE_URL = "https://vaibfaqweevjdtbwkkye.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaWJmYXF3ZWV2amR0Yndra3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMjY4MTgsImV4cCI6MjEwNTkwMjgxOH0._Ck_2K0MydGkgPXiEQIDPeUsRtZS95Andvj5Nk3HsQA";
// ------------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase; // make available globally for other scripts

// language utility
const LANG_KEY = "myexam_lang";
function getLang(){ return localStorage.getItem(LANG_KEY) || "mr"; }
function setLang(l){ localStorage.setItem(LANG_KEY, l); updateTexts(); }

// translation dictionary
const translations = {
  // labels / placeholders / buttons
  title_login: { en: "Login", mr: "लॉगिन" },
  title_register: { en: "Register", mr: "नोंदणी" },

  label_fullname: { en: "Full Name:", mr: "पूर्ण नाव:" },
  placeholder_fullname: { en: "Enter full name", mr: "पूर्ण नाव टाका" },

  label_email: { en: "Email:", mr: "ईमेल:" },
  placeholder_email: { en: "name@example.com", mr: "उदाहरण@इमेल.कॉम" },

  label_phone: { en: "Phone Number:", mr: "फोन क्रमांक:" },
  placeholder_phone: { en: "e.g. 919XXXXXXXXX", mr: "उदा. 919XXXXXXXXX" },

  label_dob: { en: "Date of Birth:", mr: "जन्म तारीख:" },
  label_course: { en: "Course:", mr: "कोर्स:" },
  label_semester: { en: "Semester:", mr: "सेमेस्टर:" },
  label_exam_mode: { en: "Exam Mode:", mr: "परीक्षेचा प्रकार:" },
  label_subjects: { en: "Subjects:", mr: "विषय:" },

  btn_print: { en: "Print Form", mr: "प्रिंट करा" },
  btn_submit: { en: "Submit & Send via WhatsApp", mr: "सबमिट करा आणि व्हाट्सअप पाठवा" },

  toggle_lang: { en: "मराठी", mr: "English" }, // button shows target language (i.e. if lang=mr, show "English" to switch)
  btn_logout: { en: "Logout", mr: "बाहेर पडणे" }
};

// run translations into elements with data attributes
export function updateTexts() {
  const lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.dataset.i18n;
    if(!key) return;
    const dict = translations[key];
    if(!dict) return;
    el.textContent = dict[lang] ?? dict.en ?? el.textContent;
  });
  // placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key = el.dataset.i18nPlaceholder;
    if(!key) return;
    const dict = translations[key];
    if(!dict) return;
    el.placeholder = dict[getLang()] ?? dict.en ?? el.placeholder;
  });
}

// expose toggle to window so HTML can call it
window.toggleLang = function(){
  const current = getLang();
  setLang(current === "mr" ? "en" : "mr");
};

// Setup form handlers if present
document.addEventListener("DOMContentLoaded", async () => {
  updateTexts();

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return alert("Login failed: " + error.message);
        // success
        window.location = "dashboard.html";
      } catch (err) { console.error(err); alert("Login error"); }
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("reg_email").value.trim();
      const password = document.getElementById("reg_password").value;
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return alert("Register failed: " + error.message);
        alert("Registered. Check your email for confirmation (if enabled).");
        window.location = "login.html";
      } catch (err) { console.error(err); alert("Register error"); }
    });
  }
});
