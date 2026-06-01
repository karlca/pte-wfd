const fs = require("fs");
const path = require("path");
const DATA_FILE = path.join(__dirname, "data.json");

function read() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); }
  catch { return { users: [], sessions: [], wrongSentences: [], loginLogs: [] }; }
}
function write(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

module.exports = {
  findUserByEmail(email) { return read().users.find(u => u.email === email) || null; },
  createUser(user) { const data = read(); data.users.push(user); write(data); },
  updateUser(email, updates) { const data = read(); const idx = data.users.findIndex(u => u.email === email); if (idx >= 0) { Object.assign(data.users[idx], updates); write(data); } },
  saveSession(session) { const data = read(); data.sessions.push(session); write(data); },
  saveWrongSentences(userId, sentences) { const data = read(); for (const s of sentences) { if (!data.wrongSentences.find(w => w.user_id === userId && w.sentence_en === s)) { data.wrongSentences.push({ user_id: userId, sentence_en: s, recorded_at: new Date().toISOString() }); } } write(data); },
  getWrongSentences(userId) { const data = read(); return [...new Set(data.wrongSentences.filter(w => w.user_id === userId).map(w => w.sentence_en))]; },
  getStats(userId) { const data = read(); const ss = data.sessions.filter(s => s.user_id === userId); return { totalTimeSeconds: ss.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), totalSessions: ss.length, wrongSentencesCount: data.wrongSentences.filter(w => w.user_id === userId).length }; },
  recordLogin(userId) { const data = read(); data.loginLogs = data.loginLogs || []; data.loginLogs.push({ user_id: userId, time: new Date().toISOString() }); write(data); },
  listAllUsers() { const data = read(); return data.users.map(u => { const ss = data.sessions.filter(s => s.user_id === u.id); const ws = data.wrongSentences.filter(w => w.user_id === u.id); const ls = (data.loginLogs || []).filter(l => l.user_id === u.id); return { id: u.id, email: u.email, verified: !!u.verified, created_at: u.created_at, totalSessions: ss.length, totalTimeSeconds: ss.reduce((sum, s) => sum + (s.duration_seconds || 0), 0), wrongCount: new Set(ws.map(w => w.sentence_en)).size, loginCount: ls.length }; }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")); },
  getUserDetail(userId) { const data = read(); const user = data.users.find(u => u.id === userId); if (!user) return null; return { user: { id: user.id, email: user.email, verified: !!user.verified, created_at: user.created_at }, sessions: data.sessions.filter(s => s.user_id === userId).sort((a,b) => (b.ended_at||"").localeCompare(a.ended_at||"")), wrongSentences: data.wrongSentences.filter(w => w.user_id === userId).sort((a,b) => (b.recorded_at||"").localeCompare(a.recorded_at||"")), loginLogs: (data.loginLogs || []).filter(l => l.user_id === userId).sort((a,b) => (b.time||"").localeCompare(a.time||"")) }; },
  deleteUser(id) { const data = read(); data.users = data.users.filter(u => u.id !== id); data.sessions = data.sessions.filter(s => s.user_id !== id); data.wrongSentences = data.wrongSentences.filter(w => w.user_id !== id); data.loginLogs = (data.loginLogs || []).filter(l => l.user_id !== id); write(data); },
};
