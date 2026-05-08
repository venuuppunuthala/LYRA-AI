
import React, { useRef, useEffect, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setIsInitializing(true);
    setError(null);
    try {
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported by your browser or is blocked by security settings.");
      }

      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: mode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (innerErr) {
        console.warn("Retrying with simpler constraints...");
        // Fallback to simplest constraints if ideal ones fail
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      
      // We set isInitializing to false first to ensure the video element is rendered
      setIsInitializing(false);
      
      // Then we use a small timeout or wait for the ref to be available to set the srcObject
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play failed", e));
          };
        }
      }, 100);

    } catch (err: any) {
      console.error("Camera access failed:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('permission denied')) {
        setError("Camera permission denied. This often happens in embedded previews. Please ensure you have granted camera access in your browser settings. If the problem persists, try opening the application in a new tab.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera found on this device.");
      } else {
        setError(`Could not access camera: ${err.message || "Unknown error"}`);
      }
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startCamera(facingMode).catch(err => {
      console.error("Initial camera start failed:", err);
    });
    return () => {
      stopCamera();
    };
  }, []);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode).catch(err => {
      console.error("Camera switch failed:", err);
    });
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 150);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const confirmCapture = () => {
    if (capturedImage) {
      const base64 = capturedImage.split(',')[1];
      onCapture(base64);
      handleClose();
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera(facingMode).catch(err => {
      console.error("Retake camera start failed:", err);
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center font-sans overflow-hidden">
      <div className="relative w-full h-full max-w-4xl bg-black overflow-hidden flex flex-col shadow-2xl">
        
        {/* Top UI Controls - Directly matching screenshot */}
        <div className="absolute top-10 left-10 right-10 flex justify-between items-start z-30">
          <button 
            onClick={handleClose} 
            className="w-12 h-12 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white transition-all active:scale-90 border border-white/10"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          
          <div className="flex gap-4">
             <button 
              onClick={() => setShowGrid(!showGrid)} 
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 border border-white/10 ${showGrid ? 'bg-blue-600 text-white' : 'bg-black/40 text-white/60'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </button>
            
            {!capturedImage && (
              <button 
                onClick={switchCamera} 
                className="w-12 h-12 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white transition-all active:scale-90 border border-white/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Camera Feed Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {isInitializing && !capturedImage ? (
            <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[10px]">Accessing Sensor</p>
            </div>
          ) : error && !capturedImage ? (
            <div className="text-center p-10 max-w-sm">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-4">Camera Error</h3>
              <p className="text-white/50 mb-8 leading-relaxed text-sm">{error}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => startCamera(facingMode)} className="px-8 py-3 bg-white text-black rounded-full font-bold transition-all active:scale-95">Retry</button>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-8 py-3 bg-white/10 text-white rounded-full font-bold transition-all active:scale-95 border border-white/20"
                >
                  Open in New Tab
                </button>
              </div>
            </div>
          ) : capturedImage ? (
            <div className="w-full h-full relative animate-in fade-in duration-500">
              <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
            </div>
          ) : (
            <div className="w-full h-full relative">
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
              
              {/* Overlay graphics exactly as requested */}
              <div className="absolute inset-0 pointer-events-none">
                {showGrid && (
                  <div className="absolute inset-0">
                    <div className="absolute left-1/3 top-0 bottom-0 w-[0.5px] bg-white/20" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-[0.5px] bg-white/20" />
                    <div className="absolute top-1/3 left-0 right-0 h-[0.5px] bg-white/20" />
                    <div className="absolute top-2/3 left-0 right-0 h-[0.5px] bg-white/20" />
                  </div>
                )}
                
                {/* Brackets */}
                <div className="absolute top-[20%] left-[10%] w-16 h-16 border-t-4 border-l-4 border-blue-600 rounded-tl-2xl opacity-80" />
                <div className="absolute top-[20%] right-[10%] w-16 h-16 border-t-4 border-r-4 border-blue-600 rounded-tr-2xl opacity-80" />
                <div className="absolute bottom-[20%] left-[10%] w-16 h-16 border-b-4 border-l-4 border-blue-600 rounded-bl-2xl opacity-80" />
                <div className="absolute bottom-[20%] right-[10%] w-16 h-16 border-b-4 border-r-4 border-blue-600 rounded-br-2xl opacity-80" />
              </div>

              {isFlashActive && <div className="absolute inset-0 bg-white z-[40] animate-out fade-out duration-150" />}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Bottom UI Panel - Matches Screenshot */}
        <div className="h-[28%] bg-[#0d0e12] border-t border-white/5 flex flex-col items-center justify-center relative">
          {capturedImage ? (
            <div className="flex items-center gap-10 animate-in slide-in-from-bottom-5 duration-500">
              <button 
                onClick={retake} 
                className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full transition-all active:scale-95 border border-white/10 text-sm tracking-widest uppercase"
              >
                Retake
              </button>
              <button 
                onClick={confirmCapture} 
                className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-full transition-all active:scale-95 shadow-xl uppercase tracking-[0.2em] text-sm"
              >
                Synthesize Scan
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {!error && !isInitializing && (
                <>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Ready to scan</p>
                  
                  {/* Outer ring */}
                  <div className="w-24 h-24 rounded-full border-[6px] border-[#2d3039] flex items-center justify-center p-1.5 shadow-2xl">
                    {/* Inner shutter button */}
                    <button 
                      onClick={takePhoto} 
                      className="w-full h-full rounded-full bg-white transition-all active:scale-90 hover:scale-[1.02]"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;
