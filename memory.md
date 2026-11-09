# memory.md — Memori Proyek Signal System

> Catatan kerja lintas sesi. Update file ini setiap ada keputusan, bug, atau perubahan arsitektur.

## Status (20 Sep 2026)

**Fase 1 — frontend selesai & terverifikasi.** 25 view render PASS, CRUD Store teruji, serve HTTP 200. Data persisten di `localStorage` (key `signal_system_v1`, tombol reset di Settings → Danger zone).

## Deploy (21 Sep 2026 — LIVE)

- Repo: `signalsocietyid-tech/signalsystem`, branch utama **`main`** (di-rename dari `master` agar cocok dengan productionBranch Vercel).
- Production: `https://signalsystem-signalsocietyid-tech.vercel.app/` — HTTP 200, judul "Signal System · Signal Society".
- Project Vercel: `signalsystem` (akun `signalsocietyid-tech`, Hobby). Auto-deploy dari push ke `main`.
- Fix yang dilakukan saat deploy: hapus field lawas `"public": true` dari `vercel.json` (gagal validasi skema), matikan Vercel Authentication (`ssoProtection: null` via API) agar publik bisa akses.
- Catatan: branch `master` masih ada di remote (default branch GitHub masih `master` — perlu owner yang ganti ke `main` di Settings, lalu hapus `master`).
- Tim: 1 orang (Sissy, Account Manager) — `config.js:team` + `currentUser`, default owner/assignee form, signer dokumen print, dan profil sidebar semua Sissy.
- Chat WA customer: tombol Chat di tabel Customers + header detail → modal brief (nomor auto format 62, template penawaran dinamis dari services + project client) → `wa.me` tab baru. Tanpa nomor → toast + buka form edit.

## Keputusan Arsitektur

| # | Keputusan | Alasan |
|---|-----------|--------|
| 1 | Vanilla JS, tanpa framework/build | Vercel-ready statis, nol build step, sesuai brief "frontend/index dulu" |
| 2 | Tailwind v4 browser CDN + `styles.css` custom | Cepat + token brand terpusat sebagai CSS variable |
| 3 | Lapisan `seed → store → db → views` | UI steril dari data; Supabase tinggal ganti adapter di `db.js` tanpa refactor view |
| 4 | Aksen `#FF6600` dari `logosignalsociety-animated.svg`, hemat | Brief: monokrom dominan + momen warna strategis |
| 5 | Chart SVG manual (`ui.js`) | Tanpa dependency; `spark/bars/donut` cukup untuk brief |
| 6 | Log aktivitas + notifikasi otomatis di `insert/update/remove` | Memenuhi modul Activity & Notification tanpa kode berulang |
| 7 | Kanban generik via `bindDrop` + guard `window._dragging` | Satu pola untuk tasks, leads, content; klik kartu tak bocor setelah drag |

## Model Data (inti)

```
CLIENT → PROJECT → MILESTONE → TASK → SUBTASK (+comments, dependencies)
CLIENT → CAMPAIGN → CONTENT (+ MARKETING_EVENT)
CLIENT → PROJECT → INVOICE → PAYMENT/TRANSACTION
LEAD → (convert) → CLIENT   // tanpa input ulang, via tombol Convert
```

Koleksi Store: `clients, leads, projects, milestones, tasks, subtasks, comments, campaigns, content, marketingEvents, invoices, salesOrders, accounts, suppliers, purchaseOrders, bills, transactions, expenses, services, templates, files, activities, notifications, notes, plans`.

Navigasi: **Sales** (Sales Orders, Invoices) dan **Purchase** (Suppliers, Purchase Orders, Bills) adalah section sendiri — bukan bagian Finance.

Relasi uang: `SALES_ORDER → (confirm) → INVOICE → (receivePayment: method + account) → TRANSACTION + saldo ACCOUNT`.
Relasi beli: `SUPPLIER → PURCHASE_ORDER → (confirm) → BILL → (payBill: method + account) → TRANSACTION(expense) − saldo ACCOUNT`.

## Logika Turunan (`store.js`)

- `projectProgress` — % task Done (bisa override manual via `progress_override`).
- `projectHealth` — Delayed jika ≥2 overdue / deadline lewat; At Risk jika ≥1 overdue / blocked / budget >90%.
- Expected revenue lead — `deal_value × probability / 100`.
- `financeTotals` — revenue/expense/profit/outstanding dari transactions + invoices.
- `attention()` — 6 sinyal untuk dashboard (overdue, H-3, invoice overdue, follow-up lead, approval konten, campaign planning).
- `createInvoiceFromSO()` — SO Confirmed → invoice Draft otomatis (nomor, items, total disalin; SO → `Invoiced`; notif deep-link ke print view).
- `receivePayment(inv, {accountId, method, amount})` — partial/full otomatis (`Partially Paid`/`Paid`), tulis income transaction + tambah saldo akun. FX beda currency dicatat di notes.
- `nextSONumber/nextInvoiceNumber` — scan max + 1 (`SO-2504…`, `INV-1045…`).
- `moneyC(n, cur)` — `Rp128.500.000` untuk IDR, `$` untuk USD.
- Purchase mirror: `createBillFromPO()` (PO Confirmed → Bill Unpaid otomatis), `payBill()` (Expense + kurangi saldo akun, status `Partially Paid`/`Paid`), `nextPONumber/nextBillNumber` (`PO-1103…`, `BILL-303…`). Attention: PO Confirmed belum berbill + bill Overdue.

## Bug yang Pernah Diperbaiki

1. `views.js` contentCalendar — kurung `+ (` tak tertutup (`})))` → `}))));`).
2. `app.js` newTask — `F("Project", Sel(...)), 1}` (koma di luar kurung, field render angka `1`) → argumen `1` masuk ke `F`.
3. Kartu kanban content tak bisa diklik (guard `dragContent` melewatkan binding) → ganti ke guard global `window._dragging`.
4. Typo class `border-[#EFEFE D]` di dashboard → `border-[#EFEFED]`.
5. Tombol collapse ikut hilang dalam mode rail → class `brandx` dilepas dari tombol.

## Bukti Uji Terakhir (21 Sep 2026 — data kosong + siap deploy)

- Demo data dihapus: seed hanya master (8 services + 4 templates). LS bump ke `signal_system_v2` → semua user mulai kosong.
- Semua chart demo diganti data real (sparklines flat→nilai aktual, cash-flow 6 minggu, tren 6 bulan, split kategori, win-rate pipeline) + empty-state di setiap modul.
- 27 view render OK dalam state kosong; first-run flow (supplier→PO→bill→bayar BCA) OK; penomoran mulai bersih (`BILL-1`).
- Repo `git init` (+ `.gitignore`), `vercel.json` statis siap. PENTING: CLI di mesin ini login sebagai `masiahsein16-bot` — JANGAN deploy sebelum `vercel login` pakai signalsocietyid@gmail.com.

- Sintaks 7/7 file OK. Render 34/34 view OK (termasuk pasca-fix XSS).
- Secrets: tidak ada key/token di repo (config anonKey default kosong).
- XSS: payload `<img onerror>` netral di customers/suppliers/print/salesOrders. Diperbaiki: helper form `T/Ta/Dd`, semua `*Opts`, opsi akun/SO/PO, helper dokumen print (`docHead/Meta/Bill/Supplier/Items/PayTo/PayFrom/Sign`), notes dokumen.
- Schema: 36 tabel RLS semua, dev policy 35/35 tabel, trigger `updated_at` 19/19 (ketemu + perbaiki: `service_templates` ketinggalan), FK valid, struktur seimbang.
- Serve HTTP 200 (index, db.js, schema.sql). CDN supabase-js reachable (200).
- Catatan: shell butuh internet sekali untuk CDN (Tailwind + supabase-js); dokumen print inline-style → tetap rapi offline. Policy DEV open — ketatkan sebelum produksi. Live Supabase butuh: run schema.sql + anon key + Push.

- `db.js` rewrite: `remote()/useRemote/test/push/pull` + write-through `from()` (split parent + line-items). Teruji dengan Supabase palsu: push 29 tabel, UUID remap, FK utuh (client/bill/account), items terisi, flag `signal_migrated`, write-through insert, pull + attach items — ALL GREEN.
- `schema.sql` + kebijakan DEV open (anon+authenticated, 35 tabel — ketatkan sebelum produksi).
- Settings: Connect (auto-test), Test, Push, Pull, status live/migrated. URL default = project `awxxvxlbebwlzgkepdsb`.

- `node --check` lolos untuk 7 file JS.
- **34/34 view PASS** (tambah `suppliers, purchaseOrders, bills, poPrint, billPrint`).
- Alur teruji: PO-1103 Confirmed → BILL-303 otomatis → bayar 200rb via BCA (Paid, saldo −200rb).
- Sinyal attention `purchase` (PO-1101) + `bills` (BILL-302 overdue); penomoran PO/BILL OK.

- `node --check` lolos untuk 7 file JS.
- **29/29 view PASS** (termasuk `salesOrders, accounts, invoicePrint, soPrint`).
- Alur end-to-end teruji: SO-2504 Confirmed → INV-1045 otomatis → bayar 400 via BCA (Partially Paid, saldo +400) → bayar 600 via PayPal (Paid).
- Sinyal attention `sales` muncul untuk SO-2502 (Confirmed belum ber-invoice); penomoran + format IDR OK.
- Serve Node HTTP: `index.html` 200.

## Live Supabase + Governance (9 Nov 2026)

App sekarang **live ke Supabase** (bukan lagi local mode + Push/Pull manual).

- **Login wajib** (Supabase Auth). Role dari `public.profiles.role`: `admin` = CEO (memutuskan semua approval), `manager` = delegasi (outreach, pesan, meeting, scope change), `member/finance/marketing` = tulis, `viewer` = baca saja. Akun dibuat admin di dashboard Supabase; sign-up publik dimatikan.
- **Sinkron:** `db.js` mendengarkan event Store (`insert/update/delete`, termasuk `log()` dan `notify()`) lalu menulis ke Supabase. Kalau database menolak (RLS / aturan), perubahan lokal dibatalkan + toast alasannya. Saat login → `pull()` semua tabel. ID baru = UUID (`store.js uid`). Kolom yang dikirim difilter lewat `assets/js/columns.js` (GENERATED — jalankan `cd tests; npm run columns` setiap skema berubah).
- **Pipeline:** stage lead hanya lewat `DB.moveLead()` → RPC `move_lead`. Maju bebas; mundur / Lost / Nurture wajib alasan; melewati Qualified butuh percakapan nyata (pesan approved yang sudah terkirim, atau balasan masuk yang di-log). Won boleh dari stage terbuka mana pun. Stage baru: Solutioning, Nurture.
- **Approval → Outbox:** menu Governance → Approvals / Outbox. Tombol Chat WhatsApp di Customers dan "Request message approval" di drawer lead membuat approval berisi teks persis; approval terikat hash SHA-256 isi pesan. Setelah approved → antre di Outbox (sekali kirim) → buka wa.me / mailto → Mark sent → tercatat di `lead_activities`. Admin bisa "Approve & open" sekaligus (tetap tercatat).
- **Database:** `supabase/migrations/20261107000000_governance.sql` (live 7 Nov) + `20261109000000_app_compat.sql`. Tes: `cd tests; npm install; npm test` (PGlite, membangun DB dari `schema.sql` + migrations).
- **Bug diperbaiki:** form Edit client mengosongkan Notes (`Ta("notes", "")`) → sekarang memakai notes yang ada. Penting karena 1.408 client hasil impor Google Maps menyimpan `place_id` di notes.
- Mode offline/demo: `localStorage.signal_supabase_key = "local"`.

## Next Step (belum dikerjakan)

1. Isi kredensial di Settings → Supabase (atau `localStorage` `signal_supabase_url/key`) lalu ganti adapter lokal di `db.js` ke client Supabase asli.
2. Aktifkan Realtime (`tasks, projects, notifications, activities, content_items, leads`) — titik sambung: `DB.Realtime`.
3. Terapkan RLS ketat (policy starter masih permissive) + enforce peran (Admin/Manager/Member/Finance/Marketing/Viewer) di `DB.Auth.can()` per modul.
4. Storage bucket untuk upload (`DB.Storage`) + ekspor PDF/CSV di Reports.
5. Polish mobile: swipe Kanban, tabel responsif per modul.

## Konvensi File Baru

- Skema baru → `supabase/schema.sql` dulu, lalu `seed.js` + `mapTable`.
- Lihat pola lengkap di `agent.md` §6 sebelum menambah modul.
