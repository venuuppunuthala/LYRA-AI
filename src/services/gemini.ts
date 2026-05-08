
import { GoogleGenAI, GenerateContentResponse, Type, Modality, ThinkingLevel } from "@google/genai";
import { Message, Attachment } from "../types";

export const cleanJsonString = (str: string) => {
  if (!str) return "";
  // Resolve markdown JSON blocks
  const match = str.match(/```json\n([\s\S]*?)\n```/) || str.match(/```\n([\s\S]*?)\n```/);
  const cleaned = match ? match[1] : str;
  return cleaned.trim();
};

// Always create a fresh instance right before usage to get the latest API key
export const getApiKey = () => {
  const win = typeof window !== 'undefined' ? window : {} as any;
  const proc = win.process || (typeof process !== 'undefined' ? process : undefined);
  const key = proc?.env?.GEMINI_API_KEY;
  return key;
};

export const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === "") {
    throw new Error("GEMINI_API_KEY is missing. Please set it in the platform environment variables or the settings menu.");
  }
  return new GoogleGenAI({ apiKey });
};

const getErrorStatus = (error: any): number | undefined => {
  if (!error) return undefined;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.code === 'number') return error.code;
  if (error.error) {
    if (typeof error.error.code === 'number') return error.error.code;
    if (typeof error.error.status === 'number') return error.error.status;
  }
  if (error.response && typeof error.response.status === 'number') return error.response.status;
  return undefined;
};

const isKeyResetRequired = (error: any): boolean => {
  const status = getErrorStatus(error);
  const errorJson = JSON.stringify(error).toUpperCase();
  const message = (error.message || "").toUpperCase();
  return (
    status === 403 || 
    status === 404 || 
    message.includes("PERMISSION_DENIED") || 
    message.includes("REQUESTED ENTITY WAS NOT FOUND") ||
    errorJson.includes("PERMISSION_DENIED") ||
    errorJson.includes("403")
  );
};

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = getErrorStatus(error);
      if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; 
    }
  }
  throw lastError;
}

export const handleGeminiError = (error: any): string => {
  if (error?.name === 'AbortError' || error?.message === 'AbortError' || error?.message?.includes('AbortError')) {
    return 'AbortError';
  }

  console.error("Gemini API Error Detail:", error);
  
  const message = error?.message || String(error);
  const errorJson = JSON.stringify(error);
  
  if (errorJson.includes("RESOURCE_EXHAUSTED") || message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("limit")) {
    const retryMatch = errorJson.match(/retry in ([\d\w.]+)/i) || message.match(/retry in ([\d\w.]+)/i);
    const retryTime = retryMatch ? ` System recovery expected in ${retryMatch[1]}.` : " Please wait a moment before trying again.";
    return `The AI system is currently at its processing limit (Quota Exceeded).${retryTime}`;
  }
  
  if (message.includes("401") || message.includes("403") || message.toLowerCase().includes("api key") || message.toLowerCase().includes("unauthorized")) {
    return "Authentication failed. Please verify your Gemini API Key in the settings menu.";
  }
  
  if (message.toLowerCase().includes("safety") || message.toLowerCase().includes("blocked")) {
    return "The request was declined by the AI safety filters. Please try rephrasing your prompt.";
  }
  
  if (message.includes("503") || message.toLowerCase().includes("overloaded") || message.toLowerCase().includes("deadline")) {
    return "The AI model is currently overloaded or timed out. Please try again in a few seconds.";
  }

  if (message.toLowerCase().includes("network") || message.toLowerCase().includes("fetch")) {
    return "Network connection issue. Please check your internet connectivity.";
  }

  return `An unexpected AI intelligence error occurred: ${message.slice(0, 100)}...`;
};

/**
 * Text Generation with specific model selection:
 * - gemini-3.1-pro-preview: For deep image/audio understanding and complex multimodal analysis.
 * - gemini-3.1-flash-preview: For search-grounded queries and document analysis.
 * - gemini-3.1-flash-lite-preview: For ultra-fast responses.
 */
export const generateTextChat = async (
  prompt: string,
  history: { role: string; parts: any[] }[],
  attachments: Attachment[] = [],
  systemInstruction?: string,
  toolType: 'search' | 'maps' | 'none' = 'search',
  complexity: 'lite' | 'normal' | 'pro' = 'normal',
  signal?: AbortSignal,
  modelOverride?: string
): Promise<GenerateContentResponse> => {
  const aiCall = async () => {
    if (signal?.aborted) throw new Error("AbortError");
    const ai = getAI();
    const parts: any[] = [{ text: prompt || "Analyze the attached content." }];
    
    for (const attachment of attachments) {
      if (attachment.data) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data
          }
        });
      }
    }

    // Auto-detect educational/complex queries
    const complexKeywords = ['explain', 'why', 'solve', 'analyze', 'compare', 'contrast', 'scientific', 'mathematical', 'history', 'theory'];
    const isEducationalQuery = complexKeywords.some(word => prompt.toLowerCase().includes(word));

    let model = modelOverride || 'gemini-3-flash-preview'; 
    
    if (!modelOverride) {
      if (complexity === 'pro' || (isEducationalQuery && !attachments.some(a => a.type === 'audio'))) {
        model = 'gemini-3.1-pro-preview';
      }
    }

    const tools: any[] = [];
    if (toolType === 'search' || isEducationalQuery) tools.push({ googleSearch: {} });
    if (toolType === 'maps') tools.push({ googleMaps: {} });
    
    const baseInstruction = `
      You are LYRA AI, a World-Class AI-Powered Personal Assistant for Adaptive Education. 
      Your purpose is to provide fast, hyper-accurate, and pedagogically sound responses to learners and educators.

      1. PEDAGOGICAL ACCURACY:
         - Provide structured explanations. Break down complex topics into digestible "intelligence nodes".
         - Use Socratic methods where appropriate to guide the user to the answer.
         - Accuracy is paramount. Use Google Search to verify any historical, scientific, or mathematical claims.

      2. MULTIMODAL INTELLIGENCE:
         - Visual: Analyze diagrams, handwritten notes, and textbook pages with sub-pixel precision.
         - Audio: Transcribe and summarize lectures, identifying key learning objectives.
         - Documents: Extract data from PDFs and research papers, maintaining context across high-page counts.

      3. ADAPTIVITY:
         - Tone: Professional, encouraging, and clear.
         - Level: Adjust complexity based on the user's perceived level of expertise.

      4. FORMATTING:
         - Use professional Markdown.
         - Use LaTeX for mathematical formulas: $E=mc^2$ or $$PE = mgh$$.
         - Structural lists and bold highlights are mandatory for key concepts.
    `;

    const config: any = {
      tools: tools.length > 0 ? tools : undefined,
      systemInstruction: systemInstruction || baseInstruction,
      temperature: 0.4,
      topP: 0.95,
      topK: 40
    };

    if (model === 'gemini-3.1-pro-preview' && complexity === 'pro') {
      config.thinkingConfig = { 
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH 
      };
    }

    if (toolType === 'maps' && navigator.geolocation) {
       try {
         const pos = await new Promise<GeolocationPosition>((res, rej) => 
           navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
         );
         config.toolConfig = {
           retrievalConfig: {
             latLng: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
           }
         };
       } catch (e) {
         console.warn("Geolocation unavailable", e);
       }
    }

    return await ai.models.generateContent({
      model,
      contents: [...history, { role: 'user', parts }],
      config
    });
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (isKeyResetRequired(error)) throw new Error("KEY_RESET_REQUIRED");
    
    // Fallback logic for Pro model quota exhaustion
    const message = error?.message || "";
    const isActuallyUsingPro = complexity === 'pro' || modelOverride === 'gemini-3.1-pro-preview'; 
    if (!modelOverride && isActuallyUsingPro && (message.includes("429") || message.includes("Quota") || message.includes("limit"))) {
      console.warn("Text Chat: Quota exceeded for Pro model, falling back to Flash synthesis.");
      return generateTextChat(prompt, history, attachments, systemInstruction, toolType, 'normal', signal, 'gemini-3-flash-preview');
    }
    
    throw new Error(handleGeminiError(error));
  }
};

/**
 * Image Generation using Nano Banana
 */
export const generateImage = async (
  prompt: string, 
  size: "512px" | "1K" | "2K" | "4K" = "1K", 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1" = "1:1",
  quality: "standard" | "high" | "pro" | "nano-banana" = "standard",
  useSearch: boolean = false,
  signal?: AbortSignal
): Promise<string | undefined> => {
  const aiCall = async () => {
    if (signal?.aborted) throw new Error("AbortError");
    const ai = getAI();
    
    const model = 'gemini-2.5-flash-image';
    const config: any = {
      imageConfig: {
        aspectRatio,
        imageSize: size
      }
    };

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return undefined;
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (isKeyResetRequired(error)) throw new Error("KEY_RESET_REQUIRED");
    
    const status = getErrorStatus(error);
    if (status === 429 && quality !== 'standard' && !signal?.aborted) {
      const lowerQuality = quality === 'pro' ? 'high' : 'standard';
      console.warn(`Quota exceeded for ${quality} image quality. Retrying with ${lowerQuality} synthesis.`);
      return generateImage(prompt, size, aspectRatio, lowerQuality, useSearch, signal);
    }
    
    if (error.message === "AbortError" || signal?.aborted) return "AbortError";
    throw new Error(handleGeminiError(error));
  }
};

export const encodeAudio = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const decodeAudio = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

export async function decodeAudioDataToBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  try {
    // Ensure we're working with the correct view of the buffer
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  } catch (e) {
    console.error("Audio decoding failed:", e);
    throw e;
  }
}
