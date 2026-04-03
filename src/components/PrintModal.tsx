import React from 'react';
import { Printer, X } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  title: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({ isOpen, onClose, onPrint, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4">Apakah Anda ingin mencetak laporan ini?</p>
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Batal
          </button>
          <button 
            onClick={onPrint} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Printer size={16} />
            Cetak
          </button>
        </div>
      </div>
    </div>
  );
};
