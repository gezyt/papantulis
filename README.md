# PapanTulis

Papan coretan bebas. Fase ini: coretan satu pengguna + **login pemilik ala GezyBoard**.

## Fitur coretan

- Coret bebas pakai jari, mouse, atau stylus (Pointer Events + Canvas 2D)
- Pena, stabilo, dan penghapus
- Pilihan warna + warna bebas, ketebalan 2–24 px
- Latar polos, kotak-kotak, bergaris, atau titik-titik (persegi tanpa garis, titik hanya di sudut grid 28 px; default: Titik-titik)
- Urungkan / ulangi (juga Ctrl+Z / Ctrl+Y)
- Hapus papan (masih bisa diurungkan)
- **Papan panjang yang bisa digeser ke atas/bawah:** tinggi awal 2400 px
  (sekitar 2–3 layar), digeser lewat bilah gulir kanan, roda mouse,
  tombol PageUp/PageDown, atau alat ✋ Geser (seret papan; berguna di
  layar sentuh/PID yang jarinya biasa dipakai menggambar). Papan
  memanjang otomatis bila coretan/tempelan mendekati bawah (tombol ⇕
  juga menambah panjang manual), maks. 9600 px. Ekspor PNG kini
  mencakup seluruh panjang papan, bukan hanya layar yang terlihat.
- **Papan juga bisa digeser ke kanan/kiri:** lebar papan mengikuti isi
  (selebar layar, atau selebar isi paling kanan, maks. 4000 px), jadi
  isi yang ditulis di laptop lebar tetap bisa dilihat di layar yang
  lebih sempit dengan menggeser papan (bilah gulir bawah atau alat ✋
  Geser). Ekspor PNG mencakup seluruh lebar papan.
- **Zoom tampilan papan (− / % / + / Pas):** memperkecil/memperbesar
  tampilan tanpa mengubah ukuran isi yang tersimpan; tombol **Pas**
  memaskan papan ke lebar layar. Besar tampilan disimpan per perangkat
  (PID dan laptop bisa beda). Bila belum pernah diatur dan papan lebih
  lebar dari layar — mis. isi dari laptop lebar dibuka di PID — tampilan
  langsung dipaskan otomatis saat halaman dibuka.
- **Bilah atas responsif (PID/layar sentuh):** di layar <= 1600 px
  bilah atas membungkus jadi 2 baris supaya semua ikon terlihat tanpa
  harus menggeser (di PID sentuhan sering meniru mouse sehingga bar
  yang meluber tidak bisa digeser jari); di laptop lebar tetap 1 baris
  seperti sebelumnya. Di layar sentuh bilah gulir dibuat tebal supaya
  mudah diraih jari.
- **Tempel teks & gambar (Ctrl+V):** teks dari clipboard jadi teks di
  papan (di tengah area yang terlihat), gambar jadi gambar di papan
  (diperkecil otomatis ke sisi terpanjang 1000 px dan dikompres bila
  > 800 KB, supaya tidak menghabiskan batas simpan 5 MB). Bisa juga
  lewat tombol 🔤 Teks (ketuk papan lalu tulis; ketuk teks yang sudah
  ada untuk mengubahnya), tombol 🖼️ Gambar (pilih berkas), atau
  seret berkas gambar dari File Explorer/galeri lalu jatuhkan di papan.
  Alat ↖️ Pindah: seret teks/gambar untuk memindahkannya, ketuk untuk
  memilih (bingkai putus-putus), Delete/⌫ untuk menghapus. Teks dan
  gambar ikut tersimpan (lokal + server bila login), bisa diurungkan,
  dan ikut diekspor PNG.
- **Gambar bisa diubah ukurannya:** gambar yang dipilih menampilkan
  gagang putih di keempat sudutnya — seret sudut mana pun untuk
  memperbesar/memperkecil dengan rasio tetap (tidak gepeng), 40 px
  sampai 2000 px per sisi. Kursor berubah jadi panah resize saat
  mengarah ke gagang. Ukuran baru ikut tersimpan dan bisa diurungkan.
- **Kotak teks bisa dilebarkan:** teks yang dipilih menampilkan gagang
  di tepi kanan dan sudut kanan-bawah — seret ke kanan untuk melebarkan
  kotak (120–2000 px), teks membungkus ulang mengikuti lebar baru dan
  tinggi kotak mengikuti isi secara otomatis. Editor inline ikut
  selebar kotak. Teks lama tanpa lebar tetap terbaca (default 480 px).
- **Edit teks langsung di papan:** klik dua kali teks (atau pilih teks
  lalu tekan ✏️, atau ketuk teks dengan alat 🔤 Teks) membuka editor
  inline tepat di atas teksnya — kursor berkedip di dalam teks, ketik
  langsung di sana; selesai dengan Ctrl+Enter atau klik di luar, Esc
  untuk batal. Bila kursor diarahkan ke sebuah teks, kursor berubah
  jadi kursor teks (I) supaya ketahuan teks itu bisa diedit.
- **Ukuran huruf:** A− / pilihan angka / A+ di toolbar (18–72, default
  28). Berlaku untuk teks yang sedang dipilih, dan menjadi ukuran
  default untuk teks baru/tempelan berikutnya. Teks kosong yang
  disimpan dari editor akan menghapus teks itu.
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
  `PATCH/DELETE /api/users/:id` (admin), `POST /api/me/password` (login),
  `GET/PUT /api/sessions` (login, sesi milik sendiri).

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

## Simpan di server (pengguna yang login)

- Satu papan per pengguna, tersimpan di tabel `user_boards` sebagai JSON
  `{version:3, currentId, sessions}` yang sama dengan format localStorage v3.
  Tiap halaman berisi goresan, teks `{kind:"text", x, y, text, color, fontSize}`,
  dan gambar `{kind:"image", x, y, w, h, src}` (src dataURL).
- Endpoint (wajib login): `GET /api/sessions`, `PUT /api/sessions`. Validasi
  server: format v3, maks. 20 sesi, maks. 100 halaman/sesi, maks. 5000 butir/halaman,
  maks. 5 MB total; teks maks. 2000 karakter, gambar dataURL maks. 2 MB/butir;
  tiap pengguna hanya bisa membaca/menulis barisnya sendiri.
- Klien: setiap perubahan papan disimpan lokal dulu, lalu disinkronkan ke
  server (debounce ±400 ms, indikator di footer: ☁️ Tersimpan di server).
  Saat dibuka / setelah login: server kosong + lokal berisi -> lokal
  diunggah; lokal kosong -> papan server dimuat; keduanya berisi dan
  berbeda -> pengguna ditanya (OK = pakai server, Batal = lokal menimpa
  server). Tidak ada penimpaan diam-diam.
- **Tanpa login, papan tetap hanya di browser perangkat itu** (seperti
  sebelumnya). Tautan berbagi / mode view-only untuk siswa adalah fase
  berikut, belum dibangun.

## Rencana berikut (belum dibangun)

- Tautan berbagi ala GezyBoard: pemilik login, pengunjung tanpa login
  (termasuk mode view-only dan tautan berpassword/kedaluwarsa agar tidak
  bisa divandalisme)
- Multi-pengguna real-time via WebSocket (pola GezyBoard)
- Undo per goresan berbasis model data

© 2026 GezyTech App · Dikembangkan oleh PakGun · Dilarang menyalin/menduplikat kode tanpa izin tertulis.
