
import React, { useState, useEffect } from 'react';
import { ChatSession, Attachment } from '../types';

type LibraryTab = 'Images' | 'Pages' | 'PPT' | 'Quizzes';

interface LibraryViewProps {
  sessions: ChatSession[];
  initialTab?: LibraryTab;
  onBack: () => void;
  onDeleteImage: (sessionId: string, messageId: string, url: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

interface ImageItem extends Attachment {
  sessionId: string;
  messageId: string;
  timestamp?: number;
}

const LibraryView: React.FC<LibraryViewProps> = ({ sessions, initialTab = 'Pages', onBack, onDeleteImage, onDeleteSession, onToggleSidebar, onNewChat, onSelectSession }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [selectedItem, setSelectedItem] = useState<{url?: string, type: string, name?: string, sessionId?: string, messageId?: string, timestamp?: number} | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const images: ImageItem[] = sessions.flatMap(session => 
    session.messages.flatMap(msg => (msg.attachments || [])
      .filter(a => a.type === 'image')
      .map(at => ({ ...at, sessionId: session.id, messageId: msg.id, timestamp: msg.timestamp }))
    )
  );

  const ppts = sessions.flatMap(session => 
    session.messages.flatMap(msg => (msg.attachments || [])
      .filter(a => a.type === 'ppt' || a.mimeType.includes('ppt'))
      .map(at => ({ ...at, sessionId: session.id }))
    )
  );

  const quizzes = sessions.filter(s => s.isQuiz && s.messages.length > 0);
  
  const pages: any[] = [];

  const handleDownload = (url: string, name: string = 'file') => {
    if (!url || url === '#') {
      alert("No valid download link found.");
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = selectedItem;
    if (!item) return;

    if (item.type === 'quiz' || item.type === 'ppt-session') {
       if (item.sessionId && confirm("Delete this entire conversation and all associated history?")) {
         onDeleteSession(item.sessionId);
         setSelectedItem(null);
       }
    } else if (item.sessionId && item.messageId && item.url) {
      if (confirm("Delete this asset permanently from history?")) {
        onDeleteImage(item.sessionId, item.messageId, item.url);
        setSelectedItem(null);
      }
    }
  };

  const getSessionTitle = (sessionId?: string) => {
    if (!sessionId) return "Unknown Session";
    return sessions.find(s => s.id === sessionId)?.title || "Untitled Chat";
  };

  const tabs: LibraryTab[] = ['Images', 'Pages', 'PPT', 'Quizzes'];

  const getItemsForTab = () => {
    switch(activeTab) {
      case 'Images': return images;
      case 'PPT': return ppts;
      case 'Quizzes': return quizzes;
      case 'Pages': return pages;
      default: return [];
    }
  };

  const activeItems = getItemsForTab();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c10] animate-in fade-in duration-500 overflow-hidden font-sans">
      <header className="px-8 h-20 flex items-center justify-between border-b border-white/[0.03] bg-black/40 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-xl border border-white/5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button 
            onClick={onBack} 
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-xl border border-white/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
        </div>

        <h1 className="text-sm font-black text-white tracking-[0.4em] uppercase">Library</h1>

        <div className="flex gap-3">
          {selectedItem && (selectedItem.type === 'quiz' || selectedItem.type === 'ppt-session') && (
            <button 
              onClick={(e) => handleDelete(e)}
              className="w-10 h-10 flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            </button>
          )}
          {!selectedItem && (
            <button 
              className="w-10 h-10 flex items-center justify-center text-white/20 bg-white/5 rounded-xl border border-white/5 cursor-not-allowed"
              disabled
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          )}
        </div>
      </header>

      <div className="px-8 py-6 flex gap-3 overflow-x-auto no-scrollbar bg-black/20 border-b border-white/[0.02]">
        {tabs.map(tab => (
          <button 
            key={tab} 
            onClick={() => { setActiveTab(tab); setSelectedItem(null); }} 
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
              activeTab === tab 
              ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/20' 
              : 'bg-white/5 text-white/30 border-white/5 hover:text-white/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar relative">
        {activeItems.length > 0 ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center w-full">
            {activeTab === 'Images' ? (
              <div className="flex flex-wrap justify-center gap-10">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedItem({url: img.url, type: 'image', sessionId: img.sessionId, messageId: img.messageId, timestamp: img.timestamp, name: img.name})} 
                    className={`group relative w-full md:w-[600px] aspect-square rounded-[2rem] md:rounded-[4rem] overflow-hidden bg-[#1a1c24] cursor-pointer border-2 transition-all duration-700 shadow-2xl ${
                      selectedItem?.url === img.url ? 'border-blue-500 scale-[1.02]' : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                       <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">View Details</span>
                          <span className="text-[9px] text-white/40 uppercase tracking-widest">{new Date(img.timestamp || Date.now()).toLocaleDateString()}</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'Quizzes' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {(activeItems as ChatSession[]).map((session) => (
                  <div 
                    key={session.id} 
                    onClick={() => onSelectSession(session.id)}
                    className={`p-8 bg-[#1a1c24] rounded-[2.5rem] border flex flex-col gap-6 hover:bg-[#252832] transition-all cursor-pointer group shadow-xl relative ${
                       selectedItem?.sessionId === session.id ? 'border-blue-500 scale-[1.02]' : 'border-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <div className="flex gap-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setSelectedItem({type: 'quiz', sessionId: session.id}); handleDelete(e); }}
                           className="w-10 h-10 flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                         >
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                         </button>
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">{new Date(session.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 truncate">{session.title}</h3>
                      <span className="text-[9px] font-black text-blue-500/60 border border-blue-500/20 bg-blue-500/5 px-3 py-1 rounded-full uppercase tracking-widest">Score: {session.quizState?.score || 0}/5</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {activeTab === 'PPT' ? ppts.map((ppt, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedItem({url: ppt.url, type: 'ppt', name: ppt.name, sessionId: ppt.sessionId})} 
                    className={`p-8 bg-[#1a1c24] rounded-[2.5rem] border flex flex-col gap-6 hover:bg-[#252832] transition-all cursor-pointer group shadow-xl ${
                       selectedItem?.url === ppt.url ? 'border-blue-500 scale-[1.02]' : 'border-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                       <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setSelectedItem({type: 'ppt-session', sessionId: ppt.sessionId}); handleDelete(e); }}
                           className="w-10 h-10 flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                         >
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDownload(ppt.url, ppt.name); }}
                           className="w-10 h-10 flex items-center justify-center text-blue-500 bg-blue-500/10 hover:bg-blue-500 hover:text-white rounded-xl border border-blue-500/20 transition-all opacity-0 group-hover:opacity-100"
                         >
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                         </button>
                       </div>
                    </div>
                    <h3 className="text-lg font-bold text-white truncate">{ppt.name || 'Presentation'}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/40 uppercase">OpenXML</span>
                       <span className="text-[8px] font-black bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-400 uppercase">Archived</span>
                    </div>
                  </div>
                )) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 opacity-10">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            <h2 className="text-3xl font-black text-white uppercase tracking-[0.4em] select-none pointer-events-none">Empty Node</h2>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setSelectedItem(null)}
        >
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" />
          
          <div 
            className="relative w-full max-w-7xl h-full flex flex-col md:flex-row bg-[#0a0c10] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Section */}
            <div className="flex-1 bg-black/40 flex items-center justify-center p-6 md:p-12 relative overflow-hidden group/preview">
              {selectedItem.type === 'image' ? (
                <img 
                  src={selectedItem.url} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-transform duration-700 group-hover/preview:scale-[1.02]" 
                  alt="Detail Preview" 
                />
              ) : (
                <div className="flex flex-col items-center gap-6">
                   <div className="w-32 h-32 rounded-3xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
                   </div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-widest">{selectedItem.name}</h3>
                </div>
              )}
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-8 left-8 w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 transition-all z-10"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Sidebar Details */}
            <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-white/5 flex flex-col p-10 bg-[#0d0f14]">
               <div className="mb-10">
                 <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">Asset Details</h2>
                 <h3 className="text-2xl font-bold text-white mb-2 truncate" title={selectedItem.name || 'AI Generated Asset'}>
                   {selectedItem.name || 'Visual Synthesis'}
                 </h3>
                 <p className="text-white/40 text-sm leading-relaxed">
                   High-fidelity multimodal generation captured via LYRA Ai core.
                 </p>
               </div>

               <div className="space-y-8 flex-1">
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Asset Lifecycle</span>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <span className="text-white/80 font-medium">{new Date(selectedItem.timestamp || Date.now()).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Parent Session</span>
                    <button 
                      onClick={() => selectedItem.sessionId && onSelectSession(selectedItem.sessionId)}
                      className="flex items-center gap-3 group/source text-left p-3 -m-3 hover:bg-white/5 rounded-2xl transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/source:bg-blue-500 group-hover/source:text-white transition-all">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <span className="text-white/80 font-medium group-hover/source:text-blue-400 transition-colors truncate max-w-[200px]">{getSessionTitle(selectedItem.sessionId)}</span>
                    </button>
                  </div>
               </div>

               <div className="mt-auto pt-10 grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleDelete}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[2rem] border border-red-500/20 transition-all active:scale-95"
                  >
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                     <span className="text-[10px] font-black uppercase tracking-widest">Delete</span>
                  </button>
                  <button 
                    onClick={() => selectedItem.url && handleDownload(selectedItem.url, selectedItem.name)}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] border border-white/10 shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                  >
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                     <span className="text-[10px] font-black uppercase tracking-widest">Download</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryView;
