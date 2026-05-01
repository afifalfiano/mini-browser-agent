# Implementation Plan: Realtime Token Usage Summary

## Overview

Implementasi dilakukan secara inkremental dalam 6 tahap: setup test framework, buat modul `TokenTracker` (logika inti), buat komponen `TokenDisplay` (UI), integrasi ke `sidebar.js` dan `sidebar.html`, tambah CSS, lalu wiring akhir dan persistensi storage. Setiap tahap langsung divalidasi dengan unit test dan property-based test sebelum lanjut ke tahap berikutnya.

## Tasks

- [x] 1. Setup test framework (Vitest + fast-check)
  - Install Vitest dan fast-check sebagai devDependencies: `npm install --save-dev vitest@latest fast-check@latest`
  - Tambahkan script `"test": "vitest --run"` ke `package.json`
  - Buat file konfigurasi `vitest.config.js` di root project dengan environment `jsdom` agar DOM API tersedia saat test
  - Buat direktori `tests/` dan file placeholder `tests/.gitkeep`
  - _Requirements: Testing Strategy (design.md)_

- [x] 2. Implementasi modul `TokenTracker` — logika ekstraksi dan estimasi token
  - Buat file `token-tracker.js` di root project
  - Definisikan `PRICING_CONFIG` dengan harga keempat model MiniMax (M2.7, M2.7-Pro, M2.5, M2.5-Pro) dan `DEFAULT_PRICING_MODEL`
  - Implementasikan fungsi internal `_extractFromUsage(raw)`: ekstrak `prompt_tokens`, `completion_tokens`, `total_tokens` dari field `usage`; kembalikan `null` jika field tidak ada atau bukan angka
  - Implementasikan fungsi internal `_estimateTokens(text)`: kembalikan `Math.ceil(text.length / 4)` untuk string apapun
  - Implementasikan fungsi internal `_calculateCost(promptTokens, completionTokens, model)`: gunakan `PRICING_CONFIG[model]` atau fallback ke `DEFAULT_PRICING_MODEL`
  - Implementasikan fungsi internal `_formatTokenCount(n)`: gunakan `toLocaleString()` untuk pemisah ribuan
  - Implementasikan fungsi internal `_formatCost(usd)`: kembalikan string format `$X.XX` dengan dua desimal
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.4, 3.5, 4.6_

  - [x] 2.1 Write property test: ekstraksi token dari `usage` adalah identitas (Property 1)
    - **Property 1: Ekstraksi token dari `usage` adalah identitas**
    - **Validates: Requirements 1.1**
    - File: `tests/token-tracker.property.test.js`
    - Gunakan `fc.record({ prompt_tokens, completion_tokens, total_tokens })` dengan integer 0–100000
    - Verifikasi `result.promptTokens === usage.prompt_tokens`, `result.completionTokens === usage.completion_tokens`, `result.isEstimated === false`
    - `numRuns: 100`

  - [x] 2.2 Write property test: estimasi token berbasis karakter (Property 2)
    - **Property 2: Estimasi token berbasis karakter mengikuti formula ceil(n/4)**
    - **Validates: Requirements 1.2**
    - Gunakan `fc.string()` untuk semua string arbitrary
    - Verifikasi `_estimateTokens(s) === Math.ceil(s.length / 4)`
    - `numRuns: 100`

  - [x] 2.3 Write property test: kalkulasi biaya mengikuti formula pricing (Property 5)
    - **Property 5: Kalkulasi biaya mengikuti formula pricing**
    - **Validates: Requirements 3.2**
    - Gunakan `fc.integer({ min: 0, max: 100000 })` untuk promptTokens dan completionTokens, `fc.constantFrom(...)` untuk model
    - Verifikasi `Math.abs(actual - expected) < 1e-10`
    - `numRuns: 100`

  - [x] 2.4 Write property test: format biaya selalu menghasilkan string USD dua desimal (Property 7)
    - **Property 7: Format biaya selalu menghasilkan string USD dua desimal**
    - **Validates: Requirements 3.5**
    - Gunakan `fc.float({ min: 0, max: 9999, noNaN: true })`
    - Verifikasi `/^\$\d+\.\d{2}$/.test(_formatCost(n))`
    - `numRuns: 100`

  - [x] 2.5 Write property test: format token count menggunakan pemisah ribuan (Property 8)
    - **Property 8: Format token count menggunakan pemisah ribuan untuk n ≥ 1000**
    - **Validates: Requirements 4.6**
    - Dua sub-assertion: `fc.integer({ min: 1000, max: 10_000_000 })` harus mengandung koma; `fc.integer({ min: 0, max: 999 })` tidak boleh mengandung koma
    - `numRuns: 100`

  - [x] 2.6 Write unit tests: fungsi-fungsi internal token-tracker
    - Test `_extractFromUsage` dengan `usage` valid, `usage` null/undefined, field bukan angka
    - Test `_estimateTokens` dengan string kosong, string pendek, string panjang
    - Test `_calculateCost` dengan model yang ada di config dan model yang tidak ada (fallback)
    - Test `_formatCost` dengan 0, nilai kecil, nilai besar
    - Test `_formatTokenCount` dengan 0, 999, 1000, 1000000

- [x] 3. Implementasi `TokenTracker` — state management dan akumulasi
  - Definisikan state in-memory `_state` dengan semua field `TokenState` diinisialisasi ke nol/null/false
  - Implementasikan `TokenTracker._accumulateRecord(record)`: tambahkan nilai record ke semua field kumulatif, increment `callCount`, update `lastCall`, set `hasEstimatedCalls` jika `record.isEstimated === true`
  - Implementasikan `TokenTracker.record(opts)`: panggil `_extractFromUsage` → jika null, gunakan `_estimateTokens` → panggil `_calculateCost` → buat `ApiCallRecord` → panggil `_accumulateRecord` → kembalikan `getState()`
  - Implementasikan `TokenTracker.reset()`: set semua field `_state` ke nol/null/false
  - Implementasikan `TokenTracker.getState()`: kembalikan shallow copy dari `_state`
  - Implementasikan `TokenTracker.setLoading(active)` dan `TokenTracker.isLoading()`
  - Expose `TokenTracker` ke `window.TokenTracker`
  - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.3_

  - [x] 3.1 Write property test: akumulasi token adalah jumlah dari semua panggilan (Property 3)
    - **Property 3: Akumulasi token adalah jumlah dari semua panggilan**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Gunakan `fc.array(fc.record({ promptTokens, completionTokens }), { minLength: 0, maxLength: 50 })`
    - Reset sebelum setiap run, panggil `TokenTracker._accumulateRecord` untuk setiap item
    - Verifikasi `cumulativeTotalTokens`, `cumulativePromptTokens`, `cumulativeCompletionTokens`, `callCount`
    - `numRuns: 100`

  - [x] 3.2 Write property test: reset mengembalikan semua akumulasi ke nol (Property 4)
    - **Property 4: Reset mengembalikan semua akumulasi ke nol**
    - **Validates: Requirements 2.4**
    - Gunakan `fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 0, maxLength: 30 })`
    - Akumulasikan records, panggil `reset()`, verifikasi semua field nol dan `lastCall === null`
    - `numRuns: 100`

  - [x] 3.3 Write property test: akumulasi biaya adalah jumlah dari semua biaya per panggilan (Property 6)
    - **Property 6: Akumulasi biaya adalah jumlah dari semua biaya per panggilan**
    - **Validates: Requirements 3.3**
    - Gunakan array records dengan `costUsd` acak, verifikasi `cumulativeCostUsd === sum(costUsd[i])`
    - Toleransi floating point `< 1e-9`
    - `numRuns: 100`

  - [x] 3.4 Write unit tests: TokenTracker state management
    - Test state awal semua nol setelah inisialisasi
    - Test `record()` dengan raw response yang memiliki `usage` (path ekstraksi)
    - Test `record()` dengan raw response tanpa `usage` (path estimasi)
    - Test `record()` dengan model tidak ada di PRICING_CONFIG (fallback + `hasEstimatedCalls`)
    - Test `reset()` setelah beberapa panggilan
    - Test `getState()` mengembalikan copy (bukan referensi langsung)

- [x] 4. Checkpoint — Pastikan semua tests lulus
  - Jalankan `npm test` dan pastikan semua unit test dan property test di task 2 dan 3 lulus
  - Pastikan tidak ada error TypeScript/lint yang kritis
  - Tanyakan ke user jika ada pertanyaan sebelum lanjut

- [x] 5. Implementasi `TokenDisplay` — komponen UI
  - Di dalam `token-tracker.js`, definisikan objek `TokenDisplay`
  - Implementasikan `TokenDisplay.init()`: cari elemen `#token-display-panel` di DOM; jika tidak ditemukan, log warning dan return (tidak throw)
  - Implementasikan `TokenDisplay.update(state)`: perbarui semua elemen DOM (`#token-cumulative`, `#token-breakdown`, `#token-calls`, `#token-cost`, `#token-last`); tampilkan/sembunyikan panel berdasarkan `state.cumulativeTotalTokens > 0`; semua operasi DOM dibungkus try/catch
  - Implementasikan `TokenDisplay.setLoading(active)`: tampilkan/sembunyikan elemen `.token-loading`
  - Expose `TokenDisplay` ke `window.TokenDisplay`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 5.1, 5.2_

  - [x] 5.1 Write property test: panel visible jika dan hanya jika cumulative > 0 (Property 9)
    - **Property 9: Panel token visible jika dan hanya jika cumulative > 0**
    - **Validates: Requirements 4.4, 4.5**
    - Setup DOM minimal dengan elemen `#token-display-panel` menggunakan jsdom
    - Gunakan `fc.integer({ min: 1, max: 1_000_000 })` untuk state dengan cumulative > 0 → panel tidak boleh punya class `hidden`
    - Gunakan state dengan `cumulativeTotalTokens === 0` → panel harus punya class `hidden`
    - `numRuns: 100`

  - [x] 5.2 Write property test: rendered display mengandung semua data yang diperlukan (Property 10)
    - **Property 10: Rendered display mengandung semua data yang diperlukan**
    - **Validates: Requirements 4.3**
    - Gunakan `fc.record({ cumulativeTotalTokens: fc.integer({ min: 1 }), cumulativePromptTokens, cumulativeCompletionTokens, callCount: fc.integer({ min: 1 }), cumulativeCostUsd: fc.float({ min: 0 }) })`
    - Setelah `TokenDisplay.update(state)`, verifikasi elemen DOM mengandung nilai yang diformat
    - `numRuns: 100`

  - [x] 5.3 Write unit tests: TokenDisplay rendering
    - Test panel tersembunyi saat `cumulativeTotalTokens === 0`
    - Test panel terlihat saat `cumulativeTotalTokens > 0`
    - Test atribut `aria-live="polite"` ada di panel
    - Test loading indicator muncul saat `setLoading(true)` dan hilang saat `setLoading(false)`
    - Test data `lastCall` ditampilkan saat ada panggilan
    - Test `TokenDisplay.update()` tidak throw jika elemen DOM tidak ditemukan

- [x] 6. Tambah HTML panel ke `sidebar.html`
  - Buka `sidebar.html` dan sisipkan elemen `#token-display-panel` di antara `#highlight-toast` dan `#task-progress`
  - Struktur HTML sesuai design doc: `div#token-display-panel.token-panel.hidden` dengan `aria-live="polite"`, `aria-label="Token usage summary"`, `role="status"`
  - Di dalam panel: `.token-panel-inner` berisi `span.token-label`, `span.token-loading.hidden`, `span#token-cumulative`, `span#token-breakdown`, `span#token-calls`, `span#token-cost`, `span#token-last`
  - Tambahkan `<script src="token-tracker.js"></script>` sebelum `<script src="sidebar.js"></script>`
  - _Requirements: 4.1, 8.1, 8.3_

- [x] 7. Tambah CSS untuk panel token ke `sidebar.css`
  - Tambahkan styles untuk `.token-panel`: layout horizontal, `background: var(--bg-2)`, `border-bottom: 1px solid var(--border)`, `padding: 6px 14px`, `flex-shrink: 0`
  - Tambahkan styles untuk `.token-panel-inner`: `display: flex`, `align-items: center`, `gap: 8px`, `flex-wrap: wrap`, `font-size: 11px`
  - Tambahkan styles untuk `.token-label`: `font-weight: 600`, `color: var(--text-dim)`, `font-size: 11px`
  - Tambahkan styles untuk `.token-cumulative`: `color: var(--text)`, `font-weight: 600`, `font-family: var(--font-mono)`
  - Tambahkan styles untuk `.token-breakdown`: `color: var(--text-dim)`, `font-family: var(--font-mono)`, `font-size: 10.5px`
  - Tambahkan styles untuk `.token-calls`: `color: var(--text-muted)`, `font-size: 10.5px`
  - Tambahkan styles untuk `.token-cost`: `color: var(--green)`, `font-family: var(--font-mono)`, `font-weight: 600`
  - Tambahkan styles untuk `.token-last`: `color: var(--text-muted)`, `font-size: 10px`, `font-style: italic`
  - Tambahkan styles untuk `.token-loading`: animasi `pulse` (sudah ada di CSS), `color: var(--yellow)`
  - Pastikan semua font-size minimal 11px (Requirements 8.4) dan kontras warna memenuhi WCAG 2.1 AA (Requirements 8.2)
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 8. Integrasi `TokenTracker` ke `sidebar.js`
  - Buka `sidebar.js` dan temukan titik integrasi: baris setelah `const reply = res.data?.content || "No response.";` di dalam `runAgentLoop`
  - Tambahkan blok try/catch sesuai design doc: panggil `TokenTracker.record({ raw, model, provider, promptMessages: apiMessages, completionText: reply })`, lalu `TokenDisplay.update(tokenState)`
  - Tambahkan `TokenDisplay.setLoading(true)` sebelum `sendToBackground({ type: "PROVIDER_CHAT", ... })` dipanggil
  - Tambahkan `TokenDisplay.setLoading(false)` di blok finally setelah respons diterima
  - Modifikasi handler `clearBtn` untuk memanggil `TokenTracker.reset()` dan `TokenDisplay.update(TokenTracker.getState())` saat chat di-clear
  - Modifikasi handler `stopBtn` untuk memanggil `TokenDisplay.setLoading(false)`
  - Tambahkan panggilan `TokenDisplay.init()` di dalam fungsi init utama (setelah DOM siap)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 2.4, 5.1, 5.2, 5.3_

  - [x] 8.1 Write property test: error di dalam token tracking tidak menghentikan agent loop (Property 11)
    - **Property 11: Error di dalam token tracking tidak menghentikan agent loop**
    - **Validates: Requirements 7.2**
    - Mock `TokenTracker.record` agar selalu throw error
    - Verifikasi bahwa kode wrapper (try/catch di sidebar.js) tidak melempar exception ke atas
    - Gunakan `fc.anything()` sebagai input untuk memastikan berbagai jenis error
    - `numRuns: 100`

  - [x] 8.2 Write unit tests: integrasi sidebar
    - Test `TokenDisplay.setLoading(true)` dipanggil sebelum API call
    - Test `TokenDisplay.setLoading(false)` dipanggil setelah API call (termasuk saat error)
    - Test `TokenTracker.reset()` dipanggil saat clear chat
    - Test error di `TokenTracker.record()` tidak menghentikan eksekusi

- [x] 9. Implementasi persistensi storage
  - Di dalam `token-tracker.js`, implementasikan `TokenTracker.loadFromStorage()`: panggil `chrome.storage.session.get("token_usage_session")` (fallback ke `chrome.storage.local.get` jika session tidak tersedia); jika data ada, restore ke `_state`; jika gagal, mulai dengan state kosong dan log error ke console
  - Di dalam `TokenTracker._accumulateRecord()`, tambahkan panggilan async non-blocking ke `chrome.storage.session.set({ token_usage_session: _state })` (atau local sebagai fallback); jika gagal, log error ke console tanpa throw — state in-memory tetap dipertahankan
  - Di dalam `TokenTracker.reset()`, tambahkan panggilan async non-blocking ke `chrome.storage.session.remove("token_usage_session")` (atau local)
  - Panggil `TokenTracker.loadFromStorage()` di dalam `TokenDisplay.init()` setelah DOM siap
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.1 Write property test: kegagalan storage tidak mengubah state in-memory (Property 12)
    - **Property 12: Kegagalan storage tidak mengubah state in-memory**
    - **Validates: Requirements 6.4**
    - Mock `chrome.storage.session.set` agar selalu reject/throw
    - Gunakan `fc.array(fc.record({ promptTokens, completionTokens }), { minLength: 1, maxLength: 20 })`
    - Verifikasi bahwa `state.cumulativeTotalTokens`, `state.callCount`, dan semua akumulasi tetap benar meskipun storage gagal
    - `numRuns: 100`

  - [x] 9.2 Write property test: ekstraksi provider-agnostic (Property 13)
    - **Property 13: Ekstraksi provider-agnostic: `usage` digunakan jika ada, estimasi jika tidak**
    - **Validates: Requirements 7.5**
    - Dua sub-assertion: objek dengan field `usage` valid → `isEstimated === false`; objek tanpa field `usage` → `isEstimated === true`
    - Gunakan `fc.record(...)` untuk generate berbagai bentuk objek respons
    - `numRuns: 100`

  - [x] 9.3 Write unit tests: storage integration
    - Test data token tersimpan ke `chrome.storage` setelah setiap panggilan (mock Chrome API)
    - Test data token di-restore dari storage saat `loadFromStorage()` dipanggil
    - Test storage dihapus saat `reset()` dipanggil
    - Test `chrome.storage.get` gagal saat init → mulai dengan state kosong

- [x] 10. Checkpoint akhir — Pastikan semua tests lulus dan fitur terintegrasi
  - Jalankan `npm test` dan pastikan semua unit test dan property test (13 properties) lulus
  - Verifikasi `sidebar.html` memuat `token-tracker.js` sebelum `sidebar.js`
  - Verifikasi panel token tersembunyi saat pertama kali dibuka (belum ada panggilan API)
  - Verifikasi panel token muncul setelah panggilan API pertama
  - Tanyakan ke user jika ada pertanyaan sebelum dianggap selesai

## Notes

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Property tests memvalidasi properti universal dengan minimum 100 iterasi per property
- Unit tests memvalidasi contoh spesifik dan edge case
- Semua 13 correctness properties dari design doc dicakup oleh property tests
- `token-tracker.js` harus bisa berjalan di browser extension context (tidak ada `require`/`import` — gunakan IIFE atau global assignment)
- Chrome API (`chrome.storage`) perlu di-mock saat testing karena tidak tersedia di jsdom
