import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { join } from "node:path";

import {
  SESSION_COOKIE, verifyPassword, createSession, getUserBySession, destroySession, countUsers,
  getUserByUsername,
} from "./auth";

// Port default 3101: sengaja beda dari GezyBoard (3100) agar bisa jalan berdampingan di VPS yang sama.
const PORT = Number(process.env.PORT || 3101);
const ROOT = join(import.meta.dir, "..");
const FOOTER = "© 2026 GezyTech App · Dikembangkan oleh PakGun · Dilarang menyalin/menduplikat kode tanpa izin tertulis.";

const app = new Hono();

function currentUser(c: Context): { id: number; username: string } | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const u = getUserBySession(token);
  return u ? { id: u.id, username: u.username } : null;
}

function requireLogin(c: any) {
  const u = currentUser(c);
  if (!u) return c.json({ ok: false, error: "Silakan login dulu." }, 401);
  return u;
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
  return c.json({ ok: true, user: { id: user.id, username: user.username } });
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

// Bukti login bekerja + tempat bergantungnya fitur pemilik fase berikut
// (kelola papan, hapus papan server). Sengaja hanya pemilik yang lolos.
app.get("/api/owner/status", (c) => {
  const u = requireLogin(c);
  if (u instanceof Response) return u;
  return c.json({ ok: true, user: u, note: "Login pemilik aktif. Coretan fase ini masih tersimpan di browser; simpan server menyusul." });
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
