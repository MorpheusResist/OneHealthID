const express = require('express');
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
  user:'root',password:'root',waitForConnections:true,connectionLimit:10
});

// Auto-create optional tables
(async()=>{
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS UPLOADS(
      upload_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,original_name VARCHAR(255),
      doc_type VARCHAR(100) DEFAULT 'Other',doc_date DATE,notes TEXT,
      file_url VARCHAR(500),uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES USER(user_id) ON DELETE CASCADE)`);
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
    const [hrD]      =await pool.execute(`SELECT CASE WHEN heart_rate<60 THEN '<60 Athlete' WHEN heart_rate<70 THEN '60-69 Optimal' WHEN heart_rate<80 THEN '70-79 Normal' ELSE '80+ Elevated' END zone,COUNT(*) cnt FROM WEARABLE_DATA WHERE user_id=? GROUP BY zone`,[uid]);
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

app.listen(3000,()=>console.log('\n🫀  NationalHealthID → http://localhost:3000\n'));
