import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  CheckSquare,
  ShieldCheck,
  PlusCircle,
  LogOut,
  LayoutDashboard,
  User as UserIcon,
} from 'lucide-react';

// Architectural Note:
// Role-aware responsive navigation bar adhering strictly to clean Swiss/linear typography.
// Zero emojis or emotes are present in the interface elements.

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const isLecturerOrAdmin =
    user?.role === 'LECTURER' || user?.role === 'STAFF' || user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-slate-900 leading-tight">
                  AutoSurat
                </span>
                <span className="text-[10px] text-slate-500 tracking-wider uppercase font-medium">
                  Agentic AI System
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center space-x-1">
                <Link
                  to="/dashboard"
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive('/dashboard')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
                  Dasbor
                </Link>

                <Link
                  to="/surat/new"
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive('/surat/new')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                  Buat Surat
                </Link>

                {isLecturerOrAdmin && (
                  <Link
                    to="/approvals"
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      isActive('/approvals')
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                    Antrean Persetujuan
                  </Link>
                )}

                <Link
                  to="/verify"
                  className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive('/verify')
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Verifikasi Surat
                </Link>
              </nav>
            )}
          </div>

          {/* User Controls */}
          <div className="flex items-center space-x-3">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-900 leading-none">
                    {user.nama}
                  </span>
                  <div className="flex items-center justify-end space-x-1 mt-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {user.nip_nim}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <UserIcon className="w-4 h-4" />
                </div>

                <button
                  onClick={handleLogout}
                  title="Keluar dari sesi"
                  className="inline-flex items-center justify-center p-2 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/verify"
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Verifikasi Publik
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition"
                >
                  Masuk Akun
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

