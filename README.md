# PapanTulis

Prototipe papan coretan bebas satu pengguna.

Buka `index.html` langsung di browser, atau layani sebagai situs statis.
Tidak perlu build, tidak perlu backend.

## Fitur

- Coret bebas pakai jari, mouse, atau stylus (Pointer Events + Canvas 2D)
- Pena, stabilo, dan penghapus
- Pilihan warna + warna bebas, ketebalan 2–24 px
- Latar polos, kotak-kotak, atau bergaris
- Urungkan / ulangi (juga Ctrl+Z / Ctrl+Y)
- Hapus papan (masih bisa diurungkan)
- Simpan otomatis di perangkat ini (localStorage)
- Ekspor PNG (latar putih)

## Cara pakai

1. Buka `index.html`.
2. Pilih alat dan warna, lalu coret di papan.
3. Tekan **Simpan PNG** untuk mengunduh hasil coretan.

## Rencana berikut (belum dibangun)

- Multi-pengguna real-time via WebSocket (pola GezyBoard: Bun + Hono + SQLite)
- Simpan papan di server, bukan hanya di perangkat
- Teks, bentuk, dan undo per goresan berbasis model data (bukan foto kondisi papan)

© 2026 GezyTech App · Dikembangkan oleh PakGun · Dilarang menyalin/menduplikat kode tanpa izin tertulis.
