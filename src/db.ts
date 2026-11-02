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

export interface User { id: number; username: string; password_hash: string; role: string; created_at: string }
export type PublicUser = { id: number; username: string; role: string; created_at: string };
export function publicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, role: u.role || "user", created_at: u.created_at };
}
