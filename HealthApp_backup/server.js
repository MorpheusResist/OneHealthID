const express = require('express');
const session = require('express-session');
const mysql   = require('mysql2/promise');
const path    = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'hdf_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

// ── DB Pool ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  database: 'health_fragmentation_db',
  user: 'root',
  password: 'root',
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Auth Guard ─────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userid) return res.redirect('/');
  next();
}

// ── GET / (Login) ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.userid) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

// ── POST /login ────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id || isNaN(parseInt(user_id))) {
    return res.render('login', { error: 'Please enter a valid numeric User ID.' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM USER WHERE user_id = ?',
      [parseInt(user_id)]
    );
    if (rows.length === 0) {
      return res.render('login', { error: 'No account found for User ID: ' + user_id });
    }
    req.session.userid  = rows[0].user_id;
    req.session.username = rows[0].name;
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Database error: ' + err.message });
  }
});

// ── GET /logout ────────────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── GET /dashboard ─────────────────────────────────────────────────────────
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userid;
    const [[user]]      = await pool.execute('SELECT * FROM USER WHERE user_id = ?', [uid]);
    const [wearable]    = await pool.execute(
      `SELECT * FROM WEARABLE_DATA
       WHERE wearable_id = (
         SELECT wearable_id FROM WEARABLE_DATA
         WHERE user_id = ? ORDER BY record_date DESC LIMIT 1
       )`,
      [uid]
    );
    const [medications] = await pool.execute(
      'SELECT * FROM MEDICATION WHERE user_id = ? AND end_date > CURRENT_DATE ORDER BY end_date ASC',
      [uid]
    );
    res.render('dashboard', {
      user,
      wearable: wearable[0] || null,
      medications
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── GET /history ───────────────────────────────────────────────────────────
app.get('/history', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userid;
    const [clinicRecords] = await pool.execute(
      `SELECT 'clinic' AS source, record_id AS id, clinic_name AS location,
              doctor_name AS provider, diagnosis AS detail,
              medication_prescribed AS extra, visit_date AS event_date
       FROM CLINIC_RECORDS WHERE user_id = ?`,
      [uid]
    );
    const [labReports] = await pool.execute(
      `SELECT 'lab' AS source, report_id AS id, lab_name AS location,
              test_name AS provider, result_value AS detail,
              NULL AS extra, test_date AS event_date
       FROM LAB_REPORT WHERE user_id = ?`,
      [uid]
    );
    const timeline = [...clinicRecords, ...labReports].sort(
      (a, b) => new Date(b.event_date) - new Date(a.event_date)
    );
    res.render('history', { timeline, user: { name: req.session.username } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── GET /analytics ─────────────────────────────────────────────────────────
app.get('/analytics', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userid;
    const [[workoutStats]] = await pool.execute(
      `SELECT
         SUM(duration_minutes)  AS total_minutes,
         SUM(calories_burned)   AS total_calories,
         COUNT(*)               AS total_sessions,
         AVG(duration_minutes)  AS avg_duration
       FROM WORKOUT WHERE user_id = ?`,
      [uid]
    );
    const [workoutByType] = await pool.execute(
      `SELECT workout_type,
              SUM(duration_minutes) AS total_duration,
              SUM(calories_burned)  AS total_calories
       FROM WORKOUT WHERE user_id = ?
       GROUP BY workout_type ORDER BY total_duration DESC`,
      [uid]
    );
    const [[wearableAvg]] = await pool.execute(
      `SELECT AVG(steps) AS avg_steps, AVG(sleep_hours) AS avg_sleep,
              AVG(heart_rate) AS avg_hr
       FROM WEARABLE_DATA WHERE user_id = ?`,
      [uid]
    );
    res.render('analytics', {
      workoutStats,
      workoutByType,
      wearableAvg,
      user: { name: req.session.username }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── GET /privacy ───────────────────────────────────────────────────────────
app.get('/privacy', requireAuth, async (req, res) => {
  try {
    const uid = req.session.userid;
    const [accessRecords] = await pool.execute(
      'SELECT * FROM DATA_ACCESS WHERE user_id = ? ORDER BY expiry_date ASC',
      [uid]
    );
    res.render('privacy', {
      accessRecords,
      user: { name: req.session.username }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── POST /privacy/revoke ───────────────────────────────────────────────────
app.post('/privacy/revoke', requireAuth, async (req, res) => {
  try {
    const { access_id } = req.body;
    const uid = req.session.userid;
    await pool.execute(
      'DELETE FROM DATA_ACCESS WHERE access_id = ? AND user_id = ?',
      [access_id, uid]
    );
    res.redirect('/privacy');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅  HealthApp running → http://localhost:${PORT}`);
});
