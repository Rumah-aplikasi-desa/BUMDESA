import React, { useState } from 'react';
import { Loader2, User, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { sheetsService } from '../services/sheetsService';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await sheetsService.login({ username, password });
      // Use sessionStorage for "wajib login setiap masuk" (cleared when tab closed)
      sessionStorage.setItem('bumdesa_token', response.token);
      sessionStorage.setItem('bumdesa_user', JSON.stringify(response.user));
      onLogin(response.user);
    } catch (err: any) {
      setError(err.message || 'Gagal login. Silakan coba lagi.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-6 md:p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl z-10 mx-4"
      >
        <div className="flex flex-col items-center mb-6 md:mb-8 text-center">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-full shadow-lg flex items-center justify-center overflow-hidden mb-4 p-1">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTA910TyKCyvT35g9F_b623oeIfnLWT7DkcRw&s"
              alt="Logo"
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-semibold text-[10px] md:text-xs tracking-widest text-sky-400 mb-1">RUMAH APLIKASI DESA</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Sim Bumdes</h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">Sistem Akuntansi Bumdesa</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Username / Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all"
                placeholder="Masukkan username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all"
                placeholder="........"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Masuk ke Aplikasi'
            )}
          </button>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-4 rounded-lg text-center"
            >
              {error}
            </motion.div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden mb-3 p-1">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4LWlEIqyvrTiKmkOOwjzhIaHn-GwWVrYq6g&s"
              alt="Kepmendes Logo"
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-slate-400 text-xs">
            Berdasarkan Kepmendes PDT nomor 136 tahun 2022
          </p>
        </div>
      </motion.div>
    </div>
  );
};
