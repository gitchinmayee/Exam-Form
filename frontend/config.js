// config.js — backend URL config
const CONFIG = {
  BACKEND_URL: window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://exam-form-ofmg.onrender.com"
};
