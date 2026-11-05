import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import suratService from '../services/suratService';
import type { SuratRequestListItem } from '../types';
import StatusBadge from '../components/StatusBadge';
import AIChatDrawer from '../components/AIChatDrawer';
import {
  FileText,
  PlusCircle,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';

// Architectural Note:
// The primary portal integrating direct AI conversational drafting with recent
// request telemetry and role-tailored workflow shortcuts.

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SuratRequestListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showChatAssistant, setShowChatAssistant] = useState(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const data = await suratService.getSuratRequests();
      setRequests(data);
    } catch {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const isStudent = user?.role === 'STUDENT';
  const isLecturerOrAdmin =
    user?.role === 'LECTURER' || user?.role === 'STAFF' || user?.role === 'ADMIN';

  const totalCount = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const revisionCount = requests.filter(
    (r) => r.status === 'REVISION_REQUIRED' || r.status === 'FAILED'
  ).length;
  const completedCount = requests.filter(
    (r) => r.status === 'APPROVED' || r.status === 'SENT' || r.status === 'PRINTED'
  ).length;

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return r.status === 'PENDING_APPROVAL';
    if (statusFilter === 'REVISION')
      return r.status === 'REVISION_REQUIRED' || r.status === 'FAILED';
    if (statusFilter === 'COMPLETED')
      return r.status === 'APPROVED' || r.status === 'SENT' || r.status === 'PRINTED';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Welcome */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Selamat datang
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {user?.nip_nim}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
            {user?.nama}
          </h1>
          {user?.profile && (
            <p className="text-xs text-slate-500 mt-1">
              {user.profile.prodi ? `${user.profile.prodi} - ` : ''}
              {user.profile.fakultas || ''}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2.5">
          {isLecturerOrAdmin && (
            <Link
              to="/approvals"
              className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition shadow-xs"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              <span>Antrean Verifikasi ({pendingCount})</span>
            </Link>
          )}

          <Link
            to="/surat/new"
            className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            <span>Ajukan Surat Baru</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Pengajuan</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Seluruh riwayat permohonan</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 text-xs font-medium">
            <span>Menunggu Approval</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Draf terkunci di meja pejabat</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>Revisi Diperlukan</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{revisionCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Memerlukan informasi tambahan</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
            <span>Selesai & Diterbitkan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{completedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">TTE dan nomor resmi terbit</div>
        </div>
      </div>

      {/* Direct AI Chat Section */}
      {isStudent && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Agen AI Konsultasi & Pembuatan Surat Langsung
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketik kebutuhan surat Anda dalam bahasa alami untuk diekstraksi secara otomatis oleh
                model Gemini.
              </p>
            </div>
            <button
              onClick={() => setShowChatAssistant(!showChatAssistant)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1 bg-slate-100 rounded border border-slate-200"
            >
              {showChatAssistant ? 'Sembunyikan Panel' : 'Tampilkan Panel'}
            </button>
          </div>

          {showChatAssistant && <AIChatDrawer />}
        </div>
      )}

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">
              Daftar Permohonan Dokumen Surat
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <div className="inline-flex rounded-md shadow-2xs border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded font-medium transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded font-medium transition ${
                  statusFilter === 'PENDING'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Approval ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('REVISION')}
                className={`px-3 py-1 rounded font-medium transition ${
                  statusFilter === 'REVISION'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Revisi ({revisionCount})
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-3 py-1 rounded font-medium transition ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Selesai ({completedCount})
              </button>
            </div>

            <button
              onClick={fetchRequests}
              title="Perbarui data"
              disabled={isLoading}
              className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3">
                  ID
                </th>
                <th scope="col" className="px-6 py-3">
                  Jenis Dokumen
                </th>
                <th scope="col" className="px-6 py-3">
                  Pemohon
                </th>
                <th scope="col" className="px-6 py-3">
                  Nomor Surat Resmi
                </th>
                <th scope="col" className="px-6 py-3">
                  Status
                </th>
                <th scope="col" className="px-6 py-3">
                  Tanggal Pengajuan
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                      <span>Memuat riwayat pengajuan surat...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">Belum ada pengajuan surat</p>
                    <p className="text-slate-400 mt-1">
                      Mulai buat draf surat pertama Anda menggunakan formulir atau agen percakapan di
                      atas.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-medium text-slate-500">#{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{req.nama_surat}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{req.kode_surat}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{req.nama_mahasiswa}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {req.nim_mahasiswa}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-700">
                      {req.nomor_surat_resmi || (
                        <span className="text-slate-400 italic">Belum diterbitkan</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        to={`/surat/${req.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                      >
                        <span>Detail</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
