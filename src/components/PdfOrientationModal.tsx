import React from 'react';
import { X, FileText } from 'lucide-react';

interface PdfOrientationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (orientation: 'portrait' | 'landscape') => void;
  title?: string;
  description?: string;
}

export const PdfOrientationModal: React.FC<PdfOrientationModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Pilih Orientasi PDF',
  description = 'Setelah memilih orientasi, browser akan membuka dialog cetak. Pilih Save as PDF untuk menyimpan file.',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{title}</h2>
              <p className="text-xs font-medium text-slate-500">Tentukan orientasi halaman sebelum export</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-slate-600">{description}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => onSelect('portrait')}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50"
            >
              <span className="block text-sm font-black uppercase tracking-wide text-slate-900">Potret</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">Cocok untuk laporan teks atau kolom sempit.</span>
            </button>

            <button
              onClick={() => onSelect('landscape')}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span className="block text-sm font-black uppercase tracking-wide text-slate-900">Lanskap</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">Cocok untuk tabel lebar agar lebih utuh.</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
