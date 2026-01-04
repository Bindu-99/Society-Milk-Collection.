const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Load configuration
const CONFIG_PATH = path.join(__dirname, 'config.json');
let CONFIG = {
  limits: {
    Cow: { fat: { min: 3.0, max: 6.0 }, snf: { min: 7.5, max: 10.0 } },
    Buffalo: { fat: { min: 5.0, max: 9.0 }, snf: { min: 8.0, max: 11.0 } }
  },
  pricing: {
    Cow: { base: 20, fat_factor: 5.0, snf_factor: 2.0 },
    Buffalo: { base: 25, fat_factor: 6.0, snf_factor: 2.5 }
  }
};
try {
  if (fs.existsSync(CONFIG_PATH)) {
    CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not read config.json, using defaults.', e);
}

// Database setup
const DB_PATH = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    session TEXT NOT NULL CHECK (session IN ('Morning','Evening')),
    farmer_id TEXT NOT NULL,
    farmer_name TEXT,
    milk_type TEXT NOT NULL CHECK (milk_type IN ('Cow','Buffalo')),
    fat REAL NOT NULL,
    snf REAL NOT NULL,
    quantity REAL NOT NULL,
    rate_per_liter REAL NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(date, session, farmer_id, milk_type)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' }
}));

// Helpers
function isNumber(n) {
  return typeof n === 'number' && !isNaN(n) && isFinite(n);
}

function calcRate(milkType, fat, snf) {
  const cfg = CONFIG.pricing[milkType];
  return cfg.base + fat * cfg.fat_factor + snf * cfg.snf_factor;
}

function validatePayload(p) {
  const errors = [];
  const sessions = ['Morning', 'Evening'];
  const types = ['Cow', 'Buffalo'];

  if (!p.date) errors.push('date is required');
  if (!sessions.includes(p.session)) errors.push('session must be Morning or Evening');
  if (!p.farmer_id) errors.push('farmer_id is required');
  if (!types.includes(p.milk_type)) errors.push('milk_type must be Cow or Buffalo');

  const fat = Number(p.fat);
  const snf = Number(p.snf);
  const quantity = Number(p.quantity);

  if (!isNumber(fat)) errors.push('FAT must be a number');
  if (!isNumber(snf)) errors.push('SNF must be a number');
  if (!isNumber(quantity)) errors.push('Quantity must be a number');
  if (isNumber(quantity) && quantity <= 0) errors.push('Quantity must be greater than zero');

  if (types.includes(p.milk_type)) {
    const lim = CONFIG.limits[p.milk_type];
    if (isNumber(fat) && (fat < lim.fat.min || fat > lim.fat.max)) {
      errors.push(`FAT must be within ${lim.fat.min}-${lim.fat.max} for ${p.milk_type}`);
    }
    if (isNumber(snf) && (snf < lim.snf.min || snf > lim.snf.max)) {
      errors.push(`SNF must be within ${lim.snf.min}-${lim.snf.max} for ${p.milk_type}`);
    }
  }

  return { errors, fat, snf, quantity };
}

// Auth helpers
function authRequired(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Auth routes
app.post('/auth/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash], function(err){
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
        return res.status(500).json({ error: 'Failed to create user' });
      }
      req.session.userId = this.lastID;
      req.session.username = username;
      res.status(201).json({ id: this.lastID, username });
    });
  } catch (e) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    try {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ id: user.id, username: user.username });
    } catch (e) {
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/auth/me', (req, res) => {
  if (req.session && req.session.userId) return res.json({ id: req.session.userId, username: req.session.username });
  return res.status(401).json({ error: 'Unauthorized' });
});

// API: Get config (read-only for UI hints)
app.get('/api/config', authRequired, (req, res) => {
  res.json({ limits: CONFIG.limits });
});

// API: List collections (optionally by date)
app.get('/api/collections', authRequired, (req, res) => {
  const { date } = req.query;
  let sql = 'SELECT * FROM collections';
  const params = [];
  if (date) {
    sql += ' WHERE date = ?';
    params.push(date);
  }
  sql += ' ORDER BY date DESC, session ASC, created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// API: Create a collection entry
app.post('/api/collections', authRequired, (req, res) => {
  // Ignore any client-provided rate or amount (not allowed)
  const { errors, fat, snf, quantity } = validatePayload(req.body);
  if (errors.length) {
    return res.status(400).json({ errors });
  }

  const { date, session, farmer_id, farmer_name = '', milk_type } = req.body;
  const rate = calcRate(milk_type, fat, snf);
  const amount = Number((rate * quantity).toFixed(2));

  const insert = `INSERT INTO collections 
    (date, session, farmer_id, farmer_name, milk_type, fat, snf, quantity, rate_per_liter, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [date, session, farmer_id, farmer_name, milk_type, fat, snf, quantity, rate, amount];

  db.run(insert, params, function (err) {
    if (err) {
      if (err && err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ errors: ['Duplicate entry for the same date/session/farmer/milk type is not allowed'] });
      }
      return res.status(500).json({ error: 'Failed to save record' });
    }
    const id = this.lastID;
    db.get('SELECT * FROM collections WHERE id = ?', [id], (e, row) => {
      if (e) return res.status(500).json({ error: 'Failed to fetch saved record' });
      res.status(201).json(row);
    });
  });
});

// Public auth pages
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/signup', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Protected app entry
app.get('/', (req, res) => {
  if (!(req.session && req.session.userId)) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
