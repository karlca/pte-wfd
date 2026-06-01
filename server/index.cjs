const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const db = require("./db.cjs");

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || "pte-wfd-secret-key-2026";

// SMTP config from env vars
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
console.log("SMTP_ENV:", JSON.stringify({ HOST: SMTP_HOST, PORT: SMTP_PORT, USER: SMTP_USER, FROM: SMTP_FROM, configured: smtpConfigured }));
if (smtpConfigured && nodemailer) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
  transporter.verify(function(err) { if (err) console.error("SMTP verify failed:", err.message); else console.log("SMTP connection OK"); });
  console.log("SMTP configured for:", SMTP_HOST, "port:", SMTP_PORT, "user:", SMTP_USER);
} else {
  console.log("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars to enable real email sending.");
}

app.use(cors());
app.use(express.json());

const verificationCodes = {};

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 4) return res.status(400).json({ error: "Invalid input" });
  if (db.findUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  verificationCodes[email] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.createUser({ id, email, password: hash, verified: false, created_at: new Date().toISOString() });

  // Try to send real email
  let emailSent = false;
  if (transporter) {
    try {
      await Promise.race([
        transporter.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: "PTE WFD Practice - Verification Code",
          text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP timeout")), 10000))
      ]);
      emailSent = true;
    } catch (e) {
      console.error("Failed to send email:", e.message);
    }
  }

  res.json({
    ok: true,
    emailSent,
    message: emailSent ? "Verification code sent to your email" : "Verification code generated (SMTP not configured)",
    code: emailSent ? undefined : code, // only return code if email not sent
  });
});

app.post("/api/auth/verify", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Invalid input" });
  const record = verificationCodes[email];
  if (!record) return res.status(400).json({ error: "No verification code found" });
  if (Date.now() > record.expiresAt) { delete verificationCodes[email]; return res.status(400).json({ error: "Code expired" }); }
  if (record.code !== code) return res.status(400).json({ error: "Invalid code" });
  delete verificationCodes[email];
  const user = db.findUserByEmail(email);
  if (user) db.updateUser(email, { verified: true });
  const token = jwt.sign({ id: user?.id, email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, email });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Invalid input" });
  const user = db.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });
  if (!user.verified) return res.status(403).json({ error: "Email not verified", needsVerification: true });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, email: user.email });
  db.recordLogin(user.id);
});

app.post("/api/practice/session", auth, (req, res) => {
  const { durationSeconds, sentencesPracticed, wrongSentences } = req.body;
  const sessionId = uuidv4();
  db.saveSession({ id: sessionId, user_id: req.user.id, duration_seconds: durationSeconds, sentences_practiced: sentencesPracticed, started_at: new Date(Date.now() - durationSeconds * 1000).toISOString(), ended_at: new Date().toISOString() });
  if (wrongSentences?.length) db.saveWrongSentences(req.user.id, wrongSentences);
  res.json({ ok: true, sessionId });
});

app.get("/api/practice/wrong", auth, (req, res) => { res.json(db.getWrongSentences(req.user.id)); });
app.get("/api/practice/stats", auth, (req, res) => { res.json(db.getStats(req.user.id)); });

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
app.get("/api/admin/users", adminAuth, (req, res) => { res.json(db.listAllUsers()); });
app.delete("/api/admin/users/:id", adminAuth, (req, res) => { db.deleteUser(req.params.id); res.json({ ok: true }); });
app.post("/api/admin/smtp-test", adminAuth, async (req, res) => {
  if (!transporter) return res.json({ ok: false, error: "SMTP not configured" });
  try {
    await Promise.race([
      transporter.sendMail({
        from: SMTP_FROM, to: req.body.email || SMTP_USER,
        subject: "SMTP Test", text: "If you receive this, SMTP is working."
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000))
    ]);
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message, code: e.code }); }
});
app.get("/api/admin/users/:id/detail", adminAuth, (req, res) => {
  const detail = db.getUserDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "User not found" });
  res.json(detail);
});

const fs = require('fs');
const path = require('path');
// In production, serve the built frontend
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

app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));




