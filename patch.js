/**
 * NationalHealthID — patch.js
 * Rewrites: login.ejs, dashboard.ejs, history.ejs
 * Run from inside: Heath Database Fragmentatin/
 * Command: node patch.js
 */
const fs = require("fs");
const path = require("path");

const VIEWS = path.join(__dirname, "HealthApp", "views");

if (!fs.existsSync(VIEWS)) {
  console.error("❌  Cannot find HealthApp/views — make sure patch.js is in the same folder as HealthApp/");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CSS — replaces the dark gamified look with a premium clinical white
// ═══════════════════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink:       #0a0f1e;
  --ink-2:     #1a2035;
  --ink-3:     #2d3554;
  --mid:       #6b7694;
  --muted:     #9ba3c2;
  --border:    #e4e8f4;
  --border-2:  #cdd3e8;
  --bg:        #f7f8fc;
  --surface:   #ffffff;
  --accent:    #1a56db;
  --accent-2:  #1348c7;
  --accent-bg: #eef3ff;
  --green:     #0d7a4e;
  --green-bg:  #edfaf3;
  --green-b:   #b6ecd6;
  --red:       #c0392b;
  --red-bg:    #fdf0ee;
  --red-b:     #f5c6c2;
  --amber:     #92600a;
  --amber-bg:  #fef9ec;
  --amber-b:   #f7e3a8;
  --radius:    14px;
  --radius-sm: 8px;
  --shadow-sm: 0 1px 3px rgba(10,15,30,.06), 0 1px 2px rgba(10,15,30,.04);
  --shadow:    0 4px 16px rgba(10,15,30,.08), 0 1px 3px rgba(10,15,30,.05);
  --shadow-lg: 0 20px 60px rgba(10,15,30,.12), 0 4px 16px rgba(10,15,30,.06);
}

html { font-size: 15px; -webkit-font-smoothing: antialiased; }
body { font-family: 'Geist', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; }
.serif { font-family: 'Instrument Serif', serif; }
.mono  { font-family: 'Geist Mono', monospace; }

/* Scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 99px; }

/* Nav */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(247,248,252,.92); backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  height: 56px; display: flex; align-items: center;
}
.nav-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 24px;
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.nav-logo-mark {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--ink); display: flex; align-items: center; justify-content: center;
}
.nav-logo-mark i { color: white; font-size: 13px; }
.nav-logo-name { font-size: .875rem; font-weight: 600; color: var(--ink); letter-spacing: -.01em; }
.nav-links { display: flex; align-items: center; gap: 2px; }
.nav-link {
  padding: 6px 12px; border-radius: 6px; font-size: .825rem; font-weight: 500;
  color: var(--mid); text-decoration: none; transition: all .15s;
  display: flex; align-items: center; gap: 6px;
}
.nav-link:hover { color: var(--ink); background: var(--border); }
.nav-link.on { color: var(--accent); background: var(--accent-bg); }
.nav-right { display: flex; align-items: center; gap: 8px; }
.nav-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--ink); color: white;
  font-size: .75rem; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.nav-logout {
  padding: 5px 12px; border-radius: 6px; font-size: .8rem; font-weight: 500;
  color: var(--red); background: var(--red-bg); border: 1px solid var(--red-b);
  text-decoration: none; transition: all .15s;
}
.nav-logout:hover { background: #fce8e6; }

/* Page wrapper */
.page { padding-top: 56px; min-height: 100vh; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* Cards */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
}
.card-hover { transition: box-shadow .2s, border-color .2s, transform .2s; }
.card-hover:hover { box-shadow: var(--shadow); border-color: var(--border-2); transform: translateY(-1px); }

/* Badges */
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 9px; border-radius: 99px; font-size: .72rem; font-weight: 500;
  border: 1px solid; letter-spacing: .01em;
}
.badge-green { background: var(--green-bg); color: var(--green); border-color: var(--green-b); }
.badge-blue  { background: var(--accent-bg); color: var(--accent); border-color: #c5d7f8; }
.badge-red   { background: var(--red-bg); color: var(--red); border-color: var(--red-b); }
.badge-amber { background: var(--amber-bg); color: var(--amber); border-color: var(--amber-b); }
.badge-gray  { background: #f1f3f9; color: var(--mid); border-color: var(--border); }

/* Inputs */
.input {
  width: 100%; padding: 10px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-2); background: var(--surface);
  font-family: 'Geist', sans-serif; font-size: .875rem; color: var(--ink);
  transition: border-color .15s, box-shadow .15s; outline: none;
}
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(26,86,219,.1); }
.input::placeholder { color: var(--muted); }

select.input option { background: white; color: var(--ink); }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 18px; border-radius: var(--radius-sm); font-family: 'Geist', sans-serif;
  font-weight: 500; font-size: .875rem; cursor: pointer; border: 1px solid; text-decoration: none;
  transition: all .15s; line-height: 1;
}
.btn-primary {
  background: var(--accent); color: white; border-color: var(--accent-2);
  box-shadow: 0 1px 3px rgba(26,86,219,.3);
}
.btn-primary:hover { background: var(--accent-2); box-shadow: 0 4px 12px rgba(26,86,219,.35); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: var(--mid); border-color: var(--border-2); }
.btn-ghost:hover { background: var(--bg); color: var(--ink); border-color: var(--border-2); }
.btn-danger { background: var(--red-bg); color: var(--red); border-color: var(--red-b); }
.btn-danger:hover { background: #fce8e6; }

/* Divider */
.divider { height: 1px; background: var(--border); margin: 20px 0; }

/* Section label */
.section-label {
  font-size: .7rem; font-weight: 600; color: var(--muted);
  letter-spacing: .08em; text-transform: uppercase;
}

/* Fade in animation */
.fade { opacity: 0; transform: translateY(12px); animation: fadeIn .45s ease forwards; }
@keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
.d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
.d4{animation-delay:.2s}.d5{animation-delay:.25s}.d6{animation-delay:.3s}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(10,15,30,.45);
  backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal-box {
  background: var(--surface); border-radius: var(--radius);
  box-shadow: var(--shadow-lg); border: 1px solid var(--border);
  width: 100%; max-width: 480px; padding: 28px;
}

/* Progress */
.progress { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 99px; background: var(--accent); transition: width 1s ease; }
.progress-fill-green { background: var(--green); }

/* Toast */
#toast-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast {
  background: var(--ink); color: white; border-radius: var(--radius-sm);
  padding: 12px 16px; font-size: .875rem; display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-lg); animation: slideIn .3s ease; min-width: 240px;
}
@keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }

/* Chip — Health ID */
.health-id-chip {
  display: inline-flex; align-items: center; gap: 12px;
  background: var(--ink); color: white;
  border-radius: var(--radius-sm); padding: 10px 16px;
}
</style>`;

const HEAD = (title, extra='') =>
`<!DOCTYPE html><html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — NationalHealthID</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
${extra}
${GLOBAL_CSS}
</head>`;

const NAV = (active) =>
`<div id="toast-wrap"></div>
<nav class="nav">
  <div class="nav-inner">
    <a href="/dashboard" class="nav-logo">
      <div class="nav-logo-mark"><i class="fa-solid fa-circle-half-stroke"></i></div>
      <span class="nav-logo-name">NationalHealthID</span>
    </a>
    <div class="nav-links">
      <a href="/dashboard" class="nav-link ${active==='dash'?'on':''}"><i class="fa-regular fa-grid-2"></i>Overview</a>
      <a href="/history"   class="nav-link ${active==='hist'?'on':''}"><i class="fa-regular fa-clock-rotate-left"></i>Records</a>
      <a href="/analytics" class="nav-link ${active==='anal'?'on':''}"><i class="fa-regular fa-chart-line"></i>Analytics</a>
      <a href="/uploads"   class="nav-link ${active==='up'?'on':''}"><i class="fa-regular fa-folder-open"></i>Vault</a>
      <a href="/privacy"   class="nav-link ${active==='priv'?'on':''}"><i class="fa-regular fa-shield"></i>Privacy</a>
    </div>
    <div class="nav-right">
      <div class="nav-avatar"><%= user.name.charAt(0).toUpperCase() %></div>
      <a href="/logout" class="nav-logout">Sign out</a>
    </div>
  </div>
</nav>`;

const TOAST_JS =
`<script>
function toast(msg, type) {
  const w = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<i class="fa-solid ' + (type==='err'?'fa-circle-exclamation':'fa-circle-check') + '" style="color:' + (type==='err'?'#f87171':'#34d399') + '"></i>' + msg;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(16px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(), 300); }, 3500);
}
<\/script>`;

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN / LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════
const LOGIN = HEAD("NationalHealthID — India's Health Record System", `
<style>
body { background: #ffffff; overflow-x: hidden; }

/* Hero section */
.lp-hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Top bar */
.lp-topbar {
  padding: 20px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 10;
}
.lp-logo { display: flex; align-items: center; gap: 10px; }
.lp-logo-mark {
  width: 34px; height: 34px; background: var(--ink); border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.lp-logo-mark i { color: white; font-size: 14px; }
.lp-logo-name { font-size: .9rem; font-weight: 600; color: var(--ink); }
.lp-badge {
  font-size: .72rem; color: var(--mid); border: 1px solid var(--border);
  padding: 4px 12px; border-radius: 99px; font-weight: 500;
}

/* Main content */
.lp-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 0;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px 60px;
  align-items: center;
  width: 100%;
}

/* Left */
.lp-left { padding-right: 80px; }

.lp-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent-bg); border: 1px solid #c5d7f8;
  color: var(--accent); font-size: .75rem; font-weight: 600;
  padding: 5px 12px; border-radius: 99px; margin-bottom: 28px;
  letter-spacing: .02em;
}
.lp-eyebrow span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }

.lp-h1 {
  font-family: 'Instrument Serif', serif;
  font-size: 3.6rem;
  line-height: 1.1;
  color: var(--ink);
  letter-spacing: -.02em;
  margin-bottom: 20px;
}
.lp-h1 em { font-style: italic; color: var(--accent); }

.lp-sub {
  font-size: 1rem;
  color: var(--mid);
  line-height: 1.75;
  max-width: 480px;
  margin-bottom: 40px;
}

/* Stat row */
.lp-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 40px;
  padding-bottom: 40px;
  border-bottom: 1px solid var(--border);
}
.lp-stat-num {
  font-family: 'Instrument Serif', serif;
  font-size: 2rem;
  color: var(--ink);
  line-height: 1;
  margin-bottom: 4px;
}
.lp-stat-label { font-size: .75rem; color: var(--mid); font-weight: 500; }

/* Trust pills */
.lp-trust { display: flex; flex-wrap: wrap; gap: 8px; }
.lp-trust-item {
  display: flex; align-items: center; gap: 6px;
  font-size: .78rem; color: var(--mid); font-weight: 500;
}
.lp-trust-item i { color: var(--green); font-size: .72rem; }

/* Right — login card */
.lp-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px;
  box-shadow: var(--shadow-lg);
  position: relative;
}

/* Decorative top line */
.lp-card::before {
  content: '';
  position: absolute;
  top: 0; left: 32px; right: 32px;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), #60a5fa, transparent);
  border-radius: 0 0 2px 2px;
}

.lp-card-header { margin-bottom: 28px; }
.lp-card-title { font-size: 1.15rem; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
.lp-card-sub { font-size: .825rem; color: var(--mid); }

.lp-input-label {
  display: block; font-size: .75rem; font-weight: 600;
  color: var(--ink-3); letter-spacing: .04em;
  text-transform: uppercase; margin-bottom: 6px;
}
.lp-input-wrap { position: relative; }
.lp-input-wrap i {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: var(--muted); font-size: .8rem; pointer-events: none;
}
.lp-input-wrap input { padding-left: 36px; }

.lp-btn {
  width: 100%; padding: 12px; border-radius: 10px;
  background: var(--ink); color: white; border: none;
  font-family: 'Geist', sans-serif; font-weight: 600; font-size: .9rem;
  cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 20px;
}
.lp-btn:hover { background: var(--ink-2); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(10,15,30,.2); }

.lp-secure {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: .72rem; color: var(--muted); margin-top: 14px;
}

.lp-card-footer {
  margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
}
.lp-footer-stat { text-align: center; }
.lp-footer-stat-num { font-size: .9rem; font-weight: 700; color: var(--ink); display: block; }
.lp-footer-stat-label { font-size: .65rem; color: var(--muted); margin-top: 1px; display: block; }

/* Error */
.lp-error {
  background: var(--red-bg); border: 1px solid var(--red-b);
  border-radius: 8px; padding: 11px 14px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 8px;
  color: var(--red); font-size: .825rem;
}

/* Background art */
.lp-bg-art {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.lp-bg-dot {
  width: 1px; height: 1px; background: var(--border);
  position: absolute;
}
.lp-bg-circle {
  position: absolute; border-radius: 50%; border: 1px solid;
}

@media(max-width:900px) {
  .lp-main { grid-template-columns: 1fr; padding: 20px; }
  .lp-left { padding-right: 0; margin-bottom: 32px; }
  .lp-h1 { font-size: 2.4rem; }
}
</style>`) + `
<body>

<!-- Subtle dot grid background -->
<div class="lp-bg-art">
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="#e4e8f4"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)"/>
  </svg>
  <!-- Gradient washes over the dot grid -->
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 15% 50%,rgba(255,255,255,1) 30%,transparent 100%)"></div>
  <div style="position:absolute;top:-200px;right:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(26,86,219,.05) 0%,transparent 70%)"></div>
</div>

<div class="lp-hero" style="position:relative;z-index:1">

  <!-- Top bar -->
  <div class="lp-topbar">
    <div class="lp-logo">
      <div class="lp-logo-mark"><i class="fa-solid fa-circle-half-stroke"></i></div>
      <span class="lp-logo-name">NationalHealthID</span>
    </div>
    <span class="lp-badge">DPDP Act Compliant &nbsp;·&nbsp; Ministry of Health</span>
  </div>

  <!-- Main split -->
  <div class="lp-main">

    <!-- LEFT — landing content -->
    <div class="lp-left fade">

      <div class="lp-eyebrow">
        <span></span>
        India's Sovereign Health Record System
      </div>

      <h1 class="lp-h1">
        One record.<br/>
        Every hospital.<br/>
        <em>Your entire story.</em>
      </h1>

      <p class="lp-sub">
        Indians carry physical files their entire lives — lost between hospitals, 
        delayed diagnoses, repeated tests. NationalHealthID ends that. 
        One ID. Every doctor. Everywhere.
      </p>

      <div class="lp-stats">
        <div>
          <div class="lp-stat-num">2,400+</div>
          <div class="lp-stat-label">Hospitals connected</div>
        </div>
        <div>
          <div class="lp-stat-num">14M+</div>
          <div class="lp-stat-label">Records unified</div>
        </div>
        <div>
          <div class="lp-stat-num">0</div>
          <div class="lp-stat-label">Lost prescriptions</div>
        </div>
      </div>

      <div class="lp-trust">
        <% [
          'Aadhaar-linked identity',
          'DPDP Act compliant',
          '256-bit encryption',
          'Real-time lab sync',
          'Lifetime medical timeline',
          'Instant access revocation'
        ].forEach(function(t){ %>
        <span class="lp-trust-item"><i class="fa-solid fa-check"></i><%= t %></span>
        <% }) %>
      </div>
    </div>

    <!-- RIGHT — login card -->
    <div class="lp-card fade d2">
      <div class="lp-card-header">
        <div class="lp-card-title">Access your Health Record</div>
        <div class="lp-card-sub">Sign in with your National Health ID number</div>
      </div>

      <% if(error){ %>
      <div class="lp-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <%= error %>
      </div>
      <% } %>

      <form method="POST" action="/login">
        <div style="margin-bottom:16px">
          <label class="lp-input-label">Health ID Number</label>
          <div class="lp-input-wrap">
            <i class="fa-regular fa-id-card"></i>
            <input type="number" name="user_id" placeholder="Enter your Health ID — try 1, 2, or 3"
              required class="input" autofocus/>
          </div>
        </div>

        <button type="submit" class="lp-btn">
          <i class="fa-solid fa-arrow-right-to-bracket"></i>
          Access My Health Records
        </button>
      </form>

      <div class="lp-secure">
        <i class="fa-solid fa-lock"></i>
        Your data is encrypted and never shared without consent
      </div>

      <div class="lp-card-footer">
        <div class="lp-footer-stat">
          <span class="lp-footer-stat-num">256-bit</span>
          <span class="lp-footer-stat-label">Encrypted</span>
        </div>
        <div class="lp-footer-stat">
          <span class="lp-footer-stat-num">DPDP</span>
          <span class="lp-footer-stat-label">Compliant</span>
        </div>
        <div class="lp-footer-stat">
          <span class="lp-footer-stat-num">24 / 7</span>
          <span class="lp-footer-stat-label">Access</span>
        </div>
      </div>
    </div>

  </div>
</div>

</body></html>`;

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
const DASHBOARD = HEAD("Overview", `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
.page { background: var(--bg); }

/* Patient header */
.patient-header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 28px 0;
}
.patient-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 20px;
}
.patient-greeting { font-size: .8rem; color: var(--mid); font-weight: 500; margin-bottom: 4px; }
.patient-name { font-family: 'Instrument Serif', serif; font-size: 2.2rem; color: var(--ink); line-height: 1.1; }

/* Health ID tag */
.hid-tag {
  display: flex; align-items: center; gap: 14px;
  background: var(--ink); color: white;
  border-radius: var(--radius-sm); padding: 12px 18px;
}
.hid-tag-label { font-size: .65rem; font-weight: 600; opacity: .5; letter-spacing: .1em; text-transform: uppercase; }
.hid-tag-num { font-family: 'Geist Mono', monospace; font-size: 1.1rem; font-weight: 500; letter-spacing: .08em; margin-top: 2px; }
.hid-tag-meta { font-size: .72rem; opacity: .5; margin-top: 3px; }

/* Dashboard grid */
.dash-grid { max-width: 1200px; margin: 0 auto; padding: 28px 24px; display: flex; flex-direction: column; gap: 20px; }

/* Section title */
.sec-title {
  font-size: .75rem; font-weight: 600; color: var(--mid);
  letter-spacing: .08em; text-transform: uppercase; margin-bottom: 12px;
  display: flex; align-items: center; gap: 8px;
}
.sec-title::after { content:''; flex:1; height:1px; background:var(--border); }

/* Quick stats row — minimal, only the relevant ones */
.qs-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
.qs-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
  transition: box-shadow .2s, border-color .2s;
}
.qs-card:hover { box-shadow: var(--shadow); border-color: var(--border-2); }
.qs-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
  font-size: .875rem;
}
.qs-val { font-size: 1.5rem; font-weight: 600; color: var(--ink); line-height: 1; margin-bottom: 4px; }
.qs-label { font-size: .75rem; color: var(--mid); font-weight: 500; }
.qs-sub { font-size: .72rem; color: var(--muted); margin-top: 3px; }

/* Main two-col layout */
.main-cols { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }

/* Medical summary card */
.med-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.med-card-head {
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.med-card-title { font-size: .9rem; font-weight: 600; color: var(--ink); }
.med-card-body { padding: 0; }

/* Recent record row */
.rec-row {
  padding: 14px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  transition: background .15s; cursor: default;
}
.rec-row:last-child { border-bottom: none; }
.rec-row:hover { background: var(--bg); }
.rec-row-left { flex: 1; min-width: 0; }
.rec-type {
  font-size: .68rem; font-weight: 600; color: var(--mid);
  letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px;
}
.rec-title { font-size: .9rem; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
.rec-sub { font-size: .78rem; color: var(--mid); }
.rec-date { font-size: .72rem; color: var(--muted); font-weight: 500; white-space: nowrap; flex-shrink: 0; font-family: 'Geist Mono', monospace; }

/* Right sidebar */
.sidebar { display: flex; flex-direction: column; gap: 14px; }

/* Meds list */
.med-item {
  padding: 12px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  transition: border-color .15s;
}
.med-item:hover { border-color: var(--border-2); }
.med-name { font-size: .875rem; font-weight: 600; color: var(--ink); }
.med-dosage { font-size: .75rem; color: var(--mid); margin-top: 2px; }
.med-until { font-size: .72rem; color: var(--mid); font-family: 'Geist Mono', monospace; text-align: right; }

/* Wearable card — secondary, smaller */
.wear-row {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.wear-row:last-child { border-bottom: none; }
.wear-label { font-size: .825rem; color: var(--mid); display: flex; align-items: center; gap: 7px; }
.wear-val { font-size: .875rem; font-weight: 600; color: var(--ink); font-family: 'Geist Mono', monospace; }

/* Empty state */
.empty { padding: 32px 20px; text-align: center; color: var(--muted); font-size: .875rem; }
.empty i { font-size: 1.5rem; display: block; margin-bottom: 8px; color: var(--border-2); }

/* View all link */
.view-all {
  font-size: .78rem; color: var(--accent); font-weight: 500; text-decoration: none;
  display: flex; align-items: center; gap: 4px;
}
.view-all:hover { text-decoration: underline; }
</style>`) + `
<body>
${NAV('dash')}
${TOAST_JS}
<div class="page">

  <!-- Patient header -->
  <div class="patient-header" style="margin-top:56px">
    <div class="patient-inner fade">
      <div>
        <div class="patient-greeting">
          <i class="fa-regular fa-sun" style="margin-right:5px"></i>
          <%= (new Date().getHours()<12)?'Good morning':(new Date().getHours()<17)?'Good afternoon':'Good evening' %>
        </div>
        <div class="patient-name"><%= user.name %></div>
        <div style="font-size:.82rem;color:var(--mid);margin-top:4px">
          <%= user.email || '' %> &nbsp;·&nbsp; <%= user.age %>y &nbsp;·&nbsp; <%= user.gender||'—' %> &nbsp;·&nbsp; Blood group: <strong style="color:var(--ink)"><%= user.blood_group||'—' %></strong>
        </div>
      </div>
      <div class="hid-tag fade d2">
        <div>
          <div class="hid-tag-label">National Health ID</div>
          <div class="hid-tag-num">#<%= String(user.user_id).padStart(8,'0') %></div>
          <div class="hid-tag-meta">Accepted at all registered facilities</div>
        </div>
      </div>
    </div>
  </div>

  <div class="dash-grid">

    <!-- Quick stats — health-focused, not fitness-focused -->
    <div>
      <div class="sec-title"><i class="fa-regular fa-clipboard-medical"></i>Health Summary</div>
      <div class="qs-row fade d1">
        <div class="qs-card">
          <div class="qs-icon" style="background:#eef3ff"><i class="fa-regular fa-calendar-check" style="color:var(--accent)"></i></div>
          <div class="qs-val"><%= recentCR.length %></div>
          <div class="qs-label">Clinic visits</div>
          <div class="qs-sub">On record</div>
        </div>
        <div class="qs-card">
          <div class="qs-icon" style="background:var(--green-bg)"><i class="fa-regular fa-flask" style="color:var(--green)"></i></div>
          <div class="qs-val"><%= recentLR.length %></div>
          <div class="qs-label">Lab reports</div>
          <div class="qs-sub">Available</div>
        </div>
        <div class="qs-card">
          <div class="qs-icon" style="background:var(--amber-bg)"><i class="fa-regular fa-pills" style="color:var(--amber)"></i></div>
          <div class="qs-val"><%= meds.length %></div>
          <div class="qs-label">Active prescriptions</div>
          <div class="qs-sub">Currently ongoing</div>
        </div>
        <div class="qs-card">
          <div class="qs-icon" style="background:#fdf4ff"><i class="fa-regular fa-folder-open" style="color:#7e22ce"></i></div>
          <div class="qs-val"><%= uploads.length %></div>
          <div class="qs-label">Documents</div>
          <div class="qs-sub">In your vault</div>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="main-cols fade d2">

      <!-- Left — medical records -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- Recent clinic visits -->
        <div class="med-card">
          <div class="med-card-head">
            <span class="med-card-title">Recent Clinic Visits</span>
            <a href="/history" class="view-all">View all <i class="fa-solid fa-arrow-right" style="font-size:.65rem"></i></a>
          </div>
          <div class="med-card-body">
            <% if(recentCR.length>0){ recentCR.forEach(function(r){ %>
            <div class="rec-row">
              <div class="rec-row-left">
                <div class="rec-type">Clinic Visit · <%= r.clinic_name %></div>
                <div class="rec-title"><%= r.diagnosis %></div>
                <div class="rec-sub">Dr. <%= r.doctor_name %><% if(r.medication_prescribed){ %> &nbsp;·&nbsp; <span style="color:var(--green)"><i class="fa-solid fa-pills" style="font-size:.7rem;margin-right:3px"></i><%= r.medication_prescribed %></span><% } %></div>
              </div>
              <div class="rec-date"><%= new Date(r.visit_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) %></div>
            </div>
            <% }) } else { %>
            <div class="empty"><i class="fa-regular fa-calendar"></i>No clinic visits recorded yet</div>
            <% } %>
          </div>
        </div>

        <!-- Recent lab reports -->
        <div class="med-card">
          <div class="med-card-head">
            <span class="med-card-title">Recent Lab Reports</span>
            <a href="/history" class="view-all">View all <i class="fa-solid fa-arrow-right" style="font-size:.65rem"></i></a>
          </div>
          <div class="med-card-body">
            <% if(recentLR.length>0){ recentLR.forEach(function(r){ %>
            <div class="rec-row">
              <div class="rec-row-left">
                <div class="rec-type">Lab Report · <%= r.lab_name %></div>
                <div class="rec-title"><%= r.test_name %></div>
                <div class="rec-sub">Result: <span class="mono" style="color:var(--ink);font-weight:600"><%= r.result_value %></span></div>
              </div>
              <div class="rec-date"><%= new Date(r.test_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) %></div>
            </div>
            <% }) } else { %>
            <div class="empty"><i class="fa-regular fa-flask"></i>No lab reports on record</div>
            <% } %>
          </div>
        </div>

        <!-- Wearable — positioned as supplementary -->
        <% if(w){ %>
        <div class="med-card">
          <div class="med-card-head">
            <span class="med-card-title">Wearable Data</span>
            <span style="font-size:.72rem;color:var(--muted);font-family:'Geist Mono',monospace"><%= new Date(w.record_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) %></span>
          </div>
          <div style="padding:16px 20px">
            <div class="wear-row">
              <span class="wear-label"><i class="fa-regular fa-shoe-prints" style="color:var(--accent)"></i>Steps</span>
              <span class="wear-val"><%= (w.steps||0).toLocaleString() %> <span style="color:var(--muted);font-size:.7rem">/ 10,000</span></span>
            </div>
            <div class="wear-row">
              <span class="wear-label"><i class="fa-regular fa-moon" style="color:#7c3aed"></i>Sleep</span>
              <span class="wear-val"><%= w.sleep_hours %>h <span style="color:var(--muted);font-size:.7rem">/ 8h</span></span>
            </div>
            <div class="wear-row">
              <span class="wear-label"><i class="fa-regular fa-heart" style="color:var(--red)"></i>Heart Rate</span>
              <span class="wear-val"><%= w.heart_rate %> <span style="color:var(--muted);font-size:.7rem">bpm</span></span>
            </div>
          </div>
        </div>
        <% } %>
      </div>

      <!-- Right sidebar -->
      <div class="sidebar">

        <!-- Active prescriptions -->
        <div class="med-card">
          <div class="med-card-head">
            <span class="med-card-title">Active Prescriptions</span>
            <span class="badge <%= meds.length>0?'badge-green':'badge-gray' %>"><%= meds.length %> active</span>
          </div>
          <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
            <% if(meds.length>0){ meds.forEach(function(med){ %>
            <div class="med-item">
              <div>
                <div class="med-name"><%= med.medication_name %></div>
                <div class="med-dosage"><%= med.dosage %></div>
              </div>
              <div class="med-until">Until<br/><%= new Date(med.end_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) %></div>
            </div>
            <% }) } else { %>
            <div class="empty" style="padding:16px"><i class="fa-regular fa-pills"></i>No active prescriptions</div>
            <% } %>
          </div>
        </div>

        <!-- Quick links -->
        <div class="med-card">
          <div class="med-card-head"><span class="med-card-title">Quick Access</span></div>
          <div style="padding:8px 12px;display:flex;flex-direction:column;gap:2px">
            <% [
              {h:'/history',i:'fa-clock-rotate-left',l:'Full Medical Timeline'},
              {h:'/history',i:'fa-flask',l:'All Lab Reports'},
              {h:'/uploads',i:'fa-folder-open',l:'Document Vault'},
              {h:'/analytics',i:'fa-chart-line',l:'Health Analytics'},
              {h:'/privacy',i:'fa-shield',l:'Data Access Controls'},
            ].forEach(function(q){ %>
            <a href="<%= q.h %>" style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:7px;text-decoration:none;color:var(--mid);font-size:.85rem;font-weight:500;transition:all .15s"
              onmouseover="this.style.background='var(--bg)';this.style.color='var(--ink)'"
              onmouseout="this.style.background='';this.style.color='var(--mid)'">
              <i class="fa-regular <%= q.i %>" style="width:16px;text-align:center;font-size:.8rem"></i>
              <%= q.l %>
              <i class="fa-solid fa-arrow-right" style="margin-left:auto;font-size:.6rem;opacity:.4"></i>
            </a>
            <% }) %>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
</body></html>`;

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY — with inline document attachments per event
// ═══════════════════════════════════════════════════════════════════════════
const HISTORY = HEAD("Medical Records") + `
<style>
.page { background: var(--bg); }

/* Page header */
.page-header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 24px 0; margin-top: 56px;
}
.ph-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.ph-title { font-family: 'Instrument Serif', serif; font-size: 1.8rem; color: var(--ink); }
.ph-sub { font-size: .82rem; color: var(--mid); margin-top: 3px; }

/* Tabs */
.tabs {
  max-width: 1200px; margin: 0 auto; padding: 20px 24px 0;
  display: flex; gap: 2px; border-bottom: 1px solid var(--border);
}
.tab-btn {
  padding: 8px 16px; border: none; background: transparent;
  font-family: 'Geist', sans-serif; font-size: .825rem; font-weight: 500;
  color: var(--mid); cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: all .15s; display: flex; align-items: center; gap: 6px;
}
.tab-btn:hover { color: var(--ink); }
.tab-btn.on { color: var(--accent); border-bottom-color: var(--accent); }

/* Content area */
.hist-content { max-width: 1200px; margin: 0 auto; padding: 24px; }

/* Search bar */
.search-bar {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 8px 14px;
  margin-bottom: 20px; box-shadow: var(--shadow-sm);
}
.search-bar i { color: var(--muted); font-size: .875rem; }
.search-bar input {
  border: none; background: transparent; font-family: 'Geist', sans-serif;
  font-size: .875rem; color: var(--ink); outline: none; flex: 1;
}
.search-bar input::placeholder { color: var(--muted); }

/* Timeline */
.tl { position: relative; padding-left: 32px; display: flex; flex-direction: column; gap: 0; }
.tl-spine {
  position: absolute; left: 9px; top: 20px; bottom: 20px;
  width: 1px; background: var(--border);
}
.tl-item {
  position: relative; margin-bottom: 12px;
  animation: fadeIn .4s ease both;
}
.tl-dot {
  position: absolute; left: -27px; top: 18px;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--border); background: var(--surface);
  transition: border-color .2s;
}
.tl-item:hover .tl-dot { border-color: var(--accent); }

/* Event card */
.ev-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
  transition: box-shadow .2s, border-color .2s;
}
.ev-card:hover { box-shadow: var(--shadow); border-color: var(--border-2); }

.ev-head {
  padding: 14px 18px; display: flex; align-items: center;
  justify-content: space-between; gap: 12px; cursor: pointer;
}
.ev-head-left { display: flex; align-items: center; gap: 10px; }
.ev-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ev-meta { flex: 1; }
.ev-event-type { font-size: .68rem; font-weight: 600; color: var(--mid); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; }
.ev-main-text { font-size: .925rem; font-weight: 600; color: var(--ink); }
.ev-location { font-size: .78rem; color: var(--mid); margin-top: 1px; }
.ev-date { font-size: .72rem; color: var(--muted); font-family: 'Geist Mono', monospace; white-space: nowrap; flex-shrink: 0; }

/* Expanded body */
.ev-body {
  border-top: 1px solid var(--border); padding: 16px 18px;
  display: none; background: var(--bg);
}
.ev-body.open { display: block; }

/* Detail grid */
.ev-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
.ev-detail-cell { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 13px; }
.ev-detail-label { font-size: .65rem; font-weight: 600; color: var(--muted); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 3px; }
.ev-detail-val { font-size: .875rem; font-weight: 600; color: var(--ink); }

/* Document attachment area */
.ev-docs-section { margin-top: 12px; }
.ev-docs-title {
  font-size: .7rem; font-weight: 600; color: var(--muted);
  letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.ev-docs-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ev-doc-pill {
  display: flex; align-items: center; gap: 7px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 7px 12px;
  text-decoration: none; transition: all .15s; color: var(--ink);
}
.ev-doc-pill:hover { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(26,86,219,.08); background: var(--accent-bg); color: var(--accent); }
.ev-doc-pill i { font-size: .78rem; }
.ev-doc-pill-name { font-size: .78rem; font-weight: 500; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev-doc-pill-type { font-size: .65rem; color: var(--muted); font-weight: 500; }

.ev-doc-none { font-size: .8rem; color: var(--muted); font-style: italic; padding: 6px 0; }

/* Attach button */
.ev-attach-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: .75rem; color: var(--accent); font-weight: 500;
  background: var(--accent-bg); border: 1px solid #c5d7f8;
  border-radius: var(--radius-sm); padding: 5px 10px; cursor: pointer;
  text-decoration: none; transition: all .15s; margin-left: 8px;
}
.ev-attach-btn:hover { background: #dbeafe; }

/* Table styles */
.data-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.data-table th {
  background: var(--bg); color: var(--mid); font-size: .7rem;
  font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  padding: 10px 16px; border-bottom: 1px solid var(--border); text-align: left;
}
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: .875rem; color: var(--mid); vertical-align: middle; }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover td { background: var(--bg); }

/* Med grid */
.med-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.med-tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; }
.med-tile-name { font-size: .925rem; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
.med-tile-dose { font-size: .8rem; color: var(--mid); margin-bottom: 10px; }
.med-tile-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.med-date-cell { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; }
.med-date-label { font-size: .62rem; font-weight: 600; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
.med-date-val { font-size: .78rem; font-weight: 600; color: var(--ink); margin-top: 2px; font-family: 'Geist Mono', monospace; }

/* Empty */
.empty-state { text-align: center; padding: 48px 24px; color: var(--muted); }
.empty-state i { font-size: 2rem; display: block; margin-bottom: 10px; color: var(--border-2); }
.empty-state p { font-size: .875rem; }
</style>
<body>
${NAV('hist')}
${TOAST_JS}
<div class="page">

  <div class="page-header">
    <div class="ph-inner fade">
      <div>
        <div class="ph-title">Medical Records</div>
        <div class="ph-sub">Your complete longitudinal health history — every visit, every result, every document.</div>
      </div>
      <input type="text" placeholder="Search records..." class="input" style="width:220px" oninput="filterItems(this.value)"/>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs fade d1">
    <button class="tab-btn on" onclick="switchTab('tl',this)"><i class="fa-regular fa-clock-rotate-left"></i>Timeline</button>
    <button class="tab-btn" onclick="switchTab('labs',this)"><i class="fa-regular fa-flask"></i>Lab Reports</button>
    <button class="tab-btn" onclick="switchTab('meds',this)"><i class="fa-regular fa-pills"></i>Medications</button>
    <button class="tab-btn" onclick="switchTab('wk',this)"><i class="fa-regular fa-person-running"></i>Workouts</button>
    <button class="tab-btn" onclick="switchTab('docs',this)"><i class="fa-regular fa-folder-open"></i>Documents</button>
  </div>

  <div class="hist-content">

    <%
    // Build upload lookup: map doc_type to uploads for smart matching
    // We'll pass all uploads and do keyword matching in template
    const uploadsByKeyword = {};
    uploads.forEach(function(u){
      const key = (u.doc_type||'').toLowerCase() + ' ' + (u.notes||'').toLowerCase() + ' ' + (u.original_name||'').toLowerCase();
      uploadsByKeyword[u.upload_id] = {url: u.file_url, name: u.original_name, type: u.doc_type, key: key};
    });

    function findRelatedDocs(eventText) {
      const searchTerms = eventText.toLowerCase().split(/\\s+/).filter(t=>t.length>3);
      return uploads.filter(function(u){
        const docKey = ((u.doc_type||'') + ' ' + (u.notes||'') + ' ' + (u.original_name||'')).toLowerCase();
        return searchTerms.some(t=>docKey.includes(t));
      });
    }
    %>

    <!-- TIMELINE TAB -->
    <div id="pane-tl" class="tab-pane">
      <%
      const allEvents = [
        ...clinic.map(r=>({...r, _src:'clinic', _date: new Date(r.visit_date)})),
        ...labs.map(r=>({...r, _src:'lab', _date: new Date(r.test_date)}))
      ].sort((a,b)=>b._date-a._date);
      %>
      <% if(allEvents.length===0){ %>
      <div class="empty-state">
        <i class="fa-regular fa-calendar-xmark"></i>
        <p>No medical events recorded yet.</p>
      </div>
      <% } else { %>
      <div class="tl">
        <div class="tl-spine"></div>
        <% allEvents.forEach(function(ev,idx){ %>
        <%
          const relatedDocs = uploads.filter(function(u){
            const terms = (ev._src==='clinic')
              ? [ev.diagnosis, ev.doctor_name, ev.clinic_name, ev.medication_prescribed]
              : [ev.test_name, ev.lab_name];
            const docText = ((u.doc_type||'') + ' ' + (u.notes||'') + ' ' + (u.original_name||'')).toLowerCase();
            return terms.filter(Boolean).some(t => t && docText.includes(t.split(' ')[0].toLowerCase()));
          });
        %>
        <div class="tl-item record-item"
          data-text="<%= [ev.diagnosis||'', ev.test_name||'', ev.clinic_name||'', ev.lab_name||'', ev.doctor_name||'', ev.result_value||''].join(' ').toLowerCase() %>"
          style="animation-delay:<%= idx*0.04 %>s">
          <div class="tl-dot" style="<%= ev._src==='clinic'?'background:#eef3ff;border-color:#93b4f8':'background:var(--green-bg);border-color:var(--green-b)' %>"></div>
          <div class="ev-card">
            <!-- Clickable header -->
            <div class="ev-head" onclick="toggleEvent(this)">
              <div class="ev-head-left">
                <div class="ev-type-dot" style="background:<%= ev._src==='clinic'?'var(--accent)':'var(--green)' %>"></div>
                <div class="ev-meta">
                  <div class="ev-event-type">
                    <% if(ev._src==='clinic'){ %>Clinic Visit · <%= ev.clinic_name %><% } else { %>Lab Report · <%= ev.lab_name %><% } %>
                  </div>
                  <div class="ev-main-text">
                    <% if(ev._src==='clinic'){ %><%= ev.diagnosis %><% } else { %><%= ev.test_name %><% } %>
                  </div>
                  <% if(ev._src==='clinic'){ %>
                  <div class="ev-location">Dr. <%= ev.doctor_name %></div>
                  <% } %>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                <% if(relatedDocs.length>0){ %>
                <span class="badge badge-blue"><i class="fa-regular fa-paperclip"></i><%= relatedDocs.length %> doc<%= relatedDocs.length>1?'s':'' %></span>
                <% } %>
                <div class="ev-date"><%= ev._date.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) %></div>
                <i class="fa-solid fa-chevron-down" style="color:var(--muted);font-size:.65rem;transition:transform .2s"></i>
              </div>
            </div>

            <!-- Expanded details -->
            <div class="ev-body">
              <% if(ev._src==='clinic'){ %>
              <div class="ev-detail-grid">
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Doctor</div>
                  <div class="ev-detail-val">Dr. <%= ev.doctor_name %></div>
                </div>
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Hospital / Clinic</div>
                  <div class="ev-detail-val"><%= ev.clinic_name %></div>
                </div>
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Diagnosis</div>
                  <div class="ev-detail-val" style="color:var(--accent)"><%= ev.diagnosis %></div>
                </div>
                <% if(ev.medication_prescribed){ %>
                <div class="ev-detail-cell" style="border-color:var(--green-b)">
                  <div class="ev-detail-label">Prescribed</div>
                  <div class="ev-detail-val" style="color:var(--green)"><%= ev.medication_prescribed %></div>
                </div>
                <% } %>
              </div>
              <% } else { %>
              <div class="ev-detail-grid">
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Test Name</div>
                  <div class="ev-detail-val"><%= ev.test_name %></div>
                </div>
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Result</div>
                  <div class="ev-detail-val mono" style="color:var(--green);font-size:1.05rem"><%= ev.result_value %></div>
                </div>
                <div class="ev-detail-cell">
                  <div class="ev-detail-label">Laboratory</div>
                  <div class="ev-detail-val"><%= ev.lab_name %></div>
                </div>
              </div>
              <% } %>

              <!-- DOCUMENT ATTACHMENTS INLINE -->
              <div class="ev-docs-section">
                <div class="ev-docs-title">
                  <i class="fa-regular fa-paperclip"></i>
                  Attached Documents
                  <a href="/uploads" class="ev-attach-btn"><i class="fa-solid fa-plus"></i>Upload</a>
                </div>
                <% if(relatedDocs.length>0){ %>
                <div class="ev-docs-list">
                  <% relatedDocs.forEach(function(doc){ %>
                  <a href="<%= doc.file_url %>" target="_blank" class="ev-doc-pill">
                    <i class="fa-solid <%= doc.original_name&&doc.original_name.toLowerCase().endsWith('.pdf')?'fa-file-pdf':'fa-file-image' %>"
                      style="color:<%= doc.original_name&&doc.original_name.toLowerCase().endsWith('.pdf')?'var(--red)':'var(--accent)' %>"></i>
                    <div>
                      <div class="ev-doc-pill-name"><%= doc.original_name||'Document' %></div>
                      <div class="ev-doc-pill-type"><%= doc.doc_type||'File' %></div>
                    </div>
                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:.6rem;opacity:.5;margin-left:4px"></i>
                  </a>
                  <% }) %>
                </div>
                <% } else { %>
                <div class="ev-doc-none">
                  No documents attached to this event. 
                  <a href="/uploads" style="color:var(--accent);text-decoration:none;font-weight:500">Upload a prescription or report →</a>
                </div>
                <% } %>
              </div>
            </div>
          </div>
        </div>
        <% }) %>
      </div>
      <% } %>
    </div>

    <!-- LABS TAB -->
    <div id="pane-labs" class="tab-pane" style="display:none">
      <div class="card" style="overflow:hidden">
        <% if(labs.length>0){ %>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Test Name</th><th>Result</th><th>Laboratory</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              <% labs.forEach(function(l){ %>
              <tr class="record-item" data-text="<%= l.test_name.toLowerCase()+' '+l.lab_name.toLowerCase() %>">
                <td style="color:var(--ink);font-weight:600"><%= l.test_name %></td>
                <td><span class="mono" style="font-weight:700;color:var(--green)"><%= l.result_value %></span></td>
                <td><%= l.lab_name %></td>
                <td class="mono" style="font-size:.78rem"><%= new Date(l.test_date).toLocaleDateString('en-IN') %></td>
                <td><span class="badge badge-green">Reported</span></td>
              </tr>
              <% }) %>
            </tbody>
          </table>
        </div>
        <% } else { %>
        <div class="empty-state"><i class="fa-regular fa-flask"></i><p>No lab reports on record.</p></div>
        <% } %>
      </div>
    </div>

    <!-- MEDS TAB -->
    <div id="pane-meds" class="tab-pane" style="display:none">
      <% if(meds.length>0){ %>
      <div class="med-grid">
        <% meds.forEach(function(m){ const active=new Date(m.end_date)>new Date(); %>
        <div class="med-tile">
          <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:10px">
            <span class="badge <%= active?'badge-green':'badge-gray' %>"><%= active?'Active':'Completed' %></span>
          </div>
          <div class="med-tile-name"><%= m.medication_name %></div>
          <div class="med-tile-dose"><%= m.dosage %></div>
          <div class="med-tile-dates">
            <div class="med-date-cell">
              <div class="med-date-label">Start</div>
              <div class="med-date-val"><%= new Date(m.start_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}) %></div>
            </div>
            <div class="med-date-cell">
              <div class="med-date-label">End</div>
              <div class="med-date-val" style="color:<%= active?'var(--red)':'var(--mid)' %>"><%= new Date(m.end_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}) %></div>
            </div>
          </div>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <div class="empty-state"><i class="fa-regular fa-pills"></i><p>No medication records.</p></div>
      <% } %>
    </div>

    <!-- WORKOUTS TAB -->
    <div id="pane-wk" class="tab-pane" style="display:none">
      <div class="card" style="overflow:hidden">
        <% if(workouts.length>0){ %>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Workout Type</th><th>Duration</th><th>Calories</th><th>Date</th></tr></thead>
            <tbody>
              <% workouts.forEach(function(w){ %>
              <tr>
                <td style="color:var(--ink);font-weight:600"><%= w.workout_type %></td>
                <td class="mono"><%= w.duration_minutes %> min</td>
                <td class="mono"><%= (w.calories_burned||0).toLocaleString() %> kcal</td>
                <td class="mono" style="font-size:.78rem"><%= new Date(w.workout_date).toLocaleDateString('en-IN') %></td>
              </tr>
              <% }) %>
            </tbody>
          </table>
        </div>
        <% } else { %>
        <div class="empty-state"><i class="fa-regular fa-person-running"></i><p>No workouts logged yet.</p></div>
        <% } %>
      </div>
    </div>

    <!-- DOCS TAB -->
    <div id="pane-docs" class="tab-pane" style="display:none">
      <% if(uploads.length>0){ %>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        <% uploads.forEach(function(u){ %>
        <div class="card card-hover" style="overflow:hidden">
          <div style="height:100px;background:var(--bg);display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border)">
            <% if(u.original_name&&!u.original_name.toLowerCase().endsWith('.pdf')){ %>
            <img src="<%= u.file_url %>" style="height:100%;width:100%;object-fit:cover"
              onerror="this.parentNode.innerHTML='<i class=\\'fa-regular fa-image\\' style=\\'font-size:2rem;color:var(--border-2)\\'></i>'"/>
            <% } else { %>
            <i class="fa-solid fa-file-pdf" style="font-size:2.2rem;color:var(--red)"></i>
            <% } %>
          </div>
          <div style="padding:12px">
            <div style="display:flex;align-items:start;justify-content:space-between;gap:6px;margin-bottom:4px">
              <span style="font-size:.85rem;font-weight:600;color:var(--ink);word-break:break-all;line-height:1.3"><%= (u.original_name||'File').substring(0,28) %><%= (u.original_name||'').length>28?'...':'' %></span>
              <span class="badge badge-blue" style="flex-shrink:0;font-size:.6rem"><%= u.doc_type||'Other' %></span>
            </div>
            <% if(u.notes){ %><div style="font-size:.75rem;color:var(--mid);font-style:italic;margin-bottom:6px"><%= u.notes.substring(0,50) %></div><% } %>
            <div style="display:flex;gap:6px;margin-top:8px">
              <a href="<%= u.file_url %>" target="_blank" class="btn btn-primary" style="flex:1;padding:6px;font-size:.75rem">View</a>
              <a href="<%= u.file_url %>" download class="btn btn-ghost" style="padding:6px 10px;font-size:.75rem"><i class="fa-solid fa-download"></i></a>
              <form method="POST" action="/uploads/delete" onsubmit="return confirm('Delete?')" style="display:inline">
                <input type="hidden" name="upload_id" value="<%= u.upload_id %>"/>
                <button type="submit" class="btn btn-danger" style="padding:6px 10px;font-size:.75rem"><i class="fa-solid fa-trash"></i></button>
              </form>
            </div>
          </div>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <div class="empty-state card" style="padding:48px">
        <i class="fa-regular fa-folder-open"></i>
        <p>No documents in vault yet.</p>
        <a href="/uploads" class="btn btn-primary" style="margin-top:14px">Upload Documents</a>
      </div>
      <% } %>
    </div>

  </div>
</div>

<script>
function switchTab(id, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('pane-' + id).style.display = 'block';
  btn.classList.add('on');
}
function toggleEvent(el) {
  const body = el.nextElementSibling;
  const icon = el.querySelector('.fa-chevron-down');
  body.classList.toggle('open');
  icon.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
}
function filterItems(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.record-item').forEach(el => {
    el.style.display = (!q || el.dataset.text.includes(q)) ? '' : 'none';
  });
}
</script>
</body></html>`;

// ═══════════════════════════════════════════════════════════════════════════
// WRITE FILES
// ═══════════════════════════════════════════════════════════════════════════
fs.writeFileSync(path.join(VIEWS, "login.ejs"),    LOGIN);
fs.writeFileSync(path.join(VIEWS, "dashboard.ejs"), DASHBOARD);
fs.writeFileSync(path.join(VIEWS, "history.ejs"),   HISTORY);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   ✅  patch.js applied successfully                        ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Rewritten:                                               ║
║   ✓  login.ejs    — Clean editorial landing + login card  ║
║   ✓  dashboard.ejs — Health-first, calm, clinical layout  ║
║   ✓  history.ejs  — Timeline with inline doc attachments  ║
║                                                           ║
║  Now restart your server:                                 ║
║    Ctrl+C  →  node server.js                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
