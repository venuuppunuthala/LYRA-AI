
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

// Always create a fresh instance right before usage to get the latest API key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
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

/**
 * Text Generation with specific model selection:
 * - gemini-3-pro-preview: For image/audio understanding and complex analysis.
 * - gemini-3-flash-preview: For search-grounded queries and document analysis.
 * - gemini-flash-lite-latest: For low-latency fast responses.
 */
export const generateTextChat = async (
  prompt: string,
  history: { role: string; parts: any[] }[],
  attachments: Attachment[] = [],
  systemInstruction?: string,
  toolType: 'search' | 'maps' | 'none' = 'search',
  complexity: 'lite' | 'normal' | 'pro' = 'normal'
): Promise<GenerateContentResponse> => {
  const aiCall = async () => {
    const ai = getAI();
    const parts: any[] = [{ text: prompt || "Analyze the attached content." }];
    
    const hasImages = attachments.some(a => a.type === 'image');
    const hasDocs = attachments.some(a => a.mimeType === 'application/pdf' || a.mimeType.includes('text/plain'));
    const hasAudio = attachments.some(a => a.type === 'audio');
    
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

    let model = 'gemini-3-flash-preview'; // Default for search and general tasks
    
    if (hasImages || hasAudio || complexity === 'pro' || hasDocs) {
      model = 'gemini-3-pro-preview'; // Upgrade for deep content understanding
    } else if (complexity === 'lite') {
      model = 'gemini-flash-lite-latest';
    } else if (toolType === 'maps') {
      model = 'gemini-2.5-flash';
    }

    const tools: any[] = [];
    if (toolType === 'search') tools.push({ googleSearch: {} });
    if (toolType === 'maps') tools.push({ googleMaps: {} }, { googleSearch: {} });
    
    const baseInstruction = `
      You are LYRA Ai, an elite multimodal research assistant powered by advanced Gemini technology.
      1. For IMAGE input: Perform deep visual analysis. Identify context, objects, text, and patterns.
      2. For DOCUMENTS (PDF, TXT): Act as a master analyst. Extract impactful data points and cite specifically.
      3. For AUDIO: Listen carefully. Transcribe if needed, analyze acoustic properties, speaker intent, or summarize discussions.
      4. For SEARCH: Use Google Search for up-to-date facts.
      Tone: Sophisticated, minimal, and highly capable.
    `;

    const config: any = {
      tools: tools.length > 0 ? tools : undefined,
      systemInstruction: systemInstruction || baseInstruction,
      temperature: 0.4,
      topP: 0.95,
      topK: 40
    };

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
    throw error;
  }
};

/**
 * Image Generation using Nano Banana series (gemini-2.5-flash-image and gemini-3-pro-image-preview)
 */
export const generateImage = async (
  prompt: string, 
  size: "1K" | "2K" | "4K" = "1K", 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1"
): Promise<string | undefined> => {
  const aiCall = async () => {
    const ai = getAI();
    const isPro = size === "2K" || size === "4K";
    const model = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    
    const config: any = {
      imageConfig: {
        aspectRatio,
        ...(isPro ? { imageSize: size } : {})
      }
    };

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: prompt }]
      },
      config
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
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
    console.error("Image generation failed:", error);
    return undefined;
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
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
