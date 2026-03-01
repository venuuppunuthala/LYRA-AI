
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
import pptxgen from "pptxgenjs";

type AppView = 'chat' | 'library';
type LibraryTab = 'Images' | 'Pages' | 'PPT' | 'Quizzes';

interface UserProfile {
  name: string;
  email: string;
  photo: string;
}

const STORAGE_KEY = 'lyra_ai_sessions_v14';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('chat');
  const [libraryInitialTab, setLibraryInitialTab] = useState<LibraryTab>('Images');
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
  const isInitialMount = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
      }
    }
    
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
    isInitialMount.current = false;
  }, []);

  useEffect(() => {
    if (isInitialMount.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    
    if (sessions.length === 0 && !isLoading) {
      createNewSession('chat');
    }
  }, [sessions, isLoading]);

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
        text: "Elite PPT Designer engaged. To architect your premium deck, please start by defining the **Topic**.",
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
    }
    if (activeSession?.isQuiz && activeSession.messages.length === 0 && !isLoading) {
      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: "Academic Calibration initialized. To begin the assessment, please define the **Topic** you'd like to be quizzed on.",
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [modelMessage] } : s));
    }
  }, [activeSession?.id, activeSession?.isPPT, activeSession?.isQuiz]);

  const generatePptxFile = async (data: PPTData): Promise<string> => {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    for (const slideData of data.slides) {
      const slide = pres.addSlide();
      if (slideData.imageUrl) {
        slide.background = { path: slideData.imageUrl };
      } else {
        slide.background = { color: slideData.accentColor?.replace('#', '') || '0F1118' };
      }
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: '000000', transparency: 50 }
      });
      slide.addText(slideData.title, {
        x: 0.5, y: 0.5, w: '90%',
        fontSize: 44, bold: true, color: 'FFFFFF',
        fontFace: 'Inter'
      });
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.5, y: 1.5, w: '90%',
          fontSize: 24, color: 'BBBBBB',
          fontFace: 'Inter'
        });
      }
      const bulletPoints = slideData.content.map(text => ({ text, options: { bullet: true, color: 'EEEEEE', fontSize: 18 } }));
      slide.addText(bulletPoints as any, {
        x: 0.5, y: 2.5, w: '90%', h: 3,
        valign: 'top', fontFace: 'Inter'
      });
    }
    const blob = await pres.write('blob');
    return URL.createObjectURL(blob as Blob);
  };

  const startPPTGeneration = async (topic: string, slideCount: number, context: string = "", attachments: Attachment[] = []) => {
    setIsLoading(true);
    try {
      if (!hasApiKey) await handleSelectApiKey();
      const themeImageUrl = await generateImage(`Hyper-realistic cinematic professional cover slide for a presentation titled "${topic}", futuristic minimal design, 8k resolution, elegant lighting`, '2K', '16:9');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const parts: any[] = [{ 
        text: `Act as an Elite Gemini PPT Architect. Synthesize a professional, high-impact deck for "${topic}". 
        Slide count: ${slideCount}. 
        Context/Data provided: ${context || "AI-driven research"}.
        Create a fluid narrative flow. Return ONLY valid JSON.` 
      }];
      for (const att of attachments) {
        if (att.data) {
          parts.push({
            inlineData: { mimeType: att.mimeType, data: att.data }
          });
        }
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts }],
        config: {
          thinkingConfig: { thinkingBudget: 12000 },
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
                    content: { type: Type.ARRAY, items: { type: Type.STRING } },
                    accentColor: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING }
                  },
                  required: ['layout', 'title', 'content', 'accentColor']
                }
              }
            }
          }
        }
      });
      const pptData: PPTData = JSON.parse(response.text);
      pptData.slides = pptData.slides.map((slide: any, idx) => ({
        ...slide,
        imageUrl: idx === 0 && themeImageUrl 
          ? themeImageUrl 
          : `https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=1200&q=${encodeURIComponent(slide.imagePrompt || topic)}`
      }));
      const pptxUrl = await generatePptxFile(pptData);
      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `Gemini Synthesis complete for **"${topic}"**. I've architected a **${slideCount}**-slide deck. All visuals are synthesized and ready for export.`,
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
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'model', text: `Gemini Alert: ${error.message}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const startQuizGeneration = async (topic: string, difficulty: string) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Generate 5 high-quality MCQ for "${topic}" at ${difficulty} level. Focus on reasoning and provide detailed explanations.` }] }],
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
        text: `Technical assessment for **"${topic}"** at **${difficulty}** level is synthesized. Let's begin.`,
        timestamp: Date.now(),
        quizQuestions: questions
      };
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { 
        ...s, 
        messages: [...s.messages, modelMessage],
        quizState: { ...s.quizState!, step: 'ongoing', difficulty: difficulty as any, currentQuestionIndex: 0, score: 0 }
      } : s));
    } catch (error: any) {
       setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'model', text: `Synthesis failed: ${error.message}`, timestamp: Date.now() } as Message] } : s));
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (text: string, attachments: Attachment[], isMoreInfoRequest: boolean = false, options?: any, targetSessionId?: string) => {
    const sessId = targetSessionId || currentSessionId;
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
        const modelMessage: Message = { id: crypto.randomUUID(), role: 'model', text: msgText, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMessage], isQuiz: false, quizState: undefined } : s));
        return;
    }

    if (text.startsWith('/ppt-method')) {
      const method = text.split(' ')[1] as 'generate' | 'paste' | 'import';
      const state = activeSession?.pptState!;
      const newState: PPTState = { ...state, method, step: method === 'generate' ? 'generating' : 'input' };
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, pptState: newState } : s));
      if (method === 'generate') {
        startPPTGeneration(state.topic!, state.slideCount!);
      } else if (method === 'paste') {
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Blueprint buffer ready for **"${state.topic}"**. Please paste your text context for synthesis.`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (method === 'import') {
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Upload sensor active. Please import the PDF blueprint for the **"${state.topic}"** deck.`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      }
      return;
    }

    if (text.startsWith('/quiz-level')) {
        const level = text.split(' ')[1];
        startQuizGeneration(activeSession?.quizState?.topic || "Synthesis", level);
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
                    let celebration = "Assessment finalized.";
                    if (newScore === 5) celebration = `Elite Synthesis! 🎉 You've achieved a perfect score of **5/5**. Your proficiency in **${s.quizState.topic}** is absolute.`;
                    else if (newScore >= 3) celebration = `Calibration Successful! 🌟 Score: **${newScore}/5**. You have a strong grasp of **${s.quizState.topic}**.`;
                    else celebration = `Cycle complete. Final score: **${newScore}/5**. Continue studying **${s.quizState.topic}** to improve calibration.`;
                    const finalMsg: Message = { id: crypto.randomUUID(), role: 'model', text: celebration, timestamp: Date.now() };
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
        if (s.id === sessId) {
          return { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now(), title: s.messages.length === 0 ? text.slice(0, 50) : s.title };
        }
        return s;
      });
      return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    if (activeSession?.isPPT && activeSession.pptState?.step !== 'completed') {
      const state = activeSession.pptState!;
      if (state.step === 'topic') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, pptState: { ...state, step: 'slides', topic: text } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Topic locked: **"${text}"**. How many slides shall I architect?`, timestamp: Date.now() };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'slides') {
        const slideCount = parseInt(text.replace(/\D/g, '')) || 5;
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, pptState: { ...state, step: 'method', slideCount } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Preparing **${slideCount}** slides for **"${state.topic}"**. Select synthesis method:`, timestamp: Date.now(), isPPTAction: true };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
      } else if (state.step === 'input') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, pptState: { ...state, step: 'generating' } } : s));
        startPPTGeneration(state.topic!, state.slideCount!, text, attachments);
      }
      return;
    }

    if (activeSession?.isQuiz && activeSession.quizState?.step === 'topic') {
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, quizState: { ...s.quizState!, step: 'difficulty', topic: text } } : s));
        const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: `Calibration Topic: **"${text}"**. Select difficulty:`, timestamp: Date.now(), isQuizAction: true };
        setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMsg] } : s));
        return;
    }

    setIsLoading(true);
    try {
      let modelMessage: Message;
      if (options?.imageGen) {
        if (!hasApiKey) await handleSelectApiKey();
        const imageUrl = await generateImage(text, options.size, options.aspectRatio);
        modelMessage = { 
          id: crypto.randomUUID(), 
          role: 'model', 
          text: imageUrl ? "Visual synthesis complete. High-fidelity asset is ready." : "Synthesis failed. Refine parameters.", 
          attachments: imageUrl ? [{ type: 'image', url: imageUrl, mimeType: 'image/png', name: 'Lyra_Asset.png' }] : [], 
          timestamp: Date.now(),
        };
      } else {
        const mapsKeywords = ['where', 'location', 'nearby', 'address', 'directions', 'place', 'restaurant', 'shop', 'near me'];
        const isMapsQuery = mapsKeywords.some(keyword => text.toLowerCase().includes(keyword));
        const history = activeSession?.messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })) || [];
        const hasImages = attachments.some(a => a.type === 'image');
        const hasDocs = attachments.some(a => a.mimeType === 'application/pdf' || a.mimeType.includes('text/plain'));
        const hasAudio = attachments.some(a => a.type === 'audio');
        const complexity = (hasImages || hasDocs || hasAudio) ? 'pro' : (text.length < 30 ? 'lite' : 'normal');
        const response = await generateTextChat(text, history, attachments, undefined, isMapsQuery ? 'maps' : 'search', complexity);
        if (abortControllerRef.current?.signal.aborted) return;
        const groundingUrls: GroundingSource[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.web) groundingUrls.push({ title: chunk.web.title || 'Source', uri: chunk.web.uri });
            else if (chunk.maps) groundingUrls.push({ title: chunk.maps.title || 'Location', uri: chunk.maps.uri });
          });
        }
        modelMessage = { id: crypto.randomUUID(), role: 'model', text: response.text || "Processed.", timestamp: Date.now(), groundingUrls: groundingUrls.length > 0 ? groundingUrls : undefined, hasMoreInfo: true };
      }
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, modelMessage], updatedAt: Date.now() } : s));
    } catch (error: any) {
      if (error.message === 'KEY_RESET_REQUIRED') {
        setHasApiKey(false);
        await handleSelectApiKey();
        return;
      }
      setSessions(prev => prev.map(s => s.id === sessId ? { ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'model', text: `Technical Alert: ${error.message}`, timestamp: Date.now() } as Message] } : s));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleVoiceTurnComplete = (userInput: string, modelOutput: string) => {
    const newSessId = currentSessionId || crypto.randomUUID();
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: userInput, timestamp: Date.now() };
    const modelMsg: Message = { id: crypto.randomUUID(), role: 'model', text: modelOutput, timestamp: Date.now() };
    setSessions(prev => {
      const exists = prev.find(s => s.id === newSessId);
      if (exists) {
        return prev.map(s => s.id === newSessId ? { ...s, messages: [...s.messages, userMsg, modelMsg], updatedAt: Date.now() } : s);
      } else {
        const newSession: ChatSession = { id: newSessId, title: userInput.slice(0, 50), messages: [userMsg, modelMsg], updatedAt: Date.now() };
        return [newSession, ...prev];
      }
    });
    if (!currentSessionId) setCurrentSessionId(newSessId);
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
    const newSessionId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newSessionId,
      title: type === 'quiz' ? 'Academic Calibration' : type === 'ppt' ? 'Gemini Deck' : (initialAttachments.length > 0 ? `Analysis: ${initialAttachments[0].name || 'Asset'}` : 'New LYRA Session'),
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

    if (initialAttachments.length > 0) {
      const isImage = initialAttachments.some(a => a.type === 'image');
      const isDoc = initialAttachments.some(a => a.mimeType === 'application/pdf' || a.mimeType.includes('text/plain'));
      const isAudio = initialAttachments.some(a => a.type === 'audio');

      if (isImage) {
        const modelIntro: Message = { id: crypto.randomUUID(), role: 'model', text: `Visual intake complete: **${initialAttachments[0].name || 'Media'}**. How shall I proceed?`, timestamp: Date.now(), attachments: initialAttachments, isImageAction: true };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else if (isDoc) {
        const modelIntro: Message = { id: crypto.randomUUID(), role: 'model', text: `Document intake complete: **${initialAttachments[0].name}**. How shall I process the findings?`, timestamp: Date.now(), attachments: initialAttachments, isDocAction: true };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else if (isAudio) {
        const modelIntro: Message = { id: crypto.randomUUID(), role: 'model', text: `Audio intake complete: **${initialAttachments[0].name}**. Should I transcribe, summarize, or perform detailed acoustic analysis?`, timestamp: Date.now(), attachments: initialAttachments };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      } else {
        const modelIntro: Message = { id: crypto.randomUUID(), role: 'model', text: "Assets received. How shall I process the intake?", timestamp: Date.now(), attachments: initialAttachments };
        setSessions(prev => prev.map(s => s.id === newSessionId ? { ...s, messages: [modelIntro] } : s));
      }
    } else if (initialPrompt && type === 'chat') {
        setTimeout(() => {
          handleSendMessage(initialPrompt, [], false, undefined, newSessionId);
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
    createNewSession('chat', undefined, [attachment]);
  };

  const handleUploadAndAnalyze = (attachment: Attachment) => {
    if (activeSession?.isPPT && activeSession.pptState?.step === 'input' && activeSession.pptState?.method === 'import') {
      handleSendMessage(`Context blueprint received: **${attachment.name}**. Designing deck...`, [attachment]);
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
            onToggleVoice={() => setIsVoiceMode(true)}
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

        {isVoiceMode && <VoiceOverlay onClose={() => setIsVoiceMode(false)} onTurnComplete={handleVoiceTurnComplete} />}
        {isCameraMode && <CameraCapture onCapture={handleCameraCapture} onClose={() => setIsCameraMode(false)} />}
        <GoogleLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
      </main>
    </div>
  );
};

export default App;
