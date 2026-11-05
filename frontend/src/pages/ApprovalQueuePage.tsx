import React, { useState, useEffect } from 'react';
import suratService from '../services/suratService';
import type { SuratRequestListItem, SuratRequestDetail } from '../types';
import StatusBadge from '../components/StatusBadge';
import PDFViewer from '../components/PDFViewer';
import {
  CheckSquare,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Edit3,
} from 'lucide-react';

// Architectural Note:
// Dedicated administrative workspace for Lecturers and Academic Deans.
// Provides side-by-side inspection, inline AI text refinement (final_approved_content),
// PDF preview, and atomic execution of APPROVE / REJECT workflows.

export const ApprovalQueuePage: React.FC = () => {
  const [requests, setRequests] = useState<SuratRequestListItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SuratRequestDetail | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Approval Form State
  const [editedContent, setEditedContent] = useState<string>('');
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [finalStatus, setFinalStatus] = useState<'SENT' | 'PRINTED'>('SENT');

  // Reject Modal State
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoadingList(true);
    try {
      const data = await suratService.getSuratRequests();
      setRequests(data);
      if (!selectedRequestId && data.length > 0) {
        const firstPending = data.find((r) => r.status === 'PENDING_APPROVAL') || data[0];
        setSelectedRequestId(firstPending.id);
      }
    } catch {
      setActionErrorMsg('Gagal memuat antrean persetujuan.');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    if (!selectedRequestId) return;
    const loadDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await suratService.getSuratRequestDetail(selectedRequestId);
        setSelectedDetail(detail);
        setEditedContent(detail.final_approved_content || detail.ai_original_draft || '');
        setApprovalNote('');
        setActionSuccessMsg(null);
        setActionErrorMsg(null);
      } catch {
        setActionErrorMsg('Gagal memuat detail permohonan surat.');
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadDetail();
  }, [selectedRequestId]);

  const currentPendingApproval = selectedDetail?.approvals.find(
    (app) => app.status === 'PENDING'
  ) || selectedDetail?.approvals[0];

  const handleApprove = async () => {
    if (!currentPendingApproval) {
      setActionErrorMsg('Langkah antrean persetujuan (approval_id) tidak ditemukan.');
      return;
    }

    setIsProcessingAction(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const result = await suratService.submitApprovalAction(currentPendingApproval.id, {
        action: 'APPROVE',
        catatan: approvalNote,
        final_approved_content: editedContent,
        final_status: finalStatus,
      });

      setActionSuccessMsg(result.message || 'Surat resmi berhasil disetujui dan diterbitkan.');
      setTimeout(() => {
        fetchQueue();
        if (selectedRequestId) {
          suratService.getSuratRequestDetail(selectedRequestId).then(setSelectedDetail);
        }
      }, 1000);
    } catch (err: any) {
      setActionErrorMsg(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Gagal memproses persetujuan surat.'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async () => {
    if (!currentPendingApproval) {
      setActionErrorMsg('Langkah antrean persetujuan tidak ditemukan.');
      return;
    }
    if (!rejectionReason.trim()) {
      setActionErrorMsg('Alasan penolakan wajib diisi.');
      return;
    }

    setIsProcessingAction(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    try {
      const result = await suratService.submitApprovalAction(currentPendingApproval.id, {
        action: 'REJECT',
        alasan_penolakan: rejectionReason.trim(),
      });

      setActionSuccessMsg(result.message || 'Permohonan surat berhasil ditolak.');
      setShowRejectModal(false);
      setRejectionReason('');
      setTimeout(() => {
        fetchQueue();
        if (selectedRequestId) {
          suratService.getSuratRequestDetail(selectedRequestId).then(setSelectedDetail);
        }
      }, 1000);
    } catch (err: any) {
      setActionErrorMsg(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Gagal menolak permohonan surat.'
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-slate-800" />
            <span>Antrean Persetujuan & Tinjauan Naskah Dinas</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Modul pejabat berwenang untuk meninjau hasil draf AI, menyunting kalimat resmi,
            dan menerbitkan tanda tangan elektronik (TTE).
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={isLoadingList}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingList ? 'animate-spin' : ''}`} />
          Segarkan Antrean
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)}>
            <X className="w-4 h-4 text-rose-700" />
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Requests List (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden flex flex-col h-[780px]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Antrean Dokumen ({requests.length})
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {requests.filter((r) => r.status === 'PENDING_APPROVAL').length} Perlu Tindakan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingList ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                Memuat antrean surat...
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada antrean surat saat ini.
              </div>
            ) : (
              requests.map((item) => {
                const isSelected = item.id === selectedRequestId;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedRequestId(item.id)}
                    className={`p-4 cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-slate-100/90 border-l-4 border-slate-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500 font-semibold">#{item.id}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                    <div className="font-semibold text-slate-900 mt-1.5 truncate">
                      {item.nama_surat}
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      {item.nama_mahasiswa} ({item.nim_mahasiswa})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Review & Approval Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {isLoadingDetail ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500 shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              Memuat berkas permohonan surat...
            </div>
          ) : !selectedDetail ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-400 shadow-xs">
              Pilih salah satu permohonan surat dari kolom sebelah kiri untuk mulai meninjau.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Request Metadata Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Dokumen ID: #{selectedDetail.id} - [{selectedDetail.kode_surat}]
                    </span>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      {selectedDetail.nama_surat}
                    </h2>
                  </div>
                  <StatusBadge status={selectedDetail.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Mahasiswa</span>
                    <span className="font-semibold text-slate-800">
                      {selectedDetail.nama_mahasiswa}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">NIM</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {selectedDetail.nim_mahasiswa}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Program Studi</span>
                    <span className="text-slate-700">{selectedDetail.prodi_mahasiswa}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Fakultas</span>
                    <span className="text-slate-700">{selectedDetail.fakultas_mahasiswa}</span>
                  </div>
                </div>

                {selectedDetail.self_critique_score !== null && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-slate-700">
                        Skor Kualitas Tata Bahasa AI (Self-Critique):
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedDetail.self_critique_score}/10
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Naskah Surat */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Tinjauan & Koreksi Redaksional Naskah Dinas
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Dapat disunting langsung sebelum persetujuan final
                  </span>
                </div>

                <div>
                  <textarea
                    rows={8}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    placeholder="Teks naskah surat..."
                    className="block w-full p-3 font-mono text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white leading-relaxed"
                  />
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Catatan Arsitektur: Perubahan teks yang disimpan di sini akan dianalisis oleh
                    AgenticMemoryAgent untuk mempelajari gaya penulisan Dosen tanpa merekam PII.
                  </span>
                </div>

                {/* Approval Options & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label
                      htmlFor="approvalNote"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Catatan Dosen / Pejabat (Opsional)
                    </label>
                    <input
                      type="text"
                      id="approvalNote"
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                      placeholder="Contoh: Disetujui dengan perbaikan tanggal kegiatan"
                      className="block w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="finalStatus"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Status Distribusi Akhir
                    </label>
                    <select
                      id="finalStatus"
                      value={finalStatus}
                      onChange={(e) => setFinalStatus(e.target.value as 'SENT' | 'PRINTED')}
                      className="block w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                    >
                      <option value="SENT">SENT - Distribusi Elektronik (Email / Telegram)</option>
                      <option value="PRINTED">PRINTED - Cetak Fisik / Arsip Hardcopy</option>
                    </select>
                  </div>
                </div>

                {/* Approval Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isProcessingAction}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    <span>Tolak Permohonan (REJECT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessingAction}
                    className="inline-flex items-center px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition shadow-xs"
                  >
                    {isProcessingAction ? (
                      <span>Memproses TTE & Menerbitkan Surat...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        <span>Setujui & Terbitkan TTE (APPROVE)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* PDF Previewer Card */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Preview Dokumen Surat Resmi (PDF)
                </h3>
                <PDFViewer
                  pdfUrl={selectedDetail.file_pdf_url}
                  nomorSurat={selectedDetail.nomor_surat_resmi}
                  documentTitle={selectedDetail.nama_surat}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-700">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Tolak Pengajuan Surat</h3>
            </div>

            <p className="text-xs text-slate-600">
              Tuliskan alasan penolakan secara jelas. Catatan ini akan dikirimkan kepada mahasiswa
              pemohon untuk perbaikan.
            </p>

            <div>
              <label
                htmlFor="rejectionReason"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alasan Penolakan (Wajib)
              </label>
              <textarea
                id="rejectionReason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Dokumen LoA belum memuat stempel resmi perusahaan..."
                className="block w-full p-2.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-rose-600 focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 rounded"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessingAction || !rejectionReason.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueuePage;
