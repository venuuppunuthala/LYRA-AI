
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encodeAudio, decodeAudio, decodeAudioDataToBuffer } from '../services/gemini';

interface VoiceOverlayProps {
  onClose: () => void;
}

const VoiceOverlay: React.FC<VoiceOverlayProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [transcription, setTranscription] = useState('');
  const [modelResponse, setModelResponse] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const startSession = async () => {
    if (!isMountedRef.current) return;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are an advanced AI voice assistant. Speak naturally and keep responses concise. You are currently in a high-fidelity visual interface.',
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            if (!isMountedRef.current) return;
            setStatus('listening');
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!isMountedRef.current || status === 'error') return;
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const base64 = encodeAudio(new Uint8Array(int16.buffer));
              // Robustly handle sending data only if session is ready
              sessionPromise.then(s => {
                try {
                  s.sendRealtimeInput({
                    media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                  });
                } catch (e) {
                  console.warn("Failed to send audio chunk", e);
                }
              }).catch(() => { /* handled by main catch */ });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isMountedRef.current) return;

            if (message.serverContent?.inputTranscription) {
              setTranscription(message.serverContent.inputTranscription.text);
              setModelResponse(''); 
            }
            if (message.serverContent?.outputTranscription) {
              setModelResponse(prev => prev + message.serverContent?.outputTranscription?.text);
            }

            const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              setStatus('speaking');
              const bytes = decodeAudio(audioBase64);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              
              const buffer = await decodeAudioDataToBuffer(bytes, audioContext, 24000, 1);
              const sourceNode = audioContext.createBufferSource();
              sourceNode.buffer = buffer;
              sourceNode.connect(audioContext.destination);
              
              sourceNode.onended = () => {
                sourcesRef.current.delete(sourceNode);
                if (sourcesRef.current.size === 0) {
                  setStatus('listening');
                  setTimeout(() => {
                    if (isMountedRef.current) setModelResponse('');
                  }, 5000);
                }
              };

              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(sourceNode);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
              setModelResponse('');
            }
          },
          onerror: (e) => {
            console.error("Live API Error:", e);
            if (isMountedRef.current) setStatus('error');
          },
          onclose: () => {
            if (isMountedRef.current) setStatus('connecting');
          }
        }
      });

      // Catch initial connection failures
      sessionPromise.catch(err => {
        console.error("Session failed to connect:", err);
        if (isMountedRef.current) setStatus('error');
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Voice initialization error:", err);
      if (isMountedRef.current) setStatus('error');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    startSession();
    return () => {
      isMountedRef.current = false;
      if (audioContextRef.current) audioContextRef.current.close();
      if (sessionRef.current) try { sessionRef.current.close(); } catch(e) {}
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden select-none font-sans">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Particles/Stars Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute w-[2px] h-[2px] bg-blue-300 rounded-full" 
               style={{ 
                 top: `${Math.random() * 100}%`, 
                 left: `${Math.random() * 100}%`,
                 opacity: Math.random()
               }} />
        ))}
      </div>

      {/* Interface Wrapper */}
      <div className="relative w-full h-full max-w-7xl flex flex-col z-10 px-12 pt-16 pb-12">
        
        {/* Top Header Label */}
        <div className="absolute top-10 left-10 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6]" />
          <div className="text-white/40 text-[10px] font-black tracking-[0.4em] uppercase">
            Multimodal Voice Core v2.5
          </div>
        </div>

        {/* Content Section: Interaction Bubbles */}
        <div className="flex-1 w-full flex flex-col items-start justify-center px-4">
          <div className="w-full max-w-xl space-y-10">
            {/* AI Output Area */}
            {(modelResponse || status === 'speaking') && (
              <div className="animate-in fade-in slide-in-from-left-8 duration-700">
                <div className="bg-white/5 backdrop-blur-[40px] border border-white/10 p-8 rounded-[2rem] shadow-2xl">
                  <p className="text-white text-3xl font-medium leading-snug tracking-tight">
                    {modelResponse || "How can I help you?"}
                  </p>
                </div>
              </div>
            )}

            {/* User Transcription Area */}
            {transcription && (
              <div className="animate-in fade-in slide-in-from-left-6 duration-700">
                <div className="bg-blue-500/5 backdrop-blur-[30px] border border-blue-500/20 p-6 rounded-[1.5rem] shadow-xl">
                  <p className="text-blue-400 text-xl font-medium italic tracking-wide">
                    {transcription}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Neon Sound Waves (Indo, Purple, Cyan) */}
        <div className="absolute bottom-52 left-1/2 -translate-x-1/2 w-full max-w-6xl h-40 flex items-center justify-center pointer-events-none">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 120">
            <defs>
              <filter id="wave-glow">
                <feGaussianBlur stdDeviation="5" result="glowBlur"/>
                <feMerge>
                  <feMergeNode in="glowBlur"/><feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Indigo Wave */}
            <path 
              d="M0 60 Q 200 -20, 400 60 T 800 60" 
              stroke="#6366f1" 
              strokeWidth="3.5" 
              fill="transparent" 
              filter="url(#wave-glow)"
              className={status !== 'connecting' && status !== 'error' ? 'animate-wave-bold' : 'opacity-20'}
            />
            {/* Purple Wave */}
            <path 
              d="M0 60 Q 150 110, 300 60 T 600 60 T 900 60" 
              stroke="#a855f7" 
              strokeWidth="2" 
              fill="transparent" 
              filter="url(#wave-glow)"
              className={status !== 'connecting' && status !== 'error' ? 'animate-wave-alt' : 'opacity-10'}
            />
            {/* Cyan Wave */}
            <path 
              d="M0 60 Q 125 15, 250 60 T 500 60 T 750 60 T 1000 60" 
              stroke="#4ec9ff" 
              strokeWidth="2.5" 
              fill="transparent" 
              filter="url(#wave-glow)"
              className={status !== 'connecting' && status !== 'error' ? 'animate-wave-main' : 'opacity-30'}
            />
          </svg>
        </div>

        {/* Footer Area: Center Status & Controls */}
        <div className="mt-auto flex flex-col items-center gap-12">
          
          {/* Status Indicator (Matching Screenshot) */}
          <div className="flex items-center gap-6 transition-all duration-500">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full bg-blue-500/20 ${status !== 'connecting' && status !== 'error' ? 'animate-status-ping' : ''}`} />
              <div className={`w-4 h-4 rounded-full shadow-[0_0_20px_#3b82f6] ${status === 'error' ? 'bg-red-500 shadow-red-500' : 'bg-blue-400'}`} />
            </div>
            <span className={`text-white text-4xl font-black tracking-tight uppercase ${status === 'error' ? 'text-red-500' : ''}`}>
              {status === 'speaking' ? 'Speaking' : status === 'listening' ? 'Listening' : status === 'error' ? 'Network Error' : 'Initializing'}
            </span>
          </div>

          {/* End Session Button */}
          <button 
            onClick={onClose}
            className="px-24 py-4.5 bg-[#121212] hover:bg-white/5 text-white/80 rounded-full font-black text-sm tracking-[0.2em] uppercase transition-all border border-white/10 shadow-2xl active:scale-95 group relative"
          >
            <span className="relative z-10">End Session</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes status-ping {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes wave-main {
          0%, 100% { d: path("M0 60 Q 125 15, 250 60 T 500 60 T 750 60 T 1000 60"); opacity: 0.3; }
          50% { d: path("M0 60 Q 125 105, 250 60 T 500 60 T 750 60 T 1000 60"); opacity: 0.8; }
        }
        @keyframes wave-alt {
          0%, 100% { d: path("M0 60 Q 150 110, 300 60 T 600 60 T 900 60"); opacity: 0.2; }
          50% { d: path("M0 60 Q 150 10, 300 60 T 600 60 T 900 60"); opacity: 0.6; }
        }
        @keyframes wave-bold {
          0%, 100% { d: path("M0 60 Q 200 -20, 400 60 T 800 60"); opacity: 0.4; }
          50% { d: path("M0 60 Q 200 140, 400 60 T 800 60"); opacity: 1; }
        }
        .animate-status-ping { animation: status-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-wave-main { animation: wave-main 3.5s ease-in-out infinite; }
        .animate-wave-alt { animation: wave-alt 4.2s ease-in-out infinite; }
        .animate-wave-bold { animation: wave-bold 5s ease-in-out infinite; }
      `}} />
    </div>
  );
};

export default VoiceOverlay;
