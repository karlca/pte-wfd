const API = (typeof window !== "undefined" && window.location.hostname === "localhost") ? "http://localhost:3001/api" : "/api";
function getToken() { return localStorage.getItem("pte_token"); }

export async function register(email, password) {
  const res = await fetch(`${API}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function verifyEmail(email, code) {
  const res = await fetch(`${API}/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  localStorage.setItem("pte_token", data.token);
  localStorage.setItem("pte_email", data.email);
  return data;
}

export async function resendVerificationCode(email) {
  const res = await fetch(`${API}/auth/resend-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  if (!data.needsVerification) {
    localStorage.setItem("pte_token", data.token);
    localStorage.setItem("pte_email", data.email);
  }
  return data;
}

export function logout() { localStorage.removeItem("pte_token"); localStorage.removeItem("pte_email"); }
export function isLoggedIn() { return !!getToken(); }
export function getUserEmail() { return localStorage.getItem("pte_email"); }

export async function savePracticeSession(durationSeconds, sentencesPracticed, wrongSentences) {
  const res = await fetch(`${API}/practice/session`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ durationSeconds, sentencesPracticed, wrongSentences }) });
  return res.json();
}

export async function getWrongSentences() {
  const res = await fetch(`${API}/practice/wrong`, { headers: { Authorization: `Bearer ${getToken()}` } });
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API}/practice/stats`, { headers: { Authorization: `Bearer ${getToken()}` } });
  return res.json();
}

