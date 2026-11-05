import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

// Architectural Note:
// Clean authentication view with instant credential preset triggers for testing,
// robust error handling, and redirection preserving the originally intended route.

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [nipNim, setNipNim] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nipNim || !password) {
      setErrorMsg('NIP/NIM dan Password wajib diisi.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(nipNim.trim(), password.trim());
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.response?.data?.message) {
        const extra = err.response?.data?.errors?.non_field_errors
          ? ` (${err.response.data.errors.non_field_errors.join(', ')})`
          : '';
        setErrorMsg(`${err.response.data.message}${extra}`);
      } else if (err.response?.data?.errors?.non_field_errors) {
        setErrorMsg(err.response.data.errors.non_field_errors.join(', '));
      } else {
        setErrorMsg('Gagal masuk. Periksa kembali NIP/NIM dan kata sandi Anda.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (type: 'student' | 'lecturer') => {
    if (type === 'student') {
      setNipNim('INF24001');
      setPassword('12345678');
    } else {
      setNipNim('198001012005011001');
      setPassword('12345678');
    }
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-slate-900">
          AutoSurat Kampus
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Sistem Penerbitan Dokumen Resmi Akademik Berbasis Agentic AI
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xs sm:rounded-lg sm:px-10 border border-slate-200">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 flex items-start space-x-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="nip_nim"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                NIM / NIP Pengguna
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="nip_nim"
                  name="nip_nim"
                  type="text"
                  required
                  value={nipNim}
                  onChange={(e) => setNipNim(e.target.value)}
                  placeholder="Contoh: INF24001 atau NIP Dosen"
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Kata Sandi
              </label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white placeholder-slate-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <span>Memverifikasi akun...</span>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Preset Selector */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <span className="block text-[11px] font-medium text-slate-500 mb-2">
              Akun Uji Coba Cepat (Testing Credentials):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('student')}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition text-left"
              >
                <div className="font-semibold">Mahasiswa</div>
                <div className="text-[10px] text-slate-500 font-mono">INF24001</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('lecturer')}
                className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition text-left"
              >
                <div className="font-semibold">Dosen / Pejabat</div>
                <div className="text-[10px] text-slate-500 font-mono">198001012005011001</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

