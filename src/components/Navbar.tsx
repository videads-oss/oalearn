import React from 'react';
import { FileText, ShieldAlert, LogOut, LogIn, Globe, UserCheck, BookOpen } from 'lucide-react';
import { User } from 'firebase/auth';
import { translations, Language } from '../lib/translations';

interface NavbarProps {
  user: User | null;
  isAdmin: boolean;
  currentRoute: string;
  onNavigate: (route: string) => void;
  onLogin: () => void;
  onLogout: () => void;
  lang: Language;
  onToggleLang: () => void;
}

export default function Navbar({
  user,
  isAdmin,
  currentRoute,
  onNavigate,
  onLogin,
  onLogout,
  lang,
  onToggleLang
}: NavbarProps) {
  const t = translations[lang];

  return (
    <nav className="sticky top-0 z-50 bg-[#FDFBF2] border-b-4 border-black text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo / Title */}
          <div 
            onClick={() => onNavigate('home')} 
            className="flex items-center space-x-3 cursor-pointer group"
          >
            {/* Sketch-styled Logo Box */}
            <div className="bg-[#FFE000] border-3 border-black p-2 shadow-[3px_3px_0px_#000] group-hover:rotate-[-4deg] transition-all duration-200">
              <BookOpen className="h-6 w-6 text-black stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xl sm:text-2xl font-black tracking-tight uppercase leading-none text-black hover:skew-x-1">
                {t.appName}
              </span>
              <p className="text-[10px] sm:text-xs font-sketch text-slate-700 tracking-wider font-bold mt-1">
                ★ {t.appSub} ★
              </p>
            </div>
          </div>

          {/* Navigation & Language / Auth Controls */}
          <div className="flex items-center space-x-3">
            {/* Download WordPress Theme ZIP Button */}
            <a
              href="/api/download-wp-theme"
              download="officers-academy-theme.zip"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-none border-2 border-black bg-[#90E0EF] hover:bg-[#00B4D8] text-black font-extrabold text-xs flex items-center space-x-1 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
              title="Download Fully Functional WordPress Theme ZIP"
            >
              <span>WP Theme 📥</span>
            </a>

            {/* English & Hindi Switcher (Sketch Button) */}
            <button
              onClick={onToggleLang}
              className="px-3 py-1.5 rounded-none border-2 border-black bg-[#FFE000] hover:bg-yellow-300 font-bold text-xs flex items-center space-x-1 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
              title="Toggle Hindi/English"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>



            {/* Admin Dashboard shortcut - ONLY visible if user logged in as Admin */}
            {isAdmin && (
              <button
                onClick={() => onNavigate('admin')}
                className={`px-3 py-1.5 rounded-none border-2 border-black font-bold text-xs transition-all cursor-pointer flex items-center space-x-1 ${
                  currentRoute === 'admin' 
                    ? 'bg-black text-[#FFE000] shadow-none' 
                    : 'bg-yellow-400 hover:bg-yellow-300 text-black shadow-[2px_2px_0px_#000]'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.manageBtn}</span>
              </button>
            )}

            {/* Profile / Auth actions */}
            <div className="border-l-2 border-black h-8 mx-1 hidden sm:block"></div>

            {user ? (
              <div className="flex items-center space-x-2">
                {/* User avatar with sketch outline */}
                <div className="hidden md:flex flex-col text-right leading-none">
                  <span className="text-xs font-bold text-black font-sans leading-none">
                    {user.displayName || 'Officer Admin'}
                  </span>
                  <span className="text-[10px] font-sketch font-bold text-slate-600 mt-1">
                    {isAdmin ? '🛡️ Super Admin' : 'Viewer'}
                  </span>
                </div>
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="user profile" 
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-none bg-black text-[#FFE000] border-2 border-black flex items-center justify-center font-bold text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <button
                  onClick={onLogout}
                  title={t.logout}
                  className="p-1.5 text-black hover:text-red-600 border-2 border-transparent hover:border-black rounded-none transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            ) : (
              /* Instead of Admin Panel links for guest, they get clear Login Option */
              <button
                onClick={onLogin}
                className="flex items-center space-x-1 bg-black text-[#FFE000] px-3.5 py-1.5 rounded-none border-2 border-black hover:bg-yellow-400 hover:text-black font-bold text-xs shadow-[2px_2px_0px_#000] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[0.5px_0.5px_0px_#000] transition-all cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{t.login}</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
