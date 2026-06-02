const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const db = require("./db.cjs");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "pte-wfd-secret-key-2026";

console.log("Email verification disabled - register to login directly");

app.use(cors());
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}

// Register: no email verification, direct login
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 4) return res.status(400).json({ error: "Invalid input" });
  if (await db.findUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  await db.createUser({ id, email, password: hash, verified: true, created_at: new Date().toISOString() });
  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, email });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Invalid input" });
  const user = await db.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  await db.recordLogin(user.id);
  res.json({ token, email: user.email });
});

// Practice
app.post("/api/practice/session", auth, async (req, res) => {
  const { durationSeconds, sentencesPracticed, wrongSentences } = req.body;
  const sessionId = uuidv4();
  await db.saveSession({ id: sessionId, user_id: req.user.id, duration_seconds: durationSeconds, sentences_practiced: sentencesPracticed, started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(), ended_at: new Date().toISOString() });
  if (wrongSentences?.length) await db.saveWrongSentences(req.user.id, wrongSentences);
  res.json({ ok: true, sessionId });
});

app.get("/api/practice/wrong", auth, async (req, res) => { res.json(await db.getWrongSentences(req.user.id)); });
app.get("/api/practice/stats", auth, async (req, res) => { res.json(await db.getStats(req.user.id)); });

// Practice state - save/restore progress
app.post("/api/practice/state", auth, async (req, res) => {
  await db.savePracticeState(req.user.id, req.body);
  res.json({ ok: true });
});

app.get("/api/practice/state", auth, async (req, res) => {
  const state = await db.loadPracticeState(req.user.id);
  res.json(state || {});
});

// Admin
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { const d = jwt.verify(token, JWT_SECRET); if (d.role !== "admin") throw new Error(); next(); }
  catch { res.status(401).json({ error: "Invalid admin token" }); }
};
app.post("/api/admin/login", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Invalid password" });
  res.json({ token: jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" }) });
});
app.get("/api/admin/users", adminAuth, async (req, res) => { res.json(await db.listAllUsers()); });
app.get("/api/admin/users/:id/detail", adminAuth, async (req, res) => {
  const detail = await db.getUserDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "User not found" });
  res.json(detail);
});
app.delete("/api/admin/users/:id", adminAuth, async (req, res) => { await db.deleteUser(req.params.id); res.json({ ok: true }); });

// ---- Course & Sentence APIs ----
app.get("/api/courses", async (req, res) => { res.json(await db.listCourses()); });

app.get("/api/courses/:id/sentences", async (req, res) => {
  const sentences = await db.getCourseSentences(req.params.id);
  res.json(sentences);
});

// Admin course CRUD
app.post("/api/admin/courses", adminAuth, async (req, res) => {
  const course = await db.createCourse(req.body);
  res.json(course);
});

app.put("/api/admin/courses/:id", adminAuth, async (req, res) => {
  await db.updateCourse(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete("/api/admin/courses/:id", adminAuth, async (req, res) => {
  await db.deleteCourse(req.params.id);
  res.json({ ok: true });
});

// Admin sentence CRUD
app.post("/api/admin/courses/:id/sentences", adminAuth, async (req, res) => {
  const s = await db.addSentence({ ...req.body, course_id: req.params.id });
  res.json(s);
});

app.put("/api/admin/sentences/:id", adminAuth, async (req, res) => {
  await db.updateSentence(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete("/api/admin/sentences/:id", adminAuth, async (req, res) => {
  await db.deleteSentence(req.params.id);
  res.json({ ok: true });
});

// Serve static frontend in production
const path = require("path");
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const filePath = path.join(distPath, req.path === "/" ? "index.html" : req.path.slice(1));
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.sendFile(path.join(distPath, "index.html"));
  });
}

db.init().then(async () => {
  // Seed default course with existing sentences
  try {
    const sentences = null;
    // Seed from JSON file instead
    try {
      const seedPath = path.join(__dirname, "..", "src", "data", "sentences.js");
      const seedContent = fs.readFileSync(seedPath, "utf-8");
      const match = seedContent.match(/export const wfdSentences = (\[[\s\S]*\]);/);
      if (match) {
        const parsed = eval(match[1]);
        await db.seedDefaultCourse(parsed);
      }
    } catch (e2) { console.log("Seed error:", e2.message); }
  } else if (sentences && sentences.wfdSentences) {
      await db.seedDefaultCourse(sentences.wfdSentences);
    }
  } catch (e) { console.log("Seed skipped:", e.message); }
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
});
