# 📖 YA ROSUL - Aplikasi Web & Mobile Dzikir Ratibul Haddad

Aplikasi Web Mobile (*Progressive Web App - PWA*) untuk pembacaan dzikir, wirid, dan surat-surat pilihan berdasarkan buku amalan **"Majlis Dzikir & Ta'lim YA ROSUL"** (Pondok Pesantren Salafiyah Nurul Huda, Pajaran - Poncokusumo Malang).

Aplikasi ini didesain khusus **Mobile-First** agar sangat nyaman, jelas, dan ringan digunakan di HP (smartphone) saat menghadiri majlis dzikir maupun amalan harian.

---

## ✨ Fitur Utama

### 1. 📖 Mode Buku HD (Scan Asli)
- Tampilan 48 halaman buku asli dalam format WebP resolusi tinggi dan ringan.
- **Navigasi Sentuh HP:** Geser/swipe layar ke kanan atau ke kiri untuk berpindah halaman seperti membaca lembaran buku fisik.
- Slider scrubber & tombol *jump to chapter* cepat (Cover, Kata Pengantar, Surat Yasin, Surat Al-Waqi'ah, Ratibul Haddad, Fadhilah).
- Pembesar tampilan (Zoom 1x, 1.5x, 2x atau double-tap) untuk memperjelas tulisan pada layar HP kecil.

### 2. 📿 Mode Teks Digital & Tasbih Interaktif
- **Ratibul Haddad Lengkap:** Teks Arab jernih, transliterasi Latin, dan terjemahan bahasa Indonesia.
- **Counter Tasbih Digital Interaktif:** Setiap bacaan yang diulang (3x, 7x, 50x, dll.) memiliki tombol hitung langsung di layar.
- **Efek Suara & Getar:** Memberikan umpan balik suara klik lembut (*Web Audio*) dan getaran haptik pada HP saat tombol hitungan ditekan.
- **Surat Yasin (83 Ayat):** Teks Arab resmi Kemenag lengkap dengan latin dan terjemahan.
- **Surat Al-Waqi'ah (96 Ayat):** Teks Arab resmi Kemenag lengkap dengan latin dan terjemahan.
- **Fadhilah & Biografi:** Manfaat membaca Ratibul Haddad serta biografi Shohibur Ratib Al-Imam Abdullah bin Alawi Al-Haddad dan sanad perguruan.

### 3. ⭕ Tasbih Mandiri (Floating Action Button)
- Lingkaran cincin animasi progresif untuk dzikir bebas kapan saja.
- Pilihan target dzikir: 33x, 100x, 1000x, atau hitung bebas tanpa batas.

### 4. ⚙️ Pengaturan Kenyamanan Membaca
- **3 Pilihan Tema:**
  - *Emerald Gold* (Hijau zamrud elegan dengan aksen emas)
  - *Dark Velvet* (Mode malam OLED untuk membaca di ruangan redup/masjid tanpa menyilaukan mata)
  - *Sepia Ivory* (Warna kertas klasik yang hangat di mata)
- Slider pengatur ukuran teks Arab (A- / A+).
- Toggle aktif/nonaktif untuk teks Latin dan Terjemahan.
- Toggle suara klik dan getaran haptik HP.

### 5. 📱 PWA & Dukungan Offline
- Dapat diinstal ke layar utama HP (*Add to Home Screen*) layaknya aplikasi Android/iOS bawaan.
- Didukung oleh *Service Worker* dan *Web Manifest* sehingga dapat diakses secara **offline** tanpa koneksi internet setelah dibuka sekali.

---

## 🚀 Cara Menjalankan

### Melalui XAMPP / Web Server:
1. Pastikan folder proyek berada di `htdocs` XAMPP:
   ```
   C:\xampp\htdocs\Yarosul
   ```
2. Nyalakan modul **Apache** pada XAMPP Control Panel.
3. Buka browser:
   - Di PC/Laptop: `http://localhost/Yarosul/`
   - Di HP (dalam jaringan Wi-Fi yang sama): `http://[IP-Komputer-Anda]/Yarosul/`

---

## 📜 Susunan Bab & Halaman Buku
| Halaman | Judul Bab | Kategori |
|---|---|---|
| 1 - 2 | Cover Depan & Mutiara Hikmah | Info |
| 3 - 5 | Kata Pengantar & Sambutan KH. Masykur Hafidh | Muqaddimah |
| 6 - 18 | Surat Yasin (Lengkap 83 Ayat) | Al-Qur'an |
| 19 - 25 | Surat Al-Waqi'ah (Lengkap 96 Ayat) | Al-Qur'an |
| 26 - 41 | Ratibul Haddad Lengkap | Dzikir & Wirid |
| 42 - 45 | Doa Ratibul Haddad | Doa |
| 46 - 48 | Fadhilah & Biografi Shohibur Ratib | Fadhilah |

---

*Diterbitkan oleh Pondok Pesantren Salafiyah Nurul Huda, Pajaran - Poncokusumo, Malang Jawa Timur.*
