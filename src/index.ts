import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { join } from "node:path";

import {
  SESSION_COOKIE, verifyPassword, hashPassword, createSession, getUserBySession, destroySession,
  destroySessionsForUser, destroyOtherSessions, countUsers, countAdmins,
  getUserByUsername, getUserById, listUsers, createUser, updateUser, updateUserPassword, deleteUser,
  publicUser,
} from "./auth";
import { getUserBoard, saveUserBoard } from "./db";

// Port default 3101: sengaja beda dari GezyBoard (3100) agar bisa jalan berdampingan di VPS yang sama.
const PORT = Number(process.env.PORT || 3101);
const ROOT = join(import.meta.dir, "..");
const FOOTER = "© 2026 GezyTech App · Dikembangkan oleh PakGun · Dilarang menyalin/menduplikat kode tanpa izin tertulis.";

const app = new Hono();

function currentUser(c: Context): { id: number; username: string; role: string } | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const u = getUserBySession(token);
  return u ? { id: u.id, username: u.username, role: u.role || "user" } : null;
}

function requireLogin(c: any) {
  const u = currentUser(c);
  if (!u) return c.json({ ok: false, error: "Silakan login dulu." }, 401);
  return u;
}

function requireAdmin(c: any) {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  if (u.role !== "admin") return c.json({ ok: false, error: "Hanya admin." }, 403);
  return u;
}

// Aturan akun (pola Aspro): username 3–32 karakter huruf/angka/titik/strip/garis bawah,
// password minimal 6 karakter. Hash tidak pernah dikembalikan ke klien.
function validUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}
function validPassword(password: string): boolean {
  return password.length >= 6;
}
function validRole(role: string): boolean {
  return role === "admin" || role === "user";
}

// ---------- auth (pola GezyBoard) ----------

// Pembatas percobaan login (di memori, cukup untuk instalasi satu proses ini):
// 5 kali gagal dalam 15 menit untuk satu kombinasi IP + username -> kunci 15 menit.
// Kunci per kombinasi, bukan per username saja, supaya penyerang tidak bisa
// mengunci akun guru yang sah hanya dengan menebak-nebak sandinya. IP diambil
// dari X-Forwarded-For bila ada proxy di depan (Caddy di VPS), bila tidak ada
// jatuh ke "unknown" dan kunci tetap berlaku per username. Percobaan gagal
// untuk username yang tidak ada pun dihitung, supaya tidak bisa dipakai
// menguji daftar username tanpa batas. Sukses menghapus hitungan kunci itu.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
type LoginAttempt = { count: number; first: number; blockedUntil: number };
const loginAttempts = new Map<string, LoginAttempt>();
function loginAttemptKey(c: Context, username: string): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || c.req.header("x-real-ip") || "unknown";
  return ip + "|" + username.toLowerCase();
}
function loginBlocked(key: string, now: number): boolean {
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (rec.blockedUntil > now) return true;
  if (now - rec.first > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  return false;
}
function recordLoginFailure(key: string, now: number): void {
  const rec = loginAttempts.get(key);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, first: now, blockedUntil: 0 });
  } else {
    rec.count += 1;
    if (rec.count >= LOGIN_MAX_ATTEMPTS) rec.blockedUntil = now + LOGIN_BLOCK_MS;
  }
  // Jangan biarkan peta tumbuh tanpa batas bila diserang dengan banyak kunci.
  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (v.blockedUntil <= now && now - v.first > LOGIN_WINDOW_MS) loginAttempts.delete(k);
    }
  }
}

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  const name = String(username || "").trim();
  const key = loginAttemptKey(c, name);
  const now = Date.now();
  if (loginBlocked(key, now)) {
    return c.json({ ok: false, error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." }, 429);
  }
  const user = getUserByUsername(name);
  if (!user || !(await verifyPassword(String(password || ""), user.password_hash))) {
    recordLoginFailure(key, now);
    return c.json({ ok: false, error: "Username atau password salah." }, 401);
  }
  loginAttempts.delete(key);
  const token = createSession(user.id);
  // Secure: cookie sesi hanya dikirim lewat HTTPS di produksi. Uji lokal
  // lewat http://localhost tetap jalan karena browser menganggap localhost
  // sebagai secure context; uji lewat http://IP-lan tidak akan bisa login.
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: true, path: "/", sameSite: "Lax", maxAge: 30 * 24 * 3600,
  });
  return c.json({ ok: true, user: publicUser(user) });
});

app.post("/api/logout", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) destroySession(token);
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

app.get("/api/me", (c) => {
  const u = currentUser(c);
  if (!u) return c.json({ ok: false }, 401);
  return c.json({ ok: true, user: u });
});

// Status pemilik: sejak ada peran, hanya admin yang lolos (bukan semua user login).
app.get("/api/owner/status", (c) => {
  const u = requireAdmin(c);
  if (u instanceof Response) return u;
  return c.json({ ok: true, user: u, note: "Login admin aktif. Papan pengguna yang login tersimpan di server." });
});

// ---------- sesi di server (hanya pengguna yang login) ----------
// Format v3, sama dengan localStorage baru:
// {version:3, currentId, sessions:[{id, name, current, pages}]}.
// Satu baris per pengguna di tabel user_boards (kolom data tidak berubah,
// hanya isi JSON-nya). Validasi ketat agar data rusak / raksasa tidak
// merusak papan pengguna lain; tiap pengguna hanya melihat barisnya sendiri.
// Endpoint /api/board lama SENGAJA dihapus: klien lama yang masih tercache
// akan gagal sinkron dan tetap lokal, bukan menimpa format sesi baru
// dengan papan v2 tanpa nama.
function validPages(pages: any, current: any): boolean {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 100) return false;
  if (!Number.isInteger(current) || current < 0 || current >= pages.length) return false;
  for (const page of pages) {
    if (!Array.isArray(page) || page.length > 5000) return false;
    for (const s of page) {
      if (!s || typeof s !== "object") return false;
      if (!["pen", "highlighter", "eraser"].includes(s.tool)) return false;
      if (typeof s.color !== "string" || s.color.length > 32) return false;
      if (typeof s.width !== "number" || !Number.isFinite(s.width) || s.width < 1 || s.width > 100) return false;
      if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > 10000) return false;
      for (const p of s.points) {
        if (!p || typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
        if (p.p !== undefined && (typeof p.p !== "number" || !Number.isFinite(p.p))) return false;
      }
    }
  }
  return true;
}
function validBoard(board: any): boolean {
  if (!board || typeof board !== "object" || board.version !== 2) return false;
  return validPages(board.pages, board.current);
}
function boardToSessions(board: any): any {
  return {
    version: 3, currentId: "utama",
    sessions: [{ id: "utama", name: "Papan utama", current: board.current, pages: board.pages }],
  };
}
function validSessions(data: any): boolean {
  if (!data || typeof data !== "object" || data.version !== 3) return false;
  if (typeof data.currentId !== "string" || !data.currentId) return false;
  if (!Array.isArray(data.sessions) || data.sessions.length < 1 || data.sessions.length > 20) return false;
  const ids = new Set<string>();
  for (const s of data.sessions) {
    if (!s || typeof s !== "object") return false;
    if (typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(s.id) || ids.has(s.id)) return false;
    ids.add(s.id);
    if (typeof s.name !== "string" || s.name.trim().length < 1 || s.name.length > 80) return false;
    if (!validPages(s.pages, s.current)) return false;
  }
  return ids.has(data.currentId);
}

app.get("/api/sessions", (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  const raw = getUserBoard(u.id);
  if (!raw) return c.json({ ok: true, sessions: null });
  try {
    const parsed = JSON.parse(raw);
    if (validSessions(parsed)) return c.json({ ok: true, sessions: parsed });
    // Migrasi sekali jalan: papan v2 lama menjadi satu sesi "Papan utama".
    if (validBoard(parsed)) {
      const converted = boardToSessions(parsed);
      saveUserBoard(u.id, JSON.stringify(converted));
      return c.json({ ok: true, sessions: converted });
    }
    return c.json({ ok: true, sessions: null });
  } catch {
    return c.json({ ok: true, sessions: null });
  }
});

app.put("/api/sessions", async (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  const body = await c.req.json().catch(() => null);
  const data = body && body.sessions;
  if (!validSessions(data)) return c.json({ ok: false, error: "Data sesi tidak valid." }, 400);
  // Batas total naik dari 2 MB (satu papan) menjadi 5 MB (semua sesi),
  // masih dalam kisaran kuota localStorage browser yang menyimpan salinan lokal.
  if (JSON.stringify(data).length > 5000000) return c.json({ ok: false, error: "Total sesi terlalu besar (maks. 5 MB)." }, 400);
  saveUserBoard(u.id, JSON.stringify(data));
  return c.json({ ok: true });
});

// ---------- kelola akun (hanya admin) ----------

app.get("/api/users", (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  return c.json({ ok: true, users: listUsers() });
});

app.post("/api/users", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const { username, password, role } = await c.req.json().catch(() => ({}));
  const name = String(username || "").trim();
  const pass = String(password || "");
  const r = role === undefined || role === "" ? "user" : String(role);
  if (!validUsername(name)) return c.json({ ok: false, error: "Username 3–32 karakter: huruf, angka, titik, strip, atau garis bawah." }, 400);
  if (!validPassword(pass)) return c.json({ ok: false, error: "Password minimal 6 karakter." }, 400);
  if (!validRole(r)) return c.json({ ok: false, error: "Peran harus admin atau user." }, 400);
  if (getUserByUsername(name)) return c.json({ ok: false, error: "Username sudah dipakai." }, 400);
  const user = createUser(name, await hashPassword(pass), r);
  return c.json({ ok: true, user: publicUser(user) });
});

app.patch("/api/users/:id", async (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const target = getUserById(Number(c.req.param("id")));
  if (!target) return c.json({ ok: false, error: "Akun tidak ditemukan." }, 404);
  const { username, role, password } = await c.req.json().catch(() => ({}));
  const patch: { username?: string; role?: string; passwordHash?: string } = {};
  if (username !== undefined) {
    const name = String(username).trim();
    if (!validUsername(name)) return c.json({ ok: false, error: "Username 3–32 karakter: huruf, angka, titik, strip, atau garis bawah." }, 400);
    const clash = getUserByUsername(name);
    if (clash && clash.id !== target.id) return c.json({ ok: false, error: "Username sudah dipakai." }, 400);
    patch.username = name;
  }
  if (role !== undefined) {
    const r = String(role);
    if (!validRole(r)) return c.json({ ok: false, error: "Peran harus admin atau user." }, 400);
    if (target.role === "admin" && r === "user" && countAdmins() <= 1) {
      return c.json({ ok: false, error: "Tidak bisa menurunkan admin terakhir." }, 400);
    }
    patch.role = r;
  }
  if (password !== undefined && password !== "") {
    const pass = String(password);
    if (!validPassword(pass)) return c.json({ ok: false, error: "Password minimal 6 karakter." }, 400);
    patch.passwordHash = await hashPassword(pass);
  }
  const updated = updateUser(target.id, patch)!;
  // Reset sandi oleh admin mematikan semua sesi akun itu (pola Aspro).
  // Bila admin mengubah sandinya sendiri, sesi saat ini dipertahankan.
  if (patch.passwordHash) {
    if (target.id === admin.id) destroyOtherSessions(target.id, getCookie(c, SESSION_COOKIE) || "");
    else destroySessionsForUser(target.id);
  }
  return c.json({ ok: true, user: publicUser(updated) });
});

app.delete("/api/users/:id", (c) => {
  const admin = requireAdmin(c);
  if (admin instanceof Response) return admin;
  const target = getUserById(Number(c.req.param("id")));
  if (!target) return c.json({ ok: false, error: "Akun tidak ditemukan." }, 404);
  if (target.id === admin.id) return c.json({ ok: false, error: "Tidak bisa menghapus akun sendiri." }, 400);
  if (target.role === "admin" && countAdmins() <= 1) return c.json({ ok: false, error: "Tidak bisa menghapus admin terakhir." }, 400);
  deleteUser(target.id);
  return c.json({ ok: true });
});

// ---------- ganti sandi sendiri (semua user yang login) ----------

app.post("/api/me/password", async (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  const { current_password, new_password } = await c.req.json().catch(() => ({}));
  const full = getUserById(u.id);
  if (!full) return c.json({ ok: false, error: "Akun tidak ditemukan." }, 404);
  if (!(await verifyPassword(String(current_password || ""), full.password_hash))) {
    return c.json({ ok: false, error: "Sandi lama salah." }, 401);
  }
  const next = String(new_password || "");
  if (!validPassword(next)) return c.json({ ok: false, error: "Sandi baru minimal 6 karakter." }, 400);
  updateUserPassword(u.id, await hashPassword(next));
  // Sesi di perangkat lain dimatikan, sesi saat ini tetap jalan.
  destroyOtherSessions(u.id, getCookie(c, SESSION_COOKIE) || "");
  return c.json({ ok: true });
});

// ---------- halaman ----------

app.get("/", async (c) => {
  const file = Bun.file(join(ROOT, "index.html"));
  if (!(await file.exists())) return c.notFound();
  return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

const server = Bun.serve({
  port: PORT,
  fetch(req) { return app.fetch(req); },
});

if (countUsers() === 0) {
  console.log("[PapanTulis] Belum ada user. Buat pemilik dengan: bun run scripts/create-user.ts <username> <password>");
}
console.log(`[PapanTulis] Berjalan di http://localhost:${PORT}`);
console.log(`[PapanTulis] ${FOOTER}`);

export { server };
