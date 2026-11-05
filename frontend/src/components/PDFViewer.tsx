import React from 'react';
import { FileText, Download, ExternalLink, AlertCircle } from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string | null;
  nomorSurat?: string | null;
  documentTitle?: string;
}

// Architectural Note:
// Robust PDF previewer providing iframe presentation, direct download fallback,
// and informational placeholder when the document is still in pre-approval phase.

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfUrl,
  nomorSurat,
  documentTitle = 'Dokumen Surat Resmi',
}) => {
  if (!pdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-center">
        <div className="p-3 bg-slate-200 rounded-full text-slate-600 mb-3">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">
          Berkas PDF Belum Diterbitkan
        </h3>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          Dokumen PDF resmi beserta TTE (Tanda Tangan Elektronik) dan QR Code verifikasi
          akan digenerate secara otomatis oleh backend segera setelah pejabat berwenang
          memberikan persetujuan final (APPROVE).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <span className="text-sm font-medium text-slate-800 truncate">
            {nomorSurat ? `Nomor: ${nomorSurat}` : documentTitle}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Buka Tab Baru
          </a>
          <a
            href={pdfUrl}
            download
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Unduh PDF
          </a>
        </div>
      </div>

      {/* PDF Viewport */}
      <div className="relative w-full h-[640px] bg-slate-100">
        <iframe
          src={pdfUrl}
          title="Preview Dokumen Surat"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
};

export default PDFViewer;

