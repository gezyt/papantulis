import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Pola GezyBoard: satu file SQLite di VPS, WAL agar tulis konkuren tidak terkunci.
const ROOT = join(import.meta.dir, "..");
const DATA_DIR = join(ROOT, "data");

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(join(DATA_DIR, "papantulis.db"), { create: true });

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sesi login pemilik, bertahan setelah server restart (pola GezyBoard).
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Papan milik tiap pengguna yang login: satu baris per pengguna, berisi
-- JSON {version:2, current, pages} yang sama dengan format localStorage v2.
-- Pengguna tanpa login tidak punya baris di sini; coretannya tetap lokal.
CREATE TABLE IF NOT EXISTS user_boards (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);
`);

// Migrasi peran: DB lama belum punya kolom role. Tambah kolom, lalu jadikan
// akun "pakgun" sebagai admin. Bila tidak ada admin sama sekali (mis. akun
// pertama bukan pakgun), angkat akun tertua menjadi admin agar selalu ada
// yang bisa mengelola akun.
const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userCols.some((c) => c.name === "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' NOT NULL");
  db.prepare("UPDATE users SET role = 'admin' WHERE username = 'pakgun'").run();
  const adminCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n;
  if (adminCount === 0) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)").run();
  }
}

export function getUserBoard(userId: number): string | null {
  const row = db.prepare("SELECT data FROM user_boards WHERE user_id = ?").get(userId) as { data: string } | undefined;
  return row ? row.data : null;
}
export function saveUserBoard(userId: number, data: string): void {
  db.prepare("INSERT INTO user_boards (user_id, data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')").run(userId, data);
}

export interface User { id: number; username: string; password_hash: string; role: string; created_at: string }
export type PublicUser = { id: number; username: string; role: string; created_at: string };
export function publicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, role: u.role || "user", created_at: u.created_at };
}
