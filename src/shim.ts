
// Shim process and global for library compatibility
// This MUST be imported before any other module that might use process or Buffer

import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  const shim = {
    env: { NODE_ENV: 'development' },
    version: 'v18.0.0',
    versions: { node: '18.0.0' },
    browser: true,
    cwd: () => '/',
    nextTick: (fn: any) => setTimeout(fn, 0),
  };
  
  if (!(window as any).process) {
    (window as any).process = shim;
  } else {
    // Merge if already exists to avoid breaking existing process objects
    (window as any).process.env = { ...shim.env, ...(window as any).process.env };
    (window as any).process.cwd = (window as any).process.cwd || shim.cwd;
    (window as any).process.nextTick = (window as any).process.nextTick || shim.nextTick;
  }
  
  (window as any).global = (window as any).global || window;
  (window as any).Buffer = (window as any).Buffer || Buffer;

  window.onerror = function(msg, url, line, col, error) {
    const errorDetails = {
      message: msg,
      url: url,
      line: line,
      column: col,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : String(error)
    };
    console.error("Global Intelligence Exception:", JSON.stringify(errorDetails, null, 2));
    return false;
  };

  window.onunhandledrejection = function(event) {
    const reason = event.reason;
    const errorDetails = {
      message: "Unhandled rejection at intelligence level",
      reason: reason instanceof Error ? {
        message: reason.message,
        stack: reason.stack
      } : String(reason)
    };
    console.error("Critical Rejection Caught:", JSON.stringify(errorDetails, null, 2));
  };
  
  console.log("Shims applied successfully.");
}

export {};
