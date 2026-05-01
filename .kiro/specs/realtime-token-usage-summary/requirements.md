# Requirements Document

## Introduction

Fitur **Realtime Token Usage Summary** menambahkan kemampuan pelacakan dan tampilan penggunaan token AI secara langsung (live) di dalam sidebar extension Mini Browser Agent. Setiap kali extension melakukan panggilan ke API provider AI (saat ini MiniMax), jumlah token yang digunakan — baik token input (prompt) maupun token output (completion) — dicatat, diakumulasikan per sesi, dan ditampilkan secara realtime di UI sidebar. Selain hitungan token, fitur ini juga menampilkan estimasi biaya berdasarkan harga per token dari masing-masing model, serta statistik tambahan seperti jumlah panggilan API dan rata-rata token per panggilan.

Fitur ini dirancang agar tidak mengganggu alur kerja agent yang sudah ada, bersifat non-blocking, dan dapat di-reset bersama sesi chat.

---

## Glossary

- **Token_Tracker**: Modul JavaScript baru (`token-tracker.js`) yang bertanggung jawab mencatat, mengakumulasikan, dan menyimpan data penggunaan token per sesi.
- **Token_Display**: Komponen UI di sidebar yang menampilkan ringkasan penggunaan token secara realtime.
- **Session**: Satu sesi percakapan aktif, dimulai saat pengguna mengirim pesan pertama dan berakhir saat chat di-clear atau extension di-reload.
- **Prompt_Tokens**: Jumlah token yang dikirim ke API sebagai input (system prompt + conversation history + user message).
- **Completion_Tokens**: Jumlah token yang dikembalikan oleh API sebagai output (respons AI).
- **Total_Tokens**: Jumlah Prompt_Tokens ditambah Completion_Tokens untuk satu panggilan API.
- **Cumulative_Tokens**: Akumulasi Total_Tokens dari seluruh panggilan API dalam satu Session.
- **Cost_Estimate**: Estimasi biaya dalam USD yang dihitung dari Cumulative_Tokens dikalikan harga per token model yang aktif.
- **API_Call**: Satu permintaan ke endpoint provider AI yang menghasilkan satu respons.
- **Provider**: Penyedia layanan AI yang terdaftar di `ProviderManager` (saat ini: MiniMax).
- **Pricing_Config**: Konfigurasi harga per 1.000 token (input dan output) untuk setiap model yang didukung.
- **Raw_Response**: Objek JSON mentah yang dikembalikan oleh API provider, berisi field `usage` dengan data token.

---

## Requirements

### Requirement 1: Ekstraksi Data Token dari Respons API

**User Story:** Sebagai pengguna extension, saya ingin data penggunaan token diambil secara otomatis dari setiap respons API, sehingga saya tidak perlu melakukan konfigurasi tambahan untuk mendapatkan informasi token.

#### Acceptance Criteria

1. WHEN respons API MiniMax diterima dan field `usage` tersedia di dalam `raw` response, THE Token_Tracker SHALL mengekstrak nilai `prompt_tokens`, `completion_tokens`, dan `total_tokens` dari field tersebut.
2. WHEN field `usage` tidak tersedia di dalam respons API, THE Token_Tracker SHALL memperkirakan jumlah token menggunakan rumus estimasi berbasis karakter (jumlah karakter dibagi 4, dibulatkan ke atas) untuk Prompt_Tokens dan Completion_Tokens.
3. WHEN ekstraksi atau estimasi token selesai, THE Token_Tracker SHALL menyimpan data tersebut sebagai satu record API_Call yang mencakup: timestamp, nama model, Prompt_Tokens, Completion_Tokens, Total_Tokens, dan nama provider.
4. THE Token_Tracker SHALL memproses data token secara sinkron setelah setiap respons API diterima, sebelum UI diperbarui.

---

### Requirement 2: Akumulasi Token Per Sesi

**User Story:** Sebagai pengguna extension, saya ingin melihat total token yang sudah dipakai sejak awal sesi percakapan, sehingga saya bisa memantau konsumsi keseluruhan dalam satu sesi kerja.

#### Acceptance Criteria

1. THE Token_Tracker SHALL mempertahankan Cumulative_Tokens yang merupakan jumlah Total_Tokens dari semua API_Call dalam Session aktif.
2. THE Token_Tracker SHALL mempertahankan hitungan terpisah untuk total Prompt_Tokens kumulatif dan total Completion_Tokens kumulatif dalam Session aktif.
3. THE Token_Tracker SHALL mempertahankan hitungan jumlah API_Call yang telah dilakukan dalam Session aktif.
4. WHEN pengguna mengklik tombol clear chat, THE Token_Tracker SHALL mereset semua akumulasi token (Cumulative_Tokens, jumlah API_Call, dan estimasi biaya) ke nilai nol.
5. WHEN extension di-reload atau sidebar ditutup dan dibuka kembali, THE Token_Tracker SHALL memulai sesi baru dengan akumulasi token dimulai dari nol.

---

### Requirement 3: Kalkulasi Estimasi Biaya

**User Story:** Sebagai pengguna extension, saya ingin melihat estimasi biaya penggunaan API dalam USD, sehingga saya bisa mengontrol pengeluaran saya saat menggunakan extension.

#### Acceptance Criteria

1. THE Token_Tracker SHALL menyimpan Pricing_Config yang berisi harga per 1.000 token (input dan output) untuk setiap model MiniMax yang didukung: MiniMax-M2.7, MiniMax-M2.7-Pro, MiniMax-M2.5, dan MiniMax-M2.5-Pro.
2. WHEN Total_Tokens dari sebuah API_Call telah dihitung, THE Token_Tracker SHALL menghitung Cost_Estimate untuk panggilan tersebut menggunakan formula: `(prompt_tokens / 1000 * input_price) + (completion_tokens / 1000 * output_price)`.
3. THE Token_Tracker SHALL mengakumulasikan Cost_Estimate dari setiap API_Call menjadi total biaya sesi.
4. WHEN model yang aktif tidak ditemukan di dalam Pricing_Config, THE Token_Tracker SHALL menggunakan harga default model MiniMax-M2.7 sebagai fallback dan menampilkan indikator bahwa harga bersifat estimasi.
5. THE Token_Tracker SHALL menampilkan Cost_Estimate dalam format USD dengan presisi dua desimal (contoh: "$0.03").
6. WHERE provider baru ditambahkan ke ProviderManager di masa depan, THE Token_Tracker SHALL mendukung penambahan Pricing_Config baru tanpa mengubah logika kalkulasi inti.

---

### Requirement 4: Tampilan Realtime di UI Sidebar

**User Story:** Sebagai pengguna extension, saya ingin melihat ringkasan penggunaan token yang diperbarui secara langsung setelah setiap respons AI, sehingga saya selalu mendapatkan informasi terkini tanpa harus melakukan aksi tambahan.

#### Acceptance Criteria

1. THE Token_Display SHALL menampilkan panel ringkasan token di dalam sidebar chat screen, di bawah header dan di atas area pesan.
2. WHEN sebuah API_Call selesai dan data token tersedia, THE Token_Display SHALL memperbarui tampilan dalam waktu tidak lebih dari 300ms setelah data token diterima.
3. THE Token_Display SHALL menampilkan informasi berikut secara bersamaan: total Cumulative_Tokens sesi, breakdown Prompt_Tokens dan Completion_Tokens kumulatif, jumlah API_Call, dan Cost_Estimate total sesi.
4. WHEN Cumulative_Tokens bernilai nol (belum ada panggilan API), THE Token_Display SHALL menyembunyikan panel ringkasan token agar tidak memenuhi ruang UI.
5. WHEN Cumulative_Tokens lebih dari nol, THE Token_Display SHALL menampilkan panel ringkasan token secara visible.
6. THE Token_Display SHALL menggunakan format angka yang mudah dibaca: angka di bawah 1.000 ditampilkan apa adanya, angka 1.000 ke atas ditampilkan dengan pemisah ribuan (contoh: "1,234 tokens").
7. THE Token_Display SHALL menampilkan data token dari API_Call terakhir (bukan kumulatif) sebagai informasi tambahan dalam format tooltip atau teks sekunder yang dapat dibedakan secara visual dari data kumulatif.

---

### Requirement 5: Indikator Loading Realtime

**User Story:** Sebagai pengguna extension, saya ingin melihat indikator visual bahwa token sedang dihitung saat agent sedang berjalan, sehingga saya tahu sistem sedang aktif memproses.

#### Acceptance Criteria

1. WHILE agent loop sedang berjalan dan menunggu respons API, THE Token_Display SHALL menampilkan indikator animasi (spinner atau pulsing dot) di samping label token untuk menunjukkan bahwa kalkulasi sedang berlangsung.
2. WHEN respons API diterima dan data token telah diperbarui, THE Token_Display SHALL menghentikan indikator animasi dan menampilkan nilai token yang diperbarui.
3. WHEN pengguna mengklik tombol Stop untuk menghentikan agent, THE Token_Display SHALL menghentikan indikator animasi dan mempertahankan nilai token terakhir yang tercatat.

---

### Requirement 6: Persistensi Data Token Dalam Sesi

**User Story:** Sebagai pengguna extension, saya ingin data token sesi saya tetap tersimpan selama sidebar terbuka, sehingga saya tidak kehilangan informasi penggunaan meskipun saya berpindah tab browser.

#### Acceptance Criteria

1. THE Token_Tracker SHALL menyimpan data akumulasi token sesi aktif di dalam `chrome.storage.session` (atau `chrome.storage.local` sebagai fallback) dengan key `token_usage_session`.
2. WHEN pengguna berpindah tab browser dan kembali ke sidebar, THE Token_Display SHALL menampilkan data token yang tersimpan tanpa kehilangan akumulasi sebelumnya.
3. WHEN pengguna mengklik clear chat, THE Token_Tracker SHALL menghapus data token yang tersimpan di storage bersamaan dengan reset akumulasi in-memory.
4. IF penyimpanan token ke storage gagal karena error, THEN THE Token_Tracker SHALL tetap mempertahankan data akumulasi in-memory dan mencatat error ke console tanpa mengganggu alur kerja agent.

---

### Requirement 7: Integrasi Non-Disruptif dengan Agent Loop

**User Story:** Sebagai developer extension, saya ingin fitur token tracking terintegrasi ke dalam alur kerja agent yang sudah ada tanpa mengubah perilaku atau performa agent, sehingga fitur baru ini tidak merusak fungsionalitas yang sudah berjalan.

#### Acceptance Criteria

1. THE Token_Tracker SHALL diintegrasikan ke dalam `sidebar.js` di titik setelah respons API diterima dari `sendToBackground`, tanpa mengubah logika parsing action atau alur agent loop.
2. IF Token_Tracker mengalami error saat memproses data token, THEN THE Token_Tracker SHALL menangkap error tersebut secara internal (try/catch) dan melanjutkan eksekusi agent loop tanpa melempar exception ke atas.
3. THE Token_Tracker SHALL beroperasi secara asinkron non-blocking sehingga pemrosesan token tidak menambah latensi yang terukur (lebih dari 10ms) pada waktu respons agent.
4. THE Token_Tracker SHALL kompatibel dengan semua mode agent yang ada (Agent, Reader, Form Filler, Researcher) tanpa memerlukan konfigurasi per-mode.
5. WHEN provider baru selain MiniMax ditambahkan ke ProviderManager, THE Token_Tracker SHALL mencoba mengekstrak data token dari field `usage` pada respons provider tersebut menggunakan struktur yang sama, dan menggunakan estimasi berbasis karakter sebagai fallback jika struktur berbeda.

---

### Requirement 8: Aksesibilitas dan Responsivitas UI

**User Story:** Sebagai pengguna extension, saya ingin panel token usage dapat diakses dengan baik dan tidak mengganggu tampilan sidebar yang sudah ada, sehingga pengalaman menggunakan extension tetap nyaman.

#### Acceptance Criteria

1. THE Token_Display SHALL menggunakan elemen HTML semantik dengan atribut `aria-live="polite"` agar pembaca layar dapat mengumumkan pembaruan token tanpa mengganggu alur baca pengguna.
2. THE Token_Display SHALL memiliki kontras warna yang memenuhi standar WCAG 2.1 level AA (rasio kontras minimal 4.5:1) antara teks token dan latar belakang panel.
3. THE Token_Display SHALL menampilkan panel token dalam layout yang tidak melebihi lebar sidebar (maksimum 100% dari lebar container) dan tidak menyebabkan horizontal scroll.
4. THE Token_Display SHALL menggunakan ukuran font minimal 11px agar teks token dapat dibaca dengan jelas di dalam sidebar yang memiliki lebar terbatas.
