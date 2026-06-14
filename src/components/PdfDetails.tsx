import React, { useState, useEffect } from 'react';
import { 
  FileText, ArrowLeft, Eye, Download, ShieldCheck, 
  ExternalLink, Calendar, HardDrive, BookOpen, User,
  Share2, CheckCircle, AlertTriangle, RefreshCw, Sparkles
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PdfDocument } from '../types';
import { translations, Language } from '../lib/translations';
import { INITIAL_FALLBACK_PDFS } from '../lib/mockData';

interface PdfDetailsProps {
  pdfId: string;
  onBack: () => void;
  lang: Language;
  user?: any;
  onSignIn?: () => void;
}

export default function PdfDetails({ pdfId, onBack, lang, user, onSignIn }: PdfDetailsProps) {
  const t = translations[lang];

  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFallbackCoverUrl = (categoryStr: string) => {
    const cat = categoryStr?.toLowerCase() || '';
    if (cat.includes('note') || cat.includes('notes')) {
      return 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=600';
    }
    if (cat.includes('paper') || cat.includes('previous')) {
      return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600';
    }
    if (cat.includes('syllabus') || cat.includes('curriculum')) {
      return 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600';
    }
    if (cat.includes('exam') || cat.includes('test') || cat.includes('series')) {
      return 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=600';
    }
    if (cat.includes('book') || cat.includes('competition')) {
      return 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';
    }
    return 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&q=80&w=600';
  };

  // Redirection & Progress Simulation
  const [redirectType, setRedirectType] = useState<'view' | 'download' | null>(null);
  const [progress, setProgress] = useState(0);
  const [timerCountdown, setTimerCountdown] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [showPremiumLoginModal, setShowPremiumLoginModal] = useState(false);

  // 30 seconds timer for secure redirection
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (redirectType !== null) {
      setTimerCountdown(30);
      setProgress(0);
      interval = setInterval(() => {
        setTimerCountdown((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setProgress(100);
            return 0;
          }
          const nextVal = prev - 1;
          setProgress(Math.round(((30 - nextVal) / 30) * 100));
          return nextVal;
        });
      }, 1000);
    } else {
      setTimerCountdown(30);
      setProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [redirectType]);

  useEffect(() => {
    async function fetchPdfDetails() {
      setLoading(true);
      setError(null);
      
      const tryFallbackDetails = (errToLog?: any) => {
        if (errToLog) {
          try {
            handleFirestoreError(errToLog, OperationType.GET, `pdfs/${pdfId}`);
          } catch (logError) {
            console.error("Firestore Error Details: ", (logError as Error).message);
          }
        }
        
        const cached = localStorage.getItem('officers_academy_fallback_pdfs');
        let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
        if (!Array.isArray(currentList)) currentList = [];
        if (currentList.length === 0) currentList = INITIAL_FALLBACK_PDFS;
        
        const found = currentList.find(p => p.id === pdfId);
        if (found) {
          const sessionKey = `viewed_pdf_${pdfId}`;
          const alreadyViewed = sessionStorage.getItem(sessionKey);
          let updated = { ...found };
          
          if (!alreadyViewed) {
            sessionStorage.setItem(sessionKey, 'true');
            updated = {
              ...found,
              clickCount: (found.clickCount || 0) + 1
            };
            const index = currentList.findIndex(p => p.id === pdfId);
            if (index !== -1) {
              currentList[index] = updated;
            }
            localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));
          }
          
          setPdf(updated);
        } else {
          setError(lang === 'en' 
            ? "Study guide not found. Verify that the URL slug is correct." 
            : "दस्तावेज़ नहीं मिला। कृपया जांचें कि यूआरएल का स्लग सही है या नहीं।"
          );
        }
      };

      try {
        const docRef = doc(db, 'pdfs', pdfId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const basePdf = {
            id: docSnap.id,
            ...data
          } as PdfDocument;
          setPdf(basePdf);

          // Increment view count initially upon landing on the intermediate URL page, avoiding session double counter
          const sessionKey = `viewed_pdf_${pdfId}`;
          const alreadyViewed = sessionStorage.getItem(sessionKey);

          if (!alreadyViewed) {
            try {
              sessionStorage.setItem(sessionKey, 'true');
              await updateDoc(docRef, {
                clickCount: increment(1)
              });
              // Update local state to reflect newly refreshed click count
              setPdf(prev => prev ? { ...prev, clickCount: (prev.clickCount || 0) + 1 } : null);
            } catch (e) {
              console.warn("View tracking failed due to rules or connectivity: ", e);
              sessionStorage.removeItem(sessionKey);
              tryFallbackDetails();
            }
          }
        } else {
          tryFallbackDetails();
        }
      } catch (err) {
        console.error("Failed to fetch pdf details: ", err);
        tryFallbackDetails(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPdfDetails();
  }, [pdfId, lang]);

  // SEO Schema & Custom Title management for Google Crawl Indexing
  useEffect(() => {
    if (!pdf) return;
    
    // Inject schema.org JSON-LD structured metadata
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      "name": pdf.title,
      "description": pdf.description || `Study Guide: ${pdf.title}. Read view and download PDF safely via Google Drive. Part of the Officers Academy online study resource archive.`,
      "educationalLevel": "Officers Examination Preparation",
      "learningResourceType": "Study Notes and Test Papers",
      "inLanguage": ["hi", "en"],
      "publisher": {
        "@type": "Organization",
        "name": "Officers Academy",
        "logo": {
          "@type": "ImageObject",
          "url": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200"
        }
      },
      "offers": {
        "@type": "Offer",
        "price": "0.00",
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock"
      },
      "educationalAlignment": {
        "@type": "AlignmentObject",
        "alignmentType": "educationalSubject",
        "targetName": pdf.category || "Competition Exam"
      },
      "interactionStatistic": [
        {
          "@type": "InteractionCounter",
          "interactionType": "https://schema.org/WatchAction",
          "userInteractionCount": pdf.clickCount || 0
        },
        {
          "@type": "InteractionCounter",
          "interactionType": "https://schema.org/DownloadAction",
          "userInteractionCount": pdf.downloadCount || 0
        }
      ]
    };

    // Clean up existing schema tags
    const existingScript = document.getElementById('seo-jsonld-schema');
    if (existingScript) {
      existingScript.remove();
    }

    // Insert new script
    const script = document.createElement('script');
    script.id = 'seo-jsonld-schema';
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify(schemaData);
    document.head.appendChild(script);

    // Dynamic high-impact Title tags for SEO
    const previousTitle = document.title;
    document.title = `${pdf.title} Free PDF Download - Officers Academy`;

    return () => {
      const addedScript = document.getElementById('seo-jsonld-schema');
      if (addedScript) {
        addedScript.remove();
      }
      document.title = previousTitle;
    };
  }, [pdf]);

  // Handle Redirection Timer and Counts
  const triggerRedirect = async (type: 'view' | 'download') => {
    if (!pdf) return;
    if (pdf.membersOnly && !user) {
      setShowPremiumLoginModal(true);
      return;
    }
    setRedirectType(type);
    setProgress(0);

    // Sync state locally
    const cached = localStorage.getItem('officers_academy_fallback_pdfs');
    let currentList: PdfDocument[] = cached ? JSON.parse(cached) : [];
    if (!Array.isArray(currentList)) currentList = [];
    const index = currentList.findIndex(p => p.id === pdf.id);

    // Save increment in Firestore database first
    try {
      const docRef = doc(db, 'pdfs', pdf.id);
      if (type === 'download') {
        await updateDoc(docRef, {
          downloadCount: increment(1)
        });
        setPdf(prev => prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : null);
      } else {
        await updateDoc(docRef, {
          clickCount: increment(1)
        });
        setPdf(prev => prev ? { ...prev, clickCount: (prev.clickCount || 0) + 1 } : null);
      }

      // Sync local storage as well on success
      if (index !== -1) {
        currentList[index] = {
          ...currentList[index],
          clickCount: type === 'view' ? (currentList[index].clickCount || 0) + 1 : (currentList[index].clickCount || 0),
          downloadCount: type === 'download' ? (currentList[index].downloadCount || 0) + 1 : (currentList[index].downloadCount || 0)
        };
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));
      }
    } catch (e) {
      console.warn("Tracking update missed, falling back to local state: ", e);
      
      // Call/handle handleFirestoreError to log the diagnostic statement
      try {
        handleFirestoreError(e, OperationType.UPDATE, `pdfs/${pdf.id}`);
      } catch (logError) {
        console.error("Firestore Error Details: ", (logError as Error).message);
      }

      // Perform local storage increment fallback
      if (index !== -1) {
        const updated = {
          ...currentList[index],
          clickCount: type === 'view' ? (currentList[index].clickCount || 0) + 1 : (currentList[index].clickCount || 0),
          downloadCount: type === 'download' ? (currentList[index].downloadCount || 0) + 1 : (currentList[index].downloadCount || 0)
        };
        currentList[index] = updated;
        localStorage.setItem('officers_academy_fallback_pdfs', JSON.stringify(currentList));
        setPdf(updated);
      } else {
        setPdf(prev => {
          if (!prev) return null;
          return {
            ...prev,
            clickCount: type === 'view' ? (prev.clickCount || 0) + 1 : (prev.clickCount || 0),
            downloadCount: type === 'download' ? (prev.downloadCount || 0) + 1 : (prev.downloadCount || 0)
          };
        });
      }
    }

    // Set redirection state to trigger our modern 30s ad landing view
    setRedirectType(type);
    setProgress(0);
    setTimerCountdown(30);
  };

  const handleFinalRedirect = () => {
    if (!pdf || !redirectType) return;
    const targetUrl = redirectType === 'view' ? pdf.thirdPartyViewUrl : pdf.thirdPartyDownloadUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setRedirectType(null); // Reset/close redirect flow
  };

  const handleModalSignIn = async () => {
    setShowPremiumLoginModal(false);
    if (onSignIn) {
      await onSignIn();
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/pdf/${pdfId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReportPdf = () => {
    if (!pdf) return;
    const pageUrl = `${window.location.origin}/pdf/${pdf.id}`;
    const subject = encodeURIComponent(`[Officers Academy REPORT] - Issue with ${pdf.title}`);
    const emailBody = encodeURIComponent(
      `Hello Officers Academy Team,\n\n` +
      `I want to report an issue/concern regarding the following study material on your portal:\n\n` +
      `---------------------------------------\n` +
      `📄 PDF Book Name: ${pdf.title}\n` +
      `📦 PDF ID Reference: ${pdf.id}\n` +
      `🔗 Shared Portal Page Link: ${pageUrl}\n` +
      `☁️ Google Drive Direct Link: ${pdf.thirdPartyViewUrl}\n` +
      `---------------------------------------\n\n` +
      `Please investigate this PDF file as soon as possible.\n\n` +
      `Thank you.`
    );
    window.location.href = `mailto:copyright@oalearn.com?subject=${subject}&body=${emailBody}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px]">
        <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin mb-3" />
        <p className="text-slate-400 text-xs font-semibold">Securing connection...</p>
      </div>
    );
  }

  if (error || !pdf) {
    return (
      <div className="max-w-md mx-auto mt-6 bg-white border border-slate-100 rounded-3xl p-6 text-center text-slate-800 shadow-sm">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold mb-2">{lang === 'hi' ? 'दस्तावेज़ नहीं मिला' : 'PDF Study Guide Not Found'}</h3>
        <p className="text-slate-500 text-xs mb-4 leading-relaxed">{error}</p>
        <button 
          onClick={onBack}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold px-4 py-2 transition"
        >
          {t.backToCatalog}
        </button>
      </div>
    );
  }

  if (redirectType) {
    const targetUrl = redirectType === 'view' ? pdf.thirdPartyViewUrl : pdf.thirdPartyDownloadUrl;
    return (
      <div className="max-w-3xl mx-auto px-3 xs:px-4 py-4 sm:py-6 text-slate-800 antialiased font-sans">
        <div className="flex items-center justify-between mb-5 select-none">
          <button 
            onClick={() => setRedirectType(null)}
            className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-xl text-xs text-slate-800 hover:bg-slate-50 transition font-sketch font-bold shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
            <span>Cancel</span>
          </button>
          
          <span className="text-[10px] sm:text-xs uppercase font-mono bg-emerald-50 border-2 border-emerald-950 text-emerald-800 px-2.5 py-1 rounded-lg font-bold">
            🔒 SECURE CLIENT NODE
          </span>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-8 shadow-[6px_6px_0px_#0f172a] relative overflow-hidden bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:16px_16px]">
          
          {/* Top aesthetic label */}
          <div className="text-center mb-6 select-none border-b-2 border-slate-900 border-dashed pb-5">
            <div className="inline-flex items-center space-x-1.5 bg-[#FFE600] text-slate-950 font-sketch font-bold text-[10px] sm:text-xs px-3.5 py-1.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_#000] mb-3 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 fill-[#FFE600] animate-spin text-slate-950" />
              <span>Link Security Clearance Active</span>
            </div>

            <h2 className="text-lg xs:text-xl sm:text-2xl font-sans font-bold text-slate-900 tracking-tight leading-snug uppercase underline decoration-2 decoration-amber-400">
              {pdf.title}
            </h2>
            <p className="text-xs text-slate-600 mt-2 font-semibold font-sans">
              {lang === 'hi' 
                ? 'अकाडमी द्वारा सुरक्षित फ़ाइल हैंडशेक प्रक्रिया प्रारंभ की जा रही है।' 
                : 'Initiating safe cloud storage handshake protocol vetted by Academy officials.'}
            </p>
          </div>

          {/* TIMER ZONE */}
          <div className="flex flex-col items-center justify-center p-5 sm:p-8 bg-[#FCFAF2] border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#000] mb-8 relative select-none">
            {timerCountdown > 0 ? (
              <>
                {/* Visual Circular Countdown representation */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex items-center justify-center mb-4">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle 
                      cx="40" 
                      cy="40" 
                      r="34" 
                      className="stroke-slate-200 fill-none"
                      strokeWidth="6"
                      style={{ transform: 'translate(4px, 4px)' } as any}
                    />
                    <circle 
                      cx="40" 
                      cy="40" 
                      r="34" 
                      className="stroke-[#FFE600] fill-none transition-all duration-1000"
                      strokeWidth="6"
                      strokeDasharray="213.52"
                      strokeDashoffset={213.52 - (213.52 * progress) / 100}
                      style={{ transform: 'translate(4px, 4px)' } as any}
                    />
                  </svg>
                  <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900">{timerCountdown}s</span>
                </div>

                <div className="text-center">
                  <h4 className="text-sm font-sketch font-bold text-slate-900 mb-1">
                    {lang === 'hi' ? 'कृपया ३० सेकंड प्रतीक्षा करें...' : 'Validating Cloud Link Nodes...'}
                  </h4>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-bold max-w-xs leading-relaxed font-sans">
                    {lang === 'hi'
                      ? `आपका लिंक सुरक्षित किया जा रहा है। कृपया इस पृष्ठ को बंद न करें (शेष ${timerCountdown} सेकंड)।`
                      : `Preparing your file clearance. Do not close or refresh this browser window (Remaining: ${timerCountdown}s).`}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-2 animate-fade-in w-full">
                <div className="bg-[#A3E635] text-slate-950 p-4 rounded-full border-2 border-slate-900 mx-auto w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-4 shadow-[2px_2px_0px_#000] animate-bounce">
                  <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 stroke-[3]" />
                </div>
                <h4 className="text-base font-sketch font-black text-slate-900 mb-1">
                  {lang === 'hi' ? 'दस्तावेज़ का लिंक सुरक्षित है!' : 'File Link Cleared for Access!'}
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mb-4 font-bold font-sans mx-auto">
                  {lang === 'hi' 
                    ? 'अकाडमी सुरक्षा प्रमाणीकरण सफल रहा। नीचे दिए बटन पर क्लिक करके फ़ाइल खोलें।' 
                    : 'Download sequence completed successfully. Click the secure gateway button below.'}
                </p>

                <button
                  onClick={handleFinalRedirect}
                  className="bg-[#FFE600] hover:bg-[#FFF275] text-slate-950 font-sketch font-extrabold py-3.5 px-6 sm:px-8 rounded-xl border-2 border-slate-900 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer text-sm uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5 mx-auto animate-pulse"
                >
                  <ExternalLink className="h-5 w-5 stroke-[2.5]" />
                  <span>{lang === 'hi' ? 'अभी फाइल खोलें 🚀' : 'Get Clear Link Now 🚀'}</span>
                </button>
              </div>
            )}

            {/* Countdown Slider Progress Bar */}
            {timerCountdown > 0 && (
              <div className="w-full max-w-sm mt-5">
                <div className="w-full bg-white h-2.5 rounded-lg overflow-hidden border-2 border-slate-900 shadow-sm">
                  <div 
                    className="bg-[#A3E635] h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono font-bold mt-1.5 px-1 text-slate-500">
                  <span>CLEARANCE ID: #OAP-{(pdf.id).substring(0, 5).toUpperCase()}</span>
                  <span className="text-emerald-700">{progress}% SECURED</span>
                </div>
              </div>
            )}
          </div>

          {/* Warning/Info notice */}
          <div className="mt-8 text-center select-none bg-[#FCFAF2] rounded-2xl p-5 border-2 border-slate-900 shadow-[3px_3px_0px_#000]">
            <span className="text-xs font-sans font-bold text-slate-800 block">
              🛡️ {lang === 'hi' ? 'सुरक्षित लिंक क्लीयरेंस प्रगति पर है... आपका अनुरोधित दस्तावेज सत्यापित और वायरस मुक्त है।' : 'Secure link clearance in progress... Your requested academic file is verified secure & virus free.'}
            </span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-0 sm:px-4 py-0 sm:py-4 text-slate-800 antialiased font-sans">
      {/* Sticky-like elegant top back button */}
      <div className="flex items-center justify-between mb-2 sm:mb-6 select-none p-4 sm:p-0">
        <button 
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-xl text-xs text-slate-800 hover:bg-slate-50 transition font-sketch font-bold shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
          <span>{t.backToCatalog}</span>
        </button>
        
        <span className="hidden sm:inline-block text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-1 rounded-lg">
          ID: {pdf.id}
        </span>
      </div>

      {/* Main Container - Stretches perfectly on mobile without padding layout boxes */}
      <div className="bg-white border-0 sm:border-2 border-slate-900 sm:rounded-2xl p-4 sm:p-8 shadow-none sm:shadow-[6px_6px_0px_#0f172a] relative overflow-hidden">

        {/* Premium Washi Tape decoration ornament across top-center */}
        <div className="hidden sm:flex absolute -top-1 left-1/2 -translate-x-1/2 w-28 h-5 bg-amber-100/90 border-x border-slate-500 border-dashed rotate-[-1.5deg] z-10 pointer-events-none shadow-sm items-center justify-center text-[9px] font-hand text-slate-600 tracking-wider">
          ACADEMY ATTESTED
        </div>

        {/* Book Banner Cover Image - Bleeds edge to edge if mobile */}
        <div className="relative w-[calc(100%+2rem)] sm:w-auto h-36 xs:h-40 sm:h-56 mb-5 -mx-4 sm:mx-0 rounded-none sm:rounded-2xl overflow-hidden border-b-2 sm:border-2 border-slate-900 shadow-none sm:shadow-[3px_3px_0px_#000] z-0 select-none">
          <img 
            src={pdf.coverUrl || getFallbackCoverUrl(pdf.category)} 
            alt={pdf.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
        </div>

        {/* Header section with notebook banner layout (No Icons, Normal Font with Underline) */}
        <div className="border-b-2 border-slate-900 pb-5 mb-5 mt-2">
          <div className="min-w-0">
            <span className="inline-block px-3 py-1 text-[10px] sm:text-[11px] font-sketch font-bold bg-[#FCFAF2] text-slate-800 border-2 border-slate-950 rounded-lg uppercase tracking-wider mb-3">
              {pdf.category || 'General'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-sans font-bold text-slate-900 tracking-tight leading-snug uppercase underline decoration-3 decoration-amber-400 underline-offset-4">
              {pdf.title}
            </h2>
            
            {/* Real-time views and published date (REPLACES AUTHOR METADATA) */}
            <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs font-bold mt-4 text-slate-600 select-none">
              <div className="flex items-center space-x-1.5">
                <Eye className="h-4.5 w-4.5 text-amber-600 stroke-[2.2]" />
                <span>{lang === 'hi' ? 'कुल पाठक (Views)' : 'Views'}: {pdf.clickCount || 0}</span>
              </div>
              <div className="text-slate-300 font-normal hidden sm:inline-block">|</div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="h-4.5 w-4.5 text-indigo-500 stroke-[2.2]" />
                <span>{lang === 'hi' ? 'प्रकाशन तिथि' : 'Published On'}: {formatDate(pdf.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Specs rendered like Sticky Notes on whiteboard */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-6 select-none font-sketch text-center">
          <div className="bg-amber-50/70 p-2 sm:p-3.5 rounded-xl flex flex-col justify-center text-center border-2 border-slate-900 shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000]">
            <span className="block text-[8px] sm:text-[9.5px] uppercase text-slate-500 font-bold tracking-wider mb-1">{t.fileSize}</span>
            <span className="text-[11px] sm:text-sm font-bold text-slate-900 font-mono">{pdf.fileSize}</span>
          </div>

          <div className="bg-[#A3E635]/15 p-2 sm:p-3.5 rounded-xl flex flex-col justify-center text-center border-2 border-slate-900 shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000]">
            <span className="block text-[8px] sm:text-[9.5px] uppercase text-slate-600 font-bold tracking-wider mb-1">{t.pages}</span>
            <span className="text-[11px] sm:text-sm font-semibold text-slate-900 font-mono leading-none">{pdf.pageCount} pg</span>
          </div>

          <div className="bg-sky-50/60 p-2 sm:p-3.5 rounded-xl flex flex-col justify-center text-center border-2 border-slate-900 shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000]">
            <span className="block text-[8px] sm:text-[9.5px] uppercase text-sky-700 font-bold tracking-wider mb-1">SECURITY</span>
            <span className="text-[9.5px] sm:text-xs font-bold text-sky-700 uppercase flex items-center justify-center space-x-1 shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 stroke-[2.5]" />
              <span className="truncate">Attested</span>
            </span>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="bg-[#FCFAF2] p-4 sm:p-6 rounded-2xl mb-6 relative border-2 border-slate-900 shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:12px_12px]">
          <span className="text-[11px] sm:text-xs font-sketch font-bold text-slate-600 uppercase tracking-widest block mb-2 underline decoration-dashed decoration-amber-500">
            📌 {t.documentDetails}
          </span>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed pt-1 whitespace-pre-wrap font-sans font-medium">
            {pdf.description || "The publisher did not attach detailed syllabus outlines. Please view direct sheet."}
          </p>
        </div>

        {/* Action Triggers Grid - PERFECTLY optimized and responsive for mobile view with downloads count appended */}
        <div className="mt-6">
          {pdf.membersOnly && !user && (
            <div className="mb-4 bg-amber-55 border-2 border-slate-900 border-dashed rounded-xl p-4 flex items-center space-x-3 text-slate-800 animate-fade-in relative">
              <span className="text-xl shrink-0">🔒</span>
              <div className="text-xs">
                <p className="font-sketch font-bold uppercase text-amber-700">
                  {lang === 'hi' ? 'प्रीमियम सामग्री अधिकृत सदस्यों के लिए' : 'Premium Document - Authorization Req.'}
                </p>
                <p className="font-sans font-medium text-slate-600 mt-0.5 leading-relaxed">
                  {lang === 'hi' 
                    ? 'कृपया ध्यान दें: इस प्रीमियम फ़ाइल को देखने या डाउनलोड करने के लिए त्वरित गूगल लॉगिन आवश्यक होगा।' 
                    : 'Notice: Click either button below to quickly Sign-In with Google and open this premium resource.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => triggerRedirect('view')}
              className="bg-[#FFE600] text-slate-950 hover:bg-[#FFF275] font-sketch font-extrabold py-4 px-4 rounded-xl border-2 border-slate-900 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer text-sm uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5 w-full"
            >
              <ExternalLink className="h-5 w-5 stroke-[2.5] shrink-0" />
              <span className="truncate">{t.viewInViewer} ({pdf.clickCount || 0})</span>
            </button>

            <button
              onClick={() => triggerRedirect('download')}
              className="bg-[#A3E635] text-slate-950 hover:bg-[#bbf054] font-sketch font-extrabold py-4 px-4 rounded-xl border-2 border-slate-900 transition duration-200 flex items-center justify-center space-x-2 cursor-pointer text-sm uppercase shadow-[3px_3px_0px_#000] active:translate-y-0.5 w-full"
            >
              <Download className="h-5 w-5 stroke-[2.5] shrink-0" />
              <span className="truncate">{t.directDownload} ({pdf.downloadCount || 0})</span>
            </button>
          </div>
        </div>

        {/* Support section: Shareable dynamic URL & Report section */}
        <div className="border-t-2 border-dashed border-slate-200 pt-5 mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-slate-550 leading-relaxed max-w-xs font-bold leading-normal">
            {t.quickNotice}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* Report Button */}
            <button 
              onClick={handleReportPdf}
              className="px-4 py-2 rounded-xl border-2 border-rose-900 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-sketch font-extrabold transition-all flex items-center space-x-1.5 cursor-pointer shadow-[2px_2px_0px_#991b1b] active:translate-y-0.5"
            >
              <AlertTriangle className="h-4 w-4 text-rose-700 stroke-[2.5]" />
              <span>{lang === 'hi' ? 'शिकायत करें' : 'Report PDF'}</span>
            </button>

            {/* Share Button */}
            <button 
              onClick={handleShare}
              className={`px-4 py-2 rounded-xl border-2 border-slate-900 text-xs font-sketch font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                copied 
                  ? 'bg-emerald-100 text-emerald-800 shadow-[1.5px_1.5px_0px_#000]' 
                  : 'bg-white hover:bg-slate-50 text-slate-800 shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] active:translate-y-0.5'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-700 stroke-[2.5]" />
                  <span>{t.copied}</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 stroke-[2.5]" />
                  <span>{t.shareLink}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* GOOGLE AUTHENTICATION PREMIUM ACCESS MODAL */}
      {showPremiumLoginModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-slate-900 rounded-2xl w-full max-w-md p-6 shadow-[8px_8px_0px_#000] relative animate-fade-in select-none">
            {/* Close button */}
            <button 
              onClick={() => setShowPremiumLoginModal(false)}
              className="absolute top-4 right-4 bg-rose-100 hover:bg-rose-200 border-2 border-slate-900 rounded-xl p-1 px-2.5 text-xs font-sketch font-bold text-slate-850 transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
            >
              ✕ {lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>

            <div className="flex flex-col items-center text-center mt-3">
              <div className="bg-[#FFE600] p-4 rounded-full border-2 border-slate-900 shadow-[3px_3px_0px_#000] mb-4 text-slate-950 animate-bounce">
                <Sparkles className="h-8 w-8 stroke-[2.5]" />
              </div>
              
              <h3 className="text-xl font-sketch font-black text-slate-900 uppercase tracking-tight mb-2">
                {lang === 'hi' ? 'प्रीमियम सामग्री अनलॉक करें 🔒' : 'Unlock Premium Study Notes 🔒'}
              </h3>
              
              <p className="text-xs sm:text-sm text-slate-650 leading-relaxed font-sans font-semibold mb-6 max-w-sm">
                {lang === 'hi' 
                  ? 'अकाडमी के इस प्रीमियम लेख/संचिका को पढ़ने या फाइल डाउनलोड करने के लिए त्वरित गूगल लॉगिन आवश्यक है।' 
                  : 'This premium resource is authorized for registered academy aspirants. Please sign-in with Google to clear instant access.'}
              </p>

              <div className="w-full space-y-3">
                <button
                  onClick={handleModalSignIn}
                  className="w-full flex items-center justify-center space-x-3 bg-[#FFE600] active:translate-y-0.5 text-slate-950 border-2 border-slate-900 rounded-xl font-sketch font-extrabold py-3.5 px-4 text-sm tracking-wide transition cursor-pointer shadow-[3.5px_3.5px_0px_#000] hover:bg-[#FFF275]"
                >
                  <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    alt="Google Logo" 
                    className="h-5 w-5"
                  />
                  <span>{lang === 'hi' ? 'गूगल से लॉगिन करें' : 'Sign In with Google'}</span>
                </button>

                <button
                  onClick={() => setShowPremiumLoginModal(false)}
                  className="w-full border-2 border-slate-900 bg-white hover:bg-slate-50 text-slate-800 font-sketch font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
                >
                  {lang === 'hi' ? 'बाद में करें' : 'Maybe Later'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
