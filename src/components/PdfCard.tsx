import React from 'react';
import { FileText, Eye, Download, ChevronRight, Tag, BookOpen, HardDrive, Award, History, Map, Trophy, Info, Star } from 'lucide-react';
import { PdfDocument } from '../types';
import { translations, Language } from '../lib/translations';

interface PdfCardProps {
  key?: string;
  pdf: PdfDocument;
  onNavigateToDocs: (pdfId: string) => void;
  lang: Language;
  isBookmarked?: boolean;
  onToggleBookmark?: (e: React.MouseEvent, pdfId: string) => void;
}

export default function PdfCard({ pdf, onNavigateToDocs, lang, isBookmarked = false, onToggleBookmark }: PdfCardProps) {
  const t = translations[lang];

  // Map category to icon and color scheme matching the screenshots
  const getCategoryTheme = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('note') || cat.includes('notes')) {
      return {
        bg: 'bg-violet-100',
        text: 'text-violet-600',
        icon: BookOpen,
        border: 'border-violet-100',
        decor: 'bg-violet-500'
      };
    }
    if (cat.includes('paper') || cat.includes('previous')) {
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-600',
        icon: History,
        border: 'border-amber-100',
        decor: 'bg-amber-500'
      };
    }
    if (cat.includes('syllabus') || cat.includes('curriculum')) {
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-600',
        icon: Map,
        border: 'border-emerald-100',
        decor: 'bg-emerald-500'
      };
    }
    if (cat.includes('exam') || cat.includes('test') || cat.includes('series')) {
      return {
        bg: 'bg-rose-100',
        text: 'text-rose-600',
        icon: Award,
        border: 'border-rose-100',
        decor: 'bg-rose-500'
      };
    }
    if (cat.includes('book') || cat.includes('competition')) {
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-600',
        icon: Trophy,
        border: 'border-blue-100',
        decor: 'bg-blue-500'
      };
    }
    // Fallback
    return {
      bg: 'bg-sky-100',
      text: 'text-sky-600',
      icon: Info,
      border: 'border-sky-100',
      decor: 'bg-sky-500'
    };
  };

  const theme = getCategoryTheme(pdf.category);
  const CatIcon = theme.icon;

  const getFallbackCoverUrl = (categoryStr: string) => {
    const cat = categoryStr?.toLowerCase() || '';
    if (cat.includes('note') || cat.includes('notes')) {
      return 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=400';
    }
    if (cat.includes('paper') || cat.includes('previous')) {
      return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400';
    }
    if (cat.includes('syllabus') || cat.includes('curriculum')) {
      return 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=400';
    }
    if (cat.includes('exam') || cat.includes('test') || cat.includes('series')) {
      return 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400';
    }
    if (cat.includes('book') || cat.includes('competition')) {
      return 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400';
    }
    return 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&q=80&w=400';
  };

  const formattedDesc = pdf.description && pdf.description.length > 72
    ? `${pdf.description.substring(0, 72)}...`
    : pdf.description || 'No additional study description provided.';

  return (
    <div 
      onClick={() => onNavigateToDocs(pdf.id)}
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all duration-300 border-2 border-slate-900 shadow-[4px_4px_0px_#0f172a] hover:shadow-[7px_7px_0px_#0f172a] hover:-translate-x-0.5 hover:-translate-y-0.5 flex flex-col justify-between group relative overflow-hidden"
    >
      {/* Dynamic top-edge style accent bar */}
      <div className={`absolute top-0 left-0 w-full h-[4px] ${theme.decor}`}></div>

      {/* Premium Washi Tape decoration ornament */}
      <div className="absolute -top-1 right-8 w-16 h-4 bg-amber-200/70 border-x border-slate-400/50 border-dashed rotate-3 z-10 pointer-events-none shadow-sm"></div>

      <div>
        {/* Book Banner Cover Image */}
        <div className="relative w-full h-36 mb-4 rounded-xl overflow-hidden border-2 border-slate-900 shadow-[2px_2px_0px_#000] z-0">
          <img 
            src={pdf.coverUrl || getFallbackCoverUrl(pdf.category)} 
            alt={pdf.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Subtle overlay accent */}
          <div className="absolute inset-0 bg-slate-900/10 mix-blend-multiply"></div>

          {/* Floating Bookmark Star Action */}
          {onToggleBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(e, pdf.id);
              }}
              className="absolute top-2 left-2 z-10 bg-white border-2 border-slate-900 rounded-lg p-1.5 transition-all duration-200 active:scale-90 hover:bg-amber-100 text-slate-800 shadow-[1.5px_1.5px_0px_#000]"
              title="Bookmark file"
            >
              <Star className={`h-4.5 w-4.5 stroke-[2.5] ${isBookmarked ? 'fill-[#FFE600] text-slate-900 stroke-slate-900' : 'text-slate-400'}`} />
            </button>
          )}
        </div>

        {/* Category & File size */}
        <div className="flex items-center justify-between mb-3 mt-1 select-none">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-sketch font-bold border border-slate-900 ${theme.bg} ${theme.text} uppercase tracking-wider`}>
            {pdf.category || 'General'}
          </span>
          <div className="flex items-center space-x-1.5 text-slate-600 font-bold text-sm sm:text-base">
            <HardDrive className="h-4 w-4 text-slate-500" />
            <span className="font-mono text-[13px] sm:text-[14px]">{pdf.fileSize}</span>
          </div>
        </div>

        {/* PDF Card Title Area with Normal Sans Font and Underline (No Icons) */}
        <div className="mb-4">
          <h3 className="text-xl sm:text-2xl font-sans font-black text-slate-950 tracking-tight leading-snug line-clamp-3 uppercase py-0.5 group-hover:text-amber-600 underline decoration-3 decoration-amber-400 group-hover:decoration-slate-900 transition-all underline-offset-4">
            {pdf.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-base sm:text-[16.5px] text-slate-600 font-sans font-medium leading-relaxed mb-4 min-h-[42px] line-clamp-2">
          {formattedDesc}
        </p>

        {/* Tags and Page Count info */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3.5">
          <div className="flex items-center space-x-1.5 text-sm sm:text-base font-bold text-slate-700 select-none">
            <BookOpen className="h-4 w-4 text-slate-500 stroke-[2.2]" />
            <span>{pdf.pageCount} {t.pages}</span>
          </div>

          <div className="text-[11px] font-bold font-sans uppercase tracking-wider flex items-center space-x-1 select-none">
            {pdf.membersOnly ? (
              <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">🔒 Premium</span>
            ) : (
              <span className="text-emerald-600 bg-emerald-55/40 px-2 py-0.5 rounded border border-emerald-300">🔓 Free</span>
            )}
          </div>
        </div>
      </div>

      {/* Analytics count metadata & tactile sketchy button */}
      <div className="border-t border-slate-200 pt-3.5 mt-4 flex items-center justify-between text-sm sm:text-base text-slate-700 font-bold select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5" title={t.views}>
            <Eye className="h-4.5 w-4.5 text-slate-500" />
            <span className="font-mono font-bold text-sm sm:text-base text-slate-800">{pdf.clickCount || 0}</span>
          </div>
          <div className="flex items-center space-x-1.5" title={t.downloads}>
            <Download className="h-4.5 w-4.5 text-slate-500" />
            <span className="font-mono font-bold text-sm sm:text-base text-slate-800">{pdf.downloadCount || 0}</span>
          </div>
        </div>

        <button className="h-9 sm:h-10 px-4 rounded-lg bg-[#FFE600] active:translate-y-0.5 text-slate-950 hover:bg-[#FFF275] border-2 border-slate-900 transition-all text-xs sm:text-sm font-sketch font-extrabold flex items-center space-x-1 shadow-[2px_2px_0px_#000]">
          <span>{lang === 'hi' ? 'खोलें' : 'Open'}</span>
          <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
