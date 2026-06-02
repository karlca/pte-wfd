const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATA_FILE = path.join(__dirname, "data.json");
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let usePg = false;

async function init() {
  if (DATABASE_URL) {
    pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await pool.query(`ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS ip TEXT; ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_agent TEXT; ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location TEXT;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, verified BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS practice_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, duration_seconds INTEGER DEFAULT 0, sentences_practiced INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS wrong_sentences (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, sentence_en TEXT NOT NULL, recorded_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS practice_state (user_id TEXT PRIMARY KEY, state JSONB DEFAULT '{}', saved_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS db_sentences (id SERIAL PRIMARY KEY, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, qnum TEXT, title TEXT NOT NULL, translation TEXT DEFAULT '', degree INTEGER DEFAULT 1, category TEXT DEFAULT 'basic', created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS login_logs (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, time TIMESTAMPTZ DEFAULT NOW());
    `);
    usePg = true;
    console.log("Using PostgreSQL database");
  } else {
    console.log("No DATABASE_URL set, using local JSON file (data will be lost on redeploy)");
  }
}

// JSON file helpers
function readJson() { try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); } catch { return { users: [], sessions: [], wrongSentences: [], loginLogs: [] }; } }
function writeJson(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

module.exports = {
  // Course management
  async listCourses() {
    if (usePg) { const r = await pool.query("SELECT * FROM courses ORDER BY id"); return r.rows; }
    return (readJson().courses || []).sort((a,b) => a.id - b.id);
  },
  async createCourse(course) {
    if (usePg) { const r = await pool.query("INSERT INTO courses (name, description) VALUES ($1,$2) RETURNING *", [course.name, course.description]); return r.rows[0]; }
    const data = readJson(); data.courses = data.courses || []; course.id = (data.courses.length > 0 ? Math.max(...data.courses.map(c => c.id)) + 1 : 1); data.courses.push(course); writeJson(data); return course;
  },
  async updateCourse(id, updates) {
    if (usePg) { await pool.query("UPDATE courses SET name=$1, description=$2 WHERE id=$3", [updates.name, updates.description, id]); return; }
  },
  async deleteCourse(id) {
    if (usePg) { await pool.query("DELETE FROM db_sentences WHERE course_id=$1", [id]); await pool.query("DELETE FROM courses WHERE id=$1", [id]); return; }
  },
  // Sentence management
  async getCourseSentences(courseId) {
    if (usePg) { const r = await pool.query("SELECT * FROM db_sentences WHERE course_id=$1 ORDER BY id", [courseId]); return r.rows; }
    return (readJson().dbSentences || []).filter(s => s.course_id == courseId);
  },
  async addSentence(sentence) {
    if (usePg) { const r = await pool.query("INSERT INTO db_sentences (course_id, qnum, title, translation, degree, category) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [sentence.course_id, sentence.qnum, sentence.title, sentence.translation, sentence.degree, sentence.category]); return r.rows[0]; }
    const data = readJson(); data.dbSentences = data.dbSentences || []; sentence.id = data.dbSentences.length + 1; data.dbSentences.push(sentence); writeJson(data); return sentence;
  },
  async updateSentence(id, updates) {
    if (usePg) { await pool.query("UPDATE db_sentences SET title=$1, translation=$2, qnum=$3, degree=$4, category=$5 WHERE id=$6", [updates.title, updates.translation, updates.qnum, updates.degree, updates.category, id]); return; }
  },
  async deleteSentence(id) {
    if (usePg) { await pool.query("DELETE FROM db_sentences WHERE id=$1", [id]); return; }
  },
  async seedDefaultCourse(sentences) {
    if (usePg) {
      const existing = await pool.query("SELECT id FROM courses LIMIT 1");
      if (existing.rows.length === 0) {
        const c = await pool.query("INSERT INTO courses (name, description) VALUES ($1,$2) RETURNING id", ["Default", "Default course"]);
        const cid = c.rows[0].id;
        for (const s of sentences) {
          await pool.query("INSERT INTO db_sentences (course_id, title, translation, category, degree) VALUES ($1,$2,$3,$4,$5)", [cid, s.en, s.zh, s.category, 1]);
        }
        console.log("Seeded default course with " + sentences.length + " sentences");
      }
    }
  },
  async savePracticeState(userId, state) {
    if (usePg) { await pool.query("INSERT INTO practice_state (user_id, state) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET state=$2, saved_at=NOW()", [userId, JSON.stringify(state)]); return; }
    const data = readJson(); data.practiceState = data.practiceState || {}; data.practiceState[userId] = state; writeJson(data);
  },
  async loadPracticeState(userId) {
    if (usePg) { const r = await pool.query("SELECT state FROM practice_state WHERE user_id=$1", [userId]); const raw = r.rows[0]?.state; return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; }
    return (readJson().practiceState || {})[userId] || null;
  },
  async clearPracticeState(userId) {
    if (usePg) { await pool.query("DELETE FROM practice_state WHERE user_id=$1", [userId]); return; }
    const data = readJson(); if (data.practiceState) { delete data.practiceState[userId]; writeJson(data); }
  },
  init,
  async findUserByEmail(email) {
    if (usePg) { const r = await pool.query("SELECT * FROM users WHERE email = $1", [email]); return r.rows[0] || null; }
    return readJson().users.find(u => u.email === email) || null;
  },
  async createUser(user) {
    if (usePg) { await pool.query("INSERT INTO users (id, email, password, verified, created_at) VALUES ($1,$2,$3,$4,$5)", [user.id, user.email, user.password, user.verified !== false, user.created_at || new Date().toISOString()]); return; }
    const data = readJson(); data.users.push(user); writeJson(data);
  },
  async updateUser(email, updates) {
    if (usePg) { const sets = Object.keys(updates).map((k,i) => `${k}=$${i+2}`).join(","); await pool.query(`ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS ip TEXT; ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_agent TEXT; ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location TEXT;`);
    await pool.query(`UPDATE users SET ${sets} WHERE email=$1`, [email, ...Object.values(updates)]); return; }
    const data = readJson(); const idx = data.users.findIndex(u => u.email === email); if (idx >= 0) { Object.assign(data.users[idx], updates); writeJson(data); }
  },
  async saveSession(session) {
    if (usePg) { await pool.query("INSERT INTO practice_sessions (id, user_id, started_at, ended_at, duration_seconds, sentences_practiced) VALUES ($1,$2,$3,$4,$5,$6)", [session.id, session.user_id, session.started_at, session.ended_at, session.duration_seconds, session.sentences_practiced]); return; }
    const data = readJson(); data.sessions.push(session); writeJson(data);
  },
  async saveWrongSentences(userId, sentences) {
    if (usePg) { for (const s of sentences) { await pool.query("INSERT INTO wrong_sentences (user_id, sentence_en) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, s]); } return; }
    const data = readJson(); for (const s of sentences) { if (!data.wrongSentences.find(w => w.user_id === userId && w.sentence_en === s)) { data.wrongSentences.push({ user_id: userId, sentence_en: s, recorded_at: new Date().toISOString() }); } } writeJson(data);
  },
  async getWrongSentences(userId) {
    if (usePg) { const r = await pool.query("SELECT DISTINCT sentence_en FROM wrong_sentences WHERE user_id=$1", [userId]); return r.rows.map(x => x.sentence_en); }
    return [...new Set(readJson().wrongSentences.filter(w => w.user_id === userId).map(w => w.sentence_en))];
  },
  async getStats(userId) {
    if (usePg) { const r = await pool.query("SELECT COALESCE(SUM(duration_seconds),0) as total_time, COUNT(*) as sessions FROM practice_sessions WHERE user_id=$1", [userId]); const w = await pool.query("SELECT COUNT(DISTINCT sentence_en) as wrong FROM wrong_sentences WHERE user_id=$1", [userId]); return { totalTimeSeconds: parseInt(r.rows[0].total_time), totalSessions: parseInt(r.rows[0].sessions), wrongSentencesCount: parseInt(w.rows[0].wrong) }; }
    const data = readJson(); const ss = data.sessions.filter(s => s.user_id === userId); return { totalTimeSeconds: ss.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), totalSessions: ss.length, wrongSentencesCount: data.wrongSentences.filter(w => w.user_id === userId).length };
  },
  async recordLogin(userId, extra = {}) {
    if (usePg) { await pool.query("INSERT INTO login_logs (user_id, time, ip, user_agent, location) VALUES ($1,$2,$3,$4,$5)", [userId, new Date().toISOString(), extra.ip || null, extra.userAgent || null, extra.location || null]); return; }
    const data = readJson(); data.loginLogs = data.loginLogs || []; data.loginLogs.push({ user_id: userId, time: new Date().toISOString(), ip: extra.ip, user_agent: extra.userAgent, location: extra.location }); writeJson(data);
  },
  async listAllUsers() {
    if (usePg) { const r = await pool.query("SELECT u.*, COALESCE(s.sessions,0) as total_sessions, COALESCE(s.total_time,0) as total_time_seconds, COALESCE(w.wrong_count,0) as wrong_count, COALESCE(l.login_count,0) as login_count FROM users u LEFT JOIN (SELECT user_id, COUNT(*) as sessions, COALESCE(SUM(duration_seconds),0) as total_time FROM practice_sessions GROUP BY user_id) s ON u.id=s.user_id LEFT JOIN (SELECT user_id, COUNT(DISTINCT sentence_en) as wrong_count FROM wrong_sentences GROUP BY user_id) w ON u.id=w.user_id LEFT JOIN (SELECT user_id, COUNT(*) as login_count FROM login_logs GROUP BY user_id) l ON u.id=l.user_id ORDER BY u.created_at DESC"); const states = await pool.query("SELECT user_id, state FROM practice_state");
    const stateMap = {}; states.rows.forEach(s => { try { const v = s.state; stateMap[s.user_id] = typeof v === "string" ? JSON.parse(v) : v; } catch(e) {} });
    return r.rows.map(u => ({ id: u.id, email: u.email, verified: u.verified, created_at: u.created_at, totalSessions: parseInt(u.total_sessions), totalTimeSeconds: parseInt(u.total_time_seconds), wrongCount: parseInt(u.wrong_count), loginCount: parseInt(u.login_count), progress: stateMap[u.id] || null })); }
    const data = readJson(); return data.users.map(u => { const ss = data.sessions.filter(s => s.user_id === u.id); const ws = data.wrongSentences.filter(w => w.user_id === u.id); const ls = (data.loginLogs || []).filter(l => l.user_id === u.id); return { id: u.id, email: u.email, verified: !!u.verified, created_at: u.created_at, totalSessions: ss.length, totalTimeSeconds: ss.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), wrongCount: new Set(ws.map(w => w.sentence_en)).size, loginCount: ls.length }; }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },
  async getUserDetail(userId) {
    if (usePg) { const u = await pool.query("SELECT * FROM users WHERE id=$1", [userId]); if (!u.rows[0]) return null; const ss = await pool.query("SELECT * FROM practice_sessions WHERE user_id=$1 ORDER BY ended_at DESC NULLS LAST", [userId]); const ws = await pool.query("SELECT * FROM wrong_sentences WHERE user_id=$1 ORDER BY recorded_at DESC", [userId]); const ls = await pool.query("SELECT * FROM login_logs WHERE user_id=$1 ORDER BY time DESC", [userId]); return { user: { id: u.rows[0].id, email: u.rows[0].email, verified: u.rows[0].verified, created_at: u.rows[0].created_at }, sessions: ss.rows, wrongSentences: ws.rows, loginLogs: ls.rows }; }
    const data = readJson(); const user = data.users.find(u => u.id === userId); if (!user) return null; return { user: { id: user.id, email: user.email, verified: !!user.verified, created_at: user.created_at }, sessions: data.sessions.filter(s => s.user_id === userId).sort((a,b) => (b.ended_at||"").localeCompare(a.ended_at||"")), wrongSentences: data.wrongSentences.filter(w => w.user_id === userId).sort((a,b) => (b.recorded_at||"").localeCompare(a.recorded_at||"")), loginLogs: (data.loginLogs || []).filter(l => l.user_id === userId).sort((a,b) => (b.time||"").localeCompare(a.time||"")) };
  },
  async deleteUser(id) {
    if (usePg) { await pool.query("DELETE FROM login_logs WHERE user_id=$1", [id]); await pool.query("DELETE FROM wrong_sentences WHERE user_id=$1", [id]); await pool.query("DELETE FROM practice_sessions WHERE user_id=$1", [id]); await pool.query("DELETE FROM users WHERE id=$1", [id]); return; }
    const data = readJson(); data.users = data.users.filter(u => u.id !== id); data.sessions = data.sessions.filter(s => s.user_id !== id); data.wrongSentences = data.wrongSentences.filter(w => w.user_id !== id); data.loginLogs = (data.loginLogs || []).filter(l => l.user_id !== id); writeJson(data);
  },
};
