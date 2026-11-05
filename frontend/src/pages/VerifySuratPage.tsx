import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import suratService from '../services/suratService';
import type { VerificationData } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  FileText,
  User,
  Hash,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// Architectural Note:
// Public-facing cryptographic verification gateway. Validates electronic signature (TTE)
// authenticity via sha256 document hashing and unforgeable unique token verification.

export const VerifySuratPage: React.FC = () => {
  const { token: urlToken } = useParams<{ token?: string }>();
  const navigate = useNavigate();

  const [inputToken, setInputToken] = useState<string>(urlToken || '');
  const [data, setData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyToken = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setData(null);

    try {
      const result = await suratService.verifySurat(tokenToVerify.trim());
      setData(result);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setData({
          status: 'INVALID',
          message:
            'Dokumen Surat TIDAK VALID atau palsu. Token verifikasi tidak ditemukan di sistem kampus.',
        });
      } else {
        setErrorMessage(
          err.response?.data?.message || 'Gagal menghubungi server verifikasi dokumen.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (urlToken) {
      setInputToken(urlToken);
      verifyToken(urlToken);
    }
  }, [urlToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    navigate(`/verify/${inputToken.trim()}`);
    verifyToken(inputToken.trim());
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center mx-auto shadow-xs">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Verifikasi Publik Keaslian Surat Resmi (TTE)
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Pusat validasi keabsahan dokumen persuratan dinas akademik. Masukkan kode token verifikasi
          atau scan QR Code pada naskah surat.
        </p>
      </div>

      {/* Search Token Input */}
      <form onSubmit={handleSubmit} className="bg-white p-4 border border-slate-200 rounded-lg shadow-xs flex items-center space-x-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Hash className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="Masukkan kode token verifikasi (contoh: a1b2c3d4e5f6...)"
            className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white placeholder-slate-400 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !inputToken.trim()}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Search className="w-3.5 h-3.5 mr-1.5" />
              <span>Verifikasi</span>
            </>
          )}
        </button>
      </form>

      {errorMessage && (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Verification Result Card */}
      {data && (
        <div
          className={`bg-white border rounded-lg p-6 shadow-xs space-y-6 ${
            data.status === 'VALID' ? 'border-emerald-300' : 'border-rose-300'
          }`}
        >
          {/* Status Indicator */}
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            {data.status === 'VALID' ? (
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
            <div>
              <div
                className={`text-sm font-bold uppercase tracking-wider ${
                  data.status === 'VALID' ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                {data.status === 'VALID' ? 'DOKUMEN ASLI & TERVERIFIKASI' : 'DOKUMEN TIDAK VALID'}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{data.message}</p>
            </div>
          </div>

          {/* Valid Details */}
          {data.status === 'VALID' && (
            <div className="space-y-6 text-xs">
              {/* Surat Detail */}
              {data.detail_surat && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>Rincian Dokumen Resmi</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Nomor Surat Resmi</span>
                      <span className="font-mono font-bold text-slate-900">
                        {data.detail_surat.nomor_surat_resmi || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Jenis Surat</span>
                      <span className="font-semibold text-slate-800">
                        {data.detail_surat.jenis_surat}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Kategori</span>
                      <span className="text-slate-700">{data.detail_surat.kategori}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Tanggal Terbit</span>
                      <span className="text-slate-700">
                        {new Date(data.detail_surat.tanggal_terbit).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mahasiswa Info */}
              {data.mahasiswa && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <User className="w-4 h-4 text-slate-600" />
                    <span>Identitas Pemohon</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Nama Mahasiswa</span>
                      <span className="font-semibold text-slate-800">{data.mahasiswa.nama}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">NIM</span>
                      <span className="font-mono font-medium text-slate-800">
                        {data.mahasiswa.nim}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Program Studi</span>
                      <span className="text-slate-700">{data.mahasiswa.prodi}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Fakultas</span>
                      <span className="text-slate-700">{data.mahasiswa.fakultas}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TTE Cryptographic Evidence */}
              {data.tte_info && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Bukti Kriptografis Tanda Tangan Elektronik</span>
                  </div>
                  <div className="space-y-2 bg-slate-50 p-4 rounded border border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Pejabat Penandatangan</span>
                      <span className="font-semibold text-slate-900">
                        {data.tte_info.penandatangan}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">
                        Hash SHA-256 Integritas Naskah
                      </span>
                      <div className="font-mono text-[10px] text-slate-800 bg-white p-2 rounded break-all border border-slate-200 mt-0.5">
                        {data.tte_info.hash_sha256}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Waktu Penandatanganan</span>
                      <span className="text-slate-700">
                        {new Date(data.tte_info.tanggal_ttd).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifySuratPage;
