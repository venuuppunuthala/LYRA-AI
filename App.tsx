
import React, { useState, useEffect, useRef } from 'react';
import { ChatSession, Message, Attachment, GroundingSource, QuizState, PPTState, PPTData, QuizQuestion } from './types';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import LibraryView from './components/LibraryView';
import VoiceOverlay from './components/VoiceOverlay';
import CameraCapture from './components/CameraCapture';
import GoogleLoginModal from './components/GoogleLoginModal';
import { generateTextChat, generateImage } from './services/gemini';
import { GoogleGenAI, Type } from "@google/genai";

type AppView = 'chat' | 'library';
type LibraryTab = 'Images' | 'Pages' | 'PPT' | 'Quizzes';

interface UserProfile {
  name: string;
  email: string;
  photo: string;
}

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('chat');
  const [libraryInitialTab, setLibraryInitialTab] = useState<LibraryTab>('Pages');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [queuedInputText, setQueuedInputText] = useState<string | null>(null);
  const [queuedAttachments, setQueuedAttachments] = useState<Attachment[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [fullScreenPPT, setFullScreenPPT] = useState<{ data: PPTData; slideIndex: number } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
    
    if (sessions.length === 0) {
      const initialId = crypto.randomUUID();
      const initialSession: ChatSession = {
        id: initialId,
        title: 'New LYRA',
        messages: [],
        updatedAt: Date.now()
      };
      setSessions([initialSession]);
      setCurrentSessionId(initialId);
    }
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  useEffect(() => {
    if (activeSession?.isPPT && activeSession.messages.length === 0 && !isLoading) {
      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: "I'm ready to help you create a stunning presentation. What is the **topic** you'd like to present on?",
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
    }
    if (activeSession?.isQuiz && activeSession.messages.length === 0 && !isLoading) {
        const modelMessage: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          text: "Welcome to **Quiz Mode**! What topic would you like to be tested on today?",
          timestamp: Date.now()
        };
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
      }
  }, [activeSession?.id, activeSession?.isPPT, activeSession?.isQuiz]);

  const handleDeleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const newId = crypto.randomUUID();
        return [{ id: newId, title: 'New LYRA', messages: [], updatedAt: Date.now() }];
      }
      return filtered;
    });
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const startPPTGeneration = async (topic: string, slideCount: number, context: string = "") => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const promptText = `Generate a detailed presentation for the topic "${topic}" with exactly ${slideCount} slides.
        ${context ? `Analyze and use the following provided content to structure the slides: "${context.slice(0, 5000)}"` : "Use your internal high-quality knowledge base."}
        Each slide must have a title, layout type ('hero', 'split', 'grid', 'list', 'image-focus'), and points.
        Return ONLY valid JSON matching the PPTData schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              theme: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    layout: { type: Type.STRING, enum: ['hero', 'split', 'grid', 'list', 'image-focus'] },
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    content: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ['layout', 'title', 'content']
                }
              }
            }
          }
        }
      });

      const pptData: PPTData = JSON.parse(response.text);
      pptData.slides = pptData.slides.map(slide => ({
        ...slide,
        imageUrl: `https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=800&q=topic=${encodeURIComponent(topic + " " + slide.title)}`
      }));

      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `Presentation on **"${topic}"** generated successfully. Click the preview to view in full screen. You can also download it below.`,
        timestamp: Date.now(),
        pptData,
        attachments: [{ type: 'ppt', name: `${topic.slice(0, 15)}.pptx`, url: '#', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }]
      };

      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMessage], pptState: { ...s.pptState!, step: 'completed' } } : s));
    } catch (error: any) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'model', text: `Error: ${error.message}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const startQuizGeneration = async (topic: string, difficulty: string) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const prompt = `Generate 5 challenging MCQ questions for the topic "${topic}" with ${difficulty} difficulty level.
        Each question must have exactly 4 options, a correctIndex (0-3), a detailed simple explanation, and a relatable real-world example.
        Return ONLY valid JSON matching an array of QuizQuestion objects.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
                example: { type: Type.STRING }
              },
              required: ['question', 'options', 'correctIndex', 'explanation']
            }
          }
        }
      });

      const questions: QuizQuestion[] = JSON.parse(response.text);
      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `The ${difficulty} level quiz on **"${topic}"** is ready! Let's see what you know.`,
        timestamp: Date.now(),
        quizQuestions: questions
      };

      setSessions(prev => prev.map(s => s.id === currentSessionId ? { 
        ...s, 
        messages: [...s.messages, modelMessage],
        quizState: { ...s.quizState!, step: 'ongoing', difficulty: difficulty as any, currentQuestionIndex: 0, score: 0 }
      } : s));
    } catch (error: any) {
       const errMessage: Message = { id: crypto.randomUUID(), role: 'model', text: `Failed to start quiz: ${error.message}`, timestamp: Date.now() };
       setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, errMessage] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[], isMoreInfoRequest: boolean = false, options?: any) => {
    if (!user) {
      setIsLoginModalOpen(true);
      if (text) setQueuedInputText(text);
      if (attachments.length > 0) setQueuedAttachments(attachments);
      return;
    }
    
    if (!currentSessionId || (!text.trim() && attachments.length === 0)) return;

    // Handle Control Commands
    if (text === '/quit-quiz') {
        const score = activeSession.quizState?.score || 0;
        const modelMessage: Message = {
            id: crypto.randomUUID(),
            role: 'model',
            text: `Quiz terminated. You scored **${score}/5**. ${score >= 4 ? "Excellent effort!" : "Good try!"} What's next?`,
            timestamp: Date.now()
        };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMessage], isQuiz: false, quizState: undefined } : s));
        return;
    }

    if (text.startsWith('/ppt-method')) {
      const method = text.split(' ')[1] as 'generate' | 'paste' | 'import';
      const state = activeSession.pptState!;
      const newState: PPTState = { ...state, method };
      if (method === 'generate') {
        newState.step = 'generating';
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, pptState: newState } : s));
        startPPTGeneration(state.topic!, state.slideCount!);
      } else {
        newState.step = 'input';
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, pptState: newState } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Please ${method === 'paste' ? 'paste the text content' : 'import the PDF file'} you want me to use for the presentation.`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      }
      return;
    }

    if (text.startsWith('/quiz-level')) {
        const level = text.split(' ')[1];
        startQuizGeneration(activeSession.quizState?.topic || "General Knowledge", level);
        return;
    }

    if (text.startsWith('/quiz-answer')) {
        const [, isCorrect] = text.split(' ');
        const isActuallyCorrect = isCorrect === 'true';
        setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId && s.quizState) {
                const nextIdx = s.quizState.currentQuestionIndex + 1;
                const newScore = isActuallyCorrect ? s.quizState.score + 1 : s.quizState.score;
                if (nextIdx >= 5) {
                    const finalMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Quiz Complete! 🎉\nYour final score is **${newScore}/5**. Thanks for playing!`, timestamp: Date.now() };
                    return { ...s, messages: [...s.messages, finalMsg], quizState: { ...s.quizState, step: 'finished', score: newScore } as any };
                }
                return { ...s, quizState: { ...s.quizState, currentQuestionIndex: nextIdx, score: newScore } };
            }
            return s;
        }));
        return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text, attachments, timestamp: Date.now() };

    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now(), title: s.messages.length === 0 ? text.slice(0, 50) : s.title };
        }
        return s;
      });
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    // PPT State Machine
    if (activeSession?.isPPT && activeSession.pptState?.step !== 'completed') {
      const state = activeSession.pptState!;
      if (state.step === 'topic') {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, pptState: { ...state, step: 'slides', topic: text } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Got it: **"${text}"**. How many slides should I include?`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'slides') {
        const slideCount = parseInt(text.replace(/\D/g, '')) || 5;
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, pptState: { ...state, step: 'method', slideCount } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `I'll prepare a **${slideCount} slide** presentation. How would you like to provide the content?`, timestamp: Date.now(), isPPTAction: true };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'input') {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, pptState: { ...state, step: 'generating' } } : s));
        startPPTGeneration(state.topic!, state.slideCount!, text);
      }
      return;
    }

    // Quiz State Machine
    if (activeSession?.isQuiz && activeSession.quizState?.step === 'topic') {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, quizState: { ...s.quizState!, step: 'difficulty', topic: text } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Topic: **"${text}"**. Select your preferred difficulty level:`, timestamp: Date.now(), isQuizAction: true };
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
        return;
    }

    setIsLoading(true);
    try {
      let modelMessage: Message;
      if (options?.imageGen) {
        const imageUrl = await generateImage(text, options.size, options.aspectRatio);
        modelMessage = { id: crypto.randomUUID(), role: 'model', text: imageUrl ? "Synthesized image successfully." : "Failed to generate image.", attachments: imageUrl ? [{ type: 'image', url: imageUrl, mimeType: 'image/png' }] : [], timestamp: Date.now() };
      } else {
        const mapsKeywords = ['where', 'location', 'nearby', 'address', 'directions', 'place', 'restaurant', 'shop', 'near me'];
        const isMapsQuery = mapsKeywords.some(keyword => text.toLowerCase().includes(keyword));
        const history = activeSession.messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const response = await generateTextChat(text, history, attachments, undefined, isMapsQuery ? 'maps' : 'search');
        if (abortControllerRef.current?.signal.aborted) return;
        const groundingUrls: GroundingSource[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.web) groundingUrls.push({ title: chunk.web.title || 'Source', uri: chunk.web.uri });
            else if (chunk.maps) groundingUrls.push({ title: chunk.maps.title || 'Map Location', uri: chunk.maps.uri });
          });
        }
        modelMessage = { id: crypto.randomUUID(), role: 'model', text: response.text || "I've processed your request.", timestamp: Date.now(), groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined, hasMoreInfo: true };
      }
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMessage], updatedAt: Date.now() } : s));
    } catch (error: any) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'model', text: error.message || "An error occurred.", timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleLogin = (name: string, email: string, photo: string) => {
    setUser({ name, email, photo });
    setIsLoginModalOpen(false);
    if (queuedInputText || queuedAttachments.length > 0) {
      handleSendMessage(queuedInputText || "", queuedAttachments);
      setQueuedInputText(null);
      setQueuedAttachments([]);
    }
  };

  const handleDeleteImage = (sessionId: string, messageId: string, url: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: s.messages.map(m => {
            if (m.id === messageId) {
              return {
                ...m,
                attachments: m.attachments?.filter(a => a.url !== url)
              };
            }
            return m;
          })
        };
      }
      return s;
    }));
  };

  const createNewSession = (type: 'chat' | 'quiz' | 'ppt' = 'chat') => {
    const newSessionId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newSessionId,
      title: type === 'quiz' ? 'New Quiz' : type === 'ppt' ? 'New PPT' : 'New LYRA',
      messages: [],
      updatedAt: Date.now(),
      isQuiz: type === 'quiz',
      quizState: type === 'quiz' ? { step: 'topic', score: 0, currentQuestionIndex: 0 } : undefined,
      isPPT: type === 'ppt',
      pptState: type === 'ppt' ? { step: 'topic' } : undefined
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setCurrentView('chat');
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[#0a0c10] overflow-hidden font-sans text-slate-200">
      <div className={`fixed inset-y-0 left-0 z-40 w-80 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 lg:static lg:translate-x-0`}>
        <Sidebar sessions={sessions} activeSessionId={currentSessionId} onSelectSession={(id) => { setCurrentSessionId(id); setCurrentView('chat'); setIsSidebarOpen(false); }} onDeleteSession={handleDeleteSession} onRenameSession={handleRenameSession} onNewChat={createNewSession} onClose={() => setIsSidebarOpen(false)} onOpenLibrary={() => { setLibraryInitialTab('Images'); setCurrentView('library'); setIsSidebarOpen(false); }} />
      </div>

      <main className="flex-1 flex flex-col relative w-full overflow-hidden">
        {currentView === 'chat' ? (
          <ChatInterface 
            sessions={sessions}
            messages={activeSession?.messages || []} 
            sessionId={currentSessionId}
            onSendMessage={handleSendMessage}
            onMoreInfo={(p) => handleSendMessage(`Elaborate more on: ${p}`, [], true)}
            onStop={handleStop}
            isLoading={isLoading}
            onToggleVoice={() => setIsVoiceMode(true)}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onGoHome={() => createNewSession('chat')}
            onSelectSession={(id) => setCurrentSessionId(id)}
            onViewAllHistory={() => setIsSidebarOpen(true)}
            onStartQuiz={() => createNewSession('quiz')}
            onStartPPT={() => createNewSession('ppt')}
            onStartImageGen={() => {}} 
            onOpenCamera={() => setIsCameraMode(true)}
            onUploadAndAnalyze={() => createNewSession('chat')}
            initialInput={queuedInputText}
            onClearInitialInput={() => setQueuedInputText(null)}
            user={user}
            onLoginClick={() => setIsLoginModalOpen(true)}
            onLogout={() => setUser(null)}
            onPPTFullScreen={(data) => setFullScreenPPT({ data, slideIndex: 0 })}
          />
        ) : (
          // Fix: Added missing onSelectSession prop to LibraryView to allow switching sessions from library view
          <LibraryView 
            sessions={sessions} 
            initialTab={libraryInitialTab} 
            onBack={() => setCurrentView('chat')} 
            onDeleteImage={handleDeleteImage} 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
            onNewChat={() => createNewSession('chat')} 
            onSelectSession={(id) => { setCurrentSessionId(id); setCurrentView('chat'); }}
          />
        )}
        
        {fullScreenPPT && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-300">
             <header className="h-16 flex items-center justify-between px-6 bg-white/5 border-b border-white/10 backdrop-blur-md">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Presenter Mode</span>
                    <h2 className="text-sm font-bold text-white truncate max-w-[200px]">{fullScreenPPT.data.theme}</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setFullScreenPPT(null)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
             </header>

             <div className="flex-1 flex items-center justify-center p-4 md:p-10 relative group">
                {/* Navigation Arrows */}
                <button 
                  onClick={() => setFullScreenPPT({ ...fullScreenPPT, slideIndex: Math.max(0, fullScreenPPT.slideIndex - 1) })}
                  className="absolute left-4 md:left-8 z-10 w-12 h-12 md:w-16 md:h-16 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={fullScreenPPT.slideIndex === 0}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                <div className="w-full h-full max-w-6xl aspect-video bg-[#0f1118] border border-white/10 rounded-2xl md:rounded-[3rem] shadow-2xl overflow-hidden relative">
                    <div className="w-full h-full flex flex-col md:flex-row">
                        {(() => {
                           const slide = fullScreenPPT.data.slides[fullScreenPPT.slideIndex];
                           if (!slide) return null;
                           return (
                                <>
                                    <div className="flex-1 p-6 md:p-16 flex flex-col justify-center gap-4 md:gap-8 overflow-y-auto">
                                        <h2 className="text-3xl md:text-6xl font-black text-white leading-tight">{slide.title}</h2>
                                        {slide.subtitle && <p className="text-lg md:text-2xl text-white/50">{slide.subtitle}</p>}
                                        <div className="h-1 w-16 md:w-24 bg-blue-500 rounded-full" />
                                        <ul className="space-y-2 md:space-y-4">
                                            {slide.content.map((item, i) => (
                                                <li key={i} className="text-base md:text-xl text-white/70 flex gap-3">
                                                    <span className="text-blue-500 mt-1">▹</span> {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    {slide.imageUrl && (
                                        <div className="w-full md:w-1/2 h-40 md:h-auto relative shrink-0">
                                            <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1118] via-transparent md:bg-gradient-to-r md:from-[#0f1118] md:to-transparent" />
                                        </div>
                                    )}
                                </>
                           );
                        })()}
                    </div>
                </div>

                <button 
                  onClick={() => setFullScreenPPT({ ...fullScreenPPT, slideIndex: Math.min(fullScreenPPT.data.slides.length - 1, fullScreenPPT.slideIndex + 1) })}
                  className="absolute right-4 md:right-8 z-10 w-12 h-12 md:w-16 md:h-16 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={fullScreenPPT.slideIndex === fullScreenPPT.data.slides.length - 1}
                >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                </button>
             </div>

             <footer className="h-12 flex items-center justify-center bg-white/5 border-t border-white/10">
                <p className="text-white/40 font-bold uppercase text-[9px] tracking-widest">Slide {fullScreenPPT.slideIndex + 1} / {fullScreenPPT.data.slides.length}</p>
             </footer>
          </div>
        )}

        {isVoiceMode && <VoiceOverlay onClose={() => setIsVoiceMode(false)} />}
        {isCameraMode && <CameraCapture onCapture={() => createNewSession('chat')} onClose={() => setIsCameraMode(false)} />}
        <GoogleLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
      </main>
    </div>
  );
};

export default App;
