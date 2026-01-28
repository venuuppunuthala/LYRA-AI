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
  initialInput: string | null;
  onClearInitialInput: () => void;
  user: { name: string; email: string; photo: string } | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onPPTFullScreen: (data: PPTData) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  sessions, messages, sessionId, onSendMessage, onMoreInfo, onStop, isLoading, onToggleVoice, onToggleSidebar, onGoHome, onSelectSession, onViewAllHistory, onStartQuiz, onStartPPT, onStartImageGen, onOpenCamera, onUploadAndAnalyze, initialInput, onClearInitialInput, user, onLoginClick, onLogout, onPPTFullScreen
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
  const [isAnalyzeMode, setIsAnalyzeMode] = useState(false);
  const [isImageGenActive, setIsImageGenActive] = useState(false);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const startHeight = useRef<number>(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_HEIGHT = window.innerHeight * 0.95;
  const DEFAULT_OPEN_HEIGHT = 600;

  const loadingSteps = [
    "Analyzing context...",
    "Gathering source info...",
    "Drafting response...",
    "Finalizing visuals..."
  ];

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() && attachments.length === 0) return;
    if (isImageGenActive) {
      onSendMessage(inputText, attachments, false, { imageGen: true, size: imageSize, aspectRatio: aspectRatio });
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

  const handleQuickAction = (prompt: string) => onSendMessage(prompt, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const newAttachment: Attachment = {
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('audio/') ? 'audio' : 'file',
        url: URL.createObjectURL(file),
        mimeType: file.type,
        data: base64,
        name: file.name
      };
      if (isAnalyzeMode) {
        onUploadAndAnalyze(newAttachment);
        setIsAnalyzeMode(false);
      } else {
        setAttachments(prev => [...prev, newAttachment]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleBottomSheet = () => {
    if (isBottomSheetOpen) closeBottomSheet();
    else {
      setIsBottomSheetOpen(true);
      setSheetHeight(DEFAULT_OPEN_HEIGHT);
    }
  };

  const handleAction = (type: 'camera' | 'file' | 'image' | 'quiz' | 'ppt' | 'upload' | 'music') => {
    if (type === 'camera') onOpenCamera();
    else if (type === 'quiz') onStartQuiz();
    else if (type === 'ppt') onStartPPT();
    else if (type === 'image') { setIsImageGenActive(true); closeBottomSheet(); }
    else if (type === 'upload') { setIsAnalyzeMode(true); if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click(); } }
    else if (type === 'file') { setIsAnalyzeMode(false); if (fileInputRef.current) { fileInputRef.current.accept = '.pdf,.doc,.docx,.txt'; fileInputRef.current.click(); } }
    else if (type === 'music') { setIsAnalyzeMode(false); if (fileInputRef.current) { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); } }
    if (type !== 'image' && type !== 'upload') closeBottomSheet();
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartY.current = clientY;
    startHeight.current = sheetHeight;
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    const deltaY = dragStartY.current - clientY;
    const newHeight = Math.min(MAX_HEIGHT, Math.max(0, startHeight.current + deltaY));
    setSheetHeight(newHeight);
  }, [isDragging, MAX_HEIGHT]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (sheetHeight < 150) closeBottomSheet();
    else if (sheetHeight > DEFAULT_OPEN_HEIGHT + 100) setSheetHeight(MAX_HEIGHT);
    else setSheetHeight(DEFAULT_OPEN_HEIGHT);
  }, [isDragging, sheetHeight, MAX_HEIGHT]);

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
  const quickActions = [
    { label: 'Help me study', prompt: 'I need help studying. Can you help me create a study plan or summarize complex topics?' },
    { label: 'Get advice', prompt: 'I need some advice on a personal or professional situation. Can we discuss some options?' },
    { label: 'Make a plan', prompt: 'I want to make a plan for a new project. Can you help me break it down into actionable steps?' }
  ];

  const actions = [
    { type: 'camera', label: 'Camera', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
    { type: 'upload', label: 'Upload & Analyze', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> },
    { type: 'music', label: 'Audio', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
    { type: 'file', label: 'Document', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { type: 'image', label: 'Gen AI Image', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> },
    { type: 'ppt', label: 'PPT Gen', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>, color: 'text-orange-400' },
    { type: 'quiz', label: 'Quiz Mode', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
  ];

  const recentSessions = sessions.filter(s => s.messages.length > 0).slice(0, 4);

  const getSessionDisplayInfo = (s: ChatSession) => {
    if (s.isQuiz) return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Quiz' };
    if (s.isPPT) return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Presentation' };
    return { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, color: 'text-white/40', bg: 'bg-white/5', label: 'Chat' };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c10] relative overflow-hidden">
      {isHomePage && (
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c10]/40 via-[#0a0c10]/80 to-[#0a0c10]" />
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 h-24 flex items-center justify-between px-6 z-30 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button onClick={onToggleSidebar} className="p-2.5 text-white/80 hover:text-white transition-all bg-[#1a1c24] border border-white/5 rounded-2xl shadow-lg">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <button onClick={onGoHome} className="p-2.5 text-white/80 hover:text-white transition-all bg-[#1a1c24] border border-white/5 rounded-2xl shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
          {!isHomePage && (
            <button onClick={onGoHome} className="p-2.5 text-white/80 hover:text-white transition-all bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20" title="New Chat">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          )}
        </div>

        <div className="relative pointer-events-auto" ref={accountMenuRef}>
          {user ? (
            <button onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)} className="flex items-center gap-2 p-1 bg-[#1a1c24] border border-white/5 rounded-full shadow-lg transition-all active:scale-95 group">
              <div className="w-9 h-9 rounded-full border border-white/10 bg-[#334155] overflow-hidden">
                <img src={user.photo} className="w-full h-full object-cover" alt={user.name} />
              </div>
            </button>
          ) : (
            <button onClick={onLoginClick} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2 rounded-full shadow-md backdrop-blur-md transition-all active:scale-95 group border border-white/10">Sign in</button>
          )}
          {isAccountMenuOpen && user && (
             <div className="absolute top-14 right-0 w-[300px] bg-[#1a1c24] rounded-[2rem] border border-white/10 shadow-2xl z-50 p-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-[#0f1118] rounded-[1.5rem] p-6 mb-2">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-lg">
                      <img src={user.photo} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-white font-medium text-lg">Hi, {user.name}!</h4>
                      <p className="text-white/40 text-xs">{user.email}</p>
                    </div>
                  </div>
                </div>
                <button onClick={onLogout} className="w-full flex items-center justify-center p-4 hover:bg-white/5 rounded-2xl text-white/60 hover:text-white transition-colors">
                  <span className="text-sm font-bold uppercase tracking-widest">Sign out</span>
                </button>
             </div>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto z-10 flex flex-col items-center custom-scrollbar ${isHomePage ? 'justify-center' : ''}`}>
        {isHomePage ? (
          <div className="w-full max-w-5xl px-8 flex flex-col items-center animate-in fade-in duration-1000 text-center py-20">
             <div className="space-y-4 mb-12">
               <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">Hello, <span className="text-blue-500">I'm LYRA.</span></h1>
               <p className="text-xl md:text-2xl font-medium text-white/40 max-w-2xl mx-auto">How can I help you bring your ideas to life today?</p>
             </div>
             <div className="flex flex-wrap justify-center gap-4 mb-16">
              {quickActions.map((action, idx) => (
                <button key={idx} onClick={() => handleQuickAction(action.prompt)} className="px-8 py-3.5 bg-[#1a1c24] hover:bg-[#252832] text-white font-semibold rounded-[2rem] border border-white/5 shadow-xl transition-all active:scale-95">{action.label}</button>
              ))}
            </div>
            {isHistoryVisible && recentSessions.length > 0 && (
              <div className="w-full max-w-4xl text-left animate-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="flex items-center justify-between mb-6 px-4">
                  <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">JUMP BACK IN</h3>
                  <div className="flex items-center gap-4">
                    <button onClick={onViewAllHistory} className="text-[10px] font-bold text-blue-500/50 hover:text-blue-400 uppercase tracking-widest transition-colors">View All History</button>
                    <button onClick={() => setIsHistoryVisible(false)} className="p-1.5 text-white/20 hover:text-white transition-colors hover:bg-white/5 rounded-full"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                  {recentSessions.map(s => {
                    const info = getSessionDisplayInfo(s);
                    return (
                      <button key={s.id} onClick={() => onSelectSession(s.id)} className="group flex flex-col items-start gap-4 p-6 bg-[#1a1c24]/50 hover:bg-[#1a1c24] border border-white/5 rounded-[2.5rem] transition-all hover:scale-[1.02] text-left shadow-lg">
                        <div className={`w-10 h-10 rounded-2xl ${info.bg} ${info.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>{info.icon}</div>
                        <div className="space-y-1">
                          <h4 className="text-[15px] font-bold text-white/90 truncate w-full">{s.title}</h4>
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/20">{info.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full p-4 md:p-8 space-y-12 max-w-4xl mx-auto pt-24 pb-24">
            {messages.map((msg, idx) => (
              <MessageBubble 
                key={msg.id}
                message={msg} 
                onSendMessage={(t, a) => onSendMessage(t, a)}
                onMoreInfo={() => onMoreInfo?.(messages[idx-1]?.text || "")}
                activeSession={activeSession}
                onPPTFullScreen={onPPTFullScreen}
              />
            ))}
            {isLoading && (
              <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 px-6">
                <div className="w-10 h-10 rounded-xl bg-[#1a1c24] flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <div className="flex-1 space-y-3 pt-2">
                   <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">{loadingSteps[loadingStep]}</p>
                   <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 animate-progress-indeterminate" />
                   </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="px-6 py-8 w-full flex flex-col items-center bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/80 to-transparent z-20">
        <form onSubmit={handleSubmit} className="w-full max-w-4xl relative group">
          {attachments.length > 0 && (
            <div className="absolute bottom-full mb-4 left-6 flex flex-wrap gap-2">
              {attachments.map((at, idx) => (
                <div key={idx} className="relative group/att bg-[#1a1c24] rounded-2xl border border-white/5 p-1.5 shadow-xl">
                  {at.type === 'image' ? <img src={at.url} className="w-14 h-14 object-cover rounded-xl" /> : <div className="w-14 h-14 flex items-center justify-center text-[10px] font-bold uppercase">{at.mimeType.split('/')[1]}</div>}
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/att:opacity-100 transition-opacity shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative flex items-center bg-[#14161e] border rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-white/[0.03] p-2.5 px-6 focus-within:border-blue-500/40">
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button type="button" onClick={toggleBottomSheet} className="p-3.5 text-white/30 hover:text-white transition-all bg-white/5 rounded-full mr-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <textarea ref={textareaRef} rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder={activeSession?.isQuiz ? "Type topic or your answer..." : "Ask LYRA anything..."} className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-white/20 py-4 px-3 text-[17px] resize-none min-h-[60px] custom-scrollbar" />
            <div className="flex items-center gap-2">
              {isLoading ? (
                <button type="button" onClick={onStop} className="p-3.5 text-red-500 bg-red-500/5 rounded-full"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
              ) : (inputText.trim() === '' && attachments.length === 0) ? (
                <button type="button" onClick={onToggleVoice} className="p-3.5 text-white/30 hover:text-blue-400 transition-all bg-white/5 rounded-full"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></button>
              ) : (
                <button type="submit" disabled={isLoading} className="p-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/30"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
              )}
            </div>
          </div>
        </form>
      </div>

      {isBottomSheetOpen && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onClick={closeBottomSheet} />
          <div ref={sheetRef} className={`fixed bottom-0 left-0 right-0 z-[101] bg-[#14161e] border-t border-white/5 rounded-t-[3.5rem] shadow-2xl transition-transform duration-300 ease-out ${isDragging ? 'transition-none' : ''}`} style={{ height: `${sheetHeight}px`, transform: `translateY(${sheetHeight > 0 ? 0 : 100}%)` }}>
            <div className="w-full h-14 flex items-center justify-center cursor-ns-resize" onMouseDown={handleDragStart} onTouchStart={handleDragStart}><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
            <div className="px-10 pb-12 overflow-y-auto h-[calc(100%-56px)] no-scrollbar">
              <div className="flex items-center justify-between mb-10 px-4">
                <h2 className="text-white/40 text-[11px] font-black uppercase tracking-[0.4em]">Enhanced Actions</h2>
                <button onClick={closeBottomSheet} className="p-3 text-white/20 bg-white/5 rounded-full"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
                {actions.map((action) => (
                  <button key={action.type} onClick={() => handleAction(action.type as any)} className="flex flex-col items-center gap-5 p-8 bg-[#1a1c24]/40 hover:bg-[#1a1c24] border border-white/5 rounded-[3rem] transition-all group hover:scale-[1.05] shadow-xl">
                    <div className={`w-16 h-16 rounded-[1.5rem] bg-[#0d0e12] flex items-center justify-center group-hover:bg-blue-600/10 ${action.color || 'text-white/40 group-hover:text-blue-400'}`}>{action.icon}</div>
                    <span className="text-[11px] font-black text-white/30 group-hover:text-white uppercase tracking-[0.2em]">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-indeterminate { 0% { transform: translateX(-100%) scaleX(0.2); } 50% { transform: translateX(0%) scaleX(0.5); } 100% { transform: translateX(100%) scaleX(0.2); } }
        .animate-progress-indeterminate { animation: progress-indeterminate 1.5s infinite linear; transform-origin: 0% 50%; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default ChatInterface;