
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Attachment, ChatSession, PPTData } from '../types';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  sessions: ChatSession[];
  messages: Message[];
  sessionId: string | null;
  onSendMessage: (text: string, attachments: Attachment[], moreInfo?: boolean, options?: any) => void;
  onMoreInfo?: (originalPrompt: string) => void;
  onStop?: () => void;
  isLoading: boolean;
  onToggleVoice: () => void;
  onToggleSidebar: () => void;
  onGoHome: () => void;
  onSelectSession: (id: string) => void;
  onViewAllHistory: () => void;
  onStartQuiz: () => void;
  onStartPPT: () => void;
  onStartImageGen: () => void;
  onOpenCamera: () => void;
  onUploadAndAnalyze: (attachment: Attachment) => void;
  onStartNewChatWithPrompt: (prompt: string) => void;
  onDeleteSession: (id: string) => void;
  onHideOnHome: (id: string) => void;
  initialInput: string | null;
  onClearInitialInput: () => void;
  user: { name: string; email: string; photo: string } | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onPPTFullScreen: (data: PPTData) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  sessions, messages, sessionId, onSendMessage, onMoreInfo, onStop, isLoading, onToggleVoice, onToggleSidebar, onGoHome, onSelectSession, onViewAllHistory, onStartQuiz, onStartPPT, onStartImageGen, onOpenCamera, onUploadAndAnalyze, onStartNewChatWithPrompt, onDeleteSession, onHideOnHome, initialInput, onClearInitialInput, user, onLoginClick, onLogout, onPPTFullScreen
}) => {
  const activeSession = sessions.find(s => s.id === sessionId);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [isImageGenActive, setIsImageGenActive] = useState(false);
  const [imageSize, setImageSize] = useState<'512px' | '1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '1:4' | '1:8' | '4:1' | '8:1'>('1:1');
  const [imageQuality, setImageQuality] = useState<'standard' | 'high' | 'pro' | 'nano-banana'>('standard');
  const [useSearch, setUseSearch] = useState(false);
  const [isSTTActive, setIsSTTActive] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const isRecognitionStarting = useRef(false);

  const MAX_HEIGHT = window.innerHeight * 0.95;
  const DEFAULT_OPEN_HEIGHT = Math.min(640, window.innerHeight * 0.85);

  const loadingSteps = ["Analyzing context...", "Gathering source info...", "Drafting response...", "Finalizing visuals..."];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (initialInput) {
      setInputText(initialInput);
      onClearInitialInput();
    }
  }, [initialInput, onClearInitialInput, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeSession?.quizState?.currentQuestionIndex]);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountMenuOpen]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsSTTActive(true);
        isRecognitionStarting.current = false;
      };
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) setInputText(prev => (prev.endsWith(' ') || prev === '' ? prev + finalTranscript : prev + ' ' + finalTranscript));
      };
      
      recognition.onend = () => {
        setIsSTTActive(false);
        isRecognitionStarting.current = false;
      };
      
      recognition.onerror = (event: any) => {
        console.warn("Speech Recognition Error", event.error);
        setIsSTTActive(false);
        isRecognitionStarting.current = false;
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleSTT = () => {
    if (!recognitionRef.current) return;
    
    if (isSTTActive) {
      recognitionRef.current.stop();
    } else {
      if (isRecognitionStarting.current) return;
      try {
        isRecognitionStarting.current = true;
        recognitionRef.current.start();
      } catch (err: any) {
        isRecognitionStarting.current = false;
        if (err.name === 'InvalidStateError') {
          console.warn("Recognition already started, syncing state.");
          setIsSTTActive(true);
        } else {
          console.error("Speech recognition start failed:", err);
        }
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() && attachments.length === 0) return;
    if (isSTTActive) { recognitionRef.current?.stop(); setIsSTTActive(false); }
    if (isImageGenActive) {
      onSendMessage(inputText, attachments, false, { imageGen: true, size: imageSize, aspectRatio: aspectRatio, quality: imageQuality, useSearch: useSearch });
      setIsImageGenActive(false);
    } else {
      onSendMessage(inputText, attachments);
    }
    setInputText('');
    setAttachments([]);
    closeBottomSheet();
  };

  const closeBottomSheet = () => {
    setSheetHeight(0);
    setTimeout(() => setIsBottomSheetOpen(false), 300);
  };

  const toggleBottomSheet = () => {
    if (isBottomSheetOpen) closeBottomSheet();
    else {
      setIsBottomSheetOpen(true);
      setSheetHeight(DEFAULT_OPEN_HEIGHT);
    }
  };

  const handleAction = (type: string) => {
    if (type === 'camera') onOpenCamera();
    else if (type === 'quiz') onStartQuiz();
    else if (type === 'ppt') onStartPPT();
    else if (type === 'image') { setIsImageGenActive(true); closeBottomSheet(); }
    else if (fileInputRef.current) {
      if (type === 'upload') fileInputRef.current.accept = 'image/*';
      else if (type === 'file') fileInputRef.current.accept = '.pdf,.doc,.docx,.txt';
      else if (type === 'music') fileInputRef.current.accept = 'audio/*';
      fileInputRef.current.click();
    }
    if (!['image', 'upload', 'file', 'music'].includes(type)) closeBottomSheet();
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startHeight.current = sheetHeight;
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const deltaY = dragStartY.current - clientY;
    setSheetHeight(Math.min(MAX_HEIGHT, Math.max(0, startHeight.current + deltaY)));
  }, [isDragging, MAX_HEIGHT]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (sheetHeight < 150) closeBottomSheet();
    else setSheetHeight(sheetHeight > DEFAULT_OPEN_HEIGHT + 100 ? MAX_HEIGHT : DEFAULT_OPEN_HEIGHT);
  }, [isDragging, sheetHeight, MAX_HEIGHT, DEFAULT_OPEN_HEIGHT]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const isHomePage = messages.length === 0;
  const recentSessions = sessions.filter(s => s.messages.length > 0 && !s.isHiddenOnHome).slice(0, 4);

  const getSessionDisplayInfo = (s: ChatSession) => {
    if (s.isQuiz) return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Quiz' };
    if (s.isPPT) return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Presentation' };
    return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, color: 'text-white/40', bg: 'bg-white/5', label: 'Chat' };
  };

  return (
    <div className="flex-1 flex-col h-full bg-[#0a0c10] relative overflow-hidden safe-area-inset flex">
      {isHomePage && (
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10]/60 via-[#0a0c10]/90 to-[#0a0c10]" />
        </div>
      )}

      {/* Header Bar */}
      <header className="absolute top-0 left-0 right-0 h-20 sm:h-24 flex items-center justify-between px-4 sm:px-6 z-30 pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button onClick={onToggleSidebar} className="p-3 text-white/80 hover:text-white transition-all bg-[#1a1c24]/90 backdrop-blur border border-white/10 rounded-2xl shadow-xl active:scale-90" aria-label="Toggle Navigation">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button onClick={onGoHome} className="p-3 text-white/80 hover:text-white transition-all bg-[#1a1c24]/90 backdrop-blur border border-white/10 rounded-2xl shadow-xl active:scale-90" aria-label="Go Home">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
          {!isHomePage && (
            <button onClick={onGoHome} className="p-3 text-white transition-all bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-90" title="New Chat" aria-label="New Chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          )}
        </div>

        <div className="relative pointer-events-auto" ref={accountMenuRef}>
          {user ? (
            <button onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)} className="p-0.5 bg-[#1a1c24] border border-white/10 rounded-full shadow-xl transition-all active:scale-90" aria-label="Account Settings">
              <div className="w-10 h-10 rounded-full bg-[#334155] overflow-hidden"><img src={user.photo} className="w-full h-full object-cover" alt={user.name} /></div>
            </button>
          ) : (
            <button onClick={onLoginClick} className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-full shadow-xl backdrop-blur-lg transition-all active:scale-95 border border-white/10 text-sm tracking-wide">Sign in</button>
          )}
          {isAccountMenuOpen && user && (
             <div className="absolute top-14 right-0 w-72 sm:w-[320px] bg-[#1a1c24] rounded-[2rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-[#0f1118] rounded-[1.5rem] p-5 mb-2 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-lg"><img src={user.photo} className="w-full h-full object-cover" alt="" /></div>
                    <div className="text-center"><h4 className="text-white font-bold text-lg">Hi, {user.name}!</h4><p className="text-white/40 text-xs truncate max-w-[200px]">{user.email}</p></div>
                </div>
                <button onClick={onLogout} className="w-full flex items-center justify-center p-4 hover:bg-white/5 rounded-2xl text-white/40 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-colors">Sign out</button>
             </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto z-10 flex flex-col items-center custom-scrollbar ${isHomePage ? 'justify-center' : ''}`} role="log" aria-live="polite">
        {isHomePage ? (
          <div className="w-full max-w-5xl px-6 flex flex-col items-center animate-in fade-in duration-1000 text-center py-20">
             <div className="space-y-4 mb-10 sm:mb-12">
               <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white">Hello, <span className="text-blue-500">I'm LYRA.</span></h1>
               <p className="text-lg sm:text-xl md:text-2xl font-medium text-white/30 max-w-2xl mx-auto">How can I help you bring your ideas to life today?</p>
             </div>
             
             <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-12 sm:mb-16">
              {['Help me study', 'Get advice', 'Make a plan'].map((label, idx) => (
                <button key={idx} onClick={() => onStartNewChatWithPrompt(`I need assistance with: ${label.toLowerCase()}`)} className="px-6 sm:px-8 py-3.5 bg-[#1a1c24]/80 backdrop-blur hover:bg-[#252832] text-white font-bold rounded-2xl border border-white/5 shadow-xl transition-all active:scale-95 text-sm sm:text-base">{label}</button>
              ))}
            </div>

            {isHistoryVisible && recentSessions.length > 0 && (
              <div className="w-full max-w-4xl text-left animate-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="flex items-center justify-between mb-6 px-4">
                  <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">RESUME RECENT</h3>
                  <button onClick={onViewAllHistory} className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">History</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 px-2">
                  {recentSessions.map(s => {
                    const info = getSessionDisplayInfo(s);
                    return (
                      <div key={s.id} className="group relative">
                        <button onClick={() => onSelectSession(s.id)} className="w-full flex flex-col items-start gap-4 p-5 sm:p-6 bg-[#1a1c24]/60 backdrop-blur border border-white/10 rounded-[2rem] transition-all hover:bg-[#1a1c24] hover:scale-[1.02] active:scale-95 text-left shadow-lg">
                          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${info.bg} ${info.color} flex items-center justify-center shrink-0`}>{info.icon}</div>
                          <div className="space-y-1 w-full overflow-hidden">
                            <h4 className="text-[14px] sm:text-[15px] font-bold text-white/90 truncate">{s.title}</h4>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">{info.label}</span>
                          </div>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onHideOnHome(s.id); }}
                          className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg active:scale-75 z-10"
                          aria-label="Remove Session from Home"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full p-4 sm:p-6 md:p-8 space-y-10 sm:space-y-12 max-w-4xl mx-auto pt-24 pb-24">
            {messages.map((msg, idx) => (
              <MessageBubble 
                key={msg.id}
                message={msg} 
                onSendMessage={onSendMessage}
                onMoreInfo={() => onMoreInfo?.(messages[idx-1]?.text || "")}
                activeSession={activeSession}
                onPPTFullScreen={onPPTFullScreen}
              />
            ))}
            {isLoading && (
              <div className="flex gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 px-4 sm:px-6 w-full max-w-2xl">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1a1c24] flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <div className="flex-1 space-y-3 pt-2">
                   <div className="flex items-center justify-between gap-4">
                     <p className="text-blue-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em]">{loadingSteps[loadingStep]}</p>
                     <button 
                       onClick={onStop} 
                       className="text-[8px] sm:text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-all active:scale-90 flex items-center gap-1.5"
                     >
                       <div className="w-1.5 h-1.5 bg-red-500 rounded-sm" />
                       Cancel
                     </button>
                   </div>
                   <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-progress-indeterminate" /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        {isLoading && isHomePage && (
          <div className="w-full max-w-4xl px-4 sm:px-6 mb-8 animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-[#1a1c24]/80 backdrop-blur border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                   <p className="text-blue-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em]">{loadingSteps[loadingStep]}</p>
                   <button 
                     onClick={onStop} 
                     className="text-[8px] sm:text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-all active:scale-90 flex items-center gap-1.5"
                   >
                     <div className="w-1.5 h-1.5 bg-red-500 rounded-sm" />
                     Cancel
                   </button>
                </div>
                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-progress-indeterminate" /></div>
             </div>
          </div>
        )}
      </div>

      {/* Input Form Bar */}
      <div className="px-4 sm:px-6 pb-6 sm:pb-8 pt-4 w-full flex flex-col items-center bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/95 to-transparent z-20">
        <form onSubmit={handleSubmit} className="w-full max-w-4xl flex items-end gap-2 sm:gap-4">
          <div className="flex-1 relative">
            {attachments.length > 0 && (
              <div className="absolute bottom-full mb-4 left-4 sm:left-6 flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
                {attachments.map((at, idx) => (
                  <div key={idx} className="relative group/att bg-[#1a1c24] rounded-xl border border-white/10 p-1 shadow-2xl">
                    {at.type === 'image' ? <img src={at.url} className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-lg" alt="" /> : <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-[8px] font-bold uppercase overflow-hidden px-1">{at.mimeType.split('/')[1] || 'FILE'}</div>}
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg active:scale-75"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                ))}
              </div>
            )}
            
            {isImageGenActive && (
               <div className="absolute bottom-full mb-4 left-0 right-0 bg-[#14161e] border border-blue-500/30 rounded-[2rem] p-4 flex flex-col gap-4 shadow-3xl animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between px-2">
                     <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Synthesis Engine</span>
                     <button type="button" onClick={() => setIsImageGenActive(false)} className="p-1 text-white/30 hover:text-white transition-colors active:scale-90"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                  <div className="flex flex-col gap-4">
                     <div className="bg-white/5 rounded-2xl p-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {(['standard', 'high', 'pro', 'nano-banana'] as const).map(q => (
                           <button key={q} type="button" onClick={() => setImageQuality(q)} className={`flex-1 min-w-[80px] py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${imageQuality === q ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:bg-white/5'}`}>{q.replace('-', ' ')}</button>
                        ))}
                     </div>
                     <div className="bg-white/5 rounded-2xl p-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {(['512px', '1K', '2K', '4K'] as const).map(res => (
                           <button key={res} type="button" onClick={() => setImageSize(res)} className={`flex-1 min-w-[60px] py-2 rounded-xl text-[10px] font-black transition-all ${imageSize === res ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white/40 hover:bg-white/5'}`}>{res}</button>
                        ))}
                     </div>
                     <div className="bg-white/5 rounded-2xl p-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {(['1:1', '16:9', '9:16', '3:4', '4:3', '1:4', '1:8', '4:1', '8:1'] as const).map(ratio => (
                           <button key={ratio} type="button" onClick={() => setAspectRatio(ratio as any)} className={`flex-1 min-w-[50px] py-2 rounded-xl text-[10px] font-black transition-all ${aspectRatio === ratio ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white/40 hover:bg-white/5'}`}>{ratio}</button>
                        ))}
                     </div>
                     <div className="flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${useSearch ? 'bg-blue-500 animate-pulse' : 'bg-white/10'}`} />
                           <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Search Grounding</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setUseSearch(!useSearch)}
                          className={`w-10 h-5 rounded-full transition-all relative ${useSearch ? 'bg-blue-600' : 'bg-white/10'}`}
                        >
                           <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${useSearch ? 'left-6' : 'left-1'}`} />
                        </button>
                     </div>
                  </div>
               </div>
            )}

            <div className="relative flex items-center bg-[#14161e] border rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border-white/[0.05] p-1.5 sm:p-2 px-3 sm:px-6 focus-within:border-blue-500/50 transition-all">
              <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64 = (ev.target?.result as string).split(',')[1];
                    const isAudio = file.type.startsWith('audio/');
                    const isImage = file.type.startsWith('image/');
                    onUploadAndAnalyze({ 
                      type: isAudio ? 'audio' : (isImage ? 'image' : 'file'), 
                      url: URL.createObjectURL(file), 
                      mimeType: file.type, 
                      data: base64, 
                      name: file.name 
                    });
                  };
                  reader.readAsDataURL(file);
                }
                e.target.value = '';
              }} />
              
              <button type="button" onClick={toggleBottomSheet} className="p-3 sm:p-3.5 text-white/40 hover:text-white transition-all bg-white/5 rounded-full mr-1 sm:mr-2 active:scale-90" aria-label="Open actions menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
              </button>

              <textarea 
                ref={textareaRef} 
                rows={1} 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSubmit(); } }} 
                placeholder={isImageGenActive ? "Synthesis description..." : "Message LYRA..."} 
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-white/20 py-3 sm:py-4 px-2 sm:px-3 text-[16px] sm:text-[17px] resize-none min-h-[50px] sm:min-h-[60px] max-h-[150px] custom-scrollbar"
                aria-label="Message text"
              />

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={toggleSTT} className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${isSTTActive ? 'bg-red-500 text-white animate-pulse' : 'text-white/40 hover:text-white bg-white/5'}`} aria-label="Speech to text">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                </button>
                {isLoading ? (
                  <button type="button" onClick={onStop} className="p-3 sm:p-3.5 text-red-500 bg-red-500/10 rounded-full active:scale-90" aria-label="Stop generating"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
                ) : (inputText.trim() !== '' || attachments.length > 0) ? (
                  <button type="submit" className={`p-3 sm:p-3.5 rounded-full text-white shadow-xl active:scale-90 transition-all ${isImageGenActive ? 'bg-purple-600 shadow-purple-500/30' : 'bg-blue-600 shadow-blue-500/30'}`} aria-label="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          
          <button type="button" onClick={onToggleVoice} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-2xl shadow-blue-500/20 flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all group shrink-0 border border-white/10" aria-label="Open voice mode">
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest hidden sm:block">LYRA</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
        </form>
      </div>

      {/* Responsive Actions Bottom Sheet */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={closeBottomSheet} aria-hidden="true" />
          <div 
            ref={sheetRef} 
            className={`relative w-full max-w-4xl bg-[#14161e] border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl transition-transform duration-300 ease-out overflow-hidden ${isDragging ? 'transition-none' : ''}`} 
            style={{ height: window.innerWidth > 640 ? 'auto' : `${sheetHeight}px` }}
            role="dialog"
            aria-label="Actions menu"
          >
            <div className="w-full h-12 flex items-center justify-center cursor-ns-resize sm:hidden" onMouseDown={handleDragStart} onTouchStart={handleDragStart}><div className="w-12 h-1 bg-white/10 rounded-full" /></div>
            <div className="px-6 sm:px-10 pb-10 sm:pb-12 pt-2 sm:pt-10 overflow-y-auto max-h-[85vh] sm:max-h-none no-scrollbar">
              <div className="flex items-center justify-between mb-8 sm:mb-10 px-2 sm:px-4">
                <h2 className="text-white/40 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.4em]">Core Synthesis</h2>
                <button onClick={closeBottomSheet} className="p-3 text-white/20 bg-white/5 rounded-full hover:bg-white/10 transition-all active:scale-90"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-8">
                {[
                  { id: 'camera', label: 'Scanner', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
                  { id: 'upload', label: 'Images', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> },
                  { id: 'file', label: 'Docs', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg> },
                  { id: 'music', label: 'Audio', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
                  { id: 'image', label: 'Generator', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg> },
                  { id: 'ppt', label: 'Elite PPT', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>, color: 'text-orange-400' },
                  { id: 'quiz', label: 'Quiz Cycle', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, color: 'text-blue-400' },
                ].map((action) => (
                  <button key={action.id} onClick={() => handleAction(action.id)} className="flex flex-col items-center gap-4 p-6 sm:p-8 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-[2rem] sm:rounded-[3rem] transition-all group active:scale-95 shadow-xl">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0d0e12] flex items-center justify-center group-hover:scale-110 transition-transform ${action.color || 'text-white/40 group-hover:text-blue-400'}`}>{action.icon}</div>
                    <span className="text-[9px] sm:text-[10px] font-black text-white/30 group-hover:text-white uppercase tracking-[0.2em]">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-indeterminate { 0% { transform: translateX(-100%) scaleX(0.2); } 50% { transform: translateX(0%) scaleX(0.5); } 100% { transform: translateX(100%) scaleX(0.2); } }
        .animate-progress-indeterminate { animation: progress-indeterminate 1.5s infinite linear; transform-origin: 0% 50%; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .safe-area-inset { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
      `}} />
    </div>
  );
};

export default ChatInterface;
