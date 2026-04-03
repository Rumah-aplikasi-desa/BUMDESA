import React, { useState, useEffect, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    let errorMessage = 'Terjadi kesalahan yang tidak terduga.';
    
    try {
      const parsedError = JSON.parse(error?.message || '');
      if (parsedError.error && parsedError.error.includes('Missing or insufficient permissions')) {
        errorMessage = 'Anda tidak memiliki izin yang cukup untuk melakukan operasi ini. Silakan hubungi administrator.';
      }
    } catch (e) {
      // Not a JSON error message
    }

    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="bg-white p-12 rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Oops! Terjadi Kesalahan</h2>
          <p className="text-slate-500 leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
