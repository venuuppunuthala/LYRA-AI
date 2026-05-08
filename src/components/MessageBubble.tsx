
import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { Message, Attachment, PPTData, ChatSession, QuizQuestion, ScanAnalysis } from '../types';

interface MessageBubbleProps {
  message: Message;
  onSendMessage?: (text: string, attachments: Attachment[], moreInfo?: boolean, options?: any) => void;
  onMoreInfo?: () => void;
  activeSession?: ChatSession;
  onPPTFullScreen?: (data: PPTData) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSendMessage, onMoreInfo, activeSession, onPPTFullScreen }) => {
  const isModel = message.role === 'model';
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [quizSelection, setQuizSelection] = useState<number | null>(null);

  const handleDownload = (url: string, filename: string = 'lyra_asset.png') => {
    if (!url || url === '#') return;
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
  };

  const handlePPTExport = (format: string) => {
     setShowDownloadMenu(false);
     if (format.includes('pptx') && message.attachments) {
        const pptAtt = message.attachments.find(a => a.type === 'ppt' || a.mimeType.includes('presentation'));
        if (pptAtt) return handleDownload(pptAtt.url, pptAtt.name);
     }
  };

  const handleQuizChoice = (idx: number, q: QuizQuestion) => {
      if (quizSelection !== null) return;
      setQuizSelection(idx);
      const isCorrect = idx === q.correctIndex;
      setTimeout(() => {
          onSendMessage?.(`/quiz-answer ${isCorrect}`, []);
          setQuizSelection(null); 
      }, 3500);
  };

  const currentQuizQuestion = (isModel && message.quizQuestions && activeSession?.quizState?.step === 'ongoing') 
    ? message.quizQuestions[activeSession?.quizState?.currentQuestionIndex ?? 0] 
    : null;

  const showQuizQuitButton = activeSession?.isQuiz && activeSession?.quizState?.step !== 'finished';

  return (
    <div className={`flex gap-3 sm:gap-5 group ${isModel ? '' : 'flex-row-reverse'}`} role="article">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black shadow-xl border transition-transform ${
        isModel ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-white/10' : 'bg-slate-800 border-slate-700 text-slate-400'
      }`}>
        {isModel ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg> : <span>ME</span>}
      </div>

      <div className={`flex flex-col gap-3 w-full max-w-[95%] sm:max-w-[85%] ${!isModel && 'items-end'}`}>
        <div className={`rounded-[1.75rem] sm:rounded-[2.5rem] px-5 py-4 sm:px-7 sm:py-6 shadow-2xl transition-all flex flex-col relative overflow-hidden ${
          isModel ? 'bg-[#151921] border border-white/[0.05] text-slate-100' : 'bg-blue-600 text-white shadow-blue-500/20'
        }`}>
          {/* Media Section */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3 sm:gap-4">
              {message.attachments.map((at, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-white/5 bg-black/40 relative group/att max-w-full">
                  {at.type === 'image' ? (
                    <div className="relative">
                      <img src={at.url} className="max-w-full sm:max-w-md max-h-[300px] sm:max-h-[450px] object-contain rounded-xl" alt="Synthesis asset" />
                      <button onClick={() => handleDownload(at.url, at.name)} className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-blue-600 text-white rounded-full opacity-100 sm:opacity-0 group-hover/att:opacity-100 transition-all active:scale-90" aria-label="Download image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                    </div>
                  ) : (at.type === 'ppt' || at.mimeType.includes('presentation')) ? (
                    <div className="p-4 sm:p-5 flex items-center gap-4 min-w-[200px] sm:min-w-[260px] cursor-pointer hover:bg-white/5 transition-all active:bg-white/10 group/pptitem" onClick={() => message.pptData && onPPTFullScreen?.(message.pptData)}>
                       <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 group-hover/pptitem:bg-orange-500 group-hover/pptitem:text-white shrink-0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg></div>
                       <div className="flex flex-col overflow-hidden"><span className="font-bold text-xs sm:text-sm truncate">{at.name}</span><span className="text-[8px] sm:text-[9px] text-orange-400/60 font-black uppercase tracking-widest">Deck View</span></div>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-5 flex items-center gap-4 min-w-[200px] sm:min-w-[260px] bg-white/5 hover:bg-white/10 rounded-2xl transition-all relative">
                       <div className={`w-10 h-10 sm:w-12 sm:h-12 ${at.type === 'audio' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'} rounded-xl flex items-center justify-center shrink-0`}>
                         {at.type === 'audio' ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                       </div>
                       <div className="flex flex-col overflow-hidden"><span className="font-bold text-xs sm:text-sm truncate">{at.name}</span><span className="text-[8px] sm:text-[9px] text-blue-400/60 font-black uppercase tracking-widest">{at.mimeType.split('/')[1]?.toUpperCase() || 'FILE'} Asset</span></div>
                       <button onClick={(e) => { e.stopPropagation(); handleDownload(at.url, at.name); }} className="ml-auto p-2 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Synthesis PPT UI */}
          {message.pptData && message.pptData.slides && (
             <div className="mb-6 space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
                <div className="flex items-center justify-between">
                   <div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/><span className="text-[8px] sm:text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Synthesis Studio</span></div>
                   <div className="relative">
                      <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black text-white/40 hover:text-white tracking-widest uppercase bg-white/5 px-3 py-2 rounded-lg border border-white/10 transition-all active:scale-95"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export</button>
                      {showDownloadMenu && (
                        <div className="absolute right-0 top-full mt-2 z-50 min-w-[160px] bg-[#1c2231] rounded-2xl border border-white/10 shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200">
                          {['PPTX Format', 'PDF Export', 'DOC Synthesis'].map(fmt => (
                            <button key={fmt} onClick={() => handlePPTExport(fmt)} className="w-full text-left px-4 py-2.5 hover:bg-white/5 rounded-xl text-white/80 font-bold text-[9px] uppercase tracking-wider transition-colors">{fmt}</button>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
                <div onClick={() => message.pptData && onPPTFullScreen?.(message.pptData)} className="relative cursor-pointer group bg-[#0f1118] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col min-h-[240px] sm:min-h-[320px] transition-all hover:border-orange-500/30 active:scale-[0.99]">
                   {(() => {
                      const slide = message.pptData.slides[activeSlideIndex];
                      if (!slide) return null;
                      return (
                        <div className="flex-1 flex flex-col md:flex-row h-full">
                            <div className="flex-1 p-6 sm:p-10 flex flex-col justify-center gap-4 sm:gap-6">
                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: slide.accentColor || '#f97316' }}>Slide {activeSlideIndex + 1}</span>
                                <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight">{slide.title}</h3>
                                <div className="space-y-2">{slide.content.slice(0, 3).map((item, idx) => (<div key={idx} className="flex gap-3 items-start"><div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: slide.accentColor || '#f97316' }} /><p className="text-white/60 text-xs sm:text-sm font-medium leading-relaxed">{item}</p></div>))}</div>
                            </div>
                            {slide.imageUrl && (<div className="w-full md:w-2/5 h-40 sm:h-48 md:h-auto overflow-hidden relative border-t md:border-t-0 md:border-l border-white/5"><img src={slide.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[4s]" alt="" /><div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0f1118] to-transparent" /></div>)}
                            <div className="absolute inset-0 bg-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]"><span className="px-6 py-3 bg-white text-black rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-xl">Expand Deck</span></div>
                        </div>
                      );
                   })()}
                </div>
                <div className="flex gap-2 justify-center flex-wrap px-4">{message.pptData.slides.map((_, i) => (<button key={i} onClick={(e) => { e.stopPropagation(); setActiveSlideIndex(i); }} className={`h-1 sm:h-1.5 rounded-full transition-all ${activeSlideIndex === i ? 'w-8 sm:w-10 bg-orange-500' : 'w-1.5 sm:w-2 bg-white/10 hover:bg-white/20'}`} aria-label={`Go to slide ${i+1}`} />))}</div>
             </div>
          )}

          {/* Synthesis Quiz UI */}
          {currentQuizQuestion && (
              <div className="mb-6 space-y-4 sm:space-y-6 w-full animate-in fade-in slide-in-from-bottom-6 duration-500">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-white/5 border border-white/10 px-5 py-3 sm:py-4 rounded-2xl sm:rounded-[2rem]">
                      <div className="flex flex-col"><span className="text-[8px] sm:text-[10px] font-black text-blue-500 tracking-[0.2em] uppercase">Assessment Phase {(activeSession?.quizState?.currentQuestionIndex ?? 0) + 1}/5</span><span className="text-sm sm:text-lg font-black text-white">Dynamic Calibration</span></div>
                      <div className="flex flex-col items-end"><div className="px-3 py-1 bg-blue-500/20 rounded-xl border border-blue-500/30"><span className="text-[10px] font-black text-blue-400">{activeSession?.quizState?.score ?? 0} pts</span></div></div>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${(((activeSession?.quizState?.currentQuestionIndex ?? 0) + 1) / 5) * 100}%` }} /></div>
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight px-1">{currentQuizQuestion.question}</h3>
                <div className="grid grid-cols-1 gap-3">
                    {currentQuizQuestion.options.map((opt, idx) => {
                        let style = 'bg-[#1a1c24] border-white/5 hover:bg-[#252832] hover:border-blue-500/30 active:scale-98';
                        if (quizSelection !== null) {
                            if (idx === currentQuizQuestion.correctIndex) style = 'bg-green-500/10 border-green-500/40 text-green-400';
                            else if (idx === quizSelection) style = 'bg-red-500/10 border-red-500/40 text-red-400';
                            else style = 'opacity-30 border-transparent grayscale scale-[0.98]';
                        }
                        return (
                          <button 
                            key={idx} 
                            disabled={quizSelection !== null} 
                            onClick={() => handleQuizChoice(idx, currentQuizQuestion)} 
                            className={`w-full text-left p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border transition-all duration-300 flex items-center gap-4 sm:gap-6 ${style}`}
                          >
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 transition-colors ${quizSelection === null ? 'bg-black/40 text-white/40' : (idx === currentQuizQuestion.correctIndex ? 'bg-green-500 text-white' : 'bg-red-500 text-white')}`}>{String.fromCharCode(65 + idx)}</div>
                            <span className="font-bold text-base sm:text-lg md:text-xl leading-snug">{opt}</span>
                          </button>
                        );
                    })}
                </div>
                {quizSelection !== null && (
                    <div className="animate-in slide-in-from-top-4 duration-500 p-6 sm:p-8 bg-blue-500/[0.03] border border-blue-500/20 rounded-[2rem] sm:rounded-[3rem] space-y-4">
                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] w-fit ${quizSelection === currentQuizQuestion.correctIndex ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{quizSelection === currentQuizQuestion.correctIndex ? 'Logic Validated' : 'Logic Mismatch'}</div>
                        <div className="space-y-2"><span className="text-[8px] sm:text-[9px] font-black text-white/30 uppercase tracking-[0.2em] block">Calibration Info</span><p className="text-white/80 text-sm sm:text-lg leading-relaxed font-medium">{currentQuizQuestion.explanation}</p></div>
                        {currentQuizQuestion.example && (<div className="p-4 sm:p-5 bg-white/5 rounded-2xl border border-white/5"><span className="text-[8px] font-black text-white/30 uppercase block mb-2 tracking-[0.2em]">Context Link</span><p className="text-white/50 text-xs sm:text-sm italic">"{currentQuizQuestion.example}"</p></div>)}
                    </div>
                )}
              </div>
          )}

          {!currentQuizQuestion && (
            <div className="markdown-body whitespace-pre-wrap leading-relaxed text-[15px] sm:text-[17px] md:text-[18px] font-medium prose prose-invert max-w-none">
              <Markdown>{message.text}</Markdown>
            </div>
          )}

          {/* Interactive Steps */}
          {isModel && (message.isPPTAction || message.isQuizAction || message.isDocAction || message.isImageAction || message.isScanAction) && (
            <div className={`mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4 ${!isModel && 'items-end'}`}>
               {message.isPPTAction ? (
                 <div className="flex flex-wrap gap-3">
                   <button onClick={() => onSendMessage?.('/ppt-method generate', [])} className="px-6 sm:px-8 py-3.5 sm:py-4 bg-orange-600 hover:bg-orange-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center gap-2 sm:gap-3 shadow-xl transition-all active:scale-95 border border-white/10"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m13 2-2 20M17 12H7M18 5l-6-3-6 3M18 19l-6 3-6-3"/></svg>Generate</button>
                   <button onClick={() => onSendMessage?.('/ppt-method paste', [])} className="px-6 sm:px-8 py-3.5 sm:py-4 bg-white/5 hover:bg-white/10 text-white/80 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 border border-white/5 transition-all">Paste Text</button>
                   <button onClick={() => onSendMessage?.('/ppt-method import', [])} className="px-6 sm:px-8 py-3.5 sm:py-4 bg-white/5 hover:bg-white/10 text-white/80 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 border border-white/5 transition-all">Import PDF</button>
                   <button onClick={() => onSendMessage?.('/ppt-cancel', [])} className="px-6 sm:px-8 py-3.5 sm:py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 border border-red-500/20 transition-all flex items-center gap-2">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     Cancel
                   </button>
                 </div>
               ) : message.isQuizAction ? (
                 <div className="flex flex-wrap gap-3">
                    {activeSession?.quizState?.step === 'difficulty' ? (
                      <>
                        {['Easy', 'Medium', 'Advanced'].map(lvl => (
                          <button key={lvl} onClick={() => onSendMessage?.(`/quiz-level ${lvl}`, [])} className={`px-6 sm:px-10 py-3.5 sm:py-5 ${lvl === 'Advanced' ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-white/5 border-white/10'} text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl sm:rounded-[2rem] border transition-all active:scale-95 shadow-xl`}>{lvl}</button>
                        ))}
                        <button onClick={() => onSendMessage?.('/quiz-cancel', [])} className="px-6 sm:px-10 py-3.5 sm:py-5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl sm:rounded-[2rem] border border-red-500/20 transition-all active:scale-95 flex items-center gap-2">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                           Cancel
                        </button>
                      </>
                    ) : null}
                 </div>
               ) : message.isDocAction ? (
                 <div className="flex flex-wrap gap-3">
                   <button onClick={() => onSendMessage?.('Provide a structured executive summary of this document.', [])} className="px-5 sm:px-6 py-3 sm:py-3.5 bg-indigo-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 shadow-lg">Summarize</button>
                   <button onClick={() => onSendMessage?.('Extract key data points from this document.', [])} className="px-5 sm:px-6 py-3 sm:py-3.5 bg-white/5 border border-indigo-500/20 text-indigo-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 transition-all">Extract</button>
                   <button onClick={() => onSendMessage?.('/doc-cancel', [])} className="px-5 sm:px-6 py-3 sm:py-3.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 transition-all border border-red-500/20 flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Cancel
                   </button>
                 </div>
                ) : message.isImageAction ? (
                 <div className="flex flex-wrap gap-3">
                   <button 
                     onClick={() => onSendMessage?.('Perform a comprehensive analysis of this image and provide detailed information about its content.', [], false, { scanAnalysis: true })} 
                     className="px-6 sm:px-8 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 shadow-xl flex items-center gap-2.5 transition-all border border-white/10"
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M21 12c-1.889 2.991-4.674 6-9 6s-7.111-3.009-9-6c1.889-2.991 4.674-6 9-6s7.111 3.009 9 6Z"/></svg>
                     Analysis
                   </button>
                   <button 
                     onClick={() => onSendMessage?.('Extract all key data points, text, and structured information from this image.', [], false, { scanAnalysis: true })} 
                     className="px-6 sm:px-8 py-3.5 sm:py-4 bg-white/5 border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl active:scale-95 transition-all flex items-center gap-2.5"
                   >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                     Extract
                   </button>
                 </div>
               ) : message.isScanAction && message.scanAnalysis ? (
                 <div className="flex flex-wrap gap-3">
                   {message.scanAnalysis.actionSuggestions.map((suggestion, i) => (
                     <button 
                       key={i} 
                       onClick={() => onSendMessage?.(suggestion, [])} 
                       className="px-5 sm:px-6 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 shadow-lg transition-all"
                     >
                       {suggestion}
                     </button>
                   ))}
                   <button 
                     onClick={() => onSendMessage?.('/scan-cancel', [])} 
                     className="px-5 sm:px-6 py-3 sm:py-3.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] rounded-xl active:scale-95 transition-all border border-red-500/20 flex items-center gap-2"
                   >
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     Dismiss
                   </button>
                 </div>
               ) : null}
            </div>
          )}

          {showQuizQuitButton && isModel && (
            <div className="mt-4 flex justify-center border-t border-white/5 pt-4">
              <button onClick={() => onSendMessage?.('/quit-quiz', [])} className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all text-[9px] font-black uppercase tracking-[0.1em] active:scale-95">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Quit Assessment
              </button>
            </div>
          )}

          {isModel && message.groundingUrls && (
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5 flex flex-col gap-4">
                <span className="text-[8px] sm:text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Grounding Sensors</span>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {message.groundingUrls.map((source, idx) => (<a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3 bg-black/40 hover:bg-blue-600/10 border border-white/5 rounded-xl text-[11px] sm:text-[12px] font-bold text-blue-400 transition-all shadow-xl active:scale-95 group/source"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/20 group-hover/source:text-blue-400"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span className="truncate max-w-[120px] sm:max-w-[200px]">{source.title}</span></a>))}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
