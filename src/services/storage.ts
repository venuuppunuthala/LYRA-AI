/**
 * Intelligent Storage Manager for Lyra AI
 * Handles QuotaExceededError by implementing auto-cleanup of old sessions.
 */

const MAX_SESSIONS = 50; // Limit total sessions
const LARGE_DATA_THRESHOLD = 100000; // 100KB - triggers cleanup if session is too big

export const safeSaveToLocalStorage = (key: string, data: any): boolean => {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return false;
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
      console.warn("Storage quota exceeded. Initiating intelligence-based cleanup.");
      
      if (!Array.isArray(data)) {
        localStorage.clear();
        return true;
      }

      // 1. Sort sessions by updatedAt descending (newest first)
      const sortedSessions = [...data].sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

      // 2. Progressive Truncation: Try keeping fewer and fewer sessions with attachments
      // Start by keeping 10, then 5, then 3, then 1.
      const limits = [25, 10, 5, 3, 1];
      
      for (const limit of limits) {
        try {
          const truncated = sortedSessions.slice(0, MAX_SESSIONS).map((s: any, idx: number) => {
            if (idx >= limit) {
              return {
                ...s,
                messages: s.messages.map((m: any) => ({
                  ...m,
                  attachments: [] // Purge attachments for older sessions
                })),
                attachments: [] // Purge session-level attachments if any
              };
            }
            return s;
          });

          localStorage.setItem(key, JSON.stringify(truncated));
          console.log(`Cleanup successful. Retained ${limit} sessions with full fidelity.`);
          return true;
        } catch (retryError) {
          continue; // Try next more aggressive limit
        }
      }

      // 3. Nuclear option: Keep only the most recent session metadata, NO attachments, NO messages
      try {
        console.error("Critical storage depletion. Retaining minimal metadata only.");
        const skeletalData = sortedSessions.slice(0, 10).map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
          messages: [],
          attachments: []
        }));
        localStorage.setItem(key, JSON.stringify(skeletalData));
        return true;
      } catch (lastDitchError) {
        localStorage.clear();
        console.error("Absolute storage failure. Cache cleared.");
        return true;
      }
    } else {
      console.error("Storage Exception:", error);
      return false;
    }
  }
};

export const safeLoadFromLocalStorage = (key: string): any | null => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to recover data from storage:", e);
    return null;
  }
};
