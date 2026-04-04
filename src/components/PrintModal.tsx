import React from 'react';
import { Printer, X, Search } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  onPreview: () => void;
  title: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({ isOpen, onClose, onPrint, onPreview, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 no-print">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-96 border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-600 font-medium">Silakan pilih tindakan yang ingin Anda lakukan:</p>
          
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={onPrint} 
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <Printer size={20} />
              Cetak Laporan
            </button>
            
            <button 
              onClick={onPreview} 
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              <Search size={20} />
              Print Preview
            </button>
            
            <button 
              onClick={onClose} 
              className="w-full px-6 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
