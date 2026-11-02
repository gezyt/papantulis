// Membuat user PapanTulis lewat terminal di server.
// Setelah ada admin, kelola akun lebih mudah lewat web (panel Kelola Akun,
// hanya admin). Skrip ini tetap berguna untuk akun pertama / darurat.
// Pakai: bun run scripts/create-user.ts <username> <password> [admin|user]
// Peran bila tidak diisi: admin bila username pakgun, atau bila belum ada
// admin sama sekali; selain itu user.
import { createUser, getUserByUsername, hashPassword, countAdmins } from "../src/auth";

const [username, password, roleArg] = Bun.argv.slice(2);
if (!username || !password) {
  console.error("Pakai: bun run scripts/create-user.ts <username> <password> [admin|user]");
  process.exit(1);
}
if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
  console.error("Username 3–32 karakter: huruf, angka, titik, strip, atau garis bawah.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Password minimal 6 karakter.");
  process.exit(1);
}
let role = roleArg;
if (role && role !== "admin" && role !== "user") {
  console.error("Peran harus admin atau user.");
  process.exit(1);
}
if (!role) {
  role = username === "pakgun" || countAdmins() === 0 ? "admin" : "user";
}
if (getUserByUsername(username)) {
  console.error(`User "${username}" sudah ada.`);
  process.exit(1);
}
const user = createUser(username, await hashPassword(password), role);
console.log(`User "${user.username}" dibuat (id=${user.id}, peran=${user.role}). Silakan login di halaman utama.`);
