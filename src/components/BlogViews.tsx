import React, { useState } from 'react';
import { BlogPost } from '../types';
import { ArrowLeft, BookOpen, Calendar, User, Search, Link2, Copy, Check, Clock } from 'lucide-react';

interface BlogPageProps {
  blogs: BlogPost[];
  onBack: () => void;
  onNavigateToBlog: (id: string) => void;
  lang: 'en' | 'hi';
  loading: boolean;
}

export function BlogPage({ blogs, onBack, onNavigateToBlog, lang, loading }: BlogPageProps) {
  const [search, setSearch] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const filtered = blogs.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.category.toLowerCase().includes(search.toLowerCase()) || 
    b.excerpt.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyExt = (ext: string) => {
    const cleanExt = ext.startsWith('#/') ? ext.replace('#/', '') : ext;
    const fullUrl = `${window.location.origin}/${cleanExt}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(ext);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-2 select-none">
      {/* Upper breadcrumb & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={onBack}
          className="self-start flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-sketch font-bold transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === 'hi' ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Materials'}</span>
        </button>

        {/* URL Extension Display Badge */}
        <div className="bg-slate-900 text-white rounded-xl py-2 px-3.5 border-2 border-slate-950 flex items-center justify-between gap-3 text-xs shadow-[2.5px_2.5px_0px_#ffe600]">
          <div className="flex items-center space-x-2">
            <Link2 className="h-4 w-4 text-[#ffe600]" />
            <span className="font-mono text-[10px] text-slate-300 font-bold">URL Extension: <span className="text-[#ffe600]">/blog</span></span>
          </div>
          <button
            onClick={() => handleCopyExt('/blog')}
            className="text-slate-400 hover:text-white transition p-1"
            title="Copy full URL"
          >
            {copiedUrl === '/blog' ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Header and Brand */}
      <div className="text-center mb-8 bg-amber-50/40 border-2 border-dashed border-slate-300 rounded-2xl p-6 relative">
        <div className="absolute top-2 right-2 bg-slate-900 text-[#ffe600] font-mono text-[9px] px-2 py-0.5 rounded-md font-bold uppercase">
          SECURE DB INDEX: blogs
        </div>
        <h2 className="text-xl sm:text-2xl font-sketch font-bold uppercase tracking-tight text-slate-900 mb-2">
          {lang === 'hi' ? '📜 दैनिक अपडेट एवं ब्लॉग' : '📜 Daily Updates & Strategies'}
        </h2>
        <p className="text-xs text-slate-500 font-sans font-bold max-w-xl mx-auto">
          {lang === 'hi' 
            ? 'अकादमी द्वारा सत्यापित रणनीति मार्गदर्शिकाएँ और सिविल सेवा परीक्षा की दैनिक सूचनाएं यहां पढ़ें।' 
            : 'Read exclusive tactics, syllabus breakdowns, and exam notices verified by academy advisors.'}
        </p>
      </div>

      {/* Search Filter Bar */}
      <div className="relative mb-8 max-w-md mx-auto">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={lang === 'hi' ? 'ब्लॉग या रणनीतियों को खोजें...' : 'Search blogs, strategies...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white placeholder-slate-450 text-slate-800 text-xs font-semibold pl-10 pr-3.5 py-3 rounded-2xl border-2 border-slate-900 outline-none focus:bg-amber-50/20"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full mb-2"></div>
          <p className="text-xs font-bold text-slate-500">Querying updates index...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <BookOpen className="h-10 w-10 text-slate-350 mx-auto mb-3" />
          <p className="text-xs font-bold font-sans">No matching blog updates found in database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(blog => (
            <div 
              key={blog.id} 
              className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] transition-all duration-200 flex flex-col cursor-pointer hover:-translate-y-0.5 group"
              onClick={() => onNavigateToBlog(blog.id)}
            >
              {blog.coverUrl && (
                <div className="h-44 overflow-hidden border-b-2 border-slate-900 relative">
                  <img 
                    src={blog.coverUrl} 
                    alt={blog.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-3 left-3 bg-[#FFE600] text-slate-900 font-sans font-extrabold text-[9px] px-2.5 py-1 rounded-md border border-slate-900 uppercase">
                    {blog.category}
                  </span>
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-3.5 text-slate-500 text-[10px] uppercase font-mono font-bold mb-2">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{blog.readTime || '5 Mins'}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-sketch font-bold text-slate-900 group-hover:text-amber-600 transition-colors mb-2 leading-snug line-clamp-2 uppercase">
                    {blog.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 font-sans font-semibold leading-relaxed line-clamp-3 mb-4">
                    {blog.excerpt}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[10px] font-sans font-bold text-slate-800">
                  <span className="flex items-center space-x-1.5 text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                    <User className="h-3 w-3" />
                    <span>{blog.author}</span>
                  </span>
                  
                  <span className="text-indigo-650 group-hover:underline flex items-center space-x-0.5">
                    <span>{lang === 'hi' ? 'अधिक पढ़ें' : 'Read Article'} &rarr;</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface BlogDetailsPageProps {
  blogId: string;
  blogs: BlogPost[];
  onBack: () => void;
  lang: 'en' | 'hi';
}

export function BlogDetailsPage({ blogId, blogs, onBack, lang }: BlogDetailsPageProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const blog = blogs.find(b => b.id === blogId);

  const handleCopyExt = (ext: string) => {
    const cleanExt = ext.startsWith('#/') ? ext.replace('#/', '') : ext;
    const fullUrl = `${window.location.origin}${cleanExt.startsWith('/') ? '' : '/'}${cleanExt}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(ext);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!blog) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center bg-white border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_#000]">
        <BookOpen className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-base font-sketch font-bold mb-2">ARTICLE NOT FOUND</h3>
        <p className="text-xs text-slate-500 mb-6">The requested document path might have been modified in the database index.</p>
        <button
          onClick={onBack}
          className="bg-[#FFE600] border-2 border-slate-900 font-sketch font-bold px-4 py-2 rounded-xl text-xs"
        >
          {lang === 'hi' ? 'वापस जाएं' : 'Return to Catalog'}
        </button>
      </div>
    );
  }

  const cleanExt = `/blog/${blog.id}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-2 font-sans select-none">
      
      {/* Navigation Headers and URL display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={onBack}
          className="self-start flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-900 rounded-xl px-3.5 py-2 text-xs font-sketch font-bold transition shadow-[2px_2px_0px_#000] active:translate-y-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === 'hi' ? 'सूची पर वापस जाएं' : 'Back to Blog Updates'}</span>
        </button>

        {/* Dynamic URL Copy Bar */}
        <div className="bg-slate-900 text-white rounded-xl py-2 px-3.5 border-2 border-slate-950 flex items-center justify-between gap-3 text-xs shadow-[2.5px_2.5px_0px_#ffe600]">
          <div className="flex items-center space-x-2 truncate max-w-[240px]">
            <Link2 className="h-4 w-4 text-[#ffe600] shrink-0" />
            <span className="font-mono text-[9px] text-slate-300 font-bold truncate">Path Ext: <span className="text-[#ffe600]">{cleanExt}</span></span>
          </div>
          <button
            onClick={() => handleCopyExt(cleanExt)}
            className="text-slate-400 hover:text-white transition p-1 shrink-0"
            title="Copy shareable full link"
          >
            {copiedUrl === cleanExt ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Newspaper / Editorial styled card */}
      <article className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-[5px_5px_0px_#000] mb-8">
        
        {blog.coverUrl && (
          <div className="h-64 sm:h-80 w-full overflow-hidden border-b-2 border-slate-900">
            <img 
              src={blog.coverUrl} 
              alt={blog.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="p-6 sm:p-10">
          
          <span className="bg-[#FFE600] text-slate-800 font-sketch font-bold text-xs px-3 py-1 rounded-lg border border-slate-900 uppercase inline-block mb-4">
            {blog.category}
          </span>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-sketch font-extrabold text-slate-900 leading-tight mb-4 uppercase">
            {blog.title}
          </h1>

          {/* Author metadata and details */}
          <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs font-semibold mb-8 pb-6 border-b border-slate-100 uppercase font-mono">
            <div className="flex items-center space-x-1.5 text-slate-850">
              <User className="h-4 w-4 text-indigo-500" />
              <span>{blog.author}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Calendar className="h-4 w-4" />
              <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock className="h-4 w-4" />
              <span>{blog.readTime || '5 Mins Read'}</span>
            </div>
          </div>

          {/* Render markdown plain structured paragraphs beautifully */}
          <div className="prose prose-slate max-w-none text-slate-800 text-[12.5px] sm:text-[13.5px] font-sans font-medium hover:text-slate-900 leading-relaxed space-y-6">
            {blog.content.split('\n\n').map((paragraph, index) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-base sm:text-lg font-sketch font-bold text-slate-950 uppercase border-l-4 border-indigo-500 pl-3 mt-8 mb-2">
                    {trimmed.replace('### ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('#### ')) {
                return (
                  <h4 key={index} className="text-sm sm:text-base font-sketch font-bold text-slate-900 mt-6 mb-2">
                    {trimmed.replace('#### ', '')}
                  </h4>
                );
              }
              if (trimmed.startsWith('- ')) {
                return (
                  <ul key={index} className="list-disc list-inside pl-4 space-y-2 mt-2">
                    {trimmed.split('\n').map((line, lIdx) => (
                      <li key={lIdx} className="font-sans font-semibold text-slate-700">
                        {line.replace('- ', '').replace('**', '').replace('**', '')}
                      </li>
                    ))}
                  </ul>
                );
              }

              // Simple bold tagging parser
              let contentHtml = trimmed;
              return (
                <p key={index} className="text-slate-755 leading-relaxed font-semibold">
                  {contentHtml}
                </p>
              );
            })}
          </div>

        </div>
      </article>

    </div>
  );
}
