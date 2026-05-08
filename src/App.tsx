
import React, { useState, useEffect, useRef } from 'react';
import { ChatSession, Message, Attachment, GroundingSource, QuizState, PPTState, PPTData, QuizQuestion, ScanAnalysis } from './types';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import LibraryView from './components/LibraryView';
import VoiceOverlay from './components/VoiceOverlay';
import CameraCapture from './components/CameraCapture';
import GoogleLoginModal from './components/GoogleLoginModal';
import { generateTextChat, generateImage, getAI, cleanJsonString, getApiKey } from './services/gemini';
import { generatePptxFile, generatePPTData, generateQuizData, generateQuizSummary, generateScanAnalysis } from './services/generation';
import { Type, ThinkingLevel } from "@google/genai";
import { safeSaveToLocalStorage, safeLoadFromLocalStorage } from './services/storage';

type AppView = 'chat' | 'library';
type LibraryTab = 'Images' | 'Pages' | 'PPT' | 'Quizzes';

interface UserProfile {
  name: string;
  email: string;
  photo: string;
}

const STORAGE_KEY = 'lyra_ai_sessions_v14';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // fallback
    }
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('chat');
  const [libraryInitialTab, setLibraryInitialTab] = useState<LibraryTab>('Images');
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
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

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const parsed = safeLoadFromLocalStorage(STORAGE_KEY);
    if (parsed) {
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSessions(parsed);
        setCurrentSessionId(parsed[0].id);
      }
    }
    
    const checkKey = async () => {
      try {
        const studio = (window as any).aistudio;
        if (studio && typeof studio.hasSelectedApiKey === 'function') {
          const selected = await studio.hasSelectedApiKey();
          setHasApiKey(selected === true);
        } else {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("API Key check failed", e);
        setHasApiKey(true); 
      }
    };
    checkKey();
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    if (isInitialMount.current) return;
    safeSaveToLocalStorage(STORAGE_KEY, sessions);
    
    // Cleanup empty legacy sessions
    const hasEmpty = sessions.some(s => s.messages.length === 0 && !s.isPPT && !s.isQuiz);
    if (hasEmpty) {
       setSessions(prev => prev.filter(s => s.messages.length > 0 || s.isPPT || s.isQuiz));
    }
  }, [sessions, isLoading]);

  const handleSelectApiKey = async () => {
    const studio = (window as any).aistudio;
    if (studio && typeof studio.openSelectKey === 'function') {
      try {
        await studio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Failed to open API key selector", e);
      }
    }
  };

  const activeSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    if (activeSession?.isPPT && activeSession?.messages?.length === 0 && !isLoading) {
      const modelMessage: Message = {
        id: generateUUID(),
        role: 'model',
        text: "LYRA PPT Intelligence initialized. I am ready to architect your premium multimodal deck. Please define the **Topic** to begin.",
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
    }
    if (activeSession?.isQuiz && activeSession?.messages?.length === 0 && !isLoading) {
      const modelMessage: Message = {
        id: generateUUID(),
        role: 'model',
        text: "Academic Calibration initialized. To begin the assessment, please define the **Topic** you'd like to be quizzed on.",
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
    }
  }, [activeSession?.id, activeSession?.isPPT, activeSession?.isQuiz, sessions.length]);

  const startPPTGeneration = async (topic: string, slideCount: number, context: string = "", attachments: Attachment[] = []) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    try {
      if (!hasApiKey) await handleSelectApiKey();
      
      if (signal.aborted) throw new Error("AbortError");
      
      // Synthesize high-fidelity visuals using LYRA architecture
      const themeImageUrl = await generateImage(
        `LYRA Ultra-Pro: Hyper-realistic cinematic professional cover slide for a presentation titled "${topic}", futuristic minimal design, 8k resolution, elegant lighting`, 
        '2K', '16:9', 'pro', false, signal
      );
      
      if (signal.aborted) throw new Error("AbortError");

      const apiKey = getApiKey();
      const pptData = await generatePPTData(topic, slideCount, context, attachments, apiKey, signal);
      
      if (signal.aborted) throw new Error("AbortError");

      // Secondary synthesis phase: Generate slide-specific LYRA visuals
      const slidesWithVisuals = await Promise.all(pptData.slides.map(async (slide: any, idx: number) => {
        if (signal.aborted) return slide;
        if (idx === 0) return { ...slide, imageUrl: themeImageUrl };
        
        // Only generate for the first few slides to manage latency, or if prompt is high quality
        if (idx < 3 && slide.imagePrompt) {
          try {
            const slideImg = await generateImage(
              `LYRA Visual: ${slide.imagePrompt}, professional presentation style, high quality`, 
              '1K', '16:9', 'high', false, signal
            );
            return { ...slide, imageUrl: slideImg };
          } catch (e) {
            console.warn(`LYRA visual synthesis failed for slide ${idx}`, e);
          }
        }
        
        return { 
          ...slide, 
          imageUrl: slide.imageUrl || `https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1200` 
        };
      }));

      if (signal.aborted) throw new Error("AbortError");

      pptData.slides = slidesWithVisuals;
      const pptxUrl = await generatePptxFile(pptData);
      const modelMessage: Message = {
        id: generateUUID(),
        role: 'model',
        text: `LYRA Synthesis complete for **"${topic}"**. Your high-impact **${slideCount}**-slide deck has been architected with sub-pixel multimodal precision.`,
        timestamp: Date.now(),
        pptData,
        attachments: [{ 
          type: 'ppt', 
          name: `${topic.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}.pptx`, 
          url: pptxUrl, 
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
        }]
      };
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, modelMessage], pptState: { ...s.pptState!, step: 'completed' } } : s));
    } catch (error: any) {
      if (error.message === 'KEY_RESET_REQUIRED' || error.status === 403) {
        setHasApiKey(false);
        handleSelectApiKey().catch(err => console.error("Key Selector Error", err));
        return;
      }
      const errorMessage = error.message || "An initialization sequence failed. System recovery recommended.";
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: generateUUID(), role: 'model', text: `**System Advisory:** ${errorMessage}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const startQuizGeneration = async (topic: string, difficulty: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setIsLoading(true);
    const sessId = currentSessionId;
    const activeSession = sessions.find(s => s.id === sessId);
    
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("KEY_RESET_REQUIRED");

      const questions = await generateQuizData(
        topic, 
        difficulty, 
        activeSession?.attachments || [], 
        apiKey, 
        signal
      );
      
      const modelMessage: Message = {
        id: generateUUID(),
        role: 'model',
        text: `Technical assessment for **"${topic}"** at **${difficulty}** level is synthesized. ${activeSession?.attachments?.length ? "Analysis based on provided source data." : ""} Let's begin.`,
        timestamp: Date.now(),
        quizQuestions: questions
      };
      setSessions(prev => prev.map(s => s.id === sessId ? { 
        ...s, 
        messages: [...s.messages, modelMessage],
        quizState: { ...s.quizState!, step: 'ongoing', difficulty: difficulty as any, currentQuestionIndex: 0, score: 0 }
      } : s));
    } catch (error: any) {
      if (error.message === 'AbortError') {
        console.log("Quiz synthesis sequence terminated by system.");
        return;
      }
      if (error.message === 'KEY_RESET_REQUIRED' || error.status === 403) {
        setHasApiKey(false);
        handleSelectApiKey().catch(err => console.error("Key Selector Error", err));
        return;
      }
      const errorMessage = error.message || "Synthesis failed. Please verify topic parameters.";
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: generateUUID(), role: 'model', text: `**Synthesis Interrupted:** ${errorMessage}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const startScanAnalysis = async (base64: string, sessionId: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("KEY_RESET_REQUIRED");

      const analysis = await generateScanAnalysis(base64, apiKey, signal);
      
      const modelMessage: Message = {
        id: generateUUID(),
        role: 'model',
        text: `## **Optical Synthesis Complete**\n\n**Category:** ${analysis.category.replace('_', ' ').toUpperCase()}\n\n**Summary:** ${analysis.summary}\n\n### **Extracted Intelligence**\n${Object.entries(analysis.extractedData).map(([k, v]) => `* **${k}:** ${v}`).join('\n')}\n\nShall I perform any follow-up operations?`,
        timestamp: Date.now(),
        scanAnalysis: analysis,
        isScanAction: true
      };

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        title: `Scan: ${analysis.title}`,
        messages: [...s.messages, modelMessage]
      } : s));
    } catch (error: any) {
      if (error.message === 'AbortError') return;
      console.error("Scan Synthesis Error", error);
      const errorMessage = error.message || "Optical capture failed to reach synergy.";
      const errorMsg: Message = { id: generateUUID(), role: 'model', text: `**System Advisory:** ${errorMessage}`, timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleHideSessionFromHome = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isHiddenOnHome: true } : s));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (text: string, attachments: Attachment[], isMoreInfoRequest: boolean = false, options?: any, targetSessionId?: string) => {
    let sessId = targetSessionId || currentSessionId;
    
    if (!sessId && (text.trim() || attachments.length > 0)) {
       const newSessionId = generateUUID();
       const newSession: ChatSession = {
           id: newSessionId,
           title: text.slice(0, 50) || 'New Session',
           messages: [],
           updatedAt: Date.now(),
           attachments: []
       };
       setSessions(prev => [newSession, ...prev]);
       setCurrentSessionId(newSessionId);
       sessId = newSessionId;
    }

    if (!user) {
      setIsLoginModalOpen(true);
      if (text) setQueuedInputText(text);
      if (attachments.length > 0) setQueuedAttachments(attachments);
      return;
    }
    if (!sessId || (!text.trim() && attachments.length === 0)) return;

    if (text === '/quit-quiz') {
        const score = activeSession?.quizState?.score || 0;
        const msgText = score >= 4 ? `Cycle complete. Exceptional proficiency achieved: **${score}/5**. Mastery validated.` : `Assessment cycle ended. Final calibration: **${score}/5**. Returning to core logic.`;
        const modelMessage: Message = { id: generateUUID(), role: 'model', text: msgText, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMessage], isQuiz: false, quizState: undefined } : s));
        return;
    }

    if (text === '/ppt-cancel') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, isPPT: false, pptState: undefined, messages: [...s.messages, { id: generateUUID(), role: 'model', text: "PPT synthesis sequence terminated. Returning to core chat logic.", timestamp: Date.now() }] } : s));
        return;
    }

    if (text === '/quiz-cancel') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, isQuiz: false, quizState: undefined, messages: [...s.messages, { id: generateUUID(), role: 'model', text: "Quiz calibration sequence terminated.", timestamp: Date.now() }] } : s));
        return;
    }

    if (text === '/doc-cancel' || text === '/image-cancel' || text === '/scan-cancel') {
        setSessions(prev => prev.map(s => {
            if (s.id === sessId) {
                const lastMsg = s.messages[s.messages.length - 1];
                if (lastMsg) {
                    const updatedMsg = { ...lastMsg, isDocAction: false, isImageAction: false, isScanAction: false };
                    return { ...s, messages: [...s.messages.slice(0, -1), updatedMsg, { id: generateUUID(), role: 'model', text: text === '/scan-cancel' ? "Optical session dismissed." : "Action sequence terminated.", timestamp: Date.now() }] };
                }
            }
            return s;
        }));
        return;
    }

    if (text.startsWith('/ppt-method')) {
      const method = text.split(' ')[1] as 'generate' | 'paste' | 'import';
      const state = activeSession?.pptState;
      if (!state) return;
      const newState: PPTState = { ...state, method, step: method === 'generate' ? 'generating' : 'input' };
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, pptState: newState } : s));
      if (method === 'generate') {
        startPPTGeneration(state.topic!, state.slideCount!).catch(err => console.error("PPT Gen Error", err));
      } else if (method === 'paste') {
        const modelMsg: Message = { id: generateUUID(), role: 'model', text: `Blueprint buffer ready for **"${state.topic}"**. Please paste your text context for synthesis.`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (method === 'import') {
        const modelMsg: Message = { id: generateUUID(), role: 'model', text: `Upload sensor active. Please import the PDF blueprint for the **"${state.topic}"** deck.`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      }
      return;
    }

    if (text.startsWith('/quiz-level')) {
        const level = text.split(' ')[1];
        startQuizGeneration(activeSession?.quizState?.topic || "Synthesis", level).catch(err => console.error("Quiz Gen Error", err));
        return;
    }

    if (text.startsWith('/quiz-answer')) {
        const [, isCorrect] = text.split(' ');
        const isActuallyCorrect = isCorrect === 'true';
        setSessions(prev => prev.map(s => {
            if (s.id === sessId && s.quizState) {
                const nextIdx = s.quizState.currentQuestionIndex + 1;
                const newScore = isActuallyCorrect ? s.quizState.score + 1 : s.quizState.score;
                if (nextIdx >= 5) {
                    const apiKey = getApiKey();
                    if (apiKey) {
                        generateQuizSummary(s.quizState.topic || "Synthesis", newScore, 5, apiKey).then(summary => {
                            const finalMsg: Message = { id: generateUUID(), role: 'model', text: summary, timestamp: Date.now() };
                            setSessions(prev => prev.map(sess => sess.id === s.id ? { 
                                ...sess, 
                                messages: [...sess.messages, finalMsg], 
                                quizState: { ...sess.quizState!, step: 'finished', score: newScore } as any 
                            } : sess));
                        }).catch(() => {
                           const finalMsg: Message = { id: generateUUID(), role: 'model', text: `Cycle complete. Final score: **${newScore}/5**. Calibration finalized.`, timestamp: Date.now() };
                           setSessions(prev => prev.map(sess => sess.id === s.id ? { 
                               ...sess, 
                               messages: [...sess.messages, finalMsg], 
                               quizState: { ...sess.quizState!, step: 'finished', score: newScore } as any 
                           } : sess));
                        });
                        return { ...s, quizState: { ...s.quizState, step: 'finished', score: newScore } as any };
                    } else {
                        const finalMsg: Message = { id: generateUUID(), role: 'model', text: `Cycle complete. Final score: **${newScore}/5**.`, timestamp: Date.now() };
                        return { ...s, messages: [...s.messages, finalMsg], quizState: { ...s.quizState, step: 'finished', score: newScore } as any };
                    }
                }
                return { ...s, quizState: { ...s.quizState, currentQuestionIndex: nextIdx, score: newScore } };
            }
            return s;
        }));
        return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const userMessage: Message = { id: generateUUID(), role: 'user', text, attachments, timestamp: Date.now() };
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === sessId) {
          // Clear active action flags from the last message when moving to the next interaction
          const lastMsg = s.messages[s.messages.length - 1];
          let cleanedMessages = s.messages;
          if (lastMsg && (lastMsg.isPPTAction || lastMsg.isQuizAction || lastMsg.isDocAction || lastMsg.isImageAction)) {
              cleanedMessages = [
                  ...s.messages.slice(0, -1),
                  { ...lastMsg, isPPTAction: false, isQuizAction: false, isDocAction: false, isImageAction: false }
              ];
          }

          return { 
            ...s, 
            messages: [...cleanedMessages, userMessage], 
            updatedAt: Date.now(), 
            title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
            attachments: [...s.attachments, ...attachments]
          };
        }
        return s;
      });
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    if (activeSession?.isPPT && activeSession.pptState?.step !== 'completed') {
      const state = activeSession.pptState;
      if (!state) return;
      if (state.step === 'topic') {
        const sessIdConst = sessId; // Capture for closure
        setSessions(prev => prev.map(s => s.id === sessIdConst ? { ...s, pptState: { ...state, step: 'slides', topic: text } } : s));
        const modelMsg: Message = { id: generateUUID(), role: 'model', text: `Topic locked: **"${text}"**. How many slides shall I architect?`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessIdConst ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'slides') {
        const slideCount = parseInt(text.replace(/\D/g, '')) || 5;
        const sessIdConst = sessId;
        setSessions(prev => prev.map(s => s.id === sessIdConst ? { ...s, pptState: { ...state, step: 'method', slideCount } } : s));
        const modelMsg: Message = { id: generateUUID(), role: 'model', text: `Preparing **${slideCount}** slides for **"${state.topic}"**. Select synthesis method:`, timestamp: Date.now(), isPPTAction: true };
        setSessions(prev => prev.map(s => s.id === sessIdConst ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'input') {
        const sessIdConst = sessId;
        setSessions(prev => prev.map(s => s.id === sessIdConst ? { ...s, pptState: { ...state, step: 'generating' } } : s));
        startPPTGeneration(state.topic!, state.slideCount!, text, attachments).catch(err => {
          console.error("Async PPT Task Failed:", err);
          setIsLoading(false);
        });
      }
      return;
    }

    if (activeSession?.isQuiz && activeSession.quizState?.step === 'topic') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, quizState: { ...s.quizState!, step: 'difficulty', topic: text } } : s));
        const modelMsg: Message = { id: generateUUID(), role: 'model', text: `Calibration Topic: **"${text}"**. Select difficulty:`, timestamp: Date.now(), isQuizAction: true };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
        return;
    }

    setIsLoading(true);
    const signal = abortControllerRef.current?.signal;
    try {
      let modelMessage: Message;
      if (options?.imageGen) {
        if (!hasApiKey) await handleSelectApiKey();
        const imageUrl = await generateImage(text, options.size, options.aspectRatio, options.quality, options.useSearch, signal);
        modelMessage = { 
          id: generateUUID(), 
          role: 'model', 
          text: imageUrl ? "Visual synthesis complete. High-fidelity asset is ready." : "Synthesis failed. Refine parameters.", 
          attachments: imageUrl ? [{ type: 'image', url: imageUrl, mimeType: 'image/png', name: 'Lyra_Asset.png' }] : [], 
          timestamp: Date.now(),
        };
      } else if (options?.scanAnalysis) {
        if (!hasApiKey) await handleSelectApiKey();
        const apiKey = getApiKey();
        const img = attachments.find(a => (a.type === 'image' || a.mimeType.startsWith('image/')) && a.data) || 
                    activeSession?.attachments?.find(a => (a.type === 'image' || a.mimeType.startsWith('image/')) && a.data);
        
        if (img && img.data) {
          const analysis = await generateScanAnalysis(img.data, apiKey!, signal);
          modelMessage = {
            id: generateUUID(),
            role: 'model',
            text: `## **Optical Synthesis Complete**\n\n**Category:** ${analysis.category.replace('_', ' ').toUpperCase()}\n\n**Summary:** ${analysis.summary}\n\n### **Extracted Intelligence**\n${Object.entries(analysis.extractedData).map(([k, v]) => `* **${k}:** ${v}`).join('\n')}\n\nShall I perform any follow-up operations?`,
            timestamp: Date.now(),
            scanAnalysis: analysis,
            isScanAction: true
          };
        } else {
          // Fallback to regular chat if no data found
          const mapsKeywords = ['where', 'location', 'nearby', 'address', 'directions', 'place', 'restaurant', 'shop', 'near me'];
          const isMapsQuery = mapsKeywords.some(keyword => text.toLowerCase().includes(keyword));
          const history = activeSession?.messages.map(m => {
            const parts: any[] = [{ text: m.text }];
            if (m.attachments) {
              m.attachments.forEach(at => {
                if (at.data) {
                  parts.push({
                    inlineData: {
                      mimeType: at.mimeType,
                      data: at.data
                    }
                  });
                }
              });
            }
            return { role: m.role, parts };
          }) || [];
          const response = await generateTextChat(text, history, attachments, undefined, isMapsQuery ? 'maps' : 'search', 'pro', signal);
          if (signal?.aborted) return;
          modelMessage = { id: generateUUID(), role: 'model', text: response.text || "Processed.", timestamp: Date.now(), hasMoreInfo: true };
        }
      } else {
        const mapsKeywords = ['where', 'location', 'nearby', 'address', 'directions', 'place', 'restaurant', 'shop', 'near me'];
        const isMapsQuery = mapsKeywords.some(keyword => text.toLowerCase().includes(keyword));
        const history = activeSession?.messages.map(m => {
          const parts: any[] = [{ text: m.text }];
          if (m.attachments) {
            m.attachments.forEach(at => {
              if (at.data) {
                parts.push({
                  inlineData: {
                    mimeType: at.mimeType,
                    data: at.data
                  }
                });
              }
            });
          }
          return { role: m.role, parts };
        }) || [];
        const hasImages = attachments.some(a => a.type === 'image') || activeSession?.attachments?.some(a => a.type === 'image');
        const hasDocs = attachments.some(a => a.mimeType === 'application/pdf' || a.mimeType.includes('text/plain')) || activeSession?.attachments?.some(a => a.mimeType === 'application/pdf');
        const hasAudio = attachments.some(a => a.type === 'audio') || activeSession?.attachments?.some(a => a.type === 'audio');
        const complexity = (hasImages || hasDocs || hasAudio) ? 'pro' : (text.length < 30 ? 'lite' : 'normal');
        const response = await generateTextChat(text, history, attachments, undefined, isMapsQuery ? 'maps' : 'search', complexity, signal);
        if (signal?.aborted) return;
        const groundingUrls: GroundingSource[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.web) groundingUrls.push({ title: chunk.web.title || 'Source', uri: chunk.web.uri });
            else if (chunk.maps) groundingUrls.push({ title: chunk.maps.title || 'Location', uri: chunk.maps.uri });
          });
        }
        modelMessage = { id: generateUUID(), role: 'model', text: response.text || "Processed.", timestamp: Date.now(), groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined, hasMoreInfo: true };
      }
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMessage], updatedAt: Date.now() } : s));
    } catch (error: any) {
      if (error.message === 'AbortError') return;
      if (error.message === 'KEY_RESET_REQUIRED') {
        setHasApiKey(false);
        handleSelectApiKey().catch(err => console.error("Key Selector Error", err));
        return;
      }
      const errorMessage = error.message || "Intelligence synchronization error. System recovery in progress.";
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, { id: generateUUID(), role: 'model', text: `**Protocol Warning:** ${errorMessage}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleVoiceTurnComplete = (userInput: string, modelOutput: string) => {
    if (!voiceSessionId) return;

    const userMsg: Message = { id: generateUUID(), role: 'user', text: userInput, timestamp: Date.now() };
    const modelMsg: Message = { id: generateUUID(), role: 'model', text: modelOutput, timestamp: Date.now() };
    
    setSessions(prev => {
      const exists = prev.find(s => s.id === voiceSessionId);
      if (exists) {
        return prev.map(s => s.id === voiceSessionId ? { ...s, messages: [...s.messages, userMsg, modelMsg], updatedAt: Date.now() } : s);
      } else {
        const newSession: ChatSession = { 
          id: voiceSessionId, 
          title: `LYRA Live: ${userInput.slice(0, 30)}${userInput.length > 30 ? '...' : ''}`, 
          messages: [userMsg, modelMsg], 
          updatedAt: Date.now(),
          attachments: []
        };
        return [newSession, ...prev];
      }
    });
    
    if (currentSessionId !== voiceSessionId) {
      setCurrentSessionId(voiceSessionId);
    }
  };

  const startVoiceMode = () => {
    const newId = generateUUID();
    setVoiceSessionId(newId);
    setIsVoiceMode(true);
  };

  const endVoiceMode = () => {
    setIsVoiceMode(false);
    setVoiceSessionId(null);
  };

  const handleLogin = (name: string, email: string, photo: string) => {
    setUser({ name, email, photo });
    setIsLoginModalOpen(false);
    if (queuedInputText || queuedAttachments.length > 0) {
      handleSendMessage(queuedInputText || "", queuedAttachments).catch(err => {
        console.error("Queued message delivery failed after login:", err);
      });
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
              return { ...m, attachments: m.attachments?.filter(a => a.url !== url) };
            }
            return m;
          })
        };
      }
      return s;
    }));
  };

  const createNewSession = (type: 'chat' | 'quiz' | 'ppt' = 'chat', initialPrompt?: string, initialAttachments: Attachment[] = []) => {
    if (type === 'chat' && !initialPrompt && initialAttachments.length === 0) {
      setCurrentSessionId(null);
      setCurrentView('chat');
      setIsSidebarOpen(false);
      return;
    }

    const newSessionId = generateUUID();
    const newSession: ChatSession = {
      id: newSessionId,
      title: type === 'quiz' ? 'Academic Calibration' : type === 'ppt' ? 'LYRA Presentation Deck' : (initialAttachments.length > 0 ? `Analysis: ${initialAttachments[0].name || 'Asset'}` : 'New LYRA Session'),
      messages: [],
      updatedAt: Date.now(),
      isQuiz: type === 'quiz',
      quizState: type === 'quiz' ? { step: 'topic', score: 0, currentQuestionIndex: 0 } : undefined,
      isPPT: type === 'ppt',
      pptState: type === 'ppt' ? { step: 'topic' } : undefined,
      attachments: initialAttachments
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setCurrentView('chat');
    setIsSidebarOpen(false);

    if (initialAttachments.length > 0) {
      const isImage = initialAttachments.some(a => a.type === 'image' || a.mimeType.startsWith('image/'));
      const isDoc = initialAttachments.some(a => a.mimeType === 'application/pdf' || a.mimeType.includes('text/plain') || a.mimeType.includes('officedocument') || a.type === 'file');
      const isAudio = initialAttachments.some(a => a.type === 'audio' || a.mimeType.startsWith('audio/'));

      if (isImage) {
        const modelIntro: Message = { 
          id: generateUUID(), 
          role: 'model', 
          text: `**Optical Intelligence Synchronized.** Asset: **${initialAttachments[0].name || 'Media'}**. Sub-pixel sensory array is initialized. \n\nI am prepared to perform an **Analysis** of the composition or **Extract** structured data points from this visual intake. How shall I proceed?`, 
          timestamp: Date.now(), 
          attachments: initialAttachments, 
          isImageAction: true 
        };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else if (isDoc) {
        const modelIntro: Message = { 
          id: generateUUID(), 
          role: 'model', 
          text: `**Document Architecture Loaded.** Analysis for: **${initialAttachments[0].name}**. I am prepared to extract structured data, synthesize summaries, or perform point-of-interest analysis. \n\nHow shall I process this information?`, 
          timestamp: Date.now(), 
          attachments: initialAttachments, 
          isDocAction: true 
        };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else if (isAudio) {
        const modelIntro: Message = { 
          id: generateUUID(), 
          role: 'model', 
          text: `**Acoustic Signal Purified.** Stream: **${initialAttachments[0].name}**. Analysis ready for transcription, intent detection, or event markers. \n\nShall I begin the deep audio calibration?`, 
          timestamp: Date.now(), 
          attachments: initialAttachments 
        };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else {
        const modelIntro: Message = { id: generateUUID(), role: 'model', text: "Assets received. How shall I process the intake?", timestamp: Date.now(), attachments: initialAttachments };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      }
    } else if (initialPrompt && type === 'chat') {
        setTimeout(() => {
          handleSendMessage(initialPrompt, [], false, undefined, newSessionId).catch(err => {
            console.error("Initial prompt delivery failed:", err);
          });
        }, 100);
    }
  };

  const handleStartNewChatWithPrompt = (prompt: string) => createNewSession('chat', prompt);

  const handleCameraCapture = (base64: string) => {
    const attachment: Attachment = {
      type: 'image',
      url: `data:image/jpeg;base64,${base64}`,
      mimeType: 'image/jpeg',
      data: base64,
      name: `Vision_Core_${new Date().getTime()}.jpg`
    };
    
    const newSessionId = generateUUID();
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'Processing Scan...',
      messages: [{
        id: generateUUID(),
        role: 'model',
        text: "## **Active Optical Scan Initiated**\nInitializing sensory array for high-fidelity extraction...",
        timestamp: Date.now(),
        attachments: [attachment]
      }],
      updatedAt: Date.now(),
      attachments: [attachment]
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setCurrentView('chat');
    setIsCameraMode(false);
    
    startScanAnalysis(base64, newSessionId).catch(err => {
      console.error("Camera capture startScanAnalysis failed", err);
    });
  };

  const handleUploadAndAnalyze = (attachment: Attachment) => {
    if (activeSession?.isPPT && activeSession.pptState?.step === 'input' && activeSession.pptState?.method === 'import') {
      handleSendMessage(`Context blueprint received: **${attachment.name}**. Designing deck...`, [attachment]).catch(err => {
        console.error("Upload analysis sendMessage failed", err);
      });
    } else {
      createNewSession('chat', undefined, [attachment]);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0c10] overflow-hidden font-sans text-slate-200 safe-area-inset">
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[35] lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <div className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shadow-2xl lg:shadow-none`}>
        <Sidebar 
          sessions={sessions} 
          activeSessionId={currentSessionId} 
          onSelectSession={(id) => { setCurrentSessionId(id); setCurrentView('chat'); setIsSidebarOpen(false); }} 
          onDeleteSession={handleDeleteSession} 
          onRenameSession={handleRenameSession} 
          onNewChat={createNewSession} 
          onClose={() => setIsSidebarOpen(false)} 
          onOpenLibrary={() => { setLibraryInitialTab('Images'); setCurrentView('library'); setIsSidebarOpen(false); }} 
        />
      </div>

      <main className="flex-1 flex flex-col relative w-full overflow-hidden" role="main">
        {currentView === 'chat' ? (
          <ChatInterface 
            sessions={sessions}
            messages={activeSession?.messages || []} 
            sessionId={currentSessionId}
            onSendMessage={handleSendMessage}
            onMoreInfo={(p) => handleSendMessage(`Deep dive: ${p}`, [], true)}
            onStop={handleStop}
            isLoading={isLoading}
            onToggleVoice={startVoiceMode}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onGoHome={() => createNewSession('chat')}
            onSelectSession={(id) => setCurrentSessionId(id)}
            onViewAllHistory={() => setIsSidebarOpen(true)}
            onStartQuiz={() => createNewSession('quiz')}
            onStartPPT={() => createNewSession('ppt')}
            onStartImageGen={() => {}} 
            onOpenCamera={() => setIsCameraMode(true)}
            onUploadAndAnalyze={handleUploadAndAnalyze}
            onStartNewChatWithPrompt={handleStartNewChatWithPrompt}
            onDeleteSession={handleDeleteSession}
            onHideOnHome={handleHideSessionFromHome}
            initialInput={queuedInputText}
            onClearInitialInput={() => setQueuedInputText(null)}
            user={user}
            onLoginClick={() => setIsLoginModalOpen(true)}
            onLogout={() => setUser(null)}
            onPPTFullScreen={(data) => setFullScreenPPT({ data, slideIndex: 0 })}
          />
        ) : (
          <LibraryView 
            sessions={sessions} 
            initialTab={libraryInitialTab} 
            onBack={() => setCurrentView('chat')} 
            onDeleteImage={handleDeleteImage} 
            onDeleteSession={handleDeleteSession}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
            onNewChat={() => createNewSession('chat')} 
            onSelectSession={(id) => { setCurrentSessionId(id); setCurrentView('chat'); }}
          />
        )}
        
        {fullScreenPPT && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-300" role="dialog" aria-label="PPT Presenter">
             <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white/5 border-b border-white/10 backdrop-blur-md">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Presenter v4.0</span>
                    <h2 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[300px]">{fullScreenPPT.data.theme}</h2>
                </div>
                <button onClick={() => setFullScreenPPT(null)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20" aria-label="Close Presenter">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
             </header>

             <div className="flex-1 flex items-center justify-center p-4 relative group">
                <button 
                  onClick={() => setFullScreenPPT({ ...fullScreenPPT, slideIndex: Math.max(0, fullScreenPPT.slideIndex - 1) })}
                  className="absolute left-2 sm:left-4 z-10 w-10 sm:w-12 h-10 sm:h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={fullScreenPPT.slideIndex === 0}
                  aria-label="Previous Slide"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                <div className="w-full h-full max-w-6xl aspect-video bg-[#0f1118] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden relative">
                    {(() => {
                        const slide = fullScreenPPT.data.slides[fullScreenPPT.slideIndex];
                        if (!slide) return null;
                        return (
                            <div className="w-full h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
                                <div className="flex-1 p-6 sm:p-10 md:p-16 flex flex-col justify-center gap-4 sm:gap-8 overflow-y-auto">
                                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white">{slide.title}</h2>
                                    {slide.subtitle && <p className="text-lg sm:text-xl text-white/50">{slide.subtitle}</p>}
                                    <ul className="space-y-3 sm:space-y-4">
                                        {slide.content.map((item, i) => (
                                          <li key={i} className="text-base sm:text-lg md:text-xl text-white/70 flex gap-3 sm:gap-4">
                                            <span className="text-blue-500 mt-1 shrink-0">
                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                            </span> 
                                            {item}
                                          </li>
                                        ))}
                                    </ul>
                                </div>
                                {slide.imageUrl && <img src={slide.imageUrl} className="w-full md:w-1/2 h-48 sm:h-64 md:h-auto object-cover border-t md:border-t-0 md:border-l border-white/5" alt="" />}
                            </div>
                        );
                    })()}
                </div>

                <button 
                  onClick={() => setFullScreenPPT({ ...fullScreenPPT, slideIndex: Math.min(fullScreenPPT.data.slides.length - 1, fullScreenPPT.slideIndex + 1) })}
                  className="absolute right-2 sm:right-4 z-10 w-10 sm:w-12 h-10 sm:h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/10 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={fullScreenPPT.slideIndex === fullScreenPPT.data.slides.length - 1}
                  aria-label="Next Slide"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                </button>
             </div>
             <footer className="h-12 flex items-center justify-center bg-white/5 border-t border-white/5 relative">
                <div className="flex gap-2">
                   {fullScreenPPT.data.slides.map((_, i) => (
                      <div key={i} className={`h-1 sm:h-1.5 rounded-full transition-all ${i === fullScreenPPT.slideIndex ? 'w-6 sm:w-8 bg-blue-500' : 'w-1 sm:w-2 bg-white/10'}`} />
                   ))}
                </div>
                <p className="absolute right-4 sm:right-6 text-[10px] text-white/40 tracking-widest uppercase font-bold">Slide {fullScreenPPT.slideIndex + 1} / {fullScreenPPT.data.slides.length}</p>
             </footer>
          </div>
        )}

        {isVoiceMode && <VoiceOverlay onClose={endVoiceMode} onTurnComplete={handleVoiceTurnComplete} />}
        {isCameraMode && <CameraCapture onCapture={handleCameraCapture} onClose={() => setIsCameraMode(false)} />}
        <GoogleLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
      </main>
    </div>
  );
};

export default App;
