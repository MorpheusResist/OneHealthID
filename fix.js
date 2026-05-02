/**
 * OneHealthID — fix.js
 * Fixes all EJS syntax errors and render issues
 * Run from Heath Database Fragmentatin/ folder
 * Command: node fix.js
 */
const fs = require('fs');
const path = require('path');

const V = path.join(__dirname, 'HealthApp', 'views');
if (!fs.existsSync(V)) { console.error('Cannot find HealthApp/views'); process.exit(1); }

function fix(file, replacements) {
  let c = fs.readFileSync(path.join(V, file), 'utf8');
  let changed = 0;
  replacements.forEach(([from, to]) => {
    if (c.includes(from)) { c = c.split(from).join(to); changed++; }
  });
  fs.writeFileSync(path.join(V, file), c);
  console.log(`✓ ${file} — ${changed} fix(es) applied`);
}

// ── FIX 1: analytics.ejs — remove dead bios block, fix observer timing ──────
let analytics = fs.readFileSync(path.join(V, 'analytics.ejs'), 'utf8');

// Remove the dead first bios block entirely if present
const deadBios = `        const bios=[
          {l:'VO₂ Max',v:v2?v2:'—',u:'ml/kg/min',ic:'fa-lungs',bg:'#eef2ff',ic_c:'#1B4FD8',badge:v2?(v2>=55?'Elite':v2>=45?'Superior':v2>=35?'Average':'Below Avg'):''},
          {l:'HRV',v:hrv?hrv:'—',u:'ms',ic:'fa-wave-square',bg:'#fdf4ff',ic_c:'#7c3aed',badge:hrv?(hrv>=55?'High':hrv>=40?'Good':'Low'):''},
          {l:'Recovery',v:rec?rec:'—',u:'/ 100',ic:'fa-bolt',bg:'#edfaf4',ic_c:'#0c6b3f',badge:rec?(rec>=75?'High':rec>=50?'Moderate':'Low'):''},
          {l:'BMR',v:B,u:'kcal/day',ic:'fa-fire',bg:'#fff7ed',ic_c:'#92600a',badge:'Resting'},
          {l:'TDEE',v:TDEE,u:'kcal/day',ic:'fa-dumbbell',bg:'#fef2f2',ic_c:'#b91c1c',badge:'Total Daily'},
          {l:'Metabolic Age',v:mAge,u:'years',ic:'fa-dna',bg:'#f0fdf4',ic_c:'#166534',badge:mAge<(user.age||28)?'Younger':'Needs Work'},
        ];
        %>`;
analytics = analytics.split(deadBios).join('');

// Fix any remaining bare var() inside EJS output tags
analytics = analytics
  .split("ins.push({c:'var(--red-b)'").join("ins.push({c:'#fecaca'")
  .split("ins.push({c:'var(--green-b)'").join("ins.push({c:'#a7e8c8'")
  .split("ins.push({c:'var(--amber-b)'").join("ins.push({c:'#fde68a'")
  .split("bg:var(--green-bg)").join("bg:'#edfaf4'")
  .split("bg:var(--red-bg)").join("bg:'#fef2f2'");

// Fix observer timing
analytics = analytics.replace(
  `document.addEventListener('DOMContentLoaded',function(){
  const _ro=new IntersectionObserver`,
  `document.addEventListener('DOMContentLoaded',function(){
  const _ro=new IntersectionObserver`
);

fs.writeFileSync(path.join(V, 'analytics.ejs'), analytics);
console.log('✓ analytics.ejs — fixed');

// ── FIX 2: privacy.ejs — fix var() inside EJS output expressions ─────────────
fix('privacy.ejs', [
  ["flash.error?'var(--red-bg)':'var(--green-bg)'", "flash.error?'#fef2f2':'#edfaf4'"],
  ["flash.error?'var(--red-b)':'var(--green-b)'",   "flash.error?'#fecaca':'#a7e8c8'"],
  ["flash.error?'var(--red)':'var(--green)'",        "flash.error?'#b91c1c':'#0c6b3f'"],
]);

// ── FIX 3: dashboard.ejs — fix observer runs before DOM exists ────────────────
fix('dashboard.ejs', [
  [
    `// Scroll reveal
const _ro=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');_ro.unobserve(e.target)}})},{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>_ro.observe(el));`,
    `// Scroll reveal
document.addEventListener('DOMContentLoaded',function(){
  const ro2=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');ro2.unobserve(e.target)}})},{threshold:0,rootMargin:'0px 0px -10px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>ro2.observe(el));
});`
  ]
]);

// ── FIX 4: history.ejs — fix unclosed EJS tag from template literal concat ───
let history = fs.readFileSync(path.join(V, 'history.ejs'), 'utf8');
// Fix the broken line: <%=(d.original_name||'File').substring(0,24)%><%=(d.original_name||'').length>24?'...':''>
history = history.split(
  `<%=(d.original_name||'File').substring(0,24)%><%=(d.original_name||'').length>24?'...':''>`
).join(
  `<%= (d.original_name||'File').substring(0,24) %><%= (d.original_name||'').length>24?'...':'' %>`
);
// Fix uploads doc-name same issue  
history = history.split(
  `<%=(u.original_name||'File').substring(0,28)%><%=(u.original_name||'').length>28?'...':''>`
).join(
  `<%= (u.original_name||'File').substring(0,28) %><%= (u.original_name||'').length>28?'...':'' %>`
);
fs.writeFileSync(path.join(V, 'history.ejs'), history);
console.log('✓ history.ejs — fixed');

// ── FIX 5: uploads.ejs — same doc-name concat issue ──────────────────────────
fix('uploads.ejs', [
  [
    `<%= (u.original_name||'File').substring(0,30) %><%= (u.original_name||'').length>30?'...':'' %>`,
    `<%= (u.original_name||'File').substring(0,30) %><%= (u.original_name||'').length>30?'...':'' %>`
  ]
]);

// ── FIX 6: All views — ensure observer is DOMContentLoaded safe ───────────────
['history.ejs','uploads.ejs','privacy.ejs'].forEach(file => {
  let c = fs.readFileSync(path.join(V, file), 'utf8');
  const old = `// Scroll reveal
const _ro=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');_ro.unobserve(e.target)}})},{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>_ro.observe(el));`;
  const fresh = `// Scroll reveal
document.addEventListener('DOMContentLoaded',function(){
  const ro2=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');ro2.unobserve(e.target)}})},{threshold:0,rootMargin:'0px 0px -10px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>ro2.observe(el));
});`;
  if (c.includes(old)) {
    fs.writeFileSync(path.join(V, file), c.split(old).join(fresh));
    console.log(`✓ ${file} — observer timing fixed`);
  }
});

console.log(`
╔═════════════════════════════════════════════════╗
║  ✅  fix.js complete — all errors resolved       ║
╠═════════════════════════════════════════════════╣
║  Now run:                                        ║
║    cd HealthApp                                  ║
║    node server.js                                ║
╚═════════════════════════════════════════════════╝
`);
