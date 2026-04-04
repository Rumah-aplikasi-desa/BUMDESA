<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SIM BUMDesa

Project ini berisi aplikasi React + Express hasil rebuild dari AI Studio dan siap dijalankan lokal maupun dideploy ke Railway.

Sumber AI Studio: https://ai.studio/apps/8faac0ee-633c-47f6-b2b5-9c899e9918db

## Run Locally

**Prerequisites:** Node.js 20+


1. Install dependencies:
   `npm install`
2. Buat `.env.local` dari [.env.example](.env.example)
3. Isi minimal variabel berikut:
   `GEMINI_API_KEY`
   `GOOGLE_SPREADSHEET_ID`
   `GOOGLE_SERVICE_ACCOUNT_KEY`
   `JWT_SECRET`
4. Jalankan aplikasi:
   `npm run dev`

## Deploy ke Railway

Project ini sudah disiapkan untuk Railway:
- aplikasi membaca `process.env.PORT`
- healthcheck tersedia di `/api/health`
- config deploy ada di `railway.toml`

Variabel environment yang perlu diset di Railway:
- `GEMINI_API_KEY` (disarankan; fallback juga menerima `API_KEY`)
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `JWT_SECRET`
- `BIGQUERY_PROJECT_ID`
- `BIGQUERY_DATASET_ID`
- `APP_URL`

Catatan:
- fitur AI sekarang berjalan lewat backend, jadi tidak perlu mengekspos `VITE_GEMINI_API_KEY` ke frontend
- untuk pengecekan cepat setelah deploy, buka `/api/health` dan pastikan `hasGeminiKey`, `hasSheetsKey`, dan `hasSpreadsheetId` bernilai `true`

Command default yang dipakai:
- Build: `npm run build`
- Start: `npm run start`
