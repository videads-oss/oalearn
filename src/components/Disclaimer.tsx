import React from 'react';
import { ArrowLeft, ShieldAlert, AlertCircle } from 'lucide-react';
import { Language } from '../lib/translations';

interface DisclaimerProps {
  onBack: () => void;
  lang: Language;
}

export default function Disclaimer({ onBack, lang }: DisclaimerProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-slate-800 antialiased font-sans">
      {/* Back button */}
      <div className="mb-6 select-none shadow-none">
        <button 
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white border-2 border-slate-900 rounded-xl text-xs text-slate-800 hover:bg-slate-50 transition font-sketch font-bold shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
          <span>{lang === 'hi' ? 'मुख्य पृष्ठ पर वापस जाएं' : 'Back to Home'}</span>
        </button>
      </div>

      {/* Main whiteboard disclaimer card */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-10 shadow-[6px_6px_0px_#0f172a] relative overflow-hidden bg-[radial-gradient(#e5e3d7_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Stamp or top aesthetic element */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 select-none rotate-6 border-2 border-dashed border-rose-600 bg-rose-50 text-rose-800 font-sketch font-bold text-[9px] sm:text-[10px] px-2.5 py-1 rounded uppercase tracking-wider">
          Official Notice
        </div>

        {/* Title */}
        <div className="flex items-center space-x-3.5 pb-5 mb-6 border-b-2 border-slate-900 border-dashed">
          <div className="bg-rose-50 p-3 rounded-full text-rose-600 border-2 border-slate-900 shadow-[2px_2px_0px_#000]">
            <ShieldAlert className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-sans font-black text-rose-650 tracking-tight leading-none uppercase">
              {lang === 'hi' ? 'महत्वपूर्ण अस्वीकरण (Disclaimer)' : 'Disclaimer Notice'}
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-mono mt-1 font-bold">REG No: #OA-DISCLAIMER-2026</p>
          </div>
        </div>

        {/* Disclaimer Text */}
        <div className="space-y-5 leading-relaxed font-sans text-xs sm:text-sm text-slate-800 font-medium">
          <div className="bg-amber-50/50 p-4 rounded-xl border-2 border-slate-900 border-dashed flex items-start space-x-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>{lang === 'hi' ? 'अस्वीकरण:' : 'Disclaimer:'}</strong> All PDFs, books, notes, and study materials available on this website are shared strictly for educational and informational purposes only. We do not claim ownership of any copyrighted material unless explicitly stated. All copyrights and intellectual property rights belong to their respective authors, publishers, and owners.
            </span>
          </div>

          <p>
            We do not modify, edit, or reproduce these materials for commercial purposes. The content is provided freely to help students and learners. If you are the copyright owner of any material and believe that your work has been shared without proper authorization, please contact us. Upon receiving a valid request, the content will be reviewed and removed promptly.
          </p>

          <p className="border-t border-slate-200 pt-3">
            By using this website, you acknowledge and agree that all materials are intended solely for free educational purposes.
          </p>
        </div>

        {/* Support and contact info */}
        <div className="mt-8 border-t-2 border-dashed border-slate-200 pt-6">
          <h4 className="text-xs font-sketch font-bold text-slate-900 uppercase mb-2">
            📧 {lang === 'hi' ? 'कापीराइट रिपोर्टिंग व पूछताछ' : 'Copyright Infringement / Removal Requests'}
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed font-sans font-medium">
            {lang === 'hi' 
              ? 'यदि आप इनमें से किसी भी शैक्षणिक सामग्री के स्वामी हैं और प्रकाशन रोकना चाहते हैं, तो कृपया ईमेल पर संपर्क करें: '
              : 'If you are the copyright holder of any document indexed here and wish for its immediate removal, please draft an email to '}
            <a 
              href="mailto:copyright@oalearn.com" 
              className="text-indigo-650 font-black underline hover:text-indigo-800 transition"
            >
              copyright@oalearn.com
            </a>
            {lang === 'hi' ? '। हम आपकी समीक्षा और हटाने के अनुरोध पर २४-४८ घंटे के भीतर काम करेंगे।' : '. Our team will review and process your removal request within 24-48 business hours.'}
          </p>
        </div>
      </div>
    </div>
  );
}
