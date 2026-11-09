# agent.md — Instruksi Agen untuk Signal System

> Dibaca oleh setiap AI coding agent sebelum menyentuh repo ini.
> Bahasa: Indonesia. Istilah teknis tetap dalam bahasa Inggris.

## 1. Identitas Proyek

- **App:** Signal System — internal business OS untuk **Signal Society**.
- **Filosofi:** "Turn scattered business activity into one clear operational signal."
- **Rasa UI:** Apple × Linear × Stripe — premium, minimal, tenang, editorial, sedikit futuristik. Bukan admin dashboard generik.
- **Fase saat ini:** frontend/index dulu. Supabase disiapkan arsitekturnya, belum diwajibkan live.

## 2. Stack & Batasan

- HTML semantik + Tailwind CSS v4 (browser CDN) + vanilla JS. **Tanpa framework, tanpa dependency chart.**
- Charts digambar manual (SVG murni di `ui.js`: `spark`, `bars`, `donut`).
- Entry: `index.html`. Static murni — harus tetap deployable ke Vercel tanpa build (`vercel.json`).
- Semua file JS harus lolos `node --check` (PowerShell 5.1, tanpa `&&` — gunakan `; if ($?) { ... }`).

## 3. Peta Direktori

```
index.html                  shell (sidebar / topbar / #view / bottom nav)
assets/css/styles.css       sistem brand + motion + kanban/kalender/tabel
assets/js/config.js         brand, konstanta (stage, status, service, tim)
assets/js/seed.js           data mock relasional (cermin schema SQL)
assets/js/store.js          state + CRUD + log aktivitas + logika turunan
assets/js/db.js             abstraksi Supabase (adapter lokal saat ini)
assets/js/ui.js             primitif: toast/modal/drawer/chart/state
assets/js/views.js          25 view, semua render dari Store
assets/js/app.js            router hash, search, command, form, DnD
supabase/schema.sql         schema Postgres (30 tabel, RLS, realtime)
agent.md                    file ini
memory.md                   memori proyek (keputusan, bug, next step)
```

## 4. Aturan Arsitektur (Wajib)

1. **Jangan hardcode data bisnis di UI.** Semua data lewat `SignalStore` (`list/get/insert/update/remove`).
2. **Mutasi lewat Store atau `DB.from()`** — jangan manipulasi `state` langsung dari view. Setiap mutasi penting mengemisikan activity log (otomatis di `insert/update/remove`, atau manual via `S.log()`).
3. **Pemisahan lapisan:** `views.js` hanya render HTML string; interaksi di `app.js`; format/komponen di `ui.js`; konstanta di `config.js`.
4. **CRUD lengkap** untuk setiap modul besar: ada Save Changes + Cancel, loading state di tombol (`Saving…`), toast `Changes saved.`, dan konfirmasi untuk aksi destruktif (`confirmDestructive`).
5. **Supabase-ready:** perubahan skema tulis di `supabase/schema.sql` DULU, lalu samakan `seed.js` + `db.js:mapTable`. Jangan menaruh query Supabase langsung di view.

## 5. Brand & Gaya

- Token: aksen `#FF6600` (hover `#E65C00`, soft `#FFF1E8`), tinta `#111113`, grafit `#1C1C1F`, kertas `#FAFAF9`, garis `#E8E8E6`.
- Oranye **hanya untuk aksen**: nav aktif, CTA, progres, highlight chart, notifikasi, selected state. Basis UI monokrom.
- Komponen baku: `.card`, `.btn-p` (gelap), `.btn-a` (aksen), `.btn-g` (ghost), `.inp`, `.lbl`, `.chip`, `.tbl`, `.kpi-label`, `.prog`, `.font-num` (angka tabular).
- Status selalu via `U.pill()` — jangan bikin warna status manual (mapping di `STATUS_COLORS`).
- Motion: `fade-up`, `modal-panel`, `drawer`, `toast-in` saja. Dilarang animasi memantul/berlebihan.
- Radius ditahan, shadow sangat subtle. Hierarki dari spacing/border/tipografi.

## 6. Pola Baku Menambah Modul

- **View baru:** tambah fungsi di `views.js` (pakai helper `head()`, `kpi()`, `secTitle()`), daftarkan di `NAV` + `ROUTES` di `app.js`, tambah string di regression test.
- **Form baru:** pakai `formModal(title, fieldsHTML, onSave)` + helper `F/T/Dd/Sel/Ta`. Kolom full-width: `F(label, inner, 1)`. Validasi required minimal (nama/judul) + toast jika kosong.
- **Drawer detail:** ikuti pola `taskDrawer` (checklist, komentar, ubah status, hapus).
- **Drag & drop:** kolom `data-drop[-x]="key"`, kartu `data-drag[-x]="id"`, daftarkan di `bindDrop`. Guard klik-vs-drag via `window._dragging` **wajib** dipakai di handler klik kartu.
- **Filter/search lokal:** simpan di `window._filter`, jaga posisi kursor (lihat pola `pq/tq/cq` di `bindDynamic`).
- **State kosong:** selalu render `U.empty()` + CTA, jangan layar putih.
- **Dokumen uang (SO/invoice):** alur baku `salesOrders → createInvoiceFromSO() → invoices → receivePayment()` — jangan bikin invoice manual dari SO tanpa lewat helper (nomor, status `Invoiced`, notif, dan link rusak kalau bypass). Pembayaran SELALU via `receivePayment()` dengan `accountId + method` agar saldo akun (BCA/PayPal) konsisten.
- **Print:** dokumen print (`invoicePrint/soPrint`) memakai **inline style murni**, bukan class Tailwind — supaya tetap rapi saat print offline ketika CDN tak termuat. Toolbar layar pakai `.no-print`; aturan cetak di `styles.css` (`@media print` + `@page A4`).

## 7. Verifikasi Wajib Setelah Edit

```powershell
node --check "assets/js/<file>.js"
```

Untuk perubahan logika/view, jalankan juga harness render (semua view harus PASS, lihat riwayat sesi) dan uji `insert → update → remove` di Store. Uji serve statis bila menyentuh `index.html`.

Untuk perubahan skema/database: tulis migration baru di `supabase/migrations/` (jangan ubah yang sudah live), lalu:

```powershell
cd tests; npm test; npm run columns
```

## 7b. Governance (wajib dipatuhi)

- Stage lead **hanya** lewat `DB.moveLead(id, stage, reason)` — jangan `S().update("leads", id, { stage })` langsung.
- Pesan keluar (WhatsApp/email/IG) **hanya** lewat `requestMessage()` → Approvals → Outbox. Jangan buka `wa.me` langsung dengan teks yang belum di-approve.
- Approval, outbox, dan log percakapan ditulis lewat `DB.gov.*` (bukan Store biasa) — database yang menentukan siapa boleh memutuskan dan apa yang boleh dikirim.
- Jangan pernah menaruh service_role / secret key di repo. Publishable key memang publik (RLS yang menjaga data).

## 8. Larangan

- Jangan menambah framework/build step/npm tanpa persetujuan.
- Jangan mengubah `vercel.json` menjadi non-statis.
- Jangan menghapus/mengubah `logosignalsociety/` (sumber brand).
- Jangan commit/push kecuali diminta eksplisit.
- Jangan menebak URL atau API — verifikasi dari file lokal dulu.
