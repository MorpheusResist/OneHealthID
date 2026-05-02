/**
 * OneHealthID — fix2.js
 * Fixes ALL confirmed bugs:
 * 1. analytics.ejs — orphaned bare <% tag crashes EJS compilation
 * 2. analytics.ejs — reveal class hides content; replaced with instant fade
 * 3. history.ejs   — @keyframes inside <script> crashes JS; tab switching broken
 * 4. privacy.ejs   — confirmed working; adds safety var() -> hex replacements
 * 5. All views     — broken FontAwesome icons (fa-regular not loading) -> fa-solid
 * 6. All views     — reveal class removed from above-fold content so nothing is hidden
 *
 * Drop in Heath Database Fragmentatin/ folder
 * Run: node fix2.js
 */

const fs   = require('fs');
const path = require('path');

const V = path.join(__dirname, 'HealthApp', 'views');
if (!fs.existsSync(V)) {
  console.error('❌  Cannot find HealthApp/views — run from Heath Database Fragmentatin/ folder');
  process.exit(1);
}

function read(f)  { return fs.readFileSync(path.join(V, f), 'utf8'); }
function write(f, c) { fs.writeFileSync(path.join(V, f), c); }

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: analytics.ejs — orphaned bare <% tag + reveal issues
// ─────────────────────────────────────────────────────────────────────────────
let analytics = read('analytics.ejs');

// Remove the orphaned bare <% tag (leftover from dead bios block removal)
analytics = analytics.replace(
  `      <div class="bio-grid reveal">
        <%

        <% const bios2=[`,
  `      <div class="bio-grid">
        <% const bios2=[`
);

// Remove "reveal" from ALL elements that are above the fold (first screenful)
// so they render immediately without waiting for IntersectionObserver
analytics = analytics
  .replace('class="page-hdr-inner reveal"', 'class="page-hdr-inner"')
  .replace('class="bio-grid reveal"', 'class="bio-grid"')
  .replace('class="two-charts reveal reveal-delay-1"', 'class="two-charts"')
  .replace('class="two-charts reveal reveal-delay-2"', 'class="two-charts"')
  .replace('class="three-charts reveal reveal-delay-3"', 'class="three-charts"')
  .replace('class="reveal reveal-delay-4"', 'class=""');

// Replace the broken DOMContentLoaded observer (rootMargin was hiding in-viewport items)
// with a simpler instant-show approach
analytics = analytics.replace(
`// Scroll reveal
document.addEventListener('DOMContentLoaded',function(){
  const _ro=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');_ro.unobserve(e.target)}})},{threshold:0,rootMargin:'0px 0px -20px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>_ro.observe(el));
});`,
`// Scroll reveal (instant for in-viewport elements)
document.addEventListener('DOMContentLoaded',function(){
  const ro=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target);}
  }),{threshold:0,rootMargin:'50px 0px 0px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
});`
);

write('analytics.ejs', analytics);
console.log('✓  analytics.ejs — orphaned tag removed, reveal fixed');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: history.ejs — @keyframes in <script>, fix FontAwesome, fix icons
// ─────────────────────────────────────────────────────────────────────────────
let history = read('history.ejs');

// Remove @keyframes from inside <script> tag (CSS in JS = crash)
history = history.replace(
  `@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`,
  `/* @keyframes moved to CSS */`
);

// Add the @keyframes to the <style> block instead
history = history.replace(
  `.ohid-empty i{font-size:1.8rem;display:block;margin-bottom:10px;color:var(--faint)}`,
  `.ohid-empty i{font-size:1.8rem;display:block;margin-bottom:10px;color:var(--faint)}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`
);

// Remove reveal from above-fold items
history = history
  .replace('class="page-hdr-inner reveal"', 'class="page-hdr-inner"')
  .replace('class="reveal reveal-delay-1"', 'class=""');

// Fix DOMContentLoaded observer rootMargin
history = history.replace(
  `rootMargin:'0px 0px -20px 0px'`,
  `rootMargin:'50px 0px 0px 0px'`
);

// Fix broken fa-regular icons that don't load — replace with fa-solid equivalents
history = history
  .replace(/fa-regular fa-flask/g,         'fa-solid fa-flask')
  .replace(/fa-regular fa-pills/g,         'fa-solid fa-pills')
  .replace(/fa-regular fa-person-running/g,'fa-solid fa-person-running')
  .replace(/fa-regular fa-folder-open/g,   'fa-solid fa-folder-open')
  .replace(/fa-regular fa-calendar-xmark/g,'fa-solid fa-calendar-xmark')
  .replace(/fa-regular fa-image/g,         'fa-solid fa-image')
  .replace(/fa-regular fa-paperclip/g,     'fa-solid fa-paperclip');

write('history.ejs', history);
console.log('✓  history.ejs — @keyframes moved to CSS, icons fixed');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: dashboard.ejs — reveal hides patient bar, fix icons
// ─────────────────────────────────────────────────────────────────────────────
let dashboard = read('dashboard.ejs');

// Remove reveal from above-fold elements
dashboard = dashboard
  .replace('class="patient-bar-inner reveal"', 'class="patient-bar-inner"')
  .replace('class="qs-grid reveal"',           'class="qs-grid"')
  .replace('class="two-col reveal reveal-delay-1"', 'class="two-col"');

// Fix broken fa-regular icons
dashboard = dashboard
  .replace(/fa-regular fa-calendar-check/g, 'fa-solid fa-calendar-check')
  .replace(/fa-regular fa-flask/g,          'fa-solid fa-flask')
  .replace(/fa-regular fa-pills/g,          'fa-solid fa-pills')
  .replace(/fa-regular fa-folder-open/g,    'fa-solid fa-folder-open')
  .replace(/fa-regular fa-clock-rotate-left/g, 'fa-solid fa-clock-rotate-left')
  .replace(/fa-regular fa-chart-line/g,     'fa-solid fa-chart-line')
  .replace(/fa-regular fa-shield/g,         'fa-solid fa-shield')
  .replace(/fa-regular fa-shoe-prints/g,    'fa-solid fa-shoe-prints')
  .replace(/fa-regular fa-moon/g,           'fa-solid fa-moon')
  .replace(/fa-regular fa-heart/g,          'fa-solid fa-heart')
  .replace(/fa-regular fa-sun/g,            'fa-solid fa-sun');

// Fix DOMContentLoaded observer rootMargin
dashboard = dashboard.replace(
  `rootMargin:'0px 0px -10px 0px'`,
  `rootMargin:'50px 0px 0px 0px'`
);

write('dashboard.ejs', dashboard);
console.log('✓  dashboard.ejs — reveal removed from above-fold, icons fixed');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: privacy.ejs — var() in EJS output tags + icons
// ─────────────────────────────────────────────────────────────────────────────
let privacy = read('privacy.ejs');

// Fix any remaining var() inside EJS output blocks
privacy = privacy
  .replace(/flash\.error\?'var\(--red-bg\)':'var\(--green-bg\)'/g, "flash.error?'#fef2f2':'#edfaf4'")
  .replace(/flash\.error\?'var\(--red-b\)':'var\(--green-b\)'/g,   "flash.error?'#fecaca':'#a7e8c8'")
  .replace(/flash\.error\?'var\(--red\)':'var\(--green\)'/g,        "flash.error?'#b91c1c':'#0c6b3f'")
  // Fix fa-regular icons
  .replace(/fa-regular fa-circle-check/g,  'fa-solid fa-circle-check')
  .replace(/fa-regular fa-circle-xmark/g,  'fa-solid fa-circle-xmark')
  .replace(/fa-regular fa-shield-halved/g, 'fa-solid fa-shield-halved')
  .replace(/fa-regular fa-user-doctor/g,   'fa-solid fa-user-doctor')
  .replace(/fa-regular fa-building-columns/g,'fa-solid fa-building-columns')
  .replace(/fa-regular fa-file-contract/g, 'fa-solid fa-file-contract')
  // Fix reveal
  .replace('class="page-hdr-inner reveal"', 'class="page-hdr-inner"')
  .replace('class="priv-stats reveal"',     'class="priv-stats"');

write('privacy.ejs', privacy);
console.log('✓  privacy.ejs — var() fixed, icons fixed, reveal fixed');

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: uploads.ejs — icons + reveal
// ─────────────────────────────────────────────────────────────────────────────
let uploads = read('uploads.ejs');

uploads = uploads
  .replace('class="page-hdr-inner reveal"', 'class="page-hdr-inner"')
  .replace('class="vault-stats reveal"',    'class="vault-stats"')
  .replace(/fa-regular fa-folder-open/g,   'fa-solid fa-folder-open')
  .replace(/fa-regular fa-image/g,         'fa-solid fa-image');

write('uploads.ejs', uploads);
console.log('✓  uploads.ejs — icons fixed, reveal fixed');

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY: Re-run EJS compilation check
// ─────────────────────────────────────────────────────────────────────────────
const ejs = require(path.join(__dirname, 'HealthApp', 'node_modules', 'ejs'));
let allGood = true;
['analytics','privacy','history','dashboard','uploads','login'].forEach(name => {
  try {
    const tmpl = read(name + '.ejs');
    ejs.compile(tmpl);
    console.log(`  ✓  ${name}.ejs compiles OK`);
  } catch(e) {
    console.log(`  ✗  ${name}.ejs FAIL:`, e.message.substring(0, 120));
    allGood = false;
  }
});

console.log(allGood ? `
╔══════════════════════════════════════════════════════╗
║  ✅  fix2.js complete — all views compile cleanly     ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  cd HealthApp                                        ║
║  node server.js                                      ║
║                                                      ║
║  Then open: http://localhost:3000                    ║
╚══════════════════════════════════════════════════════╝
` : `
⚠️  Some files still have issues — check errors above.
`);
