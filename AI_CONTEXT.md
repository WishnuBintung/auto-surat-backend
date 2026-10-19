# SYSTEM CONTEXT & ARCHITECTURAL BLUEPRINT: AUTO-SURAT AGENTIC AI

## 1. Instruksi Perilaku AI (Strict Evaluation Mode)
- Berikan informasi dan kode seakurat mungkin. Evaluasi setiap arsitektur dan kode secara teliti tanpa celah kesalahan.
- Bersikap tegas dalam memberikan tinjauan teknis.
- JANGAN pernah menggunakan emoji/emote di dalam kode, komentar kode, atau log agar kode terlihat profesional dan serius.
- Selalu sertakan saran perbaikan arsitektural di dalam komentar kode yang direvisi.

## 2. Konteks Proyek & Tech Stack Aktual
Proyek ini adalah `auto-surat-backend`, sistem pembuatan dan distribusi surat resmi otomatis.
- **Framework Utama:** Python, Django REST Framework (dijalankan via Uvicorn ASGI) di dalam `backend-django/`.
- **Database:** PostgreSQL 15.
- **Fitur Eksisting Backend:** Autentikasi (`accounts`), manajemen surat (`surat`), `templates`, penyimpanan PDF via Cloudinary, Tanda Tangan Elektronik (TTE), dan verifikasi QR Code publik.
- **Kontrak Data:** Menggunakan skema ketat yang didefinisikan pada `required_field_surat.json` dan `payload.json`.

## 3. Target Arsitektur AI: Agentic AI Level 2 (Human-in-the-Loop)
Sistem dikunci pada **Level 2 (Agent as a Copilot / Gatekeeper)** karena adanya fitur krusial TTE, QR Code publik, dan pengiriman resmi yang mewajibkan *approval* Admin.

### Alur Kerja (Workflow) yang Wajib Diimplementasikan:
1. **Fase 1: Natural Language to Structured Draft (Pra-Approval)**
   - User mengirimkan konteks singkat pembuatan surat.
   - **Surat Agent** membaca `required_field_surat.json` sesuai jenis surat, menyusun draf formal, dan melakukan *Self-Reflection/Internal Review* untuk memastikan kesesuaian *tone* dan kelengkapan atribut.
   - Output agen wajib berupa *Structured Output* (Pydantic) yang 100% mematuhi skema `surat/models.py` dan `required_field_surat.json`.
   - **State Pausing:** Simpan ke PostgreSQL dengan status `PENDING_APPROVAL` (atau ekuivalen di model). JANGAN eksekusi TTE, QR Code, Cloudinary, atau pengiriman email pada tahap ini.

2. **Fase 2: Approval & Tool Execution (Pasca-Approval)**
   - Admin meninjau *preview* dari dashboard, melakukan edit jika perlu, dan memicu *endpoint* Approval.
   - Sistem mengeksekusi *pipeline* secara berurutan/terorkestrasi:
     1. Generate QR Code & sematkan TTE.
     2. Render PDF dari direktori `templates/` dan unggah ke Cloudinary.
     3. **Email Agent** menyusun subjek serta *body* email pengantar, melampirkan PDF/tautan Cloudinary, dan mengirimkannya via protokol email.
     4. Simpan status (`SENT`, `PRINTED`, `FAILED`) ke database log.

3. **Fase 3: Agentic Memory & Feedback Loop**
   - Bandingkan (*diffing*) antara draf asli AI (`ai_original_draft`) dan teks yang disetujui Admin (`final_approved_content`).
   - Ekstrak preferensi gaya bahasa atau koreksi Admin ke dalam basis data (RAG / Vector / Rule Store) untuk disuntikkan ke *System Prompt* pada pembuatan surat berikutnya.

## 4. Isolasi Modul & Infrastruktur
- Seluruh logika AI wajib diisolasi di dalam `backend-django/surat/agents/` (terdiri dari `schemas.py`, `prompts.py`, `letter_agent.py`, `execution_tools.py`). Jangan mengotori `views.py` dengan logika *prompting*.
- Gunakan antrean asinkron (Celery + Redis atau Background Tasks ASGI) agar proses inferensi AI dan upload Cloudinary tidak memblokir *thread* HTTP utama.