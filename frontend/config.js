// config.js — update BACKEND_URL when deploying to production
const CONFIG = {
  BACKEND_URL: window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://your-backend.onrender.com"  // ← replace with your Render URL after deploying
};
