import type { DynamicFieldDef } from '../types';

// Architectural Note:
// Embedding the validated required fields from required_field_surat.json as typed dictionary.
// This allows immediate dynamic client-side form rendering and instant validation while
// maintaining backward-compatibility with backend SuratType.required_payload_fields.

export const REQUIRED_FIELDS_BY_KODE: Record<string, DynamicFieldDef[]> = {
  'SR-BEA': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Nama instansi atau penyelenggara beasiswa yang menerima surat',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan spesifik penggunaan rekomendasi beasiswa',
    },
    {
      type: 'string',
      field: 'alasan_pengajuan',
      label: 'Alasan Pengajuan',
      description: 'Alasan atau motivasi pengajuan beasiswa',
    },
  ],
  'SR-MAG': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Nama instansi atau perusahaan penerima magang',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan penggunaan surat rekomendasi magang',
    },
    {
      type: 'string',
      field: 'posisi_dilamar',
      label: 'Posisi yang Dilamar',
      description: 'Posisi atau divisi magang yang dituju',
    },
    {
      type: 'date',
      field: 'tanggal_mulai',
      label: 'Tanggal Mulai',
      description: 'Tanggal mulai kegiatan magang dalam format YYYY-MM-DD',
    },
    {
      type: 'date',
      field: 'tanggal_selesai',
      label: 'Tanggal Selesai',
      description: 'Tanggal selesai kegiatan magang dalam format YYYY-MM-DD',
    },
  ],
  'SP-MAG': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Nama instansi atau perusahaan yang dituju untuk pengantar magang',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan permohonan pengantar magang atau praktik kerja',
    },
    {
      type: 'string',
      field: 'posisi_dilamar',
      label: 'Posisi yang Dilamar',
      description: 'Posisi, peran, atau divisi magang yang dilamar',
    },
    {
      type: 'date',
      field: 'tanggal_mulai',
      label: 'Tanggal Mulai',
      description: 'Tanggal mulai magang dalam format YYYY-MM-DD',
    },
    {
      type: 'date',
      field: 'tanggal_selesai',
      label: 'Tanggal Selesai',
      description: 'Tanggal selesai magang dalam format YYYY-MM-DD',
    },
  ],
  'SI-MAG': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Nama instansi atau perusahaan tempat izin magang',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan permohonan izin pelaksanaan magang',
    },
    {
      type: 'string',
      field: 'posisi_dilamar',
      label: 'Posisi yang Dilamar',
      description: 'Posisi atau unit kerja magang',
    },
    {
      type: 'date',
      field: 'tanggal_mulai',
      label: 'Tanggal Mulai',
      description: 'Tanggal mulai izin magang dalam format YYYY-MM-DD',
    },
    {
      type: 'date',
      field: 'tanggal_selesai',
      label: 'Tanggal Selesai',
      description: 'Tanggal selesai izin magang dalam format YYYY-MM-DD',
    },
  ],
  'SK-KUL': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi atau pihak yang dituju (misal: PT Taspen, BPJS, Dinas Pendidikan)',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan peruntukan surat keterangan aktif kuliah',
    },
  ],
  'SK-BEA': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi yang memerlukan surat keterangan beasiswa',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan pengajuan surat keterangan penerimaan atau bebas beasiswa',
    },
    {
      type: 'string',
      field: 'nama_beasiswa',
      label: 'Nama Beasiswa',
      description: 'Nama program beasiswa terkait atau keterangan beasiswa yang dituju',
    },
  ],
  'SP-TRA': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi atau pihak penerima transkrip nilai akademik',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan permohonan transkrip nilai (misal: lamaran kerja, studi lanjut)',
    },
  ],
  'SP-SKC': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi kepolisian atau lembaga yang meminta surat pengantar',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan pengantar penerbitan SKCK atau keterangan berkelakuan baik',
    },
  ],
  'SP-TAS': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi, perusahaan, atau laboratorium lokasi penelitian skripsi',
    },
    {
      type: 'string',
      field: 'judul_tugas_akhir',
      label: 'Judul Tugas Akhir',
      description: 'Judul atau topik skripsi / tugas akhir mahasiswa',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan permohonan izin pengambilan data / penelitian tugas akhir',
    },
  ],
  'SI-SUR': [
    {
      type: 'string',
      field: 'instansi_tujuan',
      label: 'Nama Instansi Tujuan',
      description: 'Instansi atau lokasi pelaksanaan survei / observasi lapangan',
    },
    {
      type: 'string',
      field: 'mata_kuliah',
      label: 'Mata Kuliah',
      description: 'Nama mata kuliah yang melandasi kegiatan survei lapangan',
    },
    {
      type: 'string',
      field: 'tujuan_keperluan',
      label: 'Keperluan Surat',
      description: 'Tujuan atau topik survei / penelitian yang dilaksanakan',
    },
    {
      type: 'date',
      field: 'tanggal_mulai',
      label: 'Tanggal Mulai',
      description: 'Tanggal mulai survei dalam format YYYY-MM-DD',
    },
    {
      type: 'date',
      field: 'tanggal_selesai',
      label: 'Tanggal Selesai',
      description: 'Tanggal selesai survei dalam format YYYY-MM-DD',
    },
  ],
};

export const DEFAULT_REQUIRED_FIELDS: DynamicFieldDef[] = [
  {
    type: 'string',
    field: 'instansi_tujuan',
    label: 'Nama Instansi Tujuan',
    description: 'Nama instansi atau pihak yang menerima surat',
  },
  {
    type: 'string',
    field: 'tujuan_keperluan',
    label: 'Keperluan Surat',
    description: 'Tujuan atau keperluan permohonan surat dinas resmi',
  },
];
