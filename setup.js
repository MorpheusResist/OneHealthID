/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   NationalHealthID — Complete Final setup.js v3.0               ║
 * ║   node setup.js → cd HealthApp → npm install → node server.js   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const fs   = require("fs");
const path = require("path");

["HealthApp","HealthApp/views","HealthApp/public","HealthApp/public/uploads",
 "HealthApp/public/css","HealthApp/public/js"].forEach(d=>fs.mkdirSync(d,{recursive:true}));

// ════════════════════════════════════════════════════════════════════════════
// package.json
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/package.json", JSON.stringify({
  name:"nationalhealthid",version:"3.0.0",
  description:"India's Unified Health Intelligence Platform",
  main:"server.js",scripts:{start:"node server.js"},
  dependencies:{express:"^4.18.2",ejs:"^3.1.9",mysql2:"^3.6.1",
    "express-session":"^1.17.3",multer:"^1.4.5-lts.1","connect-flash":"^0.1.1"}
},null,2));

// ════════════════════════════════════════════════════════════════════════════
// server.js
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/server.js",
`const express = require('express');
const session = require('express-session');
const flash   = require('connect-flash');
const mysql   = require('mysql2/promise');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.use(express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(session({secret:'nhid_sovereign_2024',resave:false,saveUninitialized:false,cookie:{maxAge:1000*60*60*6}}));
app.use(flash());

const storage = multer.diskStorage({
  destination:(req,file,cb)=>{
    const d=path.join(__dirname,'public','uploads');
    if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true});
    cb(null,d);
  },
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'))
});
const upload = multer({storage,limits:{fileSize:15*1024*1024},
  fileFilter:(req,file,cb)=>['image/jpeg','image/png','image/jpg','application/pdf'].includes(file.mimetype)?cb(null,true):cb(new Error('JPG/PNG/PDF only'))});

const pool = mysql.createPool({
  host:'localhost',port:3306,database:'health_fragmentation_db',
  user:'root',password:'password',waitForConnections:true,connectionLimit:10
});

// Auto-create optional tables
(async()=>{
  try {
    await pool.execute(\`CREATE TABLE IF NOT EXISTS UPLOADS(
      upload_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,original_name VARCHAR(255),
      doc_type VARCHAR(100) DEFAULT 'Other',doc_date DATE,notes TEXT,
      file_url VARCHAR(500),uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES USER(user_id) ON DELETE CASCADE)\`);
    console.log('✅  DB tables ready.');
  } catch(e){ console.warn('DB init:', e.message.substring(0,80)); }
})();

const auth = (req,res,next) => req.session.userid ? next() : res.redirect('/');

// Health computation
function healthScore(w,ws){
  if(!w) return {score:0,grade:'—',label:'No Data',color:'gray'};
  let s=0;
  s+=Math.min(25,Math.round(((w.steps||0)/10000)*25));
  const sl=w.sleep_hours||0;
  s+=(sl>=7&&sl<=9)?25:(sl>=6)?16:(sl>=5)?8:3;
  const hr=w.heart_rate||75;
  s+=(hr<60)?25:(hr<70)?20:(hr<80)?13:(hr<90)?7:2;
  s+=Math.min(25,(ws?.total_sessions||0)*3);
  const grade=s>=90?'A+':s>=80?'A':s>=70?'B+':s>=60?'B':s>=50?'C':'D';
  const label=s>=90?'Elite Athlete':s>=80?'High Performer':s>=70?'Active & Healthy':s>=60?'Moderately Active':s>=50?'Needs Work':'Sedentary Risk';
  return {score:s,grade,label};
}
function vo2Max(w,age){
  if(!w||!w.heart_rate) return null;
  return Math.max(20,Math.min(80,Math.round(15*((220-(age||28))/w.heart_rate))));
}
function recovery(w){
  if(!w) return null;
  let s=0;
  const sl=w.sleep_hours||0; const hr=w.heart_rate||75;
  s+=(sl>=8)?40:(sl>=7)?32:(sl>=6)?20:8;
  s+=(hr<60)?35:(hr<70)?28:(hr<80)?18:7;
  s+=Math.round(1000/hr*10)>50?25:Math.round(1000/hr*10)>38?16:8;
  return Math.min(100,s);
}
function metabolicAge(age,ws){
  const sess=ws?.total_sessions||0;
  let adj=sess>=20?-5:sess>=12?-3:sess<4?3:0;
  if((ws?.total_calories||0)>8000) adj-=2;
  return Math.max(16,(age||28)+adj);
}
function hrZone(hr){
  if(!hr) return {label:'Unknown',cls:'b-gray'};
  if(hr<60) return {label:'Athlete Zone',cls:'b-green'};
  if(hr<70) return {label:'Optimal',cls:'b-green'};
  if(hr<80) return {label:'Normal',cls:'b-blue'};
  if(hr<90) return {label:'Elevated',cls:'b-yellow'};
  return {label:'High Risk',cls:'b-red'};
}
function bmr(user){
  return user.gender==='Male'
    ?Math.round(10*70+6.25*175-5*(user.age||28)+5)
    :Math.round(10*60+6.25*162-5*(user.age||28)-161);
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/',(req,res)=>req.session.userid?res.redirect('/dashboard'):res.render('login',{error:req.flash('error')[0]||null}));

app.post('/login',async(req,res)=>{
  const {user_id}=req.body;
  if(!user_id||isNaN(+user_id)){req.flash('error','Enter a valid numeric Health ID.');return res.redirect('/');}
  try{
    const [rows]=await pool.execute('SELECT * FROM USER WHERE user_id=?',[+user_id]);
    if(!rows.length){req.flash('error','No patient with Health ID '+user_id+'. Try IDs 1, 2 or 3.');return res.redirect('/');}
    Object.assign(req.session,{userid:rows[0].user_id,username:rows[0].name,userObj:rows[0]});
    res.redirect('/dashboard');
  }catch(e){req.flash('error','DB Error: '+e.message);res.redirect('/');}
});

app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

app.get('/dashboard',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const [[user]]   =await pool.execute('SELECT * FROM USER WHERE user_id=?',[uid]);
    const [wArr]     =await pool.execute('SELECT * FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date DESC LIMIT 1',[uid]);
    const [meds]     =await pool.execute('SELECT * FROM MEDICATION WHERE user_id=? AND end_date>CURRENT_DATE ORDER BY end_date ASC',[uid]);
    const [[ws]]     =await pool.execute('SELECT SUM(duration_minutes) total_minutes,SUM(calories_burned) total_calories,COUNT(*) total_sessions,AVG(duration_minutes) avg_duration FROM WORKOUT WHERE user_id=?',[uid]);
    const [recentCR] =await pool.execute('SELECT * FROM CLINIC_RECORDS WHERE user_id=? ORDER BY visit_date DESC LIMIT 4',[uid]);
    const [recentLR] =await pool.execute('SELECT * FROM LAB_REPORT WHERE user_id=? ORDER BY test_date DESC LIMIT 4',[uid]);
    const [uploads]  =await pool.execute('SELECT * FROM UPLOADS WHERE user_id=? ORDER BY uploaded_at DESC LIMIT 6',[uid]).catch(()=>[[],null]);
    const [wTrend]   =await pool.execute('SELECT steps,sleep_hours,heart_rate,record_date FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date DESC LIMIT 7',[uid]);

    const w=wArr[0]||null;
    const hs=healthScore(w,ws); const v2=vo2Max(w,user.age);
    const rec=recovery(w); const mAge=metabolicAge(user.age,ws);
    const hRisk=hrZone(w?.heart_rate); const B=bmr(user);
    const TDEE=Math.round(B*((ws?.total_sessions||0)>12?1.55:(ws?.total_sessions||0)>4?1.375:1.2));
    const hrv=w?.heart_rate?Math.round(1000/w.heart_rate*10):null;
    res.render('dashboard',{user,w,meds,ws:ws||{},recentCR,recentLR,uploads:uploads||[],
      wTrend:JSON.stringify(wTrend.reverse()),hs,v2,rec,mAge,hRisk,B,TDEE,hrv});
  }catch(e){console.error(e);res.status(500).send('<pre>'+e.stack+'</pre>');}
});

app.get('/history',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const [[user]]  =await pool.execute('SELECT * FROM USER WHERE user_id=?',[uid]);
    const [clinic]  =await pool.execute('SELECT * FROM CLINIC_RECORDS WHERE user_id=? ORDER BY visit_date DESC',[uid]);
    const [labs]    =await pool.execute('SELECT * FROM LAB_REPORT WHERE user_id=? ORDER BY test_date DESC',[uid]);
    const [meds]    =await pool.execute('SELECT * FROM MEDICATION WHERE user_id=? ORDER BY start_date DESC',[uid]);
    const [uploads] =await pool.execute('SELECT * FROM UPLOADS WHERE user_id=? ORDER BY uploaded_at DESC',[uid]).catch(()=>[[],null]);
    const [workouts]=await pool.execute('SELECT * FROM WORKOUT WHERE user_id=? ORDER BY workout_date DESC LIMIT 20',[uid]);
    res.render('history',{user,clinic,labs,meds,uploads:uploads||[],workouts});
  }catch(e){res.status(500).send(e.message);}
});

app.get('/analytics',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const [[user]]   =await pool.execute('SELECT * FROM USER WHERE user_id=?',[uid]);
    const [[ws]]     =await pool.execute('SELECT SUM(duration_minutes) total_minutes,SUM(calories_burned) total_calories,COUNT(*) total_sessions,AVG(duration_minutes) avg_duration FROM WORKOUT WHERE user_id=?',[uid]);
    const [byType]   =await pool.execute('SELECT workout_type,SUM(duration_minutes) td,SUM(calories_burned) tc,COUNT(*) cnt FROM WORKOUT WHERE user_id=? GROUP BY workout_type ORDER BY td DESC',[uid]);
    const [[wAvg]]   =await pool.execute('SELECT AVG(steps) avg_s,AVG(sleep_hours) avg_sl,AVG(heart_rate) avg_hr,MIN(heart_rate) min_hr,MAX(heart_rate) max_hr,COUNT(*) cnt FROM WEARABLE_DATA WHERE user_id=?',[uid]);
    const [w14]      =await pool.execute('SELECT record_date d,steps,sleep_hours,heart_rate FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date DESC LIMIT 14',[uid]);
    const [wk14]     =await pool.execute('SELECT DATE(workout_date) d,SUM(calories_burned) cal,SUM(duration_minutes) dur FROM WORKOUT WHERE user_id=? GROUP BY DATE(workout_date) ORDER BY workout_date DESC LIMIT 14',[uid]);
    const [labT]     =await pool.execute('SELECT test_name,result_value,test_date FROM LAB_REPORT WHERE user_id=? ORDER BY test_date DESC LIMIT 30',[uid]);
    const [sleepD]   =await pool.execute('SELECT ROUND(sleep_hours) sl,COUNT(*) cnt FROM WEARABLE_DATA WHERE user_id=? GROUP BY ROUND(sleep_hours) ORDER BY sl',[uid]);
    const [hrD]      =await pool.execute(\`SELECT CASE WHEN heart_rate<60 THEN '<60 Athlete' WHEN heart_rate<70 THEN '60-69 Optimal' WHEN heart_rate<80 THEN '70-79 Normal' ELSE '80+ Elevated' END zone,COUNT(*) cnt FROM WEARABLE_DATA WHERE user_id=? GROUP BY zone\`,[uid]);
    const [wArr]     =await pool.execute('SELECT * FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date DESC LIMIT 1',[uid]);

    const w=wArr[0]||null;
    const hs=healthScore(w,ws); const v2=vo2Max(w,user.age);
    const rec=recovery(w); const mAge=metabolicAge(user.age,ws);
    const hRisk=hrZone(w?.heart_rate||(wAvg?.avg_hr||null));
    const B=bmr(user);
    const TDEE=Math.round(B*((ws?.total_sessions||0)>12?1.55:(ws?.total_sessions||0)>4?1.375:1.2));
    const hrv=w?.heart_rate?Math.round(1000/w.heart_rate*10):null;

    res.render('analytics',{user,ws:ws||{},byType,wAvg:wAvg||{},
      w14:JSON.stringify(w14.reverse()),wk14:JSON.stringify(wk14.reverse()),
      labT,sleepD:JSON.stringify(sleepD),hrD:JSON.stringify(hrD),
      byTypeJSON:JSON.stringify(byType),hs,v2,rec,mAge,hRisk,B,TDEE,hrv,flash:req.flash()});
  }catch(e){res.status(500).send(e.message);}
});

app.get('/uploads',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const [[user]] =await pool.execute('SELECT * FROM USER WHERE user_id=?',[uid]);
    const [uploads]=await pool.execute('SELECT * FROM UPLOADS WHERE user_id=? ORDER BY uploaded_at DESC',[uid]).catch(()=>[[],null]);
    res.render('uploads',{user,uploads:uploads||[],flash:req.flash()});
  }catch(e){res.status(500).send(e.message);}
});

app.post('/uploads',auth,upload.single('health_file'),async(req,res)=>{
  try{
    if(!req.file) return res.redirect('/uploads');
    const uid=req.session.userid;
    const {doc_type='Other',doc_date='',notes=''}=req.body;
    await pool.execute(
      'INSERT INTO UPLOADS(user_id,file_name,original_name,doc_type,doc_date,notes,file_url) VALUES(?,?,?,?,?,?,?)',
      [uid,req.file.filename,req.file.originalname,doc_type,doc_date||null,notes||null,'/uploads/'+req.file.filename]);
    req.flash('success','Document uploaded to your vault.');
    res.redirect('/uploads');
  }catch(e){console.error(e);res.redirect('/uploads');}
});

app.post('/uploads/delete',auth,async(req,res)=>{
  try{
    const uid=req.session.userid; const {upload_id}=req.body;
    const [rows]=await pool.execute('SELECT * FROM UPLOADS WHERE upload_id=? AND user_id=?',[upload_id,uid]);
    if(rows[0]){
      try{fs.unlinkSync(path.join(__dirname,'public','uploads',rows[0].file_name));}catch(_){}
      await pool.execute('DELETE FROM UPLOADS WHERE upload_id=?',[upload_id]);
    }
    res.redirect('/uploads');
  }catch(e){res.redirect('/uploads');}
});

app.get('/privacy',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const [[user]] =await pool.execute('SELECT * FROM USER WHERE user_id=?',[uid]);
    const [access] =await pool.execute('SELECT * FROM DATA_ACCESS WHERE user_id=? ORDER BY expiry_date ASC',[uid]);
    res.render('privacy',{user,accessRecords:access,flash:req.flash()});
  }catch(e){res.status(500).send(e.message);}
});

app.post('/privacy/revoke',auth,async(req,res)=>{
  await pool.execute('DELETE FROM DATA_ACCESS WHERE access_id=? AND user_id=?',[req.body.access_id,req.session.userid]);
  req.flash('success','Access revoked.');res.redirect('/privacy');
});

app.post('/privacy/grant',auth,async(req,res)=>{
  const {shared_with,permission_level,expiry_date}=req.body;
  if(!shared_with||!expiry_date){req.flash('error','All fields required.');return res.redirect('/privacy');}
  await pool.execute('INSERT INTO DATA_ACCESS(shared_with,permission_level,expiry_date,user_id) VALUES(?,?,?,?)',
    [shared_with,permission_level||'read',expiry_date,req.session.userid]);
  req.flash('success','Access granted to '+shared_with+'.');res.redirect('/privacy');
});

app.post('/log-workout',auth,async(req,res)=>{
  try{
    const uid=req.session.userid;
    const {workout_type,duration_minutes,calories_burned,workout_date,notes}=req.body;
    await pool.execute('INSERT INTO WORKOUT(user_id,workout_type,duration_minutes,calories_burned,workout_date) VALUES(?,?,?,?,?)',
      [uid,workout_type,+duration_minutes||0,+calories_burned||0,workout_date||new Date().toISOString().split('T')[0]]);
    res.json({ok:true,message:'Workout logged successfully!'});
  }catch(e){res.status(500).json({ok:false,message:e.message});}
});

// Live API endpoints
app.get('/api/wearable',auth,async(req,res)=>{
  const [rows]=await pool.execute('SELECT record_date,steps,sleep_hours,heart_rate FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date ASC LIMIT 14',[req.session.userid]);
  res.json(rows);
});
app.get('/api/workout',auth,async(req,res)=>{
  const [rows]=await pool.execute('SELECT DATE(workout_date) d,SUM(calories_burned) cal,SUM(duration_minutes) dur FROM WORKOUT WHERE user_id=? GROUP BY DATE(workout_date) ORDER BY workout_date ASC LIMIT 14',[req.session.userid]);
  res.json(rows);
});
app.get('/api/stats',auth,async(req,res)=>{
  const uid=req.session.userid;
  const [[user]]=await pool.execute('SELECT age,gender FROM USER WHERE user_id=?',[uid]);
  const [wArr]  =await pool.execute('SELECT * FROM WEARABLE_DATA WHERE user_id=? ORDER BY record_date DESC LIMIT 1',[uid]);
  const [[ws]]  =await pool.execute('SELECT COUNT(*) total_sessions,SUM(calories_burned) total_calories FROM WORKOUT WHERE user_id=?',[uid]);
  const w=wArr[0]||null;
  res.json({wearable:w,hs:healthScore(w,ws),v2:vo2Max(w,user?.age),rec:recovery(w)});
});

app.listen(3000,()=>console.log('\\n🫀  NationalHealthID → http://localhost:3000\\n'));
`);

// ════════════════════════════════════════════════════════════════════════════
// SHARED DESIGN SYSTEM
// ════════════════════════════════════════════════════════════════════════════

const CSS = `
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',sans-serif;background:#020811;color:#cbd5e1;min-height:100vh;overflow-x:hidden}
h1,h2,h3,h4,.fd{font-family:'Syne',sans-serif}
.fm,code{font-family:'JetBrains Mono',monospace}
:root{--g:20,184,138;--c:6,182,212;--p:139,92,246;
  --nhid:rgba(20,184,138,1);--glow:0 0 40px rgba(20,184,138,.2);
  --card:rgba(12,24,41,.7);--cb:rgba(20,184,138,.1);
  --d9:#030d1a;--d8:#071020;--d7:#0c1829}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px}
.orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;animation:of 10s ease-in-out infinite}
.o1{width:700px;height:700px;background:radial-gradient(circle,rgba(20,184,138,.09),transparent 65%);top:-250px;right:-200px}
.o2{width:500px;height:500px;background:radial-gradient(circle,rgba(6,182,212,.07),transparent 65%);bottom:-150px;left:-150px;animation-delay:-4s}
.o3{width:350px;height:350px;background:radial-gradient(circle,rgba(139,92,246,.05),transparent 65%);top:40%;left:45%;animation-delay:-7s}
@keyframes of{0%,100%{transform:translate(0,0)}33%{transform:translate(12px,-18px)}66%{transform:translate(-8px,12px)}}
.card{background:var(--card);border:1px solid var(--cb);border-radius:20px;backdrop-filter:blur(24px)}
.card-sm{background:rgba(12,24,41,.5);border:1px solid rgba(255,255,255,.05);border-radius:14px}
.lift{transition:transform .3s,box-shadow .3s,border-color .3s}
.lift:hover{transform:translateY(-3px);box-shadow:0 24px 60px rgba(0,0,0,.4),var(--glow);border-color:rgba(20,184,138,.25)}
.gt{background:linear-gradient(135deg,rgba(20,184,138,1) 0%,rgba(6,182,212,1) 55%,rgba(139,92,246,1) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;border-radius:12px;font-family:'Syne',sans-serif;font-weight:600;font-size:.875rem;transition:all .25s;cursor:pointer;border:none;text-decoration:none;line-height:1}
.bp{background:linear-gradient(135deg,rgba(20,184,138,1),rgba(6,182,212,.85));color:#fff;box-shadow:0 0 24px rgba(20,184,138,.3),inset 0 1px 0 rgba(255,255,255,.15)}
.bp:hover{box-shadow:0 0 44px rgba(20,184,138,.5),inset 0 1px 0 rgba(255,255,255,.2);transform:translateY(-1px)}
.bg_{background:rgba(255,255,255,.05);color:#94a3b8;border:1px solid rgba(255,255,255,.08)}
.bg_:hover{background:rgba(255,255,255,.1);color:#e2e8f0}
.bd{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.25)}
.bd:hover{background:rgba(239,68,68,.22);box-shadow:0 0 20px rgba(239,68,68,.2)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-family:'Syne',sans-serif;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border:1px solid}
.bg{background:rgba(20,184,138,.12);color:#34d399;border-color:rgba(20,184,138,.2)}
.bb{background:rgba(59,130,246,.12);color:#60a5fa;border-color:rgba(59,130,246,.2)}
.br{background:rgba(239,68,68,.12);color:#f87171;border-color:rgba(239,68,68,.2)}
.by{background:rgba(245,158,11,.12);color:#fbbf24;border-color:rgba(245,158,11,.2)}
.bpu{background:rgba(139,92,246,.12);color:#a78bfa;border-color:rgba(139,92,246,.2)}
.bgr{background:rgba(100,116,139,.12);color:#94a3b8;border-color:rgba(100,116,139,.2)}
.bc{background:rgba(6,182,212,.12);color:#22d3ee;border-color:rgba(6,182,212,.2)}
.pg{height:6px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}
.pf{height:100%;border-radius:999px;background:linear-gradient(90deg,rgba(20,184,138,1),rgba(6,182,212,1));box-shadow:0 0 10px rgba(20,184,138,.4);transition:width 1.4s cubic-bezier(.4,0,.2,1)}
.pf-p{background:linear-gradient(90deg,rgba(139,92,246,1),#ec4899)}
.pf-r{background:linear-gradient(90deg,#ef4444,#f97316)}
.inp{width:100%;background:rgba(7,16,32,.9);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-radius:12px;padding:10px 14px;transition:all .2s;font-family:'Outfit',sans-serif;font-size:.875rem}
.inp:focus{outline:none;border-color:rgba(20,184,138,.5);box-shadow:0 0 0 3px rgba(20,184,138,.1)}
.inp::placeholder{color:#334155}
.sn{font-family:'Syne',sans-serif;font-weight:700;line-height:1}
.fu{opacity:0;transform:translateY(18px);animation:fu .55s ease forwards}
@keyframes fu{to{opacity:1;transform:translateY(0)}}
.d1{animation-delay:.06s}.d2{animation-delay:.13s}.d3{animation-delay:.2s}
.d4{animation-delay:.27s}.d5{animation-delay:.34s}.d6{animation-delay:.41s}
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(3,13,26,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(20,184,138,.08);height:58px;display:flex;align-items:center}
.nl{color:#64748b;padding:7px 13px;border-radius:10px;font-weight:500;font-size:.82rem;transition:all .2s;display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap}
.nl:hover,.nl.on{color:rgba(20,184,138,1);background:rgba(20,184,138,.08)}
.tbl{width:100%;border-collapse:separate;border-spacing:0}
.tbl th{background:rgba(7,16,32,.8);color:#475569;font-family:'Syne',sans-serif;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;padding:12px 16px;font-weight:700}
.tbl td{padding:12px 16px;color:#94a3b8;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.03)}
.tbl tbody tr:hover{background:rgba(20,184,138,.03)}
.modal-bg{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,8,17,.85);backdrop-filter:blur(12px)}
.modal{background:rgba(7,16,32,.97);border:1px solid rgba(20,184,138,.2);border-radius:24px;padding:32px;width:100%;max-width:480px;box-shadow:0 40px 100px rgba(0,0,0,.6),var(--glow)}
#tc{position:fixed;bottom:24px;right:24px;z-index:9998;display:flex;flex-direction:column;gap:10px}
.toast{background:rgba(7,16,32,.97);border:1px solid rgba(20,184,138,.25);border-radius:14px;padding:13px 17px;color:#e2e8f0;font-size:.875rem;display:flex;align-items:center;gap:10px;box-shadow:0 12px 40px rgba(0,0,0,.5),var(--glow);animation:tin .35s ease;min-width:260px}
.toast-e{border-color:rgba(239,68,68,.3)}
.toast-s{border-color:rgba(20,184,138,.35)}
@keyframes tin{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.tab{cursor:pointer;padding:8px 16px;border-radius:10px;font-family:'Syne',sans-serif;font-size:.82rem;font-weight:600;color:#64748b;transition:all .2s;white-space:nowrap;border:none;background:transparent}
.tab:hover{color:rgba(20,184,138,.8)}
.tab.on{background:rgba(20,184,138,.14);color:rgba(20,184,138,1)}
.tl{position:relative;padding-left:36px}
.tl-line{position:absolute;left:15px;top:14px;bottom:0;width:2px;background:linear-gradient(180deg,rgba(20,184,138,.5),transparent)}
.tl-dot{position:absolute;left:8px;width:14px;height:14px;border-radius:50%;border:2px solid;background:#030d1a}
.ring{position:relative;display:inline-block;width:128px;height:128px}
.ring svg{position:absolute;inset:0;width:128px;height:128px}
.ring-in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
@keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
.pdot{width:8px;height:8px;border-radius:50%;background:rgba(20,184,138,1);display:inline-block;animation:pdot 2s ease infinite}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(20,184,138,.25);border-radius:3px}
select.inp option{background:#071020;color:#e2e8f0}
</style>`;

const HEAD = (title, extras='') =>
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} — NationalHealthID</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
${extras}${CSS}
</head>`;

const NAV = (active) =>
`<div class="o1 orb"></div><div class="o2 orb"></div><div class="o3 orb"></div>
<div id="tc"></div>
<nav>
  <div style="max-width:1280px;margin:0 auto;padding:0 20px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px">
    <a href="/dashboard" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0">
      <div class="btn bp" style="width:36px;height:36px;border-radius:10px;padding:0;flex-shrink:0">
        <i class="fa-solid fa-dna" style="font-size:13px"></i>
      </div>
      <div style="display:none" class="lg-show">
        <div class="fd" style="font-weight:800;color:#fff;font-size:.9rem;line-height:1">NationalHealthID</div>
        <div style="color:rgba(20,184,138,.65);font-size:.62rem;margin-top:2px">India's Health OS</div>
      </div>
    </a>
    <div style="display:flex;align-items:center;gap:2px;overflow-x:auto;flex:1;justify-content:center">
      <a href="/dashboard" class="nl ${active==='dash'?'on':''}"><i class="fa-solid fa-gauge-high"></i>Dashboard</a>
      <a href="/history" class="nl ${active==='hist'?'on':''}"><i class="fa-solid fa-timeline"></i>Records</a>
      <a href="/analytics" class="nl ${active==='anal'?'on':''}"><i class="fa-solid fa-wave-square"></i>Analytics</a>
      <a href="/uploads" class="nl ${active==='up'?'on':''}"><i class="fa-solid fa-vault"></i>Vault</a>
      <a href="/privacy" class="nl ${active==='priv'?'on':''}"><i class="fa-solid fa-shield-halved"></i>Privacy</a>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
      <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,rgba(20,184,138,1),rgba(6,182,212,.8));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem">
        <%= user.name.charAt(0).toUpperCase() %>
      </div>
      <a href="/logout" class="btn bd" style="padding:7px 10px;font-size:.75rem"><i class="fa-solid fa-power-off"></i></a>
    </div>
  </div>
</nav>`;

const TOAST =
`<script>
function toast(m,t='s'){
  const c=document.getElementById('tc');
  const d=document.createElement('div');
  d.className='toast toast-'+(t==='e'?'e':'s');
  const ic=t==='e'?'fa-circle-exclamation':'fa-circle-check';
  const co=t==='e'?'#f87171':'#34d399';
  d.innerHTML='<i class="fa-solid '+ic+'" style="color:'+co+';flex-shrink:0"></i><span>'+m+'</span>';
  c.appendChild(d);
  setTimeout(()=>{d.style.animation='tin .35s ease reverse';setTimeout(()=>d.remove(),350);},3500);
}
<\/script>`;

// ════════════════════════════════════════════════════════════════════════════
// login.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/login.ejs",
HEAD("Sign In") + `
<body>
<div class="o1 orb"></div><div class="o2 orb"></div><div class="o3 orb"></div>
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;position:relative;z-index:1">

  <!-- Left branding panel (desktop only) -->
  <div style="width:480px;padding-right:64px;display:none" class="lg-show">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:48px">
      <div class="btn bp" style="width:48px;height:48px;border-radius:14px;padding:0;box-shadow:0 0 30px rgba(20,184,138,.4)">
        <i class="fa-solid fa-dna" style="font-size:18px"></i>
      </div>
      <div>
        <div class="fd" style="font-weight:800;color:#fff;font-size:1.1rem">NationalHealthID</div>
        <div style="color:rgba(20,184,138,.6);font-size:.7rem">India's Sovereign Health OS</div>
      </div>
    </div>
    <h1 class="fd" style="font-size:2.8rem;font-weight:800;color:#fff;line-height:1.15;margin-bottom:20px">
      Your health.<br/><span class="gt">One identity.</span><br/>Every doctor.
    </h1>
    <p style="color:#475569;font-size:1rem;line-height:1.7;margin-bottom:32px">
      Like Aadhaar for your documents — NationalHealthID is your sovereign medical identity, 
      accepted at every clinic, hospital, and lab in India. One ID. Your entire health story.
    </p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <% [['fa-hospital','2,400+ Hospitals integrated nationwide'],['fa-flask','Real-time lab sync & report delivery'],['fa-shield-halved','DPDP Act compliant, 256-bit encrypted'],['fa-brain','Expert biometric intelligence engine'],['fa-file-medical','Lifetime medical timeline — never lose a record']].forEach(f=>{ %>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="card-sm" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid <%= f[0] %>" style="color:rgba(20,184,138,.7);font-size:13px"></i>
        </div>
        <span style="color:#64748b;font-size:.875rem"><%= f[1] %></span>
      </div>
      <% }) %>
    </div>
  </div>

  <!-- Login card -->
  <div class="fu" style="width:100%;max-width:420px">
    <div class="card" style="padding:36px;box-shadow:0 40px 80px rgba(0,0,0,.5),var(--glow)">
      <div style="text-align:center;margin-bottom:28px">
        <div class="btn bp" style="width:56px;height:56px;border-radius:16px;padding:0;margin:0 auto 16px;box-shadow:0 0 30px rgba(20,184,138,.4)">
          <i class="fa-solid fa-dna" style="font-size:20px"></i>
        </div>
        <h2 class="fd" style="font-size:1.35rem;color:#fff;margin-bottom:6px">Sign in to your Health ID</h2>
        <p style="color:#475569;font-size:.85rem">Enter your National Health ID number</p>
      </div>

      <% if(error){ %>
      <div class="card-sm" style="padding:13px 16px;margin-bottom:20px;border-color:rgba(239,68,68,.25);display:flex;align-items:center;gap:10px">
        <i class="fa-solid fa-triangle-exclamation" style="color:#f87171;flex-shrink:0"></i>
        <span style="color:#fca5a5;font-size:.875rem"><%= error %></span>
      </div>
      <% } %>

      <form method="POST" action="/login" style="display:flex;flex-direction:column;gap:18px">
        <div>
          <label class="fd" style="display:block;font-size:.75rem;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Health ID Number</label>
          <div style="position:relative">
            <i class="fa-solid fa-id-card" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:rgba(20,184,138,.6);font-size:13px"></i>
            <input type="number" name="user_id" placeholder="e.g. 1, 2, 3 ..." required class="inp" style="padding-left:40px" autofocus/>
          </div>
          <p style="color:#334155;font-size:.72rem;margin-top:6px">Your ID was assigned at registration. Demo: try 1, 2, or 3.</p>
        </div>
        <button type="submit" class="btn bp" style="width:100%;padding:14px;font-size:.9rem">
          <i class="fa-solid fa-arrow-right-to-bracket"></i>Access My Health Dashboard
        </button>
      </form>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.05)">
        <% [['256-bit','Encrypted'],['DPDP','Compliant'],['24/7','Available']].forEach(s=>{ %>
        <div class="card-sm" style="padding:12px;text-align:center">
          <div class="fd" style="font-size:1rem;font-weight:700;color:rgba(20,184,138,.9)")<%= s[0] %></div>
          <div style="color:#334155;font-size:.65rem;margin-top:2px"><%= s[1] %></div>
        </div>
        <% }) %>
      </div>
    </div>
    <p style="text-align:center;color:#1e2d40;font-size:.72rem;margin-top:20px">© 2024 NationalHealthID · DPDP Compliant · Ministry of Health Initiative</p>
  </div>
</div>
<style>.lg-show{display:block!important}</style>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// dashboard.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/dashboard.ejs",
HEAD("Dashboard", `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>`) + `
<body>
${NAV('dash')}
${TOAST}
<div style="position:relative;z-index:1;padding:72px 20px 48px;max-width:1280px;margin:0 auto">

  <!-- Header row -->
  <div class="fu" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:28px">
    <div>
      <p style="color:rgba(20,184,138,.7);font-size:.82rem;font-weight:500;margin-bottom:4px">
        <i class="fa-solid fa-sun" style="margin-right:6px"></i>
        <%= (new Date().getHours()<12)?'Good morning':(new Date().getHours()<17)?'Good afternoon':'Good evening' %>
      </p>
      <h1 class="fd" style="font-size:2.2rem;color:#fff;font-weight:800"><%= user.name %></h1>
    </div>
    <!-- Health ID chip -->
    <div style="background:linear-gradient(135deg,rgba(20,184,138,.12),rgba(6,182,212,.08));border:1px solid rgba(20,184,138,.2);border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:14px;backdrop-filter:blur(10px)">
      <div class="btn bp" style="width:40px;height:40px;border-radius:12px;padding:0;flex-shrink:0">
        <i class="fa-solid fa-dna" style="font-size:14px"></i>
      </div>
      <div>
        <div class="fd" style="font-size:.65rem;color:rgba(20,184,138,.6);letter-spacing:.12em;text-transform:uppercase">National Health ID</div>
        <div class="fm" style="font-size:1.1rem;font-weight:600;color:#fff;letter-spacing:.1em">#<%= String(user.user_id).padStart(8,'0') %></div>
        <div style="font-size:.7rem;color:#475569;margin-top:2px"><%= user.blood_group||'—' %> · <%= user.age %>y · <%= user.gender||'—' %></div>
      </div>
    </div>
  </div>

  <!-- Row 1: Health Score + 6 Vitals -->
  <div style="display:grid;grid-template-columns:200px 1fr;gap:18px;margin-bottom:18px" class="fu d1">

    <!-- Score ring -->
    <div class="card lift" style="padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px">
      <p style="color:#475569;font-size:.68rem;font-family:'Syne',sans-serif;letter-spacing:.1em;text-transform:uppercase">Health Score</p>
      <div class="ring">
        <svg viewBox="0 0 128 128" style="transform:rotate(-90deg)">
          <circle cx="64" cy="64" r="52" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>
          <circle cx="64" cy="64" r="52" fill="none" stroke="url(#sg)" stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="<%= Math.round(2*Math.PI*52) %>"
            stroke-dashoffset="<%= Math.round(2*Math.PI*52*(1-hs.score/100)) %>"/>
          <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgba(20,184,138,1)"/><stop offset="100%" stop-color="rgba(6,182,212,1)"/>
          </linearGradient></defs>
        </svg>
        <div class="ring-in">
          <span class="sn" style="font-size:2rem;color:#fff"><%= hs.score %></span>
          <span style="color:rgba(20,184,138,1);font-weight:700;font-size:.9rem;font-family:'Syne',sans-serif"><%= hs.grade %></span>
        </div>
      </div>
      <p style="color:rgba(20,184,138,.8);font-size:.8rem;font-weight:600;font-family:'Syne',sans-serif"><%= hs.label %></p>
    </div>

    <!-- Vitals 3x2 grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
      <% const vitals=[
        {l:'VO₂ Max',v:v2?v2+' ml/kg':'—',sub:'Cardio ceiling',ic:'fa-lungs',cl:'#22d3ee',tip:v2?(v2>=55?'Elite':v2>=45?'Superior':v2>=35?'Average':'Below Avg'):''},
        {l:'Recovery',v:rec?rec+'%':'—',sub:'Today readiness',ic:'fa-bolt',cl:'rgba(20,184,138,1)',tip:rec?(rec>=75?'Train Hard':rec>=50?'Moderate':'Rest Day'):''},
        {l:'Resting HR',v:w?(w.heart_rate+' bpm'):'—',sub:hRisk.label,ic:'fa-heart-pulse',cl:'#f87171',tip:''},
        {l:'Metabolic Age',v:mAge+'y',sub:'vs real age '+user.age+'y',ic:'fa-dna',cl:'#a78bfa',tip:mAge<user.age?'Younger ✓':'Older — train more'},
        {l:'HRV',v:hrv?hrv+' ms':'—',sub:'Autonomic health',ic:'fa-wave-square',cl:'#fbbf24',tip:hrv?(hrv>=55?'High resilience':hrv>=38?'Good':'Low — recover'):''},
        {l:'TDEE',v:TDEE+' kcal',sub:'Daily expenditure',ic:'fa-fire',cl:'#fb923c',tip:'Based on activity level'},
      ]; %>
      <% vitals.forEach(function(v,i){ %>
      <div class="card-sm lift fu d<%= i+1 %>" style="padding:16px">
        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center">
            <i class="fa-solid <%= v.ic %>" style="color:<%= v.cl %>;font-size:14px"></i>
          </div>
          <% if(v.tip){ %><span class="badge bg" style="font-size:.6rem"><%= v.tip.split(' ')[0] %></span><% } %>
        </div>
        <div class="sn" style="font-size:1.5rem;color:#fff;margin-bottom:2px"><%= v.v %></div>
        <div class="fd" style="font-size:.67rem;color:#475569;letter-spacing:.07em;text-transform:uppercase"><%= v.l %></div>
        <div style="color:#334155;font-size:.7rem;margin-top:2px"><%= v.sub %></div>
      </div>
      <% }) %>
    </div>
  </div>

  <!-- Row 2: Wearable detail + Meds -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">

    <!-- Wearable -->
    <div class="card lift fu d2" style="padding:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <h3 class="fd" style="color:#fff;font-size:1rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-watch" style="color:rgba(20,184,138,.7)"></i>Wearable Snapshot
        </h3>
        <% if(w){ %>
        <span class="badge bg"><span class="pdot"></span>
          <%= new Date(w.record_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) %>
        </span>
        <% } %>
      </div>
      <% if(w){ %>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
            <span style="color:#64748b"><i class="fa-solid fa-person-walking" style="color:#22d3ee;margin-right:5px"></i>Steps</span>
            <span class="fm" style="color:#fff"><%= (w.steps||0).toLocaleString() %> / 10,000</span>
          </div>
          <div class="pg"><div class="pf" style="width:<%= Math.min(100,Math.round((w.steps||0)/100)) %>%"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
            <span style="color:#64748b"><i class="fa-solid fa-moon" style="color:#818cf8;margin-right:5px"></i>Sleep</span>
            <span class="fm" style="color:#fff"><%= w.sleep_hours %>h / 8h goal</span>
          </div>
          <div class="pg"><div class="pf pf-p" style="width:<%= Math.min(100,Math.round((w.sleep_hours||0)/8*100)) %>%"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px">
            <span style="color:#64748b"><i class="fa-solid fa-heart-pulse" style="color:#f87171;margin-right:5px"></i>Heart Rate</span>
            <span class="fm" style="color:#fff"><%= w.heart_rate %> bpm — <%= hRisk.label %></span>
          </div>
          <div class="pg"><div class="pf pf-r" style="width:<%= Math.min(100,Math.round((w.heart_rate||70)/180*100)) %>%"></div></div>
        </div>
      </div>
      <!-- Mini wearable trend chart -->
      <div style="margin-top:16px;height:70px">
        <canvas id="miniChart"></canvas>
      </div>
      <% } else { %>
      <div style="text-align:center;padding:32px;color:#334155">
        <i class="fa-solid fa-watch" style="font-size:2.5rem;display:block;margin-bottom:10px;color:#1e2d40"></i>
        No wearable data synced yet.
      </div>
      <% } %>
    </div>

    <!-- Active Meds -->
    <div class="card lift fu d3" style="padding:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <h3 class="fd" style="color:#fff;font-size:1rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-pills" style="color:rgba(20,184,138,.7)"></i>Active Prescriptions
        </h3>
        <span class="badge <%= meds.length>0?'bg':'bb' %>"><%= meds.length %> active</span>
      </div>
      <% if(meds.length>0){ %>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:260px;overflow-y:auto">
        <% meds.forEach(function(med){ %>
        <div class="card-sm" style="padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:9px;background:rgba(20,184,138,.12);border:1px solid rgba(20,184,138,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fa-solid fa-capsules" style="color:rgba(20,184,138,.8);font-size:12px"></i>
            </div>
            <div>
              <div style="color:#fff;font-weight:600;font-size:.875rem"><%= med.medication_name %></div>
              <div style="color:#475569;font-size:.75rem"><%= med.dosage %></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="color:#f87171;font-size:.72rem" class="fm">Until</div>
            <div style="color:#f87171;font-size:.75rem" class="fm"><%= new Date(med.end_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) %></div>
          </div>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <div style="text-align:center;padding:32px;color:#334155">
        <i class="fa-solid fa-pills" style="font-size:2.5rem;display:block;margin-bottom:10px;color:#1e2d40"></i>
        No active prescriptions.
      </div>
      <% } %>
    </div>
  </div>

  <!-- Row 3: Recent Clinic + Recent Labs -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
    <div class="card lift fu d4" style="padding:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="fd" style="color:#fff;font-size:.95rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-stethoscope" style="color:rgba(20,184,138,.7)"></i>Recent Visits
        </h3>
        <a href="/history" style="color:rgba(20,184,138,.6);font-size:.78rem;text-decoration:none;font-weight:600" class="fd">All →</a>
      </div>
      <% if(recentCR.length>0){ %>
      <div style="display:flex;flex-direction:column;gap:10px">
        <% recentCR.forEach(function(r){ %>
        <div class="card-sm" style="padding:11px;border-left:2px solid rgba(20,184,138,.35)">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;margin-bottom:4px">
            <div style="color:#fff;font-weight:600;font-size:.85rem"><%= r.diagnosis %></div>
            <span class="fm" style="color:#475569;font-size:.7rem;flex-shrink:0"><%= new Date(r.visit_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) %></span>
          </div>
          <div style="color:#64748b;font-size:.75rem"><i class="fa-solid fa-user-doctor" style="color:rgba(20,184,138,.5);margin-right:4px"></i><%= r.doctor_name %> · <%= r.clinic_name %></div>
          <% if(r.medication_prescribed){ %>
          <div style="color:rgba(20,184,138,.65);font-size:.72rem;margin-top:4px"><i class="fa-solid fa-pills" style="margin-right:4px"></i><%= r.medication_prescribed %></div>
          <% } %>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <p style="color:#334155;text-align:center;padding:20px;font-size:.85rem">No clinic records.</p>
      <% } %>
    </div>

    <div class="card lift fu d5" style="padding:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="fd" style="color:#fff;font-size:.95rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-flask" style="color:#22d3ee"></i>Recent Lab Results
        </h3>
        <a href="/history" style="color:rgba(20,184,138,.6);font-size:.78rem;text-decoration:none;font-weight:600" class="fd">All →</a>
      </div>
      <% if(recentLR.length>0){ %>
      <div style="display:flex;flex-direction:column;gap:10px">
        <% recentLR.forEach(function(r){ %>
        <div class="card-sm" style="padding:11px;border-left:2px solid rgba(6,182,212,.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div>
              <div style="color:#fff;font-weight:600;font-size:.85rem"><%= r.test_name %></div>
              <div style="color:#64748b;font-size:.72rem"><%= r.lab_name %> · <span class="fm"><%= new Date(r.test_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) %></span></div>
            </div>
            <span class="fm" style="color:#22d3ee;font-weight:700;font-size:1rem;flex-shrink:0"><%= r.result_value %></span>
          </div>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <p style="color:#334155;text-align:center;padding:20px;font-size:.85rem">No lab reports.</p>
      <% } %>
    </div>
  </div>

  <!-- Quick nav pills -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px" class="fu d6">
    <% [{h:'/history',i:'fa-timeline',c:'#22d3ee',l:'Medical Timeline',s:'Clinic & labs'},{h:'/analytics',i:'fa-wave-square',c:'#a78bfa',l:'Biometrics',s:'Deep analytics'},{h:'/uploads',i:'fa-vault',c:'rgba(20,184,138,1)',l:'Health Vault',s:'Documents'},{h:'/privacy',i:'fa-shield-halved',c:'#fbbf24',l:'Privacy',s:'Control access'}].forEach(function(q){ %>
    <a href="<%= q.h %>" class="card-sm lift" style="padding:18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;text-decoration:none">
      <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;transition:transform .2s">
        <i class="fa-solid <%= q.i %>" style="color:<%= q.c %>;font-size:18px"></i>
      </div>
      <div>
        <div class="fd" style="color:#fff;font-weight:600;font-size:.85rem"><%= q.l %></div>
        <div style="color:#334155;font-size:.72rem;margin-top:2px"><%= q.s %></div>
      </div>
    </a>
    <% }) %>
  </div>
</div>

<script>
// Mini wearable sparkline
const wTrend = <%- wTrend %>;
if(wTrend.length && document.getElementById('miniChart')){
  const ctx=document.getElementById('miniChart').getContext('2d');
  new Chart(ctx,{
    type:'line',
    data:{labels:wTrend.map(r=>new Date(r.record_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'})),
      datasets:[{data:wTrend.map(r=>r.steps),borderColor:'rgba(20,184,138,.7)',backgroundColor:'rgba(20,184,138,.08)',
        borderWidth:2,pointRadius:3,pointBackgroundColor:'rgba(20,184,138,1)',fill:true,tension:.4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.raw.toLocaleString()+' steps'}}},
      scales:{x:{display:false},y:{display:false}}}
  });
}
</script>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// history.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/history.ejs",
HEAD("Medical Records") + `
<body>
${NAV('hist')}
${TOAST}
<div style="position:relative;z-index:1;padding:72px 20px 48px;max-width:1280px;margin:0 auto">

  <div class="fu" style="margin-bottom:24px;display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div>
      <h1 class="fd" style="font-size:2rem;color:#fff;font-weight:800">Medical Records</h1>
      <p style="color:#475569;margin-top:4px">Complete longitudinal health history — searchable, filterable, exportable.</p>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <input type="text" id="search" placeholder="Search records..." class="inp" style="width:220px"
        oninput="filterRecords(this.value)"/>
    </div>
  </div>

  <!-- Tabs -->
  <div class="fu d1" style="display:flex;gap:4px;background:rgba(12,24,41,.7);border:1px solid rgba(20,184,138,.1);border-radius:14px;padding:5px;width:fit-content;overflow-x:auto;margin-bottom:20px">
    <% [['tl','Timeline','fa-timeline'],['labs','Lab Reports','fa-flask'],['meds','Medications','fa-pills'],['wk','Workouts','fa-dumbbell'],['docs','Documents','fa-file-medical']].forEach(function(t){ %>
    <button onclick="switchTab('<%= t[0] %>')" id="tab-<%= t[0] %>" class="tab">
      <i class="fa-solid <%= t[2] %>" style="margin-right:6px"></i><%= t[1] %>
    </button>
    <% }) %>
  </div>

  <!-- TIMELINE -->
  <div id="pane-tl">
    <% const all=[...clinic.map(r=>({...r,_s:'clinic',_d:r.visit_date})),...labs.map(r=>({...r,_s:'lab',_d:r.test_date}))].sort((a,b)=>new Date(b._d)-new Date(a._d)); %>
    <% if(all.length===0){ %>
    <div class="card" style="padding:48px;text-align:center;color:#334155">
      <i class="fa-solid fa-folder-open" style="font-size:3rem;display:block;margin-bottom:12px;color:#1e2d40"></i>
      <p class="fd" style="font-size:1rem;color:#475569">No medical events recorded yet.</p>
    </div>
    <% } else { %>
    <div class="tl"><div class="tl-line"></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <% all.forEach(function(ev,idx){ %>
        <div class="record-item" data-text="<%= [ev.diagnosis||'',ev.test_name||'',ev.clinic_name||'',ev.lab_name||'',ev.doctor_name||''].join(' ').toLowerCase() %>"
          style="position:relative;animation:fu .5s ease both;animation-delay:<%= idx*0.05 %>s">
          <div class="tl-dot" style="border-color:<%= ev._s==='clinic'?'rgba(20,184,138,1)':'rgba(6,182,212,1)' %>"></div>
          <div class="card-sm lift" style="padding:18px">
            <div style="display:flex;flex-wrap:wrap;align-items:start;justify-content:space-between;gap:10px;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <% if(ev._s==='clinic'){ %>
                <span class="badge bg"><i class="fa-solid fa-stethoscope"></i>Clinic Visit</span>
                <% } else { %>
                <span class="badge bc"><i class="fa-solid fa-flask"></i>Lab Report</span>
                <% } %>
                <span class="fm" style="color:#475569;font-size:.72rem">
                  <%= new Date(ev._d).toLocaleDateString('en-IN',{weekday:'short',year:'numeric',month:'short',day:'numeric'}) %>
                </span>
              </div>
              <span class="badge bpu"><i class="fa-solid fa-location-dot"></i><%= ev._s==='clinic'?ev.clinic_name:ev.lab_name %></span>
            </div>
            <% if(ev._s==='clinic'){ %>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
              <div class="card-sm" style="padding:10px">
                <div style="color:#475569;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;font-family:'Syne',sans-serif;margin-bottom:4px">Doctor</div>
                <div style="color:#fff;font-weight:600;font-size:.875rem"><%= ev.doctor_name %></div>
              </div>
              <div class="card-sm" style="padding:10px">
                <div style="color:#475569;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;font-family:'Syne',sans-serif;margin-bottom:4px">Diagnosis</div>
                <div style="color:rgba(20,184,138,.9);font-weight:600;font-size:.875rem"><%= ev.diagnosis %></div>
              </div>
              <% if(ev.medication_prescribed){ %>
              <div class="card-sm" style="padding:10px;border-color:rgba(20,184,138,.15)">
                <div style="color:#475569;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;font-family:'Syne',sans-serif;margin-bottom:4px"><i class="fa-solid fa-pills" style="color:rgba(20,184,138,.6);margin-right:4px"></i>Prescribed</div>
                <div style="color:rgba(20,184,138,.8);font-size:.85rem"><%= ev.medication_prescribed %></div>
              </div>
              <% } %>
            </div>
            <% } else { %>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="card-sm" style="padding:10px">
                <div style="color:#475569;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;font-family:'Syne',sans-serif;margin-bottom:4px">Test</div>
                <div style="color:#fff;font-weight:600;font-size:.875rem"><%= ev.test_name %></div>
              </div>
              <div class="card-sm" style="padding:10px;border-color:rgba(6,182,212,.2)">
                <div style="color:#475569;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;font-family:'Syne',sans-serif;margin-bottom:4px">Result</div>
                <div class="fm" style="color:#22d3ee;font-weight:700;font-size:1.1rem"><%= ev.result_value %></div>
              </div>
            </div>
            <% } %>
          </div>
        </div>
        <% }) %>
      </div>
    </div>
    <% } %>
  </div>

  <!-- LABS -->
  <div id="pane-labs" style="display:none">
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;justify-content:space-between">
        <h3 class="fd" style="color:#fff;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-flask" style="color:#22d3ee"></i>All Lab Reports</h3>
        <span class="badge bc"><%= labs.length %> records</span>
      </div>
      <% if(labs.length>0){ %>
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr><th>Test Name</th><th>Result</th><th>Lab</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            <% labs.forEach(function(l){ %>
            <tr class="record-item" data-text="<%= l.test_name.toLowerCase()+' '+l.lab_name.toLowerCase() %>">
              <td style="color:#fff;font-weight:600"><%= l.test_name %></td>
              <td><span class="fm" style="color:#22d3ee;font-weight:700;font-size:1rem"><%= l.result_value %></span></td>
              <td><%= l.lab_name %></td>
              <td class="fm" style="font-size:.78rem"><%= new Date(l.test_date).toLocaleDateString('en-IN') %></td>
              <td><span class="badge bg">Reported</span></td>
            </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
      <% } else { %><p style="text-align:center;padding:40px;color:#334155">No lab reports found.</p><% } %>
    </div>
  </div>

  <!-- MEDS -->
  <div id="pane-meds" style="display:none">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
      <% if(meds.length>0){ meds.forEach(function(m){ %>
      <% const active=new Date(m.end_date)>new Date(); %>
      <div class="card-sm lift" style="padding:18px">
        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:12px">
          <div style="width:40px;height:40px;border-radius:11px;background:rgba(20,184,138,.1);border:1px solid rgba(20,184,138,.2);display:flex;align-items:center;justify-content:center">
            <i class="fa-solid fa-capsules" style="color:rgba(20,184,138,.8)"></i>
          </div>
          <span class="badge <%= active?'bg':'br' %>"><%= active?'Active':'Completed' %></span>
        </div>
        <div class="fd" style="color:#fff;font-weight:700;font-size:1rem;margin-bottom:4px"><%= m.medication_name %></div>
        <div style="color:rgba(20,184,138,.7);font-weight:600;font-size:.875rem;margin-bottom:12px"><%= m.dosage %></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="card-sm" style="padding:8px">
            <div style="color:#334155;font-size:.65rem;text-transform:uppercase;font-family:'Syne',sans-serif">Start</div>
            <div class="fm" style="color:#94a3b8;font-size:.78rem;margin-top:2px"><%= new Date(m.start_date).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'}) %></div>
          </div>
          <div class="card-sm" style="padding:8px">
            <div style="color:#334155;font-size:.65rem;text-transform:uppercase;font-family:'Syne',sans-serif">End</div>
            <div class="fm" style="color:<%= active?'#f87171':'#475569' %>;font-size:.78rem;margin-top:2px"><%= new Date(m.end_date).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'}) %></div>
          </div>
        </div>
      </div>
      <% }) } else { %>
      <div class="card" style="padding:48px;text-align:center;color:#334155;grid-column:1/-1">No medication records.</div>
      <% } %>
    </div>
  </div>

  <!-- WORKOUTS -->
  <div id="pane-wk" style="display:none">
    <div class="card" style="overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;justify-content:space-between">
        <h3 class="fd" style="color:#fff;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-dumbbell" style="color:#a78bfa"></i>Workout Log</h3>
        <span class="badge bpu"><%= workouts.length %> sessions</span>
      </div>
      <% if(workouts.length>0){ %>
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr><th>Type</th><th>Duration</th><th>Calories</th><th>Date</th></tr></thead>
          <tbody>
            <% workouts.forEach(function(w){ %>
            <tr>
              <td style="color:#fff;font-weight:600"><%= w.workout_type %></td>
              <td style="color:#a78bfa" class="fm"><%= w.duration_minutes %> min</td>
              <td style="color:#fb923c" class="fm"><%= (w.calories_burned||0).toLocaleString() %> kcal</td>
              <td class="fm" style="font-size:.78rem"><%= new Date(w.workout_date).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'}) %></td>
            </tr>
            <% }) %>
          </tbody>
        </table>
      </div>
      <% } else { %><p style="text-align:center;padding:40px;color:#334155">No workouts logged yet. <a href="/analytics" style="color:rgba(20,184,138,.7);text-decoration:none">Log one →</a></p><% } %>
    </div>
  </div>

  <!-- DOCS -->
  <div id="pane-docs" style="display:none">
    <% if(uploads.length>0){ %>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
      <% uploads.forEach(function(u){ %>
      <div class="card-sm lift" style="padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="height:110px;background:rgba(7,16,32,.6);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid rgba(255,255,255,.04)">
          <% if(!u.original_name.toLowerCase().endsWith('.pdf')){ %>
          <img src="<%= u.file_url %>" style="height:100%;width:100%;object-fit:cover;border-radius:9px" onerror="this.parentNode.innerHTML='<i class=\\'fa-solid fa-image\\' style=\\'color:#334155;font-size:2rem\\'></i>'"/>
          <% } else { %>
          <div style="text-align:center">
            <i class="fa-solid fa-file-pdf" style="color:#f87171;font-size:2rem;display:block;margin-bottom:6px"></i>
            <span style="color:#475569;font-size:.72rem">PDF</span>
          </div>
          <% } %>
        </div>
        <div>
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;margin-bottom:6px">
            <div style="color:#fff;font-weight:600;font-size:.85rem;word-break:break-all;line-height:1.3"><%= u.original_name.substring(0,35) %><%= u.original_name.length>35?'...':'' %></div>
            <span class="badge bg" style="flex-shrink:0"><%= u.doc_type %></span>
          </div>
          <% if(u.notes){ %><div style="color:#475569;font-size:.75rem;font-style:italic;margin-bottom:4px"><%= u.notes.substring(0,60) %></div><% } %>
          <div class="fm" style="color:#334155;font-size:.68rem"><%= new Date(u.uploaded_at).toLocaleDateString('en-IN') %></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:auto">
          <a href="<%= u.file_url %>" target="_blank" class="btn bp" style="flex:1;padding:8px;font-size:.78rem"><i class="fa-solid fa-eye"></i>View</a>
          <a href="<%= u.file_url %>" download class="btn bg_" style="padding:8px 12px;font-size:.78rem"><i class="fa-solid fa-download"></i></a>
          <form method="POST" action="/uploads/delete" onsubmit="return confirm('Delete this document?')" style="display:inline">
            <input type="hidden" name="upload_id" value="<%= u.upload_id %>"/>
            <button type="submit" class="btn bd" style="padding:8px 10px"><i class="fa-solid fa-trash" style="font-size:.78rem"></i></button>
          </form>
        </div>
      </div>
      <% }) %>
    </div>
    <% } else { %>
    <div class="card" style="padding:48px;text-align:center">
      <i class="fa-solid fa-folder-open" style="font-size:3rem;color:#1e2d40;display:block;margin-bottom:14px"></i>
      <p class="fd" style="color:#475569;margin-bottom:16px">No documents uploaded yet.</p>
      <a href="/uploads" class="btn bp">Upload Your First Document</a>
    </div>
    <% } %>
  </div>
</div>

<script>
function switchTab(id){
  ['tl','labs','meds','wk','docs'].forEach(t=>{
    document.getElementById('pane-'+t).style.display=t===id?'block':'none';
    const b=document.getElementById('tab-'+t);
    b.classList.toggle('on',t===id);
  });
}
switchTab('tl');
function filterRecords(q){
  q=q.toLowerCase();
  document.querySelectorAll('.record-item').forEach(el=>{
    el.style.display=(!q||el.dataset.text.includes(q))?'':'none';
  });
}
</script>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// analytics.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/analytics.ejs",
HEAD("Analytics", `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>`) + `
<body>
${NAV('anal')}
${TOAST}
<div style="position:relative;z-index:1;padding:72px 20px 48px;max-width:1280px;margin:0 auto">

  <div class="fu" style="display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:24px">
    <div>
      <h1 class="fd" style="font-size:2rem;color:#fff;font-weight:800">Biometric Intelligence</h1>
      <p style="color:#475569;margin-top:4px">Expert health analytics — VO₂, HRV, metabolic health, training load, and more.</p>
    </div>
    <button onclick="showModal('workoutModal')" class="btn bp">
      <i class="fa-solid fa-plus"></i>Log Workout
    </button>
  </div>

  <!-- Flash -->
  <% if(flash.success){ %><div class="card-sm" style="padding:13px 16px;margin-bottom:16px;border-color:rgba(20,184,138,.25);display:flex;align-items:center;gap:10px"><i class="fa-solid fa-circle-check" style="color:#34d399"></i><span style="color:#86efac;font-size:.875rem"><%= flash.success[0] %></span></div><% } %>

  <!-- Row 1: 6 expert biometrics -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px" class="fu d1">
    <% const exB=[
      {l:'VO₂ Max',v:v2?v2:'—',u:'ml/kg/min',i:'fa-lungs',c:'#22d3ee',
        tip:v2?(v2>=55?'Elite':v2>=45?'Superior':v2>=35?'Average':'Below Avg'):'No data',
        desc:'Cardiorespiratory fitness ceiling'},
      {l:'HRV',v:hrv?hrv:'—',u:'ms',i:'fa-wave-square',c:'#a78bfa',
        tip:hrv?(hrv>=55?'High resilience':hrv>=40?'Good':hrv>=28?'Moderate':'Low'):'',
        desc:'Autonomic nervous system marker'},
      {l:'Recovery',v:rec?rec:'—',u:'/ 100',i:'fa-bolt',c:'rgba(20,184,138,1)',
        tip:rec?(rec>=75?'Train Hard':rec>=50?'Moderate':'Rest Day'):'',
        desc:'Daily readiness to train'},
      {l:'BMR',v:B,u:'kcal',i:'fa-fire',c:'#fb923c',
        tip:'Resting metabolic rate',
        desc:'Calories burned at complete rest'},
      {l:'TDEE',v:TDEE,u:'kcal',i:'fa-dumbbell',c:'#ef4444',
        tip:'Total daily energy',
        desc:'Total daily caloric expenditure'},
      {l:'Metabolic Age',v:mAge,u:'years',i:'fa-dna',c:'rgba(20,184,138,.8)',
        tip:mAge<(user.age||28)?'Younger ✓':'Needs work',
        desc:'Biological vs chronological age'},
    ]; %>
    <% exB.forEach(function(s,i){ %>
    <div class="card-sm lift fu d<%= i+1 %>" style="padding:14px" title="<%= s.desc %>">
      <div style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;margin-bottom:10px">
        <i class="fa-solid <%= s.i %>" style="color:<%= s.c %>;font-size:13px"></i>
      </div>
      <div class="sn" style="font-size:1.4rem;color:#fff"><%= s.v %></div>
      <div style="color:<%= s.c %>;font-size:.65rem;font-family:'JetBrains Mono',monospace;margin-top:1px"><%= s.u %></div>
      <div class="fd" style="color:#475569;font-size:.65rem;letter-spacing:.07em;text-transform:uppercase;margin-top:6px"><%= s.l %></div>
      <% if(s.tip){ %><span class="badge bg" style="margin-top:6px;font-size:.58rem"><%= s.tip.split(' ').slice(0,2).join(' ') %></span><% } %>
    </div>
    <% }) %>
  </div>

  <!-- Row 2: Wearable trend + Workout bar chart -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card lift fu d2" style="padding:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="fd" style="color:#fff;font-size:.95rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-wave-square" style="color:rgba(20,184,138,.7)"></i>14-Day Wearable Trend
        </h3>
        <div style="display:flex;gap:4px">
          <button onclick="setMetric('steps')" id="m-steps" class="btn bg_" style="padding:5px 10px;font-size:.72rem">Steps</button>
          <button onclick="setMetric('sleep_hours')" id="m-sleep" class="btn bg_" style="padding:5px 10px;font-size:.72rem">Sleep</button>
          <button onclick="setMetric('heart_rate')" id="m-hr" class="btn bg_" style="padding:5px 10px;font-size:.72rem">HR</button>
        </div>
      </div>
      <div style="height:180px"><canvas id="wearChart"></canvas></div>
    </div>

    <div class="card lift fu d3" style="padding:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="fd" style="color:#fff;font-size:.95rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-chart-bar" style="color:#a78bfa"></i>Workout by Type
        </h3>
        <span class="badge bpu"><%= byType.length %> types</span>
      </div>
      <% if(byType.length>0){ %>
      <div style="height:180px"><canvas id="workoutChart"></canvas></div>
      <% } else { %>
      <div style="height:180px;display:flex;align-items:center;justify-content:center;color:#334155">
        <div style="text-align:center">
          <i class="fa-solid fa-chart-bar" style="font-size:2rem;display:block;margin-bottom:10px;color:#1e2d40"></i>
          No workout data. Log a session above.
        </div>
      </div>
      <% } %>
    </div>
  </div>

  <!-- Row 3: Wearable averages + Workout stats + Calorie trend -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">

    <div class="card lift fu d3" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-gauge" style="color:#22d3ee"></i>Wearable Averages
      </h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:5px">
            <span style="color:#64748b">Avg Steps/day</span>
            <span class="fm" style="color:#fff"><%= wAvg.avg_s?Math.round(wAvg.avg_s).toLocaleString():'—' %></span>
          </div>
          <div class="pg"><div class="pf" style="width:<%= wAvg.avg_s?Math.min(100,Math.round(wAvg.avg_s/100)):0 %>%"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:5px">
            <span style="color:#64748b">Avg Sleep</span>
            <span class="fm" style="color:#fff"><%= wAvg.avg_sl?parseFloat(wAvg.avg_sl).toFixed(1):'—' %> hrs</span>
          </div>
          <div class="pg"><div class="pf pf-p" style="width:<%= wAvg.avg_sl?Math.min(100,Math.round(wAvg.avg_sl/9*100)):0 %>%"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:5px">
            <span style="color:#64748b">Avg Heart Rate</span>
            <span class="fm" style="color:#fff"><%= wAvg.avg_hr?parseFloat(wAvg.avg_hr).toFixed(0):'—' %> bpm</span>
          </div>
          <div class="pg"><div class="pf pf-r" style="width:<%= wAvg.avg_hr?Math.min(100,Math.round(wAvg.avg_hr/180*100)):0 %>%"></div></div>
          <div style="color:#334155;font-size:.68rem;margin-top:4px">Range: <%= wAvg.min_hr||'—' %>–<%= wAvg.max_hr||'—' %> bpm · <%= wAvg.cnt||0 %> records</div>
        </div>
      </div>
    </div>

    <div class="card lift fu d4" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-dumbbell" style="color:#a78bfa"></i>Training Summary
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <% [
          {l:'Sessions',v:ws.total_sessions||0,c:'rgba(20,184,138,1)'},
          {l:'Total Min',v:ws.total_minutes?Math.round(ws.total_minutes):0,c:'#22d3ee'},
          {l:'Calories',v:ws.total_calories?Math.round(ws.total_calories).toLocaleString():0,c:'#fb923c'},
          {l:'Avg/Session',v:(ws.avg_duration?parseFloat(ws.avg_duration).toFixed(0):0)+' min',c:'#a78bfa'},
        ].forEach(function(s){ %>
        <div class="card-sm" style="padding:10px">
          <div class="sn" style="font-size:1.2rem;color:<%= s.c %>"><%= s.v %></div>
          <div style="color:#334155;font-size:.68rem;margin-top:2px;font-family:'Syne',sans-serif;text-transform:uppercase;letter-spacing:.06em"><%= s.l %></div>
        </div>
        <% }) %>
      </div>
      <% if(byType.length>0){ %>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
        <% byType.slice(0,3).forEach(function(b){ %>
        <div class="card-sm" style="padding:8px;display:flex;align-items:center;justify-content:space-between">
          <span style="color:#94a3b8;font-size:.8rem;font-weight:600"><%= b.workout_type %></span>
          <div style="display:flex;gap:8px">
            <span class="fm" style="color:#a78bfa;font-size:.75rem"><%= b.td %> min</span>
            <span class="fm" style="color:#fb923c;font-size:.75rem"><%= b.tc %> kcal</span>
            <span class="badge bc" style="padding:1px 6px;font-size:.6rem"><%= b.cnt %>x</span>
          </div>
        </div>
        <% }) %>
      </div>
      <% } %>
    </div>

    <div class="card lift fu d5" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-fire" style="color:#fb923c"></i>Calorie Burn Trend
      </h3>
      <div style="height:160px"><canvas id="calChart"></canvas></div>
    </div>
  </div>

  <!-- Row 4: Lab values + AI Insights -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="card lift fu d5" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-flask" style="color:#22d3ee"></i>Recent Lab Values
      </h3>
      <% if(labT.length>0){ %>
      <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
        <% labT.forEach(function(l){ %>
        <div class="card-sm" style="padding:11px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="color:#fff;font-weight:600;font-size:.85rem"><%= l.test_name %></div>
            <div class="fm" style="color:#334155;font-size:.68rem"><%= new Date(l.test_date).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'}) %></div>
          </div>
          <span class="fm" style="color:#22d3ee;font-weight:700;font-size:1.05rem"><%= l.result_value %></span>
        </div>
        <% }) %>
      </div>
      <% } else { %>
      <p style="color:#334155;text-align:center;padding:32px;font-size:.875rem">No lab data available.</p>
      <% } %>
    </div>

    <div class="card lift fu d6" style="padding:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <h3 class="fd" style="color:#fff;font-size:.9rem;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-brain" style="color:#a78bfa"></i>AI Health Insights
        </h3>
        <span class="badge bpu" style="font-size:.6rem">Beta</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:260px;overflow-y:auto">
        <%
        const ins=[];
        if(v2&&v2<35) ins.push({i:'fa-lungs',c:'#f87171',t:'Low VO₂ Max Detected',b:'Your VO₂ Max of '+v2+' ml/kg/min is below average for your age. Incorporate 2–3 zone-2 cardio sessions/week (60–70% maxHR). Aim for 40+ in 8 weeks.'});
        else if(v2&&v2>=50) ins.push({i:'fa-trophy',c:'#34d399',t:'Elite Cardiovascular Fitness',b:'VO₂ Max '+v2+' puts you in the top 15% of your age group. Maintain with periodised training and deload weeks.'});
        if(hrv&&hrv<32) ins.push({i:'fa-wave-square',c:'#fbbf24',t:'Low HRV — Prioritise Recovery',b:'HRV '+hrv+'ms signals autonomic fatigue. Prioritise sleep, magnesium glycinate, sauna/cold contrast, and skip high-intensity sessions today.'});
        if(wAvg.avg_sl&&parseFloat(wAvg.avg_sl)<6.5) ins.push({i:'fa-moon',c:'#818cf8',t:'Chronic Sleep Debt Risk',b:'Average '+parseFloat(wAvg.avg_sl).toFixed(1)+'h is below 7h minimum. Sleep debt elevates cortisol by 37%, suppresses testosterone, and impairs glucose metabolism.'});
        if((ws.total_sessions||0)<4) ins.push({i:'fa-dumbbell',c:'#fb923c',t:'Low Training Frequency',b:'Only '+(ws.total_sessions||0)+' sessions logged. WHO recommends 150+ min/week of moderate exercise. Start with 20-min daily walks — compound effect is real.'});
        if(mAge>(user.age||28)+4) ins.push({i:'fa-dna',c:'#f87171',t:'Metabolic Age Elevated',b:'Metabolic age '+mAge+' vs biological '+(user.age||28)+'y. Add 3x/week resistance training — muscle mass raises RMR by up to 15%. Consider creatine monohydrate 5g/day.'});
        if(rec&&rec>80) ins.push({i:'fa-bolt',c:'#34d399',t:'Peak Readiness Window',b:'Recovery score '+rec+'/100. Your CNS is primed — ideal day for a PB attempt, VO₂ Max test, or high-intensity interval session. Strike now.'});
        if(wAvg.avg_hr&&parseFloat(wAvg.avg_hr)>85) ins.push({i:'fa-heart-pulse',c:'#f87171',t:'Elevated Resting HR Trend',b:'Average HR '+parseFloat(wAvg.avg_hr).toFixed(0)+'bpm is persistently elevated. Rule out anaemia, dehydration, and overtraining. Consider a 48h rest block.'});
        if(ins.length===0) ins.push({i:'fa-circle-check',c:'#34d399',t:'Metrics Looking Healthy',b:'All tracked indicators are within acceptable ranges. Keep logging data — personalised insights improve with more data points.'});
        ins.forEach(function(n){ %>
        <div class="card-sm" style="padding:12px;border-left:2px solid <%= n.c %>25">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <i class="fa-solid <%= n.i %>" style="color:<%= n.c %>;font-size:13px;flex-shrink:0"></i>
            <span class="fd" style="color:#fff;font-size:.82rem;font-weight:600"><%= n.t %></span>
          </div>
          <p style="color:#64748b;font-size:.78rem;line-height:1.6"><%= n.b %></p>
        </div>
        <% }) %>
      </div>
    </div>
  </div>

  <!-- Sleep distribution -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="fu d6">
    <div class="card lift" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-moon" style="color:#818cf8"></i>Sleep Distribution
      </h3>
      <div style="height:160px"><canvas id="sleepChart"></canvas></div>
    </div>
    <div class="card lift" style="padding:20px">
      <h3 class="fd" style="color:#fff;font-size:.9rem;margin-bottom:14px;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-heart-pulse" style="color:#f87171"></i>Heart Rate Zones
      </h3>
      <div style="height:160px"><canvas id="hrZoneChart"></canvas></div>
    </div>
  </div>
</div>

<!-- Workout Logger Modal -->
<div id="workoutModal" class="modal-bg" style="display:none" onclick="if(event.target===this)hideModal('workoutModal')">
  <div class="modal">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h3 class="fd" style="color:#fff;font-size:1.2rem;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-dumbbell" style="color:rgba(20,184,138,.7)"></i>Log a Workout
      </h3>
      <button onclick="hideModal('workoutModal')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:1.2rem">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="fd" style="color:#64748b;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Workout Type</label>
        <select id="wt" class="inp">
          <option>Running</option><option>Cycling</option><option>Swimming</option>
          <option>Weight Training</option><option>HIIT</option><option>Yoga</option>
          <option>Walking</option><option>Crossfit</option><option>Sports</option><option>Other</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label class="fd" style="color:#64748b;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Duration (min)</label>
          <input type="number" id="wd" class="inp" placeholder="45" min="1"/>
        </div>
        <div>
          <label class="fd" style="color:#64748b;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Calories Burned</label>
          <input type="number" id="wc" class="inp" placeholder="350" min="0"/>
        </div>
      </div>
      <div>
        <label class="fd" style="color:#64748b;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Date</label>
        <input type="date" id="wdate" class="inp" value="<%= new Date().toISOString().split('T')[0] %>"/>
      </div>
      <button onclick="logWorkout()" class="btn bp" style="width:100%;padding:13px">
        <i class="fa-solid fa-circle-check"></i>Save Workout
      </button>
      <p id="wlog-status" style="text-align:center;font-size:.8rem;color:rgba(20,184,138,.7);display:none"></p>
    </div>
  </div>
</div>

<script>
// ── Chart init ──────────────────────────────────────────────────────────────
const W14 = <%- w14 %>;
const WK14 = <%- wk14 %>;
const BY_TYPE = <%- byTypeJSON %>;
const SLEEP_D = <%- sleepD %>;
const HR_D = <%- hrD %>;

const COLORS=['rgba(20,184,138,.85)','rgba(6,182,212,.85)','rgba(139,92,246,.85)','rgba(251,191,36,.85)','rgba(249,115,22,.85)','rgba(236,72,153,.85)'];
const chartDefaults={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#64748b',font:{family:'Outfit',size:11}}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#475569',font:{family:'Outfit',size:10}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#475569',font:{family:'Outfit',size:10}}}}};

let wearChart,calChart;
// Wearable trend
function buildWearChart(metric){
  if(wearChart) wearChart.destroy();
  const cols={'steps':'rgba(20,184,138,1)','sleep_hours':'rgba(139,92,246,1)','heart_rate':'rgba(239,68,68,1)'};
  const labs={'steps':'Steps','sleep_hours':'Sleep (hrs)','heart_rate':'Heart Rate (bpm)'};
  const ctx=document.getElementById('wearChart').getContext('2d');
  wearChart=new Chart(ctx,{type:'line',data:{
    labels:W14.map(r=>new Date(r.d||r.record_date).toLocaleDateString('en-IN',{month:'short',day:'numeric'})),
    datasets:[{label:labs[metric],data:W14.map(r=>r[metric]),borderColor:cols[metric],
      backgroundColor:cols[metric].replace('1)','0.1)'),borderWidth:2.5,pointRadius:4,
      pointBackgroundColor:cols[metric],fill:true,tension:.4}]
  },options:{...chartDefaults}});
}
function setMetric(m){
  ['steps','sleep_hours','heart_rate'].forEach(x=>{
    document.getElementById('m-'+x).className='btn '+(m===x?'bp':'bg_');
    document.getElementById('m-'+x).style.padding='5px 10px';
    document.getElementById('m-'+x).style.fontSize='.72rem';
  });
  buildWearChart(m);
}
if(W14.length) buildWearChart('steps');

// Workout by type
if(BY_TYPE.length && document.getElementById('workoutChart')){
  const ctx=document.getElementById('workoutChart').getContext('2d');
  new Chart(ctx,{type:'bar',data:{
    labels:BY_TYPE.map(b=>b.workout_type),
    datasets:[
      {label:'Duration (min)',data:BY_TYPE.map(b=>b.td),backgroundColor:COLORS,borderRadius:8,borderSkipped:false},
      {label:'Calories',data:BY_TYPE.map(b=>b.tc),backgroundColor:COLORS.map(c=>c.replace('.85','.35')),borderRadius:8,borderSkipped:false}
    ]
  },options:{...chartDefaults}});
}

// Calorie trend
if(WK14.length && document.getElementById('calChart')){
  const ctx=document.getElementById('calChart').getContext('2d');
  new Chart(ctx,{type:'bar',data:{
    labels:WK14.map(r=>new Date(r.d).toLocaleDateString('en-IN',{month:'short',day:'numeric'})),
    datasets:[{label:'Calories',data:WK14.map(r=>r.cal||0),backgroundColor:'rgba(249,115,22,.75)',borderRadius:6,borderSkipped:false}]
  },options:{...chartDefaults,plugins:{legend:{display:false}}}});
}

// Sleep distribution
if(SLEEP_D.length && document.getElementById('sleepChart')){
  const ctx=document.getElementById('sleepChart').getContext('2d');
  new Chart(ctx,{type:'doughnut',data:{
    labels:SLEEP_D.map(s=>(s.sl||0)+'h'),
    datasets:[{data:SLEEP_D.map(s=>s.cnt),backgroundColor:COLORS,borderWidth:2,borderColor:'#030d1a'}]
  },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#64748b',font:{family:'Outfit',size:10}}}}}});
}

// HR zone donut
if(HR_D.length && document.getElementById('hrZoneChart')){
  const ctx=document.getElementById('hrZoneChart').getContext('2d');
  new Chart(ctx,{type:'doughnut',data:{
    labels:HR_D.map(h=>h.zone),
    datasets:[{data:HR_D.map(h=>h.cnt),backgroundColor:['rgba(20,184,138,.8)','rgba(6,182,212,.8)','rgba(251,191,36,.8)','rgba(239,68,68,.8)'],borderWidth:2,borderColor:'#030d1a'}]
  },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#64748b',font:{family:'Outfit',size:10}}}}}});
}

// Modal helpers
function showModal(id){document.getElementById(id).style.display='flex';}
function hideModal(id){document.getElementById(id).style.display='none';}

// Workout logger
async function logWorkout(){
  const payload={workout_type:document.getElementById('wt').value,duration_minutes:document.getElementById('wd').value,calories_burned:document.getElementById('wc').value,workout_date:document.getElementById('wdate').value};
  if(!payload.duration_minutes){toast('Enter duration first','e');return;}
  const st=document.getElementById('wlog-status');
  st.style.display='block';st.textContent='Saving...';
  try{
    const r=await fetch('/log-workout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.ok){toast(d.message);st.textContent='✓ Saved!';setTimeout(()=>{hideModal('workoutModal');window.location.reload();},1200);}
    else{toast(d.message,'e');st.textContent=d.message;}
  }catch(e){toast('Network error','e');}
}
</script>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// uploads.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/uploads.ejs",
HEAD("Health Vault") + `
<body>
${NAV('up')}
${TOAST}
<div style="position:relative;z-index:1;padding:72px 20px 48px;max-width:1280px;margin:0 auto">

  <div class="fu" style="display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:24px">
    <div>
      <h1 class="fd" style="font-size:2rem;color:#fff;font-weight:800">Health Document Vault</h1>
      <p style="color:#475569;margin-top:4px">Prescriptions, lab reports, scans — encrypted and accessible anywhere in India.</p>
    </div>
    <button onclick="document.getElementById('uploadModal').style.display='flex'" class="btn bp">
      <i class="fa-solid fa-cloud-arrow-up"></i>Upload Document
    </button>
  </div>

  <!-- Flash -->
  <% if(flash&&flash.success&&flash.success[0]){ %>
  <div class="card-sm" style="padding:13px 16px;margin-bottom:16px;border-color:rgba(20,184,138,.25);display:flex;align-items:center;gap:10px">
    <i class="fa-solid fa-circle-check" style="color:#34d399"></i>
    <span style="color:#86efac;font-size:.875rem"><%= flash.success[0] %></span>
  </div>
  <% } %>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px" class="fu d1">
    <% const pdfs=uploads.filter(u=>u.original_name&&u.original_name.toLowerCase().endsWith('.pdf'));
       const imgs=uploads.filter(u=>!u.original_name||!u.original_name.toLowerCase().endsWith('.pdf'));
       const cats=[...new Set(uploads.map(u=>u.doc_type))]; %>
    <% [{l:'Total Documents',v:uploads.length,i:'fa-folder-open',c:'rgba(20,184,138,1)'},{l:'PDF Reports',v:pdfs.length,i:'fa-file-pdf',c:'#f87171'},{l:'Images / Scans',v:imgs.length,i:'fa-file-image',c:'#60a5fa'},{l:'Categories',v:cats.length,i:'fa-tags',c:'#a78bfa'}].forEach(function(s){ %>
    <div class="card-sm lift" style="padding:16px">
      <i class="fa-solid <%= s.i %>" style="color:<%= s.c %>;font-size:1.2rem;display:block;margin-bottom:8px"></i>
      <div class="sn" style="font-size:1.5rem;color:#fff"><%= s.v %></div>
      <div style="color:#334155;font-size:.72rem;margin-top:2px;font-family:'Syne',sans-serif;text-transform:uppercase;letter-spacing:.06em"><%= s.l %></div>
    </div>
    <% }) %>
  </div>

  <!-- Document grid -->
  <% if(uploads.length>0){ %>
  <!-- Filter row -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap" class="fu d2">
    <button class="tab on" onclick="filterDocs('')" id="f-all">All</button>
    <% cats.forEach(function(cat){ %>
    <button class="tab" onclick="filterDocs('<%= cat %>')" id="f-<%= cat.replace(/[^a-z]/gi,'') %>"><%= cat %></button>
    <% }) %>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px" class="fu d3" id="docGrid">
    <% uploads.forEach(function(u){ %>
    <div class="card-sm lift" style="display:flex;flex-direction:column;gap:12px;padding:0;overflow:hidden" data-cat="<%= u.doc_type %>">
      <!-- Preview -->
      <div style="height:120px;background:rgba(7,16,32,.6);display:flex;align-items:center;justify-content:center;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.04)">
        <% if(u.original_name&&!u.original_name.toLowerCase().endsWith('.pdf')){ %>
        <img src="<%= u.file_url %>" style="height:100%;width:100%;object-fit:cover"
          onerror="this.parentNode.innerHTML='<div style=\\'text-align:center\\'><i class=\\'fa-solid fa-image\\' style=\\'color:#334155;font-size:2rem;display:block;margin-bottom:6px\\'></i><span style=\\'color:#1e2d40;font-size:.7rem\\'>Preview unavailable</span></div>'"/>
        <% } else { %>
        <div style="text-align:center">
          <i class="fa-solid fa-file-pdf" style="color:#f87171;font-size:2.2rem;display:block;margin-bottom:6px"></i>
          <span style="color:#475569;font-size:.72rem">PDF Document</span>
        </div>
        <% } %>
      </div>
      <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:start;justify-content:space-between;gap:6px">
          <div style="color:#fff;font-weight:600;font-size:.85rem;word-break:break-all;line-height:1.3">
            <%= (u.original_name||'Unnamed').substring(0,32) %><%= (u.original_name||'').length>32?'...':'' %>
          </div>
          <span class="badge bg" style="flex-shrink:0;font-size:.6rem"><%= u.doc_type||'Other' %></span>
        </div>
        <% if(u.doc_date){ %><div class="fm" style="color:#475569;font-size:.72rem"><i class="fa-solid fa-calendar" style="margin-right:4px;color:#334155"></i><%= new Date(u.doc_date).toLocaleDateString('en-IN',{month:'short',day:'numeric',year:'numeric'}) %></div><% } %>
        <% if(u.notes){ %><div style="color:#475569;font-size:.75rem;font-style:italic;line-height:1.4"><%= u.notes.substring(0,60) %><%= u.notes.length>60?'...':'' %></div><% } %>
        <div class="fm" style="color:#1e2d40;font-size:.65rem">Added <%= new Date(u.uploaded_at).toLocaleDateString('en-IN') %></div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <a href="<%= u.file_url %>" target="_blank" class="btn bp" style="flex:1;padding:8px;font-size:.75rem"><i class="fa-solid fa-eye"></i>View</a>
          <a href="<%= u.file_url %>" download class="btn bg_" style="padding:8px 10px;font-size:.75rem"><i class="fa-solid fa-download"></i></a>
          <form method="POST" action="/uploads/delete" style="display:inline" onsubmit="return confirm('Delete this document permanently?')">
            <input type="hidden" name="upload_id" value="<%= u.upload_id %>"/>
            <button type="submit" class="btn bd" style="padding:8px 10px"><i class="fa-solid fa-trash" style="font-size:.75rem"></i></button>
          </form>
        </div>
      </div>
    </div>
    <% }) %>
  </div>
  <% } else { %>
  <div class="card" style="padding:64px;text-align:center" class="fu d2">
    <div style="width:72px;height:72px;background:rgba(20,184,138,.08);border:1px solid rgba(20,184,138,.15);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
      <i class="fa-solid fa-vault" style="color:rgba(20,184,138,.5);font-size:1.8rem"></i>
    </div>
    <h3 class="fd" style="color:#fff;font-size:1.2rem;margin-bottom:8px">Your Vault is Empty</h3>
    <p style="color:#475569;font-size:.875rem;max-width:360px;margin:0 auto 24px;line-height:1.6">Upload prescriptions, lab reports, discharge summaries, or any health document. One tap — accessible to any doctor, anywhere.</p>
    <button onclick="document.getElementById('uploadModal').style.display='flex'" class="btn bp">
      <i class="fa-solid fa-cloud-arrow-up"></i>Upload Your First Document
    </button>
  </div>
  <% } %>
</div>

<!-- Upload Modal -->
<div id="uploadModal" class="modal-bg" style="display:none" onclick="if(event.target===this)this.style.display='none'">
  <div class="modal">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h3 class="fd" style="color:#fff;font-size:1.1rem;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-cloud-arrow-up" style="color:rgba(20,184,138,.7)"></i>Upload Health Document
      </h3>
      <button onclick="document.getElementById('uploadModal').style.display='none'" style="background:none;border:none;color:#475569;cursor:pointer;font-size:1.1rem">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <form method="POST" action="/uploads" enctype="multipart/form-data" style="display:flex;flex-direction:column;gap:16px">
      <!-- Drop zone -->
      <label for="fileInput" style="display:block;cursor:pointer">
        <div id="dropZone" style="background:rgba(7,16,32,.6);border:2px dashed rgba(20,184,138,.25);border-radius:14px;padding:32px;text-align:center;transition:all .2s">
          <i class="fa-solid fa-cloud-arrow-up" style="color:rgba(20,184,138,.5);font-size:2rem;display:block;margin-bottom:10px"></i>
          <div style="color:#94a3b8;font-size:.875rem;font-weight:600;margin-bottom:4px">Drop file here or click to browse</div>
          <div style="color:#334155;font-size:.75rem">PDF, JPG, PNG — max 15MB</div>
          <div id="fname" style="color:rgba(20,184,138,.8);font-size:.8rem;margin-top:8px;display:none;font-family:'JetBrains Mono',monospace"></div>
        </div>
        <input type="file" id="fileInput" name="health_file" required accept=".pdf,.jpg,.jpeg,.png" style="display:none"
          onchange="document.getElementById('fname').textContent='📎 '+this.files[0].name;document.getElementById('fname').style.display='block';document.getElementById('dropZone').style.borderColor='rgba(20,184,138,.5)'"/>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Document Type</label>
          <select name="doc_type" class="inp">
            <option>Prescription</option><option>Lab Report</option><option>Scan / Imaging</option>
            <option>Discharge Summary</option><option>Vaccination</option><option>Insurance</option><option>Other</option>
          </select>
        </div>
        <div>
          <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Document Date</label>
          <input type="date" name="doc_date" class="inp"/>
        </div>
      </div>
      <div>
        <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Notes (optional)</label>
        <textarea name="notes" rows="2" placeholder="e.g. Post-op report from Dr. Kapoor, Fortis Hospital, Chennai" class="inp" style="resize:none"></textarea>
      </div>
      <button type="submit" class="btn bp" style="width:100%;padding:13px">
        <i class="fa-solid fa-lock"></i>Securely Upload to Vault
      </button>
    </form>
  </div>
</div>

<script>
function filterDocs(cat){
  document.querySelectorAll('[id^="f-"]').forEach(b=>b.classList.remove('on'));
  document.getElementById(cat?'f-'+cat.replace(/[^a-z]/gi,''):'f-all').classList.add('on');
  document.querySelectorAll('#docGrid > div').forEach(d=>{
    d.style.display=(!cat||d.dataset.cat===cat)?'':'none';
  });
}
</script>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// privacy.ejs
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/views/privacy.ejs",
HEAD("Privacy Controls") + `
<body>
${NAV('priv')}
${TOAST}
<div style="position:relative;z-index:1;padding:72px 20px 48px;max-width:1280px;margin:0 auto">

  <div class="fu" style="display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:24px">
    <div>
      <h1 class="fd" style="font-size:2rem;color:#fff;font-weight:800">Privacy Controls</h1>
      <p style="color:#475569;margin-top:4px">Sovereign control over your health data. DPDP Act compliant. Revoke access instantly.</p>
    </div>
    <button onclick="document.getElementById('grantModal').style.display='flex'" class="btn bp">
      <i class="fa-solid fa-key"></i>Grant New Access
    </button>
  </div>

  <!-- Flash -->
  <% const msg=flash&&(flash.success||flash.error); %>
  <% if(msg&&(msg[0])){ %>
  <div class="card-sm" style="padding:13px 16px;margin-bottom:16px;border-color:rgba(<%= flash.error?'239,68,68':'20,184,138' %>,.25);display:flex;align-items:center;gap:10px">
    <i class="fa-solid fa-<%= flash.error?'triangle-exclamation':'circle-check' %>" style="color:<%= flash.error?'#f87171':'#34d399' %>"></i>
    <span style="color:<%= flash.error?'#fca5a5':'#86efac' %>;font-size:.875rem"><%= (flash.success||flash.error)[0] %></span>
  </div>
  <% } %>

  <!-- Status cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px" class="fu d1">
    <% const active=accessRecords.filter(r=>new Date(r.expiry_date)>new Date());
       const expired=accessRecords.filter(r=>new Date(r.expiry_date)<=new Date()); %>
    <% [{l:'Active Grants',v:active.length,i:'fa-circle-check',c:'rgba(20,184,138,1)'},{l:'Expired',v:expired.length,i:'fa-circle-xmark',c:'#f87171'},{l:'Encryption',v:'256-bit',i:'fa-lock',c:'#a78bfa'},{l:'Standard',v:'DPDP Act',i:'fa-shield-halved',c:'#22d3ee'}].forEach(function(s){ %>
    <div class="card-sm lift" style="padding:16px">
      <i class="fa-solid <%= s.i %>" style="color:<%= s.c %>;font-size:1.2rem;display:block;margin-bottom:8px"></i>
      <div class="sn" style="font-size:1.4rem;color:#fff"><%= s.v %></div>
      <div style="color:#334155;font-size:.7rem;margin-top:2px;font-family:'Syne',sans-serif;text-transform:uppercase;letter-spacing:.06em"><%= s.l %></div>
    </div>
    <% }) %>
  </div>

  <!-- Info banner -->
  <div class="card-sm" style="padding:14px 18px;margin-bottom:18px;border-color:rgba(20,184,138,.15);display:flex;align-items:center;gap:14px" class="fu d2">
    <div style="width:36px;height:36px;background:rgba(20,184,138,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <i class="fa-solid fa-shield-halved" style="color:rgba(20,184,138,.7)"></i>
    </div>
    <p style="color:#64748b;font-size:.85rem;line-height:1.5">All data sharing is encrypted at rest and in transit. Grants can be revoked at any time — takes effect immediately across all connected hospital systems.</p>
  </div>

  <!-- Access table -->
  <div class="card" style="overflow:hidden;margin-bottom:18px" class="fu d3">
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;justify-content:space-between">
      <h3 class="fd" style="color:#fff;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-key" style="color:rgba(20,184,138,.7)"></i>Data Access Grants</h3>
      <span class="badge bgr"><%= accessRecords.length %> total</span>
    </div>
    <% if(accessRecords.length>0){ %>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead><tr><th>Shared With</th><th>Permission</th><th>Expiry Date</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
        <tbody>
          <% accessRecords.forEach(function(r){ %>
          <% const exp=new Date(r.expiry_date)<=new Date(); %>
          <% const pl=(r.permission_level||'read').toLowerCase(); %>
          <tr style="<%= exp?'opacity:.45':'' %>">
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,rgba(20,184,138,.3),rgba(6,182,212,.2));display:flex;align-items:center;justify-content:center;color:rgba(20,184,138,.9);font-weight:700;font-size:.85rem;flex-shrink:0">
                  <%= (r.shared_with||'?').charAt(0).toUpperCase() %>
                </div>
                <span style="color:#fff;font-weight:600"><%= r.shared_with %></span>
              </div>
            </td>
            <td>
              <span class="badge <%= pl==='admin'?'br':pl==='write'?'bb':'bg' %>">
                <i class="fa-solid <%= pl==='admin'?'fa-crown':pl==='write'?'fa-pen':'fa-eye' %>"></i>
                <%= r.permission_level||'read' %>
              </span>
            </td>
            <td class="fm" style="font-size:.78rem"><%= new Date(r.expiry_date).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'}) %></td>
            <td>
              <% if(exp){ %>
              <span class="badge br"><span style="width:6px;height:6px;border-radius:50%;background:#f87171;display:inline-block"></span>Expired</span>
              <% } else { %>
              <span class="badge bg"><span class="pdot"></span>Active</span>
              <% } %>
            </td>
            <td style="text-align:right">
              <form method="POST" action="/privacy/revoke" style="display:inline" onsubmit="return confirm('Revoke access for <%= r.shared_with %>? This is immediate and cannot be undone.')">
                <input type="hidden" name="access_id" value="<%= r.access_id %>"/>
                <button type="submit" class="btn bd" style="padding:7px 12px;font-size:.75rem"><i class="fa-solid fa-ban"></i>Revoke</button>
              </form>
            </td>
          </tr>
          <% }) %>
        </tbody>
      </table>
    </div>
    <% } else { %>
    <div style="text-align:center;padding:48px;color:#334155">
      <i class="fa-solid fa-shield-halved" style="font-size:2.5rem;display:block;margin-bottom:12px;color:#1e2d40"></i>
      <p class="fd" style="color:#475569">No access grants. Your data is completely private.</p>
    </div>
    <% } %>
  </div>

  <!-- Privacy tips -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px" class="fu d4">
    <% [
      {i:'fa-user-doctor',c:'#22d3ee',t:'Share with Doctors',b:'Grant read-only access to your treating physician. Set a short expiry — 7–30 days is sufficient for a consultation.'},
      {i:'fa-building-columns',c:'rgba(20,184,138,1)',t:'Hospital Access',b:'For hospital admissions, grant write access so the care team can add records. Revoke on discharge.'},
      {i:'fa-file-contract',c:'#a78bfa',t:'Insurance Claims',b:'Share read-only access with your insurer for the claim period. Use expiry dates to auto-limit access scope.'},
    ].forEach(function(tip){ %>
    <div class="card-sm lift" style="padding:16px">
      <i class="fa-solid <%= tip.i %>" style="color:<%= tip.c %>;font-size:1.1rem;display:block;margin-bottom:10px"></i>
      <div class="fd" style="color:#fff;font-weight:600;font-size:.875rem;margin-bottom:6px"><%= tip.t %></div>
      <p style="color:#475569;font-size:.78rem;line-height:1.6"><%= tip.b %></p>
    </div>
    <% }) %>
  </div>
</div>

<!-- Grant Access Modal -->
<div id="grantModal" class="modal-bg" style="display:none" onclick="if(event.target===this)this.style.display='none'">
  <div class="modal">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h3 class="fd" style="color:#fff;font-size:1.1rem;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-key" style="color:rgba(20,184,138,.7)"></i>Grant Data Access
      </h3>
      <button onclick="document.getElementById('grantModal').style.display='none'" style="background:none;border:none;color:#475569;cursor:pointer;font-size:1.1rem">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <form method="POST" action="/privacy/grant" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Share With</label>
        <input type="text" name="shared_with" placeholder="e.g. Dr. Priya Nair / Apollo Hospitals / ManipalCigna" required class="inp"/>
      </div>
      <div>
        <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Permission Level</label>
        <select name="permission_level" class="inp">
          <option value="read">Read Only — View records</option>
          <option value="write">Read + Write — Add records</option>
          <option value="admin">Full Access — Admin level</option>
        </select>
      </div>
      <div>
        <label class="fd" style="color:#64748b;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">Expiry Date</label>
        <input type="date" name="expiry_date" required class="inp" min="<%= new Date().toISOString().split('T')[0] %>"/>
        <p style="color:#334155;font-size:.72rem;margin-top:4px">Access automatically expires on this date — no manual revocation needed.</p>
      </div>
      <button type="submit" class="btn bp" style="width:100%;padding:13px"><i class="fa-solid fa-key"></i>Grant Access</button>
    </form>
  </div>
</div>
</body></html>`);

// ════════════════════════════════════════════════════════════════════════════
// SQL helper
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/SETUP_DB.sql",
`-- Run this after your main schema to add supporting tables:
CREATE TABLE IF NOT EXISTS UPLOADS (
  upload_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  doc_type     VARCHAR(100) DEFAULT 'Other',
  doc_date     DATE,
  notes        TEXT,
  file_url     VARCHAR(500),
  uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

-- Sample data to populate dashboards (replace user_id as needed):
INSERT IGNORE INTO WEARABLE_DATA (user_id,steps,sleep_hours,heart_rate,record_date) VALUES
(1,8400,7.2,64,'2024-12-01'),(1,9200,6.8,67,'2024-12-02'),(1,11000,8.1,61,'2024-12-03'),
(1,7800,6.5,70,'2024-12-04'),(1,10500,7.8,63,'2024-12-05'),(1,6200,5.9,74,'2024-12-06'),(1,9800,7.5,65,'2024-12-07');

INSERT IGNORE INTO WORKOUT (user_id,workout_type,duration_minutes,calories_burned,workout_date) VALUES
(1,'Running',45,420,'2024-12-01'),(1,'Weight Training',60,380,'2024-12-03'),
(1,'Cycling',50,460,'2024-12-05'),(1,'HIIT',30,350,'2024-12-07'),
(1,'Running',40,390,'2024-11-28'),(1,'Yoga',60,180,'2024-11-25');

INSERT IGNORE INTO MEDICATION (user_id,medication_name,dosage,start_date,end_date) VALUES
(1,'Metformin 500mg','500mg twice daily','2024-11-01','2025-02-28'),
(1,'Vitamin D3','2000 IU daily','2024-10-01','2025-03-31');
`);

// ════════════════════════════════════════════════════════════════════════════
// .gitignore
// ════════════════════════════════════════════════════════════════════════════
fs.writeFileSync("HealthApp/.gitignore",
`node_modules/
public/uploads/
.env
*.log
`);

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   🫀  NationalHealthID v3.0 — Complete scaffold generated!       ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1.  cd HealthApp                                                ║
║  2.  npm install                                                 ║
║  3.  MySQL: ensure health_fragmentation_db + all 7 tables exist  ║
║      Optional: run SETUP_DB.sql for uploads table + sample data  ║
║  4.  node server.js                                              ║
║  5.  Open → http://localhost:3000                                ║
║                                                                  ║
║  Pages built:                                                    ║
║   /           Premium glassmorphic login — Health ID auth        ║
║   /dashboard  Score ring · 6 vitals · wearable trend chart       ║
║               Live meds · Recent clinic & lab panels             ║
║   /history    Timeline · Labs table · Meds cards                 ║
║               Workouts log · Documents · Live search filter      ║
║   /analytics  VO₂ · HRV · BMR · TDEE · Metabolic Age            ║
║               4 live Chart.js charts · AI insight engine          ║
║               Workout logger modal → POST → live reload          ║
║   /uploads    Document Vault · Preview · Category filter          ║
║               Drag-and-drop modal upload · Delete                 ║
║   /privacy    Grant/Revoke table · Status badges                  ║
║               Grant modal · Privacy tips                          ║
║                                                                  ║
║  API endpoints:                                                   ║
║   GET /api/wearable  — 14-day trend JSON                         ║
║   GET /api/workout   — 14-day workout JSON                       ║
║   GET /api/stats     — Live health score JSON                    ║
║   POST /log-workout  — AJAX workout logger (no page reload)      ║
╚══════════════════════════════════════════════════════════════════╝
`);
