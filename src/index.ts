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

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));
  const user = getUserByUsername(String(username || "").trim());
  if (!user || !(await verifyPassword(String(password || ""), user.password_hash))) {
    return c.json({ ok: false, error: "Username atau password salah." }, 401);
  }
  const token = createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, path: "/", sameSite: "Lax", maxAge: 30 * 24 * 3600,
  });
  return c.json({ ok: true, user: publicUser(user) });
});

app.post("/api/logout", (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) destroySession(token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
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

// ---------- papan di server (hanya pengguna yang login) ----------
// Satu papan per pengguna, format sama dengan localStorage v2:
// {version:2, current, pages}. Validasi ketat agar data rusak / raksasa
// tidak merusak papan pengguna lain; tiap pengguna hanya melihat barisnya sendiri.
function validBoard(board: any): boolean {
  if (!board || typeof board !== "object" || board.version !== 2) return false;
  if (!Array.isArray(board.pages) || board.pages.length < 1 || board.pages.length > 100) return false;
  if (!Number.isInteger(board.current) || board.current < 0 || board.current >= board.pages.length) return false;
  for (const page of board.pages) {
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

app.get("/api/board", (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  const raw = getUserBoard(u.id);
  if (!raw) return c.json({ ok: true, board: null });
  try {
    const board = JSON.parse(raw);
    if (!validBoard(board)) return c.json({ ok: true, board: null });
    return c.json({ ok: true, board });
  } catch {
    return c.json({ ok: true, board: null });
  }
});

app.put("/api/board", async (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  const body = await c.req.json().catch(() => null);
  const board = body && body.board;
  if (!validBoard(board)) return c.json({ ok: false, error: "Data papan tidak valid." }, 400);
  if (JSON.stringify(board).length > 2000000) return c.json({ ok: false, error: "Papan terlalu besar (maks. 2 MB)." }, 400);
  saveUserBoard(u.id, JSON.stringify(board));
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
