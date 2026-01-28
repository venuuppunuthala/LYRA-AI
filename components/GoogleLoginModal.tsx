
import React, { useState } from 'react';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (name: string, email: string, photo: string) => void;
}

const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [step, setStep] = useState<'email' | 'password' | 'loading'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'email') {
      if (email.includes('@')) setStep('password');
    } else {
      setStep('loading');
      setTimeout(() => {
        onLogin(
          email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
          email,
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
        );
        // Reset for next time
        setStep('email');
        setEmail('');
        setPassword('');
      }, 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[450px] bg-white rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 md:p-12">
          {/* Google Logo + LYRA text */}
          <div className="flex justify-center items-center gap-1.5 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-[22px] text-[#5f6368] font-medium" style={{ fontFamily: 'product sans, arial, sans-serif' }}>LYRA</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-normal text-slate-900 mb-2">
              {step === 'loading' ? 'Signing in...' : 'Sign in'}
            </h1>
            <p className="text-sm text-slate-600">to continue to LYRA</p>
          </div>

          {step === 'loading' ? (
            <div className="py-12 flex flex-col items-center">
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-progress-indeterminate" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleNext}>
              <div className="mb-8">
                {step === 'email' ? (
                  <div className="space-y-4">
                    <div className="relative">
                      {/* Dark input background */}
                      <input
                        autoFocus
                        type="email"
                        placeholder="Email or phone"
                        className="w-full px-4 py-4 rounded bg-[#3c4043] text-white/90 placeholder-white/40 border-none outline-none focus:ring-0 transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button type="button" className="text-sm font-medium text-[#1a73e8] hover:underline">
                      Forgot email?
                    </button>
                    <p className="text-sm text-slate-500 leading-relaxed mt-6">
                      Not your computer? Use Guest mode to sign in privately.{' '}
                      <a href="#" className="text-[#1a73e8] font-medium hover:underline">Learn more</a>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-1 pr-4 mb-4 border border-slate-200 rounded-full w-fit">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700">{email}</span>
                      <button type="button" onClick={() => setStep('email')} className="text-slate-400 hover:text-slate-600">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="password"
                      placeholder="Enter your password"
                      className="w-full px-4 py-4 rounded bg-[#3c4043] text-white/90 placeholder-white/40 border-none outline-none focus:ring-0 transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="show" className="rounded border-slate-300" />
                      <label htmlFor="show" className="text-sm font-medium text-slate-700">Show password</label>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-10">
                <div className="flex items-center gap-4">
                  <button type="button" className="text-sm font-bold text-[#1a73e8] hover:bg-blue-50/50 px-2 py-2 rounded transition-colors">
                    Create account
                  </button>
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="text-sm font-bold text-slate-500 hover:bg-slate-50 px-2 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <button
                  type="submit"
                  className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold px-7 py-2.5 rounded transition-all shadow-md active:scale-95"
                >
                  Next
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-slate-50/50 p-6 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
          <div className="flex items-center gap-1 cursor-pointer hover:text-slate-800">
            <span>English (United States)</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <div className="flex items-center gap-5">
            <button className="hover:text-slate-800">Help</button>
            <button className="hover:text-slate-800">Privacy</button>
            <button className="hover:text-slate-800">Terms</button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(0%) scaleX(0.5); }
          100% { transform: translateX(100%) scaleX(0.2); }
        }
        .animate-progress-indeterminate {
          animation: progress-indeterminate 1.5s infinite linear;
          transform-origin: 0% 50%;
        }
      `}} />
    </div>
  );
};

export default GoogleLoginModal;
