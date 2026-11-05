import React from 'react';
import type { SuratStatusCode } from '../types';

interface StatusBadgeProps {
  status: SuratStatusCode;
  size?: 'sm' | 'md';
}

// Architectural Note:
// Zero-emoji design pattern: Status visualization strictly relies on semantic color tokens,
// border contrast, and clear uppercase typographic labels.

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'SUBMITTED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
          SUBMITTED
        </span>
      );
    case 'REVISION_REQUIRED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1.5"></span>
          REVISI DIPERLUKAN
        </span>
      );
    case 'PENDING_APPROVAL':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5"></span>
          MENUNGGU PERSETUJUAN
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
          DISETUJUI
        </span>
      );
    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-rose-50 text-rose-800 border border-rose-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5"></span>
          DITOLAK
        </span>
      );
    case 'PROCESSED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-purple-50 text-purple-800 border border-purple-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-1.5"></span>
          DIPROSES (TTE)
        </span>
      );
    case 'SENT':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-teal-50 text-teal-800 border border-teal-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 mr-1.5"></span>
          TERKIRIM
        </span>
      );
    case 'PRINTED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-indigo-50 text-indigo-800 border border-indigo-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mr-1.5"></span>
          DICETAK
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-red-50 text-red-800 border border-red-300 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5"></span>
          GAGAL
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center font-medium rounded-md bg-gray-100 text-gray-700 border border-gray-300 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};

export default StatusBadge;
