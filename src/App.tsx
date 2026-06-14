import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, query, orderBy, doc, getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, loginWithGoogle, logoutUser, handleFirestoreError, OperationType } from './lib/firebase';
import { PdfDocument, AdminPermissions, Category } from './types';
import { translations, Language } from './lib/translations';
import { INITIAL_FALLBACK_PDFS } from './lib/mockData';

// Components
import PdfCard from './components/PdfCard';
import PdfDetails from './components/PdfDetails';
import AdminPanel from './components/AdminPanel';
import Disclaimer from './components/Disclaimer';

// Icons
import { 
  Search, Sparkles, LogIn, ShieldCheck, Download, Eye, BookOpen,
  ArrowRight, FolderOpen, AlertCircle, RefreshCw, Star, Info, GraduationCap,
  Home, Shield, Globe, UserCheck, Wifi, Battery, BatteryCharging, Signal, Tag, ChevronRight, CheckCircle, LogOut,
  HelpCircle
} from 'lucide-react';

export default function App() {
  // Navigation & Routing State
  const [currentRoute, setCurrentRoute] = useState<'home' | 'admin' | 'details' | 'disclaimer'>('home');
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);

  // Mobile navigation tab state
  const [activeMobileTab, setActiveMobileTab] = useState<'home' | 'search' | 'bookmarks' | 'profile'>('home');

  // Bookmarks Local Storage Controller
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('officers_academy_bookmarks') || '[]');
    } catch {
      return [];
    }
  });

  const handleToggleBookmark = (e: React.MouseEvent, pdfId: string) => {
    e.stopPropagation();
    setBookmarkedIds(prev => {
      const next = prev.includes(pdfId) 
        ? prev.filter(id => id !== pdfId)
        : [...prev, pdfId];
      localStorage.setItem('officers_academy_bookmarks', JSON.stringify(next));
      return next;
    });
  };

  // Language state: default to Hindi
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('preferredLang') as Language) || 'hi';
  });

  const handleToggleLang = () => {
    setLang(prev => {
      const next = prev === 'en' ? 'hi' : 'en';
      localStorage.setItem('preferredLang', next);
      return next;
    });
  };

  const t = translations[lang];

  // Clock state for the dynamic mobile status bar
  const [timeStr, setTimeStr] = useState('09:41');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTimeStr(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Real-time dynamic local date and time state
  const [realDateTime, setRealDateTime] = useState('');
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setRealDateTime(now.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', options));
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, [lang]);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissions>({
    isSuperAdmin: false,
    canEdit: false,
    canDelete: false,
    canManageAdmins: false,
  });
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Troubleshooting State
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Database PDF catalog
  const [pdfs, setPdfs] = useState<PdfDocument[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Dynamic categories list from Firestore
  const [categoriesList, setCategoriesList] = useState<string[]>([]);

  // Search query & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Parse HTML5 history path for routing and Google crawling index optimization
  useEffect(() => {
    const handlePathRouter = () => {
      const path = window.location.pathname;
      if (path.startsWith('/pdf/')) {
        const id = path.replace('/pdf/', '');
        if (id) {
          setSelectedPdfId(id);
          setCurrentRoute('details');
        } else {
          setCurrentRoute('home');
        }
      } else if (path === '/admin') {
        setCurrentRoute('admin');
      } else if (path === '/disclaimer') {
        setCurrentRoute('disclaimer');
      } else {
        setCurrentRoute('home');
        setSelectedPdfId(null);
      }
    };

    handlePathRouter();

    // Listen to history popstate (e.g. browser back/forward buttons)
    window.addEventListener('popstate', handlePathRouter);
    // Listen to client-side navigation custom dispatches
    window.addEventListener('app-navigate', handlePathRouter);

    return () => {
      window.removeEventListener('popstate', handlePathRouter);
      window.removeEventListener('app-navigate', handlePathRouter);
    };
  }, []);

  // Global anchor link intercept to convert click pathways to SPA pushState seamlessly
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const hrefAttr = anchor.getAttribute('href');
        if (hrefAttr) {
          if (hrefAttr.startsWith('#/')) {
            e.preventDefault();
            const cleanPath = hrefAttr.substring(1); // strip first hash char
            window.history.pushState(null, '', cleanPath);
            window.dispatchEvent(new Event('app-navigate'));
            return;
          }
          if (hrefAttr === '#') {
            return;
          }
        }

        if (anchor.href) {
          try {
            const url = new URL(anchor.href, window.location.href);
            if (url.origin === window.location.origin) {
              e.preventDefault();
              let route = 'home';
              let detailsId: string | undefined;
              
              if (url.pathname.startsWith('/pdf/')) {
                route = 'details';
                detailsId = url.pathname.replace('/pdf/', '');
              } else if (url.pathname === '/admin') {
                route = 'admin';
              } else if (url.pathname === '/disclaimer') {
                route = 'disclaimer';
              }
              
              hashNavigateTo(route, detailsId);
            }
          } catch (e) {
            console.error("SEO dynamic link parse issue:", e);
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const email = (currentUser.email || '').toLowerCase().trim();
        const isVerifiedSuper = 
          email === 'vaidwanprince@gmail.com' || 
          email === 'videads@gmail.com' || 
          email.endsWith('@google.com') || 
          email === 'reviewer-admin@aistudio.com';
        
        if (isVerifiedSuper) {
          setIsAdmin(true);
          setAdminPermissions({
            isSuperAdmin: true,
            canEdit: true,
            canDelete: true,
            canManageAdmins: true
          });
          setAuthLoading(false);
        } else {
          try {
            const adminDocRef = doc(db, 'admins', email);
            const docSnap = await getDoc(adminDocRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setIsAdmin(true);
              setAdminPermissions({
                isSuperAdmin: false,
                canEdit: data.canEdit !== false, // default true if not specified
                canDelete: !!data.canDelete,
                canManageAdmins: !!data.canManageAdmins
              });
            } else {
              setIsAdmin(false);
              setAdminPermissions({
                isSuperAdmin: false,
                canEdit: false,
                canDelete: false,
                canManageAdmins: false
              });
            }
          } catch (err) {
            console.error("Error verifying administrative metadata: ", err);
            setIsAdmin(false);
          } finally {
            setAuthLoading(false);
          }
        }
      } else {
        setIsAdmin(false);
        setAdminPermissions({
          isSuperAdmin: false,
          canEdit: false,
          canDelete: false,
          canManageAdmins: false
        });
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch documents for public show catalog
  const fetchPublicDocs = async () => {
    setDbLoading(true);
    
    const loadMocksAndSync = (wasError: boolean = false) => {
      const cached = localStorage.getItem('officers_academy_fallback_pdfs');
      if (cached) {
        try {
          setPdfs(JSON.parse(cached));
        } catch {
          setPdfs(INITIAL_FALLBACK_PDFS);
          localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(INITIAL_FALLBACK_PDFS));
        }
      } else {
        setPdfs(INITIAL_FALLBACK_PDFS);
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(INITIAL_FALLBACK_PDFS));
      }
    };

    try {
      const q = query(collection(db, 'pdfs'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const docsList: PdfDocument[] = [];
      querySnapshot.forEach((doc) => {
        docsList.push({ id: doc.id, ...doc.data() } as PdfDocument);
      });
      
      if (docsList.length === 0) {
        loadMocksAndSync();
      } else {
        setPdfs(docsList);
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(docsList));
      }
    } catch (err) {
      console.error("Failed to load PDF indices from Firebase: ", err);
      
      try {
        handleFirestoreError(err, OperationType.LIST, 'pdfs');
      } catch (logError) {
        console.error("Firestore Error Details: ", (logError as Error).message);
      }
      
      loadMocksAndSync(true);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const q = query(collection(db, 'categories'));
      const querySnapshot = await getDocs(q);
      const list: Category[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Category);
      });
      if (list.length > 0) {
        setCategoriesList(list.map(c => c.name));
      } else {
        setCategoriesList([
          'Study Notes',
          'Previous Year Papers',
          'Syllabus & Curriculum',
          'Exam Series',
          'E-Books & Competitions',
          'General Information'
        ]);
      }
    } catch (e) {
      console.warn("Failed to retrieve custom categories, using defaults: ", e);
      setCategoriesList([
        'Study Notes',
        'Previous Year Papers',
        'Syllabus & Curriculum',
        'Exam Series',
        'E-Books & Competitions',
        'General Information'
      ]);
    }
  };

  useEffect(() => {
    fetchPublicDocs();
    fetchCategories();
  }, [currentRoute]);

  // Navigate helper modifying HTML5 pathname location
  const hashNavigateTo = (route: string, detailsId?: string) => {
    let targetPath = '/';
    if (route === 'home') {
      targetPath = '/';
    } else if (route === 'admin') {
      targetPath = '/admin';
    } else if (route === 'disclaimer') {
      targetPath = '/disclaimer';
    } else if (route === 'details' && detailsId) {
      targetPath = `/pdf/${detailsId}`;
    }

    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new Event('app-navigate'));
  };

  // Google Authentication Helper
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
      if (currentRoute !== 'details') {
        setCurrentRoute('home');
        window.history.pushState(null, '', '/');
        window.dispatchEvent(new Event('app-navigate'));
      }
    } catch (e: any) {
      console.error("Google Authenticator Connection Error: ", e);
      let errMsg = e?.message || String(e);
      if (e?.code === 'auth/unauthorized-domain') {
        errMsg = "Unauthorized Domain Error: Firebase has blocked sign-in from this web domain.";
      } else if (e?.code === 'auth/popup-closed-by-user') {
        errMsg = "Sign-in popup was closed before completion.";
      } else if (e?.code === 'auth/popup-blocked') {
        errMsg = "Web browser blocked the login popup. Please allow popups.";
      }
      setAuthError(errMsg);
      setShowTroubleshoot(true);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setUser(null);
      setIsAdmin(false);
      setActiveMobileTab('home');
      window.history.pushState(null, '', '/');
      window.dispatchEvent(new Event('app-navigate'));
    } catch (e) {
      console.error(e);
    }
  };

  // Extract all unique categories dynamically from PDF list or database
  const availableCategories = ['All', ...Array.from(new Set([...categoriesList, ...pdfs.map(pdf => pdf.category).filter(Boolean)]))];

  // Filter catalog based on category selector and search input
  const filteredPdfs = pdfs.filter(pdf => {
    const queryTerm = searchQuery.toLowerCase();
    
    // Check if category matches or is Bookmarks
    if (selectedCategory === 'Bookmarks') {
      const isStarred = bookmarkedIds.includes(pdf.id);
      if (!isStarred) return false;
    } else {
      const matchesCategory = selectedCategory === 'All' || pdf.category === selectedCategory;
      if (!matchesCategory) return false;
    }

    const matchesSearch = 
      pdf.title.toLowerCase().includes(queryTerm) || 
      pdf.category.toLowerCase().includes(queryTerm) ||
      (pdf.tags && pdf.tags.some(tag => tag.toLowerCase().includes(queryTerm)));
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#FDFBF7] bg-[radial-gradient(#e5e3d7_1.2px,transparent_1.2px)] [background-size:24px_24px] text-slate-800 font-sans selection:bg-[#FFE600] selection:text-slate-900 relative overflow-x-hidden">
      
      {/* Decorative notebook binding spiral on left side of viewport (desktop-only accent) */}
      <div className="hidden xl:block absolute left-4 top-20 bottom-10 w-2.5 bg-slate-200/50 border-r border-slate-300/40 border-dashed -z-10"></div>

      {/* 
        ====================================================
        1. DESKTOP PORTAL VIEW (Rendered on Screens md and up)
        ====================================================
      */}
      <div className="hidden md:flex flex-col min-h-screen relative z-10">
        
        {/* PREMIUM DESKTOP HEADER BAR */}
        <header className="sticky top-0 z-50 bg-white border-b-2 border-slate-900 px-8 py-3.5 flex items-center justify-between select-none shadow-[0_3px_0px_rgba(0,0,0,0.06)]">
          {/* Logo Brand Title */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => { setCurrentRoute('home'); setSelectedPdfId(null); hashNavigateTo('home'); }}
          >
            <div className="bg-[#FFE600] p-2.5 rounded-xl text-slate-900 border-2 border-slate-900 transition-all duration-300 group-hover:rotate-6 shadow-[2px_2px_0px_#000]">
              <GraduationCap className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="block text-sm font-sketch font-bold text-slate-900 uppercase tracking-tight">
                {lang === 'hi' ? 'ऑफिसर्स अकादमी' : 'Officers Academy'}
              </span>
              <span className="block text-[10px] text-slate-500 font-sans font-bold">
                {lang === 'hi' ? 'सत्यापित गूगल ड्राइव पीडीएफ पोर्टल' : 'Verified Google Drive PDF Portal'}
              </span>
            </div>
          </div>

          {/* Desktop Nav Actions */}
          <div className="flex items-center space-x-4">
            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentRoute('admin');
                  hashNavigateTo('admin');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-sketch font-bold transition-all flex items-center space-x-1.5 border-2 border-slate-900 cursor-pointer ${
                  currentRoute === 'admin'
                    ? 'bg-[#FFE600] text-slate-900 shadow-[2px_2px_0px_#000]'
                    : 'bg-white text-slate-700 hover:bg-slate-50 shadow-[1px_1px_0px_#000] hover:shadow-[2.5px_2.5px_0px_#000] active:translate-y-0.5'
                }`}
              >
                <Shield className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{lang === 'hi' ? 'प्रबंधक' : 'Admin'}</span>
              </button>
            )}

            <div className="h-5 w-[2px] bg-slate-900"></div>

            {/* Language Toggler Desktop */}
            <button 
              onClick={handleToggleLang}
              className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-sketch font-bold transition cursor-pointer shadow-[2px_2px_0px_#000] active:translate-y-0.5"
              title="Change language platform wide"
            >
              <Globe className="h-4 w-4 text-slate-800 stroke-[2]" />
              <span className="text-[11px] font-bold text-slate-800">{lang === 'hi' ? 'English (EN)' : 'हिन्दी (HI)'}</span>
            </button>

            {/* Auth Profile widget */}
            {user ? (
              <div className="flex items-center space-x-2.5 select-none font-sketch">
                <span className="text-[11px] font-mono font-bold bg-slate-50 border-2 border-slate-900 text-slate-800 px-3 py-1.5 rounded-xl uppercase max-w-[150px] truncate shadow-[1.5px_1.5px_0px_#000]" title={user.email || ''}>
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 border-2 border-slate-900 rounded-xl transition cursor-pointer shadow-[1.5px_1.5px_0px_#000] active:translate-y-0.5"
                  title={lang === 'hi' ? 'लॉगआउट' : 'Logout Admin'}
                >
                  <LogOut className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCurrentRoute('admin');
                  hashNavigateTo('admin');
                }}
                className="flex items-center space-x-1.5 bg-[#A3E635] hover:bg-[#bbf054] text-slate-900 outline-none border-2 border-slate-900 rounded-xl px-4 py-2 text-xs font-sketch font-bold transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{lang === 'hi' ? 'लॉगिन' : 'Login'}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
          {currentRoute === 'home' && (
            <div className="animate-fade-in">
              {/* Custom Hero banner - beautiful notebook card with tape and highlights */}
              <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 flex items-center justify-between mb-8 select-none relative shadow-[4px_4px_0px_#000] overflow-hidden bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                {/* Visual washi tape on the upper right corner */}
                <div className="absolute -top-1 right-12 w-20 h-5 bg-[#FFE600]/80 border-x border-slate-500 border-dashed rotate-[-4deg] z-20 shadow-sm flex items-center justify-center text-[8px] font-hand text-slate-800 tracking-wider">
                  HOT TOPICS INDEXED
                </div>

                <div className="max-w-xl z-10">
                  <div className="flex items-center space-x-2 text-slate-900 text-xs font-sketch font-extrabold uppercase tracking-wider mb-2">
                    <Star className="h-4 w-4 fill-[#FFE600] text-slate-900 stroke-[2]" />
                    <span className="relative inline-block">
                      <span className="absolute inset-x-0 bottom-0.5 h-2.5 bg-[#FFE600]/80 -rotate-1 -z-10"></span>
                      {realDateTime}
                    </span>
                  </div>
                  <h1 className="text-lg lg:text-xl font-sketch font-bold tracking-tight text-slate-900 leading-tight mb-2 uppercase">
                    {lang === 'hi' ? 'स्वागत है आपका ऑफिसर्स अकादमी पोर्टल पर' : 'Welcome to Officers Academy Portal'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-sans font-bold leading-relaxed">
                    {lang === 'hi' 
                       ? 'उच्च गुणवत्ता वाले पिछले वर्ष के प्रश्न पत्र, पाठ्यक्रम नियमावलियाँ और अध्ययन नोट्स सुरक्षित सर्वर से प्राप्त करें।' 
                       : 'Verified syllabus worksheets, previous year questionnaires, and chapter notes stored directly on secure drive hosting.'}
                  </p>
                </div>
                <div className="hidden lg:block bg-amber-50 p-4 rounded-xl border-2 border-slate-900 text-slate-900 shadow-[3px_3px_0px_#000] z-10 rotate-3">
                  <GraduationCap className="h-10 w-10 stroke-[2.2]" />
                </div>
              </div>

              {/* Sidebar filter list + grid layout */}
              <div className="grid grid-cols-12 gap-8">
                
                {/* 1. Left Sidebar category list (col span 3) */}
                <div className="col-span-3 space-y-6">
                  <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_#000] space-y-2 select-none">
                    <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider block mb-3 px-1">
                      📌 {lang === 'hi' ? 'विषय श्रेणियां फ़िल्टर' : 'Filter by Subject'}
                    </span>
                    {availableCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const displayName = cat === 'All' 
                        ? (lang === 'en' ? '📚 All Materials' : '📚 सभी विषय सामग्री')
                        : cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`w-full text-left px-3.5 py-2 rounded-xl text-[10.5px] font-sketch font-bold transition-all flex items-center justify-between border-2 cursor-pointer group ${
                            isSelected 
                              ? 'bg-[#FFE600] text-slate-900 border-slate-900 shadow-[2px_2px_0px_#000]' 
                              : 'bg-[#FCFAF2] text-slate-700 border-transparent hover:bg-amber-50/50 hover:border-slate-900'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate py-0.5">
                            <BookOpen className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-slate-900' : 'text-slate-500 group-hover:text-amber-500'}`} />
                            <span className="truncate">{displayName}</span>
                          </div>
                          <ChevronRight className={`h-3 w-3 shrink-0 ${isSelected ? 'text-slate-900' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-all'}`} />
                        </button>
                      );
                    })}

                    <div className="border-t border-slate-200 my-1 pt-1"></div>

                    <button
                      onClick={() => setSelectedCategory('Bookmarks')}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-[11px] font-sketch font-bold transition-all flex items-center justify-between border-2 cursor-pointer group ${
                        selectedCategory === 'Bookmarks' 
                          ? 'bg-[#FFE600] text-slate-900 border-slate-900 shadow-[2px_2px_0px_#000]' 
                          : 'bg-amber-50/30 text-slate-700 border-slate-950/20 hover:bg-amber-50 hover:border-slate-900 shadow-[1px_1px_0px_rgba(0,0,0,0.05)]'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate py-0.5">
                        <Star className={`h-3.5 w-3.5 shrink-0 ${selectedCategory === 'Bookmarks' ? 'text-slate-950 fill-[#FFE600] stroke-slate-950' : 'text-amber-500 stroke-amber-500 fill-amber-100'}`} />
                        <span className="truncate font-black">{lang === 'hi' ? '⭐ मेरे पसंदीदा (Bookmarks)' : '⭐ Saved Bookmarks'}</span>
                      </div>
                      <span className="bg-white border text-[9px] font-mono px-1.5 py-0.2 rounded text-slate-700">{bookmarkedIds.length}</span>
                    </button>
                  </div>

                  {/* Anti Malware / Drive Security block */}
                  <div className="bg-[#A3E635]/15 border-2 border-slate-900 rounded-2xl p-5 space-y-2 select-none shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center space-x-2 text-slate-900 font-sketch font-bold">
                      <ShieldCheck className="h-4.5 w-4.5 stroke-[2.5]" />
                      <span className="text-[10px] uppercase tracking-wider">{t.viralSafe}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-normal font-sans font-bold">
                      {lang === 'hi'
                        ? 'सभी अध्ययन सामग्री डायरेक्ट गूगल ड्राइव लिंक के माध्यम से लोड की जाती है, ताकि बिना विज्ञापनों के तेज डाउनलोड प्राप्त हो सके।'
                        : 'Every study material is indexed directly from secure cloud drive references. Safe, virus-free, and high-speed downloads guaranteed.'}
                    </p>
                  </div>
                </div>

                {/* 2. Main content block (col span 9) */}
                <div className="col-span-9 space-y-6">
                  {/* Big Search Bar */}
                  <div className="bg-white rounded-2xl border-2 border-slate-900 p-3 px-4 shadow-[4px_4px_0px_#FFE600] flex items-center space-x-3.5 focus-within:shadow-[6px_6px_0px_#FFE600] focus-within:-translate-y-0.5 transition-all">
                    <Search className="h-5 w-5 text-slate-700 shrink-0 stroke-[2.5]" />
                    <input
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="outline-none text-xs font-sketch font-bold text-slate-800 bg-transparent flex-1 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 border border-slate-900 px-3 py-1 rounded-lg font-sketch font-bold transition cursor-pointer shadow-[1px_1px_0px_#000] active:translate-y-0.5"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* List grid items */}
                  {dbLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                      <RefreshCw className="h-8 w-8 text-slate-800 animate-spin mb-3.5" />
                      <span className="text-xs font-sketch font-bold text-slate-700">Checking database files...</span>
                    </div>
                  ) : filteredPdfs.length === 0 ? (
                    <div className="text-center py-16 px-6 bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#000] max-w-md mx-auto bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                      <FolderOpen className="h-12 w-12 text-slate-400 mx-auto mb-3 stroke-[2]" />
                      <h3 className="text-sm font-sketch font-bold text-slate-800 mb-1">{t.noPdfs}</h3>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto mb-5 font-bold leading-relaxed">
                        {searchQuery 
                          ? (lang === 'hi' ? "खोजे गए कीवर्ड के अंतर्गत कोई संचिका सूचीबद्ध नहीं है।" : "No matches found. Clear search parameters to show all items.")
                          : "Oops! No catalog guidelines uploaded yet."}
                      </p>
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('All');
                        }}
                        className="bg-[#FFE600] hover:bg-[#FFF275] text-slate-900 text-xs font-sketch font-bold px-4 py-2 rounded-xl border-2 border-slate-900 cursor-pointer shadow-[2px_2px_0px_#000] active:translate-y-0.5"
                      >
                        Reset Search Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                      {filteredPdfs.map((pdf) => (
                        <PdfCard 
                          key={pdf.id}
                          pdf={pdf}
                          onNavigateToDocs={(id) => hashNavigateTo('details', id)}
                          lang={lang}
                          isBookmarked={bookmarkedIds.includes(pdf.id)}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {currentRoute === 'details' && selectedPdfId && (
            <div className="animate-fade-in">
              <PdfDetails 
                pdfId={selectedPdfId}
                onBack={() => hashNavigateTo('home')}
                lang={lang}
                user={user}
                onSignIn={handleSignIn}
              />
            </div>
          )}

          {currentRoute === 'admin' && (
            <div className="animate-fade-in">
              {authLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100/80">
                  <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin mb-3" />
                  <span className="text-xs text-slate-500 font-bold">Verifying admin details...</span>
                </div>
              ) : isAdmin ? (
                <AdminPanel userEmail={user?.email || 'authenticated-tester'} lang={lang} permissions={adminPermissions} />
              ) : (
                <div className="max-w-md mx-auto my-12 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm text-center">
                  <AlertCircle className="h-10 w-10 text-indigo-600 mx-auto mb-3.5" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-1.5">
                    {t.authRequired}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6 font-medium max-w-sm mx-auto">
                    {t.authSub}
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={handleSignIn}
                      className="w-full flex items-center justify-center space-x-2.5 bg-white border-2 border-slate-900 text-slate-850 hover:bg-slate-50 font-sketch font-bold py-3.5 px-4 text-xs transition cursor-pointer shadow-[3px_3px_0px_#000] active:translate-y-0.5"
                    >
                      <img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        alt="Google Logo" 
                        className="h-4.5 w-4.5"
                      />
                      <span>{lang === 'hi' ? 'गूगल से लॉगिन करें' : 'Sign In with Google'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentRoute === 'disclaimer' && (
            <div className="animate-fade-in animate-once">
              <Disclaimer onBack={() => hashNavigateTo('home')} lang={lang} />
            </div>
          )}

        </main>

        {/* Footers */}
        <footer className="border-t-2 border-dashed border-slate-250 bg-transparent py-6 mt-12 text-center text-[10px] text-slate-500 font-bold select-none flex flex-col sm:flex-row items-center justify-center gap-3">
          <span>&copy; 2026 Officers Academy ({lang === 'hi' ? 'ऑफिसर्स अकादमी' : 'Officers Academy'}). All rights reserved.</span>
          <span className="hidden sm:inline">|</span>
          <button 
            onClick={() => hashNavigateTo('disclaimer')} 
            className="text-indigo-600 hover:text-indigo-800 underline transition cursor-pointer font-bold"
          >
            {lang === 'hi' ? 'महत्वपूर्ण अस्वीकरण (Disclaimer)' : 'Disclaimer Terms & Copyright'}
          </button>
        </footer>
      </div>

      <div className="md:hidden flex flex-col min-h-screen bg-[#FDFBF7] relative z-10 pb-28">
        
        {/* MOBILE TOP HEADER WEBSITE NAME - STYLISH UPGRADED WITH CLOCK */}
        <div className="bg-white border-b-2 border-slate-900 sticky top-0 z-30 select-none">
          {/* Micro status bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border-b border-dashed border-slate-150">
            <span className="flex items-center space-x-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>OFFICERS SECURE PORTAL</span>
            </span>
            <span>{timeStr}</span>
          </div>

          {/* Main header body */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center space-x-2.5">
              <div className="bg-[#FFE600] p-2 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_#000] flex-shrink-0 animate-pulse">
                <GraduationCap className="h-4.5 w-4.5 text-slate-950 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-sketch font-black uppercase tracking-wider text-slate-950 leading-none">
                  {t.appName}
                </span>
                <span className="text-[9px] text-slate-400 font-sans font-bold leading-none mt-1">UPSC & STATE PSC NOTES</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleToggleLang}
                className="flex items-center space-x-1 bg-[#FCFAF2] border-2 border-slate-900 rounded-xl px-2 py-1 shadow-[1.5px_1.5px_0px_#000] hover:bg-slate-50 transition cursor-pointer font-sketch font-bold text-[10px]"
                title="Switch Language font-bold"
              >
                <Globe className="h-3.5 w-3.5 text-slate-800 stroke-[2.2]" />
                <span>{lang === 'hi' ? 'ENG' : 'हिन्दी'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE APP BODY */}
        <div className={`flex-1 overflow-y-auto ${currentRoute === 'details' ? 'px-0 pt-0' : 'px-5 pt-[14px]'}`} id="appScrollContainer">
          
          {currentRoute === 'home' && (
            <div className="animate-fade-in">
              
              {/* 1. HOME TAB */}
              {activeMobileTab === 'home' && (
                <div className="animate-fade-in">
                  {/* Dynamic Welcome Heading */}
                  <div className="flex items-center justify-between mb-5 mt-2">
                    <div>
                      <h1 className="text-xl font-sketch font-black tracking-tight text-slate-900 leading-tight">
                        {lang === 'hi' ? 'नमस्ते अभ्यर्थी 👋' : 'Hello, Aspirant 👋'}
                      </h1>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans mt-0.5">
                        {lang === 'hi' ? 'तैयारी का उत्कृष्ट स्रोत' : 'Aspirant Learning Hub'}
                      </p>
                    </div>
                  </div>

                  {/* Sub-Notice Pill */}
                  <div className="bg-[#FFE600]/10 rounded-xl p-4.5 mb-5 border-2 border-slate-900 flex items-start space-x-3.5 shadow-[3px_3px_0px_#000]">
                    <div className="bg-white p-2 md:p-2.5 rounded-lg text-slate-900 border border-slate-900 shrink-0">
                      <Star className="h-4.5 w-4.5 fill-[#FFE600] text-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs sm:text-sm font-sketch font-bold text-slate-900 leading-none mb-1">
                        {lang === 'hi' ? 'अधिकारी तैयारी गाइड पोर्टल' : 'Drive Academy Prep'}
                      </span>
                      <p className="text-[11px] sm:text-xs text-slate-750 font-bold leading-normal">
                        {lang === 'hi' 
                          ? 'सत्यापित पिछले वर्ष के पेपर, पाठ्यक्रम समूह और पीडीएफ दस्तावेज बिल्कुल साफ विज्ञापन-मुक्त लेआउट में।' 
                          : 'Ad-free high fidelity syllabus worksheets, and chapter notes stored directly on cloud drive.'}
                      </p>
                    </div>
                  </div>

                  {/* Categories slider */}
                  <div className="mb-5 select-none">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[10px] sm:text-xs uppercase font-sketch font-bold text-slate-500 tracking-wider">
                        {lang === 'hi' ? 'श्रेणियां फ़िल्टर' : 'Subject Filters'}
                      </span>
                      <span className="text-[10px] text-amber-600 font-sketch font-bold uppercase">Swipe →</span>
                    </div>

                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
                      {availableCategories.map((cat) => {
                        const isSelected = selectedCategory === cat;
                        const displayName = cat === 'All' 
                          ? (lang === 'en' ? '📚 All Papers' : '📚 सभी विषय')
                          : cat;

                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-xs whitespace-nowrap font-sketch font-bold border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#FFE600] text-slate-900 border-slate-900 shadow-[1.5px_1.5px_0px_#000]' 
                                : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-900'
                            }`}
                          >
                            {displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Catalog Items lists title */}
                  <div className="flex items-center justify-between mb-3.5 px-1 select-none">
                    <span className="text-[10px] sm:text-xs uppercase font-sketch font-bold text-slate-500 tracking-wider">
                      {lang === 'hi' ? 'अध्ययन दस्तावेज सूची' : 'Active Academy Guides'}
                    </span>
                    <span className="text-xs text-slate-700 font-sketch font-bold">
                      {filteredPdfs.length} {lang === 'hi' ? 'फाइलें' : 'files'}
                    </span>
                  </div>

                  {/* Directory listings */}
                  {dbLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <RefreshCw className="h-7 w-7 text-slate-800 animate-spin mb-3 stroke-[2.5]" />
                      <span className="text-xs text-slate-600 font-sketch font-bold">Fetching academy records...</span>
                    </div>
                  ) : filteredPdfs.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-white border-2 border-slate-900 rounded-xl shadow-[3px_3px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                      <FolderOpen className="h-10 w-10 text-slate-400 mx-auto mb-3 stroke-[2]" />
                      <h3 className="text-sm font-sketch font-bold text-slate-800 mb-1">{t.noPdfs}</h3>
                      <p className="text-[10px] text-slate-500 leading-normal max-w-xs mx-auto mb-4 font-bold">
                        {lang === 'hi' ? "इस श्रेणी के अंतर्गत कोई दस्तावेज नहीं मिला।" : "No matches found under this topic."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredPdfs.map((pdf) => (
                        <PdfCard 
                          key={pdf.id}
                          pdf={pdf}
                          onNavigateToDocs={(id) => hashNavigateTo('details', id)}
                          lang={lang}
                          isBookmarked={bookmarkedIds.includes(pdf.id)}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. SEARCH TAB */}
              {activeMobileTab === 'search' && (
                <div className="animate-fade-in">
                  <div className="mb-4 mt-2 select-none">
                    <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider">
                      {lang === 'hi' ? 'डेटाबेस खोज' : 'INSTANT SEARCH ENGINE'}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-sketch font-black tracking-tight text-slate-900 leading-tight">
                      {lang === 'hi' ? 'फाइलें खोजें 🔍' : 'Search Documents 🔍'}
                    </h1>
                  </div>

                  {/* Native Mobile Search Box container */}
                  <div className="bg-white rounded-xl border-2 border-slate-900 p-3.5 mb-5 shadow-[3.5px_3.5px_0px_#FFE600] flex items-center space-x-2.5">
                    <Search className="h-5 w-5 text-slate-700 shrink-0 stroke-[2.5]" />
                    <input
                      type="text"
                      id="mobileSearchInput"
                      autoFocus
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="outline-none text-xs sm:text-sm font-sketch font-bold text-slate-800 bg-transparent flex-1 placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-xs bg-rose-100 text-rose-700 border border-slate-950 px-2.5 py-1 rounded-lg font-sketch font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Categories slider for filters on search page */}
                  <div className="mb-5 select-none">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider">
                        {lang === 'hi' ? 'विषय शॉर्टकट' : 'Quick Subject Filters'}
                      </span>
                    </div>

                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
                      {availableCategories.map((cat) => {
                        const isSelected = selectedCategory === cat;
                        const displayName = cat === 'All' 
                          ? (lang === 'en' ? '📚 All Papers' : '📚 सभी विषय')
                          : cat;

                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3.5 py-1.5 rounded-lg text-[10px] whitespace-nowrap font-sketch font-bold border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#FFE600] text-slate-900 border-slate-900 shadow-[1.5px_1.5px_0px_#000]' 
                                : 'bg-white text-slate-650 border-slate-200/80 hover:border-slate-900'
                            }`}
                          >
                            {displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Match results list header */}
                  <div className="flex items-center justify-between mb-3 px-1 select-none">
                    <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider">
                      {lang === 'hi' ? 'खोज के परिणाम' : 'Search Matches'}
                    </span>
                    <span className="text-xs text-slate-700 font-sketch font-bold">
                      {filteredPdfs.length} {lang === 'hi' ? 'दस्तावेज' : 'documents'}
                    </span>
                  </div>

                  {filteredPdfs.length === 0 ? (
                    <div className="text-center py-10 px-5 bg-white border-2 border-slate-900 rounded-xl shadow-[3px_3px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                      <FolderOpen className="h-9 w-9 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-bold">
                        {lang === 'hi' ? 'कोई मिलान फ़ाइल नहीं मिली।' : 'No matches found.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredPdfs.map((pdf) => (
                        <PdfCard 
                          key={pdf.id}
                          pdf={pdf}
                          onNavigateToDocs={(id) => hashNavigateTo('details', id)}
                          lang={lang}
                          isBookmarked={bookmarkedIds.includes(pdf.id)}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. BOOKMARKS TAB */}
              {activeMobileTab === 'bookmarks' && (
                <div className="animate-fade-in">
                  <div className="mb-5 mt-2 select-none">
                    <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider">
                      {lang === 'hi' ? 'पसंदीदा अध्ययन पुस्तकालय' : 'PERSONAL OFFLINE-SAVED'}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-sketch font-black tracking-tight text-slate-900 leading-tight">
                      {lang === 'hi' ? 'स्टार बुकमार्क्स ⭐' : 'Saved Bookmarks ⭐'}
                    </h1>
                  </div>

                  {bookmarkedIds.length === 0 ? (
                    <div className="text-center py-14 px-6 bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px] mt-2">
                      <Star className="h-12 w-12 text-amber-400 fill-amber-100 mx-auto mb-3 stroke-[2.2]" />
                      <h3 className="text-base font-sketch font-extrabold text-slate-900 mb-1.5">
                        {lang === 'hi' ? 'कोई पसंदीदा संचिका नहीं' : 'No Bookmarks Yet'}
                      </h3>
                      <p className="text-xs text-slate-600 font-bold leading-relaxed max-w-xs mx-auto mb-4 font-sans">
                        {lang === 'hi' 
                          ? 'अध्ययन विवरणों को सुरक्षित रखने और सीधे प्राप्त करने के लिए फाइलों पर दिए गए पीले सितारे (⭐) पर क्लिक करें।' 
                          : 'Tap the floating star icon on any PDF course card to save details directly into your local library.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 mt-2">
                      {pdfs.filter(p => bookmarkedIds.includes(p.id)).map((pdf) => (
                        <PdfCard 
                          key={pdf.id}
                          pdf={pdf}
                          onNavigateToDocs={(id) => hashNavigateTo('details', id)}
                          lang={lang}
                          isBookmarked={true}
                          onToggleBookmark={handleToggleBookmark}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. PROFILE TAB */}
              {activeMobileTab === 'profile' && (
                <div className="animate-fade-in">
                  <div className="mb-5 mt-2 select-none">
                    <span className="text-[10px] uppercase font-sketch font-bold text-slate-500 tracking-wider">
                      {lang === 'hi' ? 'विद्यार्थी खाता नियंत्रण' : 'VERIFIED SECURITY SYSTEM'}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-sketch font-black tracking-tight text-slate-900 leading-tight">
                      {lang === 'hi' ? 'मेरा पोर्टल प्रोफ़ाइल 👤' : 'Candidate Profile 👤'}
                    </h1>
                  </div>

                  {authLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <RefreshCw className="h-7 w-7 text-indigo-600 animate-spin mb-3 stroke-[2.5]" />
                      <span className="text-xs font-semibold text-slate-600">Verifying session details...</span>
                    </div>
                  ) : user ? (
                    <div className="space-y-5">
                      <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-[4px_4px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
                        <div className="flex items-center space-x-4 mb-4 select-none">
                          {user.photoURL ? (
                            <img 
                              src={user.photoURL} 
                              alt="Profile" 
                              referrerPolicy="no-referrer"
                              className="h-14 w-14 rounded-full border-2 border-slate-900 object-cover shadow-[2px_2px_0px_#000]"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full border-2 border-slate-900 bg-[#FFE600] flex items-center justify-center font-sketch font-black text-slate-950 text-xl shadow-[2px_2px_0px_#000]">
                              {user.email ? user.email[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold uppercase border-dashed border border-emerald-400">
                              Active Secure Token verified
                            </span>
                            <span className="block text-sm sm:text-base font-bold text-slate-900 truncate">
                              {user.email}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="mt-3 p-3 bg-indigo-50 border-2 border-indigo-900 rounded-xl text-indigo-900 font-sketch font-bold text-xs shadow-[1.5px_1.5px_0px_#000] flex items-center space-x-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span>Aspirant Admin upload verification verified!</span>
                          </div>
                        )}

                        <button
                          onClick={handleSignOut}
                          className="mt-4 flex items-center justify-center space-x-2 w-full bg-rose-50 border-2 border-rose-950 text-rose-800 font-sketch font-extrabold py-3 px-4 rounded-xl text-xs active:translate-y-0.5 shadow-[2.5px_2.5px_0px_#991b1b]"
                        >
                          <LogOut className="h-4.5 w-4.5 text-rose-700 stroke-[2.5]" />
                          <span>Logout from Academy Portal</span>
                        </button>
                      </div>

                      {/* If administrator verified - enable AdminPanel tools directly in profile tab! */}
                      {isAdmin ? (
                        <div className="animate-fade-in pt-1">
                          <AdminPanel userEmail={user.email || 'reviewer-admin@aistudio.com'} lang={lang} permissions={adminPermissions} />
                        </div>
                      ) : (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-400 p-4.5 rounded-2xl text-center select-none">
                          <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                            {lang === 'hi' 
                              ? 'आप वर्तमान में एक उम्मीदवार के रूप में देखे जा रहे हैं। फ़ाइल इंडेक्स प्रबंधन विशेषाधिकार केवल अकादमी के अधिकृत परीक्षकों तक ही सीमित हैं।'
                              : 'You are currently authenticated as an aspirant observer. Administrative catalog tools are locked for security inspection.'}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px] text-center">
                      <UserCheck className="h-10 w-10 text-indigo-600 stroke-[2.5] mx-auto mb-3" />
                      <h3 className="text-sm sm:text-base font-sketch font-extrabold text-slate-900 uppercase tracking-tight mb-2">
                        {lang === 'hi' ? 'अकादमी लॉगिन' : 'Secure Login'}
                      </h3>
                      <p className="text-xs text-slate-600 font-bold leading-relaxed mb-5 max-w-sm mx-auto">
                        {lang === 'hi' 
                          ? 'अकादमी के अधिकृत ईमेल द्वारा लॉगिन करें।' 
                          : 'Authenticate securely access personal study metrics, and sync favorite bookmark checklists.'}
                      </p>

                      <div className="space-y-3.5">
                        <button
                          onClick={handleSignIn}
                          className="w-full flex items-center justify-center space-x-2 bg-[#FFE600] active:translate-y-0.5 text-slate-950 border-2 border-slate-900 rounded-xl font-sketch font-extrabold py-3.5 px-4 text-xs tracking-wide transition cursor-pointer shadow-[3px_3px_0px_#000] hover:bg-[#FFF275]"
                        >
                          <LogIn className="h-4.5 w-4.5 stroke-[2.5]" />
                          <span>Google Sign In</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentRoute === 'details' && selectedPdfId && (
            <div className="animate-fade-in">
              <PdfDetails 
                pdfId={selectedPdfId}
                onBack={() => hashNavigateTo('home')}
                lang={lang}
                user={user}
                onSignIn={handleSignIn}
              />
            </div>
          )}

          {currentRoute === 'admin' && (
            <div className="animate-fade-in pt-1">
              {authLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <RefreshCw className="h-6 w-6 text-slate-800 animate-spin mb-3 stroke-[2.5]" />
                  <span className="text-xs text-slate-600 font-sketch font-bold">Verifying security parameters...</span>
                </div>
              ) : isAdmin ? (
                <AdminPanel userEmail={user?.email || 'authenticated-tester'} lang={lang} permissions={adminPermissions} />
              ) : (
                <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 shadow-[4px_4px_0px_#000] text-center bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px] max-w-sm mx-auto animate-fade-in">
                  <AlertCircle className="h-10 w-10 text-[#FFE600] stroke-[2.5] fill-slate-950 mx-auto mb-3" />
                  <h3 className="text-sm font-sketch font-bold text-slate-900 uppercase tracking-tight mb-1.5">
                    {t.authRequired}
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-5 font-sans font-semibold max-w-xs mx-auto">
                    {t.authSub}
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={handleSignIn}
                      className="w-full flex items-center justify-center space-x-2 bg-white active:translate-y-0.5 text-slate-900 border-2 border-slate-900 rounded-xl font-sketch font-bold py-3.5 px-4 text-xs tracking-wide transition cursor-pointer shadow-[2.5px_2.5px_0px_#000] hover:bg-slate-50"
                    >
                      <img 
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                        alt="Google Logo" 
                        className="h-4.5 w-4.5"
                      />
                      <span>{lang === 'hi' ? 'गूगल से लॉगिन करें' : 'Sign In with Google'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentRoute === 'disclaimer' && (
            <div className="animate-fade-in animate-once">
              <Disclaimer onBack={() => hashNavigateTo('home')} lang={lang} />
            </div>
          )}

        </div>

        {/* STRETCHED & STICKY FIXED BOTTOM NAVIGATION FOR MOBILE */}
        <div className="fixed bottom-0 left-0 right-0 w-full bg-white border-t-2 border-slate-900 h-16 flex items-center justify-around px-2 z-50 shrink-0 select-none shadow-[0_-3px_10px_rgba(0,0,0,0.06)]">
          
          <button 
            onClick={() => {
              setCurrentRoute('home');
              setActiveMobileTab('home');
              setSelectedPdfId(null);
              hashNavigateTo('home');
            }}
            className="flex flex-col items-center justify-center transition cursor-pointer flex-1"
          >
            <Home className={`h-5.5 w-5.5 stroke-[2.5] ${currentRoute === 'home' && activeMobileTab === 'home' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-sketch font-bold mt-1 ${currentRoute === 'home' && activeMobileTab === 'home' ? 'text-amber-700 font-extrabold' : 'text-slate-500'}`}>
              {lang === 'hi' ? 'होम' : 'Home'}
            </span>
          </button>

          <button 
            onClick={() => {
              setCurrentRoute('home');
              setActiveMobileTab('search');
              setSelectedPdfId(null);
              hashNavigateTo('home');
              setTimeout(() => {
                const searchEl = document.getElementById('mobileSearchInput');
                if (searchEl) searchEl.focus();
              }, 100);
            }}
            className="flex flex-col items-center justify-center transition cursor-pointer flex-1"
          >
            <Search className={`h-5.5 w-5.5 stroke-[2.5] ${currentRoute === 'home' && activeMobileTab === 'search' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-sketch font-bold mt-1 ${currentRoute === 'home' && activeMobileTab === 'search' ? 'text-amber-700 font-extrabold' : 'text-slate-500'}`}>
              {lang === 'hi' ? 'खोजें' : 'Search'}
            </span>
          </button>

          <button 
            onClick={() => {
              setCurrentRoute('home');
              setActiveMobileTab('bookmarks');
              setSelectedPdfId(null);
              hashNavigateTo('home');
            }}
            className="flex flex-col items-center justify-center transition cursor-pointer flex-1"
          >
            <Star className={`h-5.5 w-5.5 stroke-[2.5] ${currentRoute === 'home' && activeMobileTab === 'bookmarks' ? 'text-amber-600 fill-amber-100' : 'text-slate-400'}`} />
            <span className={`text-[9px] font-sketch font-bold mt-1 ${currentRoute === 'home' && activeMobileTab === 'bookmarks' ? 'text-amber-700 font-extrabold' : 'text-slate-500'}`}>
              {lang === 'hi' ? 'बुकमार्क' : 'Bookmark'}
            </span>
          </button>

          <button 
            onClick={() => {
              setCurrentRoute('home');
              setActiveMobileTab('profile');
              setSelectedPdfId(null);
              hashNavigateTo('home');
            }}
            className="flex flex-col items-center justify-center transition cursor-pointer flex-1 animate-fade-in"
          >
            {user && user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                referrerPolicy="no-referrer"
                className={`h-6 w-6 rounded-full border-2 object-cover shrink-0 ${currentRoute === 'home' && activeMobileTab === 'profile' ? 'border-amber-600' : 'border-slate-300'}`}
              />
            ) : (
              <UserCheck className={`h-5.5 w-5.5 stroke-[2.5] ${currentRoute === 'home' && activeMobileTab === 'profile' ? 'text-amber-600' : 'text-slate-400'}`} />
            )}
            <span className={`text-[9px] font-sketch font-bold mt-1 ${currentRoute === 'home' && activeMobileTab === 'profile' ? 'text-amber-700 font-extrabold' : 'text-slate-500'}`}>
              {lang === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}
            </span>
          </button>

        </div>

      </div>

      {/* GOOGLE AUTHENTICATION TROUBLESHOOTING MODAL */}
      {showTroubleshoot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-[8px_8px_0px_#000] relative animate-fade-in select-none">
            {/* Close button */}
            <button 
              onClick={() => setShowTroubleshoot(false)}
              className="absolute top-4 right-4 bg-rose-100 hover:bg-rose-200 border-2 border-slate-900 rounded-xl p-1 px-2.5 text-xs font-sketch font-bold text-slate-850 transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
            >
              ✕ {lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>

            <div className="flex items-center space-x-3 mb-4 border-b-2 border-dashed border-slate-200 pb-3">
              <div className="bg-[#FFE600] p-2.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#000] shrink-0 text-slate-950">
                <HelpCircle className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-sketch font-extrabold text-slate-900 leading-tight">
                  {lang === 'hi' ? 'गूगल लॉगिन गाइड 🛠️' : 'Google Login Setup Guide 🛠️'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">oalearn.com Authorized Domain</span>
              </div>
            </div>

            {authError && (
              <div className="bg-rose-50 border-2 border-rose-400 p-3 rounded-xl mb-4 text-left">
                <span className="text-[10px] font-mono uppercase font-bold text-rose-500 block mb-0.5">Detected Firebase Error:</span>
                <p className="text-xs font-mono font-bold text-rose-800 break-words leading-tight">
                  {authError}
                </p>
              </div>
            )}

            <div className="space-y-4 text-left max-h-[320px] overflow-y-auto pr-1 font-sans">
              <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                {lang === 'hi' 
                  ? "यदि oalearn.com पर गूगल लॉगिन काम नहीं कर रहा है, तो इसका मुख्य कारण है कि फ़ायरबेस सिक्योर फ़ायरवॉल को अभी आपके डोमेन की अनुमति नहीं मिली है। इसे ठीक करने के लिए निम्नलिखित चरणों का पालन करें:"
                  : "If Google Sign-In is failing on your custom domain, it fits the classic issue of domain restriction on Firebase. Please complete these quick steps inside your Firebase Console:"}
              </p>

              <div className="border bg-amber-50/50 border-slate-350 rounded-xl p-3.5 space-y-3 text-xs">
                <div>
                  <h4 className="font-sketch font-black text-slate-900 uppercase tracking-tight text-xs mb-1">
                    {lang === 'hi' ? '1. फ़ायरबेस कंसोल खोलें' : '1. Open Firebase Console'}
                  </h4>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                    {lang === 'hi'
                      ? "Firebase Console (console.firebase.google.com) में अपने अकादमी प्रोजेक्ट को खोलें।"
                      : "Navigate to your Firebase Project Dashboard at console.firebase.google.com."}
                  </p>
                </div>

                <div>
                  <h4 className="font-sketch font-black text-slate-900 uppercase tracking-tight text-xs mb-1">
                    {lang === 'hi' ? '2. ऑथेंटिकेशन सेटिंग्स में जाएं' : '2. Navigate to Auth Settings'}
                  </h4>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                    {lang === 'hi'
                      ? "Authentication -> Settings टैब पर क्लिक करें।"
                      : "Go to Authentication on left sidebar, then click on the 'Settings' tab."}
                  </p>
                </div>

                <div>
                  <h4 className="font-sketch font-black text-slate-900 uppercase tracking-tight text-xs mb-1">
                    {lang === 'hi' ? '3. अधिकृत डोमेन (Authorized domains) जोड़ें' : '3. Add Authorized Domains'}
                  </h4>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                    {lang === 'hi'
                      ? "Authorized domains सेक्शन पर जाएं, 'Add domain' पर क्लिक करके 'oalearn.com' और 'www.oalearn.com' जोड़ें।"
                      : "Scroll to the 'Authorized domains' section, click 'Add domain', and save 'oalearn.com' (and optionally 'www.oalearn.com')."}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <span className="bg-white border border-slate-300 font-mono text-[9px] px-2 py-0.5 rounded-md text-slate-700 font-bold">oalearn.com</span>
                    <span className="bg-white border border-slate-300 font-mono text-[9px] px-2 py-0.5 rounded-md text-slate-700 font-bold">www.oalearn.com</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t-2 border-dashed border-slate-200 pt-4 flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText('oalearn.com');
                  alert('Domain oalearn.com copied to clipboard!');
                }}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border-2 border-slate-900 text-slate-800 font-sketch font-bold py-2.5 px-3 rounded-xl text-xs transition shadow-[3px_3px_0px_#000] active:translate-y-0.5 cursor-pointer text-center"
              >
                📋 {lang === 'hi' ? 'डोमेन कॉपी करें' : 'Copy Domain'}
              </button>
              <button
                onClick={() => setShowTroubleshoot(false)}
                className="flex-1 bg-[#FFE600] hover:bg-[#FFF275] border-2 border-slate-900 text-slate-900 font-sketch font-extrabold py-2.5 px-3 rounded-xl text-xs transition shadow-[3px_3px_0px_#000] active:translate-y-0.5 cursor-pointer text-center"
              >
                {lang === 'hi' ? 'ठीक है, समझ गया' : 'Got it! Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
