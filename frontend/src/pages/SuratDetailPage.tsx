import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import suratService from '../services/suratService';
import type { SuratRequestDetail } from '../types';
import StatusBadge from '../components/StatusBadge';
import PDFViewer from '../components/PDFViewer';
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  AlertCircle,
  FileCode,
  ExternalLink,
} from 'lucide-react';

// Architectural Note:
// In-depth lifecycle inspector displaying AI generation telemetry, multi-stage approval
// audit trails, real-time status polling for background workers, and iterative re-drafting.

export const SuratDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SuratRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-draft state
  const [additionalContext, setAdditionalContext] = useState<string>('');
  const [isSubmittingRedraft, setIsSubmittingRedraft] = useState<boolean>(false);
  const [redraftSuccess, setRedraftSuccess] = useState<string | null>(null);
  const [redraftError, setRedraftError] = useState<string | null>(null);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const data = await suratService.getSuratRequestDetail(parseInt(id, 10));
      setDetail(data);
    } catch {
      setErrorMsg('Gagal memuat rincian permohonan surat.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    if (detail.status === 'SUBMITTED') {
      const timer = setInterval(() => {
        fetchDetail();
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [detail?.status]);

  const handleRedraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !additionalContext.trim()) return;

    setIsSubmittingRedraft(true);
    setRedraftError(null);
    setRedraftSuccess(null);

    try {
      const res = await suratService.redraftSuratRequest(parseInt(id, 10), {
        additional_prompt_context: additionalContext.trim(),
      });
      setRedraftSuccess(res.message || 'Informasi tambahan revisi berhasil dikirim.');
      setAdditionalContext('');
      fetchDetail();
    } catch (err: any) {
      setRedraftError(
        err.response?.data?.message || 'Gagal mengirim informasi perbaikan revisi.'
      );
    } finally {
      setIsSubmittingRedraft(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500">Memuat rincian permohonan surat...</span>
      </div>
    );
  }

  if (errorMsg || !detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-full inline-flex mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-slate-800">Data Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 mt-1">{errorMsg || 'Permohonan surat tidak ditemukan.'}</p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Kembali ke Dasbor
        </Link>
      </div>
    );
  }

  const isRevisionNeeded =
    detail.status === 'REVISION_REQUIRED' || detail.status === 'FAILED';

  const notesList = Array.isArray(detail.revision_notes)
    ? detail.revision_notes
    : detail.revision_notes
    ? [String(detail.revision_notes)]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/dashboard"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              Dasbor
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono font-medium text-slate-600">
              Permohonan #{detail.id}
            </span>
          </div>

          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-2">
            {detail.nama_surat}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
            <div>
              Pemohon:{' '}
              <span className="font-semibold text-slate-800">{detail.nama_mahasiswa}</span> (
              {detail.nim_mahasiswa})
            </div>
            <div>
              Prodi: <span className="text-slate-700">{detail.prodi_mahasiswa}</span>
            </div>
            <div>
              Fakultas: <span className="text-slate-700">{detail.fakultas_mahasiswa}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end space-y-2">
          <StatusBadge status={detail.status} />
          {detail.nomor_surat_resmi && (
            <div className="text-xs font-mono font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              No: {detail.nomor_surat_resmi}
            </div>
          )}
          <button
            onClick={fetchDetail}
            className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Segarkan Status
          </button>
        </div>
      </div>

      {/* Asynchronous Processing Notice */}
      {detail.status === 'SUBMITTED' && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start space-x-3 text-xs text-blue-900">
          <Clock className="w-5 h-5 shrink-0 text-blue-600 animate-spin" />
          <div>
            <h4 className="font-semibold">Agen AI Sedang Menyusun Draf Surat</h4>
            <p className="mt-0.5 text-blue-700 leading-relaxed">
              Permohonan Anda sedang dievaluasi oleh SuratDraftingAgent di latar belakang. Halaman ini
              akan memperbarui data secara otomatis ketika hasil penulisan naskah selesai.
            </p>
          </div>
        </div>
      )}

      {/* Revision Required Callout */}
      {isRevisionNeeded && (
        <div className="p-5 rounded-lg bg-amber-50 border border-amber-300 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Informasi Tambahan Diperlukan (Self-Critique AI)
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                Agen AI mendeteksi data yang belum lengkap atau memerlukan konfirmasi untuk memenuhi
                standar surat dinas resmi:
              </p>
              {notesList.length > 0 && (
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-amber-900 font-medium">
                  {notesList.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Form Re-draft */}
          <form onSubmit={handleRedraftSubmit} className="pt-2 border-t border-amber-200 space-y-2">
            {redraftError && (
              <div className="p-2 rounded bg-rose-100 text-rose-800 text-xs">{redraftError}</div>
            )}
            {redraftSuccess && (
              <div className="p-2 rounded bg-emerald-100 text-emerald-800 text-xs">
                {redraftSuccess}
              </div>
            )}

            <label
              htmlFor="additionalContext"
              className="block text-xs font-semibold text-amber-950"
            >
              Jawaban / Informasi Tambahan Koreksi
            </label>
            <textarea
              id="additionalContext"
              rows={3}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Contoh: Tanggal mulai magang adalah 2026-08-01 sampai 2026-11-30 pada divisi Backend Engineer..."
              className="block w-full px-3 py-2 text-xs border border-amber-300 rounded bg-white focus:ring-1 focus:ring-amber-900 focus:border-amber-900"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingRedraft || !additionalContext.trim()}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-800 disabled:opacity-50 rounded transition"
              >
                {isSubmittingRedraft ? (
                  <span>Mengirim koreksi ke agen...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    <span>Kirim Informasi Revisi (Re-Draft)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: AI Draft and Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: AI Draft & Metadata */}
        <div className="space-y-6">
          {/* Naskah Draf Surat AI */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Naskah Draf AI ({detail.final_approved_content ? 'Telah Disetujui' : 'Draf Awal'})
                </h2>
              </div>
              {detail.self_critique_score !== null && (
                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                  Skor Evaluasi: {detail.self_critique_score}/10
                </span>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {detail.final_approved_content ||
                detail.ai_original_draft ||
                'Naskah surat sedang diproses oleh agen AI.'}
            </div>

            {/* Extracted Payload Attributes */}
            {detail.payload_data && Object.keys(detail.payload_data).length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Atribut Data Terekstraksi (Structured Payload):
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(detail.payload_data).map(([key, val]) => (
                    <div key={key} className="p-2 rounded bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{key}</div>
                      <div className="font-medium text-slate-800 truncate">
                        {val === null || val === undefined ? '-' : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Antrean Persetujuan (Approvals) */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Antrean & Riwayat Persetujuan Pejabat
              </h2>
            </div>

            {detail.approvals && detail.approvals.length > 0 ? (
              <div className="space-y-3">
                {detail.approvals.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 rounded border border-slate-200 bg-slate-50/50 text-xs flex items-start justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        Langkah {app.step_order}: {app.approver_name || 'Pejabat Berwenang'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        NIP: {app.approver_nip || '-'}
                      </div>
                      {app.catatan && (
                        <div className="mt-1.5 p-2 bg-white rounded border border-slate-200 text-slate-700 italic">
                          Catatan: "{app.catatan}"
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        app.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Antrean persetujuan akan dibentuk secara otomatis sesuai hierarki jabatan setelah
                draf AI lolos evaluasi kualitas.
              </p>
            )}
          </div>

          {/* Rekam Jejak Audit (Audit Logs) */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <FileCode className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Log Audit Sistem
              </h2>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {detail.audit_logs && detail.audit_logs.length > 0 ? (
                detail.audit_logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-700 mr-2">
                        [{log.action_id}]
                      </span>
                      <span className="text-slate-800">{log.action}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Belum ada catatan log aktivitas.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: PDF Preview & Signatures */}
        <div className="space-y-6">
          {/* PDF Previewer Component */}
          <PDFViewer
            pdfUrl={detail.file_pdf_url}
            nomorSurat={detail.nomor_surat_resmi}
            documentTitle={detail.nama_surat}
          />

          {/* TTE & Digital Verification Card */}
          {detail.signatures && detail.signatures.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Tanda Tangan Elektronik (TTE) & Keabsahan Dokumen
                </h2>
              </div>

              {detail.signatures.map((sig) => (
                <div key={sig.id} className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Penandatangan Resmi:</span>
                    <div className="font-semibold text-slate-800">
                      {sig.signer_name} ({sig.signer_nip || 'Sistem Kampus'})
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500">Hash SHA-256 Integritas Dokumen:</span>
                    <div className="font-mono text-[10px] text-slate-700 bg-slate-100 p-2 rounded break-all border border-slate-200">
                      {sig.hash_document}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-slate-500 text-[11px]">
                      Token Verifikasi Publik:{' '}
                      <span className="font-mono font-bold">{sig.token}</span>
                    </span>
                    <Link
                      to={`/verify/${sig.token}`}
                      target="_blank"
                      className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <span>Uji Keaslian Publik</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuratDetailPage;
