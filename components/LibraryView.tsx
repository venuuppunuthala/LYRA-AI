
import React, { useState, useEffect } from 'react';
import { ChatSession, Attachment } from '../types';

type LibraryTab = 'Images' | 'Pages' | 'PPT' | 'Quizzes';

interface LibraryViewProps {
  sessions: ChatSession[];
  initialTab?: LibraryTab;
  onBack: () => void;
  onDeleteImage: (sessionId: string, messageId: string, url: string) => void;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  // Fix: Added missing onSelectSession prop to fix "Cannot find name 'onSelectSession'" error
  onSelectSession: (id: string) => void;
}

interface ImageItem extends Attachment {
  sessionId: string;
  messageId: string;
}

const LibraryView: React.FC<LibraryViewProps> = ({ sessions, initialTab = 'Pages', onBack, onDeleteImage, onToggleSidebar, onNewChat, onSelectSession }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [selectedItem, setSelectedItem] = useState<{url: string, type: string, name?: string, sessionId?: string, messageId?: string} | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const images: ImageItem[] = sessions.flatMap(session => 
    session.messages.flatMap(msg => (msg.attachments || [])
      .filter(a => a.type === 'image')
      .map(at => ({ ...at, sessionId: session.id, messageId: msg.id }))
    )
  );

  const ppts = sessions.flatMap(session => 
    session.messages.flatMap(msg => (msg.attachments || [])
      .filter(a => a.type === 'ppt' || a.mimeType.includes('ppt'))
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

  const handleDelete = () => {
    const item = selectedItem;
    if (item && item.sessionId && item.messageId) {
      if (confirm("Delete this asset permanently from history?")) {
        onDeleteImage(item.sessionId, item.messageId, item.url);
        setSelectedItem(null);
      }
    }
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
          {selectedItem && (
            <>
              <button 
                onClick={handleDelete}
                className="w-10 h-10 flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
              </button>
              <button 
                onClick={() => handleDownload(selectedItem.url, selectedItem.name || 'lyra-asset.png')}
                className="w-10 h-10 flex items-center justify-center text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </>
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
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">
            {activeTab === 'Images' ? (
              <div className="flex flex-wrap justify-center gap-10">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedItem({url: img.url, type: 'image', sessionId: img.sessionId, messageId: img.messageId})} 
                    className={`group relative w-full md:w-[600px] aspect-square rounded-[2rem] md:rounded-[4rem] overflow-hidden bg-[#1a1c24] cursor-pointer border-2 transition-all duration-700 shadow-2xl ${
                      selectedItem?.url === img.url ? 'border-blue-500 scale-[1.02]' : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                       <span className="text-[11px] font-black text-white uppercase tracking-[0.4em]">Expand Protocol</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'Quizzes' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {(activeItems as ChatSession[]).map((session) => (
                  <div 
                    key={session.id} 
                    // Fix: onSelectSession is now correctly destructured and available
                    onClick={() => onSelectSession(session.id)}
                    className="p-8 bg-[#1a1c24] rounded-[2.5rem] border border-white/5 flex flex-col gap-6 hover:bg-[#252832] transition-all cursor-pointer group shadow-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      </div>
                      <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">{new Date(session.updatedAt).toLocaleDateString()}</span>
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
                {ppts.map((ppt, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedItem({url: ppt.url, type: 'ppt', name: ppt.name})} 
                    className="p-8 bg-[#1a1c24] rounded-[2.5rem] border border-white/5 flex flex-col gap-6 hover:bg-[#252832] transition-all cursor-pointer group shadow-xl"
                  >
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M2 7h20"/><path d="M12 17v4"/><path d="M8 21h8"/></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white truncate">{ppt.name || 'Presentation'}</h3>
                  </div>
                ))}
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

      {selectedItem && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-10 md:p-20">
           {/* Overlay Click Area handled by Header Back/Close or specific logic */}
        </div>
      )}
    </div>
  );
};

export default LibraryView;
