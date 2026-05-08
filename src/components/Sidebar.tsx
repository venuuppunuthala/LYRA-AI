
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onNewChat: (type?: 'chat' | 'quiz' | 'ppt') => void;
  onClose?: () => void;
  onOpenLibrary?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, activeSessionId, onSelectSession, onDeleteSession, onRenameSession, onNewChat, onClose, onOpenLibrary 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuSession, setMenuSession] = useState<ChatSession | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredSessions = sessions.filter(s => 
    s.messages.length > 0 && s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: Record<string, ChatSession[]> = {};
  const formatDateGroup = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "TODAY";
    if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  [...filteredSessions].sort((a, b) => b.updatedAt - a.updatedAt).forEach(session => {
    const group = formatDateGroup(session.updatedAt);
    if (!groups[group]) groups[group] = [];
    groups[group].push(session);
  });

  const openMenu = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.left + rect.width, y: rect.top });
    setMenuSession(session);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuSession(null);
        setMenuPosition(null);
      }
    };
    if (menuSession) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuSession]);

  const handleRename = () => {
    if (!menuSession) return;
    const newTitle = "Renamed Session"; // Defaulting or could use input if implemented
    onRenameSession(menuSession.id, newTitle);
    setMenuSession(null);
  };

  const handleDelete = () => {
    if (menuSession) {
      onDeleteSession(menuSession.id);
      setMenuSession(null);
    }
  };

  const handleShare = async () => {
    if (!menuSession) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/chat/${menuSession.id}`);
    } catch (err) {
      console.warn("Failed to copy link.");
    }
    setMenuSession(null);
  };

  const getSessionIcon = (session: ChatSession) => {
    if (session.isQuiz) return <div className="w-5 h-5 text-blue-400 shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>;
    if (session.isPPT) return <div className="w-5 h-5 text-orange-400 shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg></div>;
    return <div className="w-5 h-5 text-white/40 shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>;
  };

  return (
    <nav className="h-full flex flex-col bg-[#0c0d11] overflow-hidden select-none border-r border-white/5 relative" aria-label="Main Navigation">
      <div className="px-5 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          LYRA <span className="text-blue-500">Ai</span>
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-3 text-white/40 hover:text-white transition-colors lg:hidden" aria-label="Close sidebar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
      </div>

      <div className="px-4 sm:px-5 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#1a1c24] rounded-2xl px-4 py-3 border border-white/5 focus-within:border-blue-500/50 transition-all shadow-inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/40"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Search history" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-white placeholder-white/40 ml-3 w-full text-sm"
              aria-label="Search conversation history"
            />
          </div>
          <button onClick={() => onNewChat('chat')} className="p-3 text-white/40 hover:text-white transition-all bg-[#1a1c24] border border-white/5 rounded-xl hover:bg-white/5 shadow-lg active:scale-95" aria-label="Start new chat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-5 mb-6 space-y-1">
        <div className="px-2 mb-2"><h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">TOOLS</h3></div>
        <button onClick={onOpenLibrary} className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl transition-all group active:bg-white/10">
          <div className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-xl text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="12" height="12" x="2" y="10" rx="2" ry="2"></rect><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-5a2.24 2.24 0 0 0-3 0L10 6"></path></svg>
          </div>
          <span className="text-sm font-bold text-white/60 group-hover:text-white truncate">Library</span>
        </button>
      </div>

      <div className="px-6 sm:px-7 mb-4"><h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">RECENT HISTORY</h3></div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-8 space-y-6 custom-scrollbar">
        {Object.entries(groups).length > 0 ? Object.entries(groups).map(([date, items]) => (
          <div key={date} className="space-y-1">
            <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.15em] px-4 mb-2">{date}</h4>
            {items.map(session => (
              <div 
                key={session.id} 
                className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all ${activeSessionId === session.id ? 'bg-[#1a1c24] border border-white/5 shadow-md' : 'hover:bg-white/[0.03] active:bg-white/5'}`}
                onClick={() => onSelectSession(session.id)}
              >
                {getSessionIcon(session)}
                <p className={`text-sm font-medium truncate flex-1 ${activeSessionId === session.id ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>{session.title || 'New Session'}</p>
                <button 
                  onClick={(e) => openMenu(e, session)}
                  className="p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-white/40 hover:text-white transition-all rounded-lg hover:bg-white/10"
                  aria-label="Conversation options"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
              </div>
            ))}
          </div>
        )) : <div className="px-4 py-12 text-center"><p className="text-[10px] text-white/10 font-black uppercase tracking-widest">Archive Empty</p></div>}
      </div>

      {menuSession && menuPosition && (
        <div 
          ref={menuRef}
          className="fixed z-[100] w-60 bg-[#1c2231] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 py-2"
          style={{ left: `${Math.min(menuPosition.x, window.innerWidth - 260)}px`, top: `${Math.min(menuPosition.y, window.innerHeight - 200)}px` }}
          role="menu"
        >
          <button onClick={handleRename} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 text-white/80 hover:text-white transition-all group" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/20 group-hover:text-blue-400"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span className="text-sm font-bold">Rename</span>
          </button>
          <button onClick={handleShare} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 text-white/80 hover:text-white transition-all group" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/20 group-hover:text-blue-400"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span className="text-sm font-bold">Share</span>
          </button>
          <div className="h-px bg-white/5 my-1 mx-3" />
          <button onClick={handleDelete} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-red-500/10 text-red-400 transition-all group" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400/50 group-hover:text-red-400"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            <span className="text-sm font-bold">Delete</span>
          </button>
        </div>
      )}
    </nav>
  );
};

export default Sidebar;
