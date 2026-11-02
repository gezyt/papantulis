# PapanTulis

Papan coretan bebas. Fase ini: coretan satu pengguna + **login pemilik ala GezyBoard**.

## Fitur coretan

- Coret bebas pakai jari, mouse, atau stylus (Pointer Events + Canvas 2D)
- Pena, stabilo, dan penghapus
- Pilihan warna + warna bebas, ketebalan 2–24 px
- Latar polos, kotak-kotak, bergaris, atau titik-titik (persegi tanpa garis, titik hanya di sudut grid 28 px; default: Titik-titik)
- Urungkan / ulangi (juga Ctrl+Z / Ctrl+Y)
- Hapus papan (masih bisa diurungkan)
- Simpan otomatis di perangkat ini (localStorage)
- Ekspor PNG (latar putih)
- **Mode halaman:** bar halaman di atas papan — tombol Halaman 1, 2, …,
  Sebelumnya/Berikutnya, **+ Halaman** untuk menambah halaman kosong sesuai
  kebutuhan, dan 🗑️ Hapus halaman (dengan konfirmasi; halaman terakhir tidak
  bisa dihapus). Tiap halaman punya coretan dan undo/redo sendiri; ekspor PNG
  hanya untuk halaman yang sedang dibuka (`papantulis-halaman-N.png`).
  Coretan format lama otomatis dipindah menjadi Halaman 1.

## Login + kelola akun (pola GezyBoard + Aspro)

- Stack: Bun + Hono + bun:sqlite (WAL), satu proses, seperti GezyBoard.
- Password di-hash bcrypt (Bun.password, cost 10); sesi berupa cookie HttpOnly
  `papantulis_session` berlaku 30 hari, tersimpan di tabel `sessions` sehingga
  bertahan setelah server restart.
- **Tidak ada registrasi publik.** Akun pertama dibuat lewat skrip di server.
- Peran: `admin` dan `user`. Akun `pakgun` yang sudah ada otomatis menjadi
  admin saat migrasi (bila tidak ada admin, akun tertua diangkat jadi admin).
  Akun baru lewat web defaultnya `user`, admin bisa memilih `admin`.
- Papan tetap bisa dipakai tanpa login (seperti sekarang). Yang login hanya
  mendapat panel akun; hanya admin yang mendapat panel Kelola Akun.
- **Kelola Akun (hanya admin, panel di web):** panel Akun saya + Kelola Akun
  defaultnya tersembunyi agar papan lega; dibuka/tutup lewat tombol di header
  (🔐 Kelola Akun untuk admin, 🔑 Akun saya untuk pengguna). Di dalamnya:
  lihat daftar akun, tambah akun
  (username 3–32 karakter huruf/angka/titik/strip/garis bawah, sandi min. 6),
  ubah peran, reset sandi akun lain, hapus akun. Pengaman: tidak bisa hapus
  akun sendiri, tidak bisa hapus/menurunkan admin terakhir. Reset sandi oleh
  admin mematikan semua sesi akun itu.
- **Ganti sandi sendiri (semua user yang login, panel Akun saya):** wajib isi
  sandi lama, sandi baru min. 6, dan ulangi sandi baru. Sesi di perangkat lain
  dimatikan, sesi perangkat ini tetap jalan.
- Hash sandi tidak pernah dikembalikan ke klien.
- Endpoint: `POST /api/login`, `POST /api/logout`, `GET /api/me`,
  `GET /api/owner/status` (hanya admin), `GET/POST /api/users` (admin),
  `PATCH/DELETE /api/users/:id` (admin), `POST /api/me/password` (login).

### Menjalankan lokal

```sh
bun install
bun run scripts/create-user.ts <username> <password> [admin|user]
# tanpa peran: pakgun atau akun pertama menjadi admin, sisanya user
bun run src/index.ts
# lalu buka http://localhost:3101
```

Akun default TIDAK disediakan — buat sendiri lewat skrip di atas, dan ganti
bila pernah tersebar. Database `data/papantulis.db` tidak ikut commit (lihat `.gitignore`).

### Deploy di VPS (wilayah Pak Gun)

1. `git pull` di server, lalu `bun install`.
2. Buat akun pemilik sekali saja (bila DB masih kosong):
   `bun run scripts/create-user.ts <username> <password>`.
3. Jalankan satu proses Bun di port `3101` (atau `PORT=... bun run src/index.ts`),
   di belakang reverse proxy + HTTPS, seperti GezyBoard (port 3100) — port
   sengaja dibedakan agar keduanya bisa jalan berdampingan.
4. Bila situs masih dilayani sebagai berkas statis, tombol login akan
   menampilkan pesan bahwa server belum menjalankan mode Bun; coretan
   tetap bisa dipakai karena masih tersimpan di browser.

## Batas fase ini — dibaca dulu sebelum mengira sudah "di mana saja"

Login saja **belum** memindahkan coretan ke server. Coretan fase ini masih
tersimpan di browser perangkat yang dipakai, jadi belum bisa dibuka dari
perangkat lain. Simpan papan di server + tautan berbagi adalah fase berikut.

## Rencana berikut (belum dibangun)

- Simpan papan di server (tabel papan + goresan) agar bisa dibuka kapan saja di mana saja
- Tautan berbagi ala GezyBoard: pemilik login, pengunjung tanpa login
- Multi-pengguna real-time via WebSocket (pola GezyBoard)
- Teks, bentuk, dan undo per goresan berbasis model data

© 2026 GezyTech App · Dikembangkan oleh PakGun · Dilarang menyalin/menduplikat kode tanpa izin tertulis.
