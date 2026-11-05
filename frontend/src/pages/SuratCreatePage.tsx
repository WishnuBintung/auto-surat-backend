import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import suratService from '../services/suratService';
import type { SuratType, DynamicFieldDef } from '../types';
import { REQUIRED_FIELDS_BY_KODE, DEFAULT_REQUIRED_FIELDS } from '../data/requiredFields';
import {
  FileText,
  Sparkles,
  Send,
  ArrowLeft,
  Paperclip,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

// Architectural Note:
// Dynamic schema-driven letter request form. Asynchronously syncs with backend SuratType
// definitions while rendering precise input controls based on validated dynamic specifications.

export const SuratCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const prefillState = (location.state as any) || {};

  const [suratTypes, setSuratTypes] = useState<SuratType[]>([]);
  const [selectedKodeSurat, setSelectedKodeSurat] = useState<string>(
    prefillState.prefilledKodeSurat || ''
  );
  const [promptContext, setPromptContext] = useState<string>(
    prefillState.prefilledPrompt || ''
  );
  const [payloadData, setPayloadData] = useState<Record<string, any>>(
    prefillState.prefilledPayload || {}
  );
  const [chosenDestination, setChosenDestination] = useState<'email' | 'telegram' | ''>('');
  const [targetDestinationAddress, setTargetDestinationAddress] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await suratService.getSuratTypes();
        setSuratTypes(types);
        if (!selectedKodeSurat && types.length > 0) {
          setSelectedKodeSurat(types[0].kode_surat);
        }
      } catch {
        setErrorMsg('Gagal memuat master daftar jenis surat dari server.');
      } finally {
        setIsLoadingTypes(false);
      }
    };
    loadTypes();
  }, []);

  const activeFields: DynamicFieldDef[] = selectedKodeSurat
    ? REQUIRED_FIELDS_BY_KODE[selectedKodeSurat] || DEFAULT_REQUIRED_FIELDS
    : DEFAULT_REQUIRED_FIELDS;

  const handleFieldChange = (fieldName: string, value: any) => {
    setPayloadData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...filesArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKodeSurat) {
      setErrorMsg('Pilih jenis surat yang ingin diajukan.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await suratService.createSuratRequest({
        kode_surat: selectedKodeSurat,
        user_prompt_context: promptContext,
        payload_data: payloadData,
        chosen_destination: chosenDestination || undefined,
        target_destination_address: targetDestinationAddress || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setSuccessMsg(result.message || 'Permohonan surat berhasil dikirim.');

      const requestId = result.request_id || result.data?.request_id;
      setTimeout(() => {
        if (requestId) {
          navigate(`/surat/${requestId}`);
        } else {
          navigate('/dashboard');
        }
      }, 1500);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else if (err.response?.data?.errors) {
        const errors = err.response.data.errors;
        if (typeof errors === 'string') {
          setErrorMsg(errors);
        } else if (typeof errors === 'object') {
          const firstKey = Object.keys(errors)[0];
          setErrorMsg(`${firstKey}: ${errors[firstKey]}`);
        }
      } else {
        setErrorMsg('Terjadi kesalahan saat mengajukan permohonan surat.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button and page title */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-3 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Kembali ke Dasbor
        </Link>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Formulir Permohonan Surat Resmi
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lengkapi data spesifik jenis surat. Sistem agen AI akan mengekstrak, memvalidasi
          integritas akademik, dan menyusun draf naskah resmi dinas.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 flex items-start space-x-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Surat Type Selection */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <FileText className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              1. Pilihan Jenis Surat Resmi
            </h2>
          </div>

          <div>
            <label
              htmlFor="kode_surat"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Jenis Surat Akademik
            </label>
            <select
              id="kode_surat"
              value={selectedKodeSurat}
              onChange={(e) => setSelectedKodeSurat(e.target.value)}
              disabled={isLoadingTypes}
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
            >
              {suratTypes.map((type) => (
                <option key={type.kode_surat} value={type.kode_surat}>
                  [{type.kode_surat}] {type.nama_surat} - Kategori: {type.kategori}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 2: Dynamic Fields */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                2. Atribut Wajib Jenis Dokumen ({selectedKodeSurat})
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {activeFields.length} Atribut Wajib
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeFields.map((field) => {
              const val = payloadData[field.field] || '';
              return (
                <div
                  key={field.field}
                  className={field.field === 'alasan_pengajuan' ? 'md:col-span-2' : ''}
                >
                  <label
                    htmlFor={field.field}
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    {field.label}
                  </label>
                  {field.type === 'date' ? (
                    <div className="relative rounded-md shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="date"
                        id={field.field}
                        value={val}
                        onChange={(e) => handleFieldChange(field.field, e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                      />
                    </div>
                  ) : field.field === 'alasan_pengajuan' ? (
                    <textarea
                      id={field.field}
                      rows={3}
                      value={val}
                      onChange={(e) => handleFieldChange(field.field, e.target.value)}
                      placeholder={field.description}
                      className="block w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    />
                  ) : (
                    <input
                      type="text"
                      id={field.field}
                      value={val}
                      onChange={(e) => handleFieldChange(field.field, e.target.value)}
                      placeholder={field.description}
                      className="block w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                    />
                  )}
                  <span className="block text-[10px] text-slate-500 mt-1">
                    {field.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Context & Delivery Options */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <FileText className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              3. Konteks Tambahan & Jalur Pengiriman
            </h2>
          </div>

          <div>
            <label
              htmlFor="promptContext"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Konteks Alami / Keterangan Khusus
            </label>
            <textarea
              id="promptContext"
              rows={4}
              value={promptContext}
              onChange={(e) => setPromptContext(e.target.value)}
              placeholder="Jelaskan kebutuhan pengajuan secara rinci. Contoh: Pengajuan surat keterangan aktif kuliah untuk keperluan pendaftaran beasiswa PT Pertamina semester ganjil."
              className="block w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
            />
            <span className="block text-[10px] text-slate-500 mt-1">
              Data ini akan diproses oleh agen LLM Gemini untuk menyusun paragraf isi surat dinas.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label
                htmlFor="chosen_destination"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Kanal Distribusi Otomatis
              </label>
              <select
                id="chosen_destination"
                value={chosenDestination}
                onChange={(e) =>
                  setChosenDestination(e.target.value as 'email' | 'telegram' | '')
                }
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              >
                <option value="">Pilih kanal pengiriman (Opsional)</option>
                <option value="email">Email Mahasiswa / Instansi</option>
                <option value="telegram">Telegram Chat ID</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="target_destination_address"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alamat Tujuan (Email / Chat ID)
              </label>
              <input
                type="text"
                id="target_destination_address"
                value={targetDestinationAddress}
                onChange={(e) => setTargetDestinationAddress(e.target.value)}
                placeholder="nama@email.com atau Chat ID Telegram"
                className="block w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: File Attachments */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Paperclip className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              4. Berkas Lampiran Pendukung (Multimodal AI)
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unggah Dokumen (PDF, JPG, PNG)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
            <span className="block text-[10px] text-slate-500 mt-1">
              Mendukung LoA magang, sertifikat, atau pengumuman resmi. Agen AI mampu membaca teks
              dokumen secara langsung.
            </span>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-medium text-slate-700">Daftar Berkas Terpilih:</span>
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium text-slate-800">{file.name}</span>
                    <span className="text-[10px] text-slate-400">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4">
          <Link
            to="/dashboard"
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition"
          >
            Batalkan
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition shadow-xs"
          >
            {isSubmitting ? (
              <span>Mengirim & Menyusun Draf AI...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Kirim Permohonan Surat</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SuratCreatePage;
