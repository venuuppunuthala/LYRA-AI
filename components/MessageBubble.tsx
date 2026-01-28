import React, { useState } from 'react';
import { Message, Attachment, PPTData, ChatSession, QuizQuestion } from '../types';

interface MessageBubbleProps {
  message: Message;
  onSendMessage?: (text: string, attachments: Attachment[]) => void;
  onMoreInfo?: () => void;
  activeSession?: ChatSession;
  onPPTFullScreen?: (data: PPTData) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onSendMessage, onMoreInfo, activeSession, onPPTFullScreen }) => {
  const isModel = message.role === 'model';
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [quizSelection, setQuizSelection] = useState<number | null>(null);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePPTDownload = (format: string) => {
     alert(`Downloading in ${format.toUpperCase()}...`);
     setShowDownloadMenu(false);
  };

  const handleQuizChoice = (idx: number, q: QuizQuestion) => {
      if (quizSelection !== null) return;
      setQuizSelection(idx);
      const isCorrect = idx === q.correctIndex;
      setTimeout(() => {
          onSendMessage?.(`/quiz-answer ${isCorrect}`, []);
          setQuizSelection(null); // Reset for next bubble in same session
      }, 3500);
  };

  const currentQuizQuestion = (isModel && message.quizQuestions && activeSession?.quizState?.step === 'ongoing') 
    ? message.quizQuestions[activeSession.quizState.currentQuestionIndex] 
    : null;

  return (
    <div className={`flex gap-4 md:gap-5 group ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black shadow-xl border ${
        isModel ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-white/10' : 'bg-slate-800 border-slate-700 text-slate-400'
      }`}>
        {isModel ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg> : <span>ME</span>}
      </div>

      <div className={`flex flex-col gap-3 max-w-[95%] md:max-w-[85%] ${!isModel && 'items-end'}`}>
        <div className={`rounded-3xl px-5 py-4 md:px-7 md:py-5 shadow-xl transition-all flex flex-col ${
          isModel ? 'bg-[#151921] border border-white/5 text-slate-100' : 'bg-[#2b63d9] text-white shadow-blue-500/10'
        }`}>
          {/* Media Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-4">
              {message.attachments.map((at, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-white/5 bg-black/40 relative group/att">
                  {at.type === 'image' ? (
                    <img src={at.url} className="max-w-full md:max-w-md max-h-[400px] object-contain rounded-xl" alt="" />
                  ) : at.type === 'ppt' ? (
                    <div className="p-5 flex items-center gap-4 min-w-[220px] cursor-pointer hover:bg-white/5 transition-all" onClick={() => message.pptData && onPPTFullScreen?.(message.pptData)}>
                       <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
                       </div>
                       <div className="flex flex-col overflow-hidden">
                         <span className="font-bold text-sm truncate">{at.name}</span>
                         <span className="text-[9px] text-orange-400/60 font-black uppercase tracking-widest">Click to Present</span>
                       </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-center gap-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><span className="text-sm font-bold uppercase">{at.mimeType.split('/')[1]}</span></div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PPT Preview with Controls */}
          {message.pptData && message.pptData.slides && (
             <div className="mb-6 space-y-6 w-full">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar max-w-[60%]">
                      {message.pptData.slides.map((_, i) => (
                         <button key={i} onClick={() => setActiveSlideIndex(i)} className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${activeSlideIndex === i ? 'bg-blue-400 scale-125' : 'bg-white/10'}`} />
                      ))}
                   </div>
                   <div className="relative">
                      <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="flex items-center gap-2 text-[10px] font-black text-blue-400 hover:text-blue-300 tracking-widest uppercase">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export
                      </button>
                      {showDownloadMenu && (
                        <div className="absolute right-0 top-full mt-2 z-50 min-w-[140px] bg-[#1c2231] rounded-xl border border-white/10 shadow-2xl p-1 animate-in zoom-in-95 duration-200">
                          {['PDF', 'DOCX', 'PPTX'].map(fmt => <button key={fmt} onClick={() => handlePPTDownload(fmt)} className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-lg text-white/80 font-bold text-[10px] uppercase tracking-wider">Download as {fmt}</button>)}
                        </div>
                      )}
                   </div>
                </div>

                <div onClick={() => message.pptData && onPPTFullScreen?.(message.pptData)} className="relative cursor-pointer group bg-[#0f1118] border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[250px] transition-transform hover:scale-[1.01]">
                   {(() => {
                      const slide = message.pptData.slides[activeSlideIndex];
                      if (!slide) return null;
                      return (
                        <div className="flex-1 p-6 flex flex-col justify-center text-center">
                            <h3 className="text-2xl font-black text-white leading-tight mb-2">{slide.title}</h3>
                            <p className="text-[13px] text-white/40 mb-4">{slide.subtitle}</p>
                            <div className="flex flex-wrap justify-center gap-1.5">
                                {slide.content.slice(0, 3).map((item, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-white/5 rounded-full text-[11px] font-medium text-white/60">{item}</span>
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="px-5 py-2.5 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30">Present Full Screen</span></div>
                        </div>
                      );
                   })()}
                </div>
             </div>
          )}

          {/* Quiz MCQ Interface */}
          {currentQuizQuestion && (
              <div className="mb-6 space-y-5 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 px-4 py-3 rounded-2xl">
                    <span className="text-[9px] font-black text-blue-400 tracking-widest uppercase">Question {activeSession?.quizState!.currentQuestionIndex + 1} of 5</span>
                    <span className="text-[9px] font-black text-blue-400 tracking-widest uppercase">Points: {activeSession?.quizState!.score}</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">{currentQuizQuestion.question}</h3>
                <div className="grid grid-cols-1 gap-2.5">
                    {currentQuizQuestion.options.map((opt, idx) => {
                        let style = 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10';
                        if (quizSelection !== null) {
                            if (idx === currentQuizQuestion.correctIndex) style = 'bg-green-500/20 border-green-500/30 text-green-400';
                            else if (idx === quizSelection) style = 'bg-red-500/20 border-red-500/30 text-red-400';
                            else style = 'opacity-30 border-transparent';
                        }
                        return (
                            <button key={idx} disabled={quizSelection !== null} onClick={() => handleQuizChoice(idx, currentQuizQuestion)} className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${style}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center font-black text-xs text-white/50">{String.fromCharCode(65 + idx)}</div>
                                    <span className="font-medium text-sm md:text-base">{opt}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {quizSelection !== null && (
                    <div className="animate-in zoom-in-95 duration-500 p-5 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4 shadow-inner">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${quizSelection === currentQuizQuestion.correctIndex ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                             <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${quizSelection === currentQuizQuestion.correctIndex ? 'text-green-400' : 'text-red-400'}`}>{quizSelection === currentQuizQuestion.correctIndex ? 'Correct' : 'Incorrect'}</span>
                        </div>
                        <p className="text-white/60 text-sm leading-relaxed italic">{currentQuizQuestion.explanation}</p>
                        {currentQuizQuestion.example && (
                            <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                <span className="text-[9px] font-black text-blue-400/60 uppercase block mb-1.5 tracking-widest">Example Insight</span>
                                <p className="text-blue-100/60 text-[13px] leading-relaxed">{currentQuizQuestion.example}</p>
                            </div>
                        )}
                    </div>
                )}
                <button onClick={() => onSendMessage?.('/quit-quiz', [])} className="w-full py-3 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white transition-all rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/10">QUIT QUIZ</button>
              </div>
          )}

          {!currentQuizQuestion && <div className="whitespace-pre-wrap leading-relaxed text-[16px] md:text-[17px]">{message.text}</div>}

          {/* PPT Options Step */}
          {isModel && message.isPPTAction && (
            <div className="mt-6 flex flex-wrap gap-2.5">
               <button onClick={() => onSendMessage?.('/ppt-method generate', [])} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M5 5l7-3 7 3M5 19l7 3 7-3"/></svg>Generate</button>
               <button onClick={() => onSendMessage?.('/ppt-method paste', [])} className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 border border-white/5 active:scale-95 transition-all">Paste Text</button>
               <button onClick={() => onSendMessage?.('/ppt-method import', [])} className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 border border-white/5 active:scale-95 transition-all">Import PDF</button>
            </div>
          )}

          {/* Quiz Level Options Step */}
          {isModel && message.isQuizAction && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-2.5">
               {['Easy', 'Medium', 'Advanced'].map(lvl => (
                   <button key={lvl} onClick={() => onSendMessage?.(`/quiz-level ${lvl}`, [])} className={`px-5 py-4 ${lvl === 'Advanced' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10 border-white/5'} text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl border transition-all shadow-xl active:scale-95`}>
                       {lvl}
                   </button>
               ))}
            </div>
          )}

          {isModel && message.groundingUrls && (
            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                {message.groundingUrls.map((source, idx) => (
                  <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-medium text-blue-400 transition-all max-w-[200px]"><span className="truncate">{source.title}</span></a>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;