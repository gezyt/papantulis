import { db, type User, publicUser, type PublicUser } from "./db";

// Sama persis dengan GezyBoard: cookie sesi HttpOnly, berlaku 30 hari.
export const SESSION_COOKIE = "papantulis_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function createUser(username: string, passwordHash: string, role: string = "user"): User {
  const stmt = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) RETURNING *");
  return stmt.get(username, passwordHash, role) as User;
}

export function getUserByUsername(username: string): User | null {
  return (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User) ?? null;
}

export function getUserById(id: number): User | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User) ?? null;
}

export function listUsers(): PublicUser[] {
  const rows = db.prepare("SELECT * FROM users ORDER BY id").all() as User[];
  return rows.map(publicUser);
}

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function countAdmins(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n;
}

export function updateUserPassword(id: number, passwordHash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function updateUser(id: number, patch: { username?: string; role?: string; passwordHash?: string }): User | null {
  const existing = getUserById(id);
  if (!existing) return null;
  const username = patch.username ?? existing.username;
  const role = patch.role ?? existing.role;
  const passwordHash = patch.passwordHash ?? existing.password_hash;
  db.prepare("UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?").run(username, role, passwordHash, id);
  return getUserById(id);
}

export function deleteUser(id: number): void {
  destroySessionsForUser(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function createSession(userId: number): string {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  return token;
}

export function getUserBySession(token: string): User | null {
  if (!token) return null;
  const row = db
    .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')")
    .get(token) as User | null;
  return row ?? null;
}

export function destroySession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function destroySessionsForUser(userId: number): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function destroyOtherSessions(userId: number, keepToken: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(userId, keepToken);
}

export { publicUser };
export type { PublicUser };
