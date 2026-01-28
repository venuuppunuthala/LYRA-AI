
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { Message, Attachment } from "../types";

// Always create a fresh instance right before usage as per guidelines to get the latest API key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * Robustly extracts a status code or error code from various error object structures.
 */
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
    errorJson.includes("403") ||
    errorJson.includes("PERMISSION DENIED")
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

export const generateTextChat = async (
  prompt: string,
  history: { role: string; parts: any[] }[],
  attachments: Attachment[] = [],
  systemInstruction?: string,
  toolType: 'search' | 'maps' = 'search'
): Promise<GenerateContentResponse> => {
  const aiCall = async () => {
    const ai = getAI();
    const parts: any[] = [{ text: prompt }];
    
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

    const baseInstruction = `
      You are LYRA Ai, a high-performance research assistant. 
      For EVERY user question, you must strictly follow this process:
      1. Analyze context and intent.
      2. Use Grounding Tools (Search or Maps) for up-to-date information when relevant.
      3. Cross-reference sources.
      4. Synthesize the best possible response.
      Always prioritize real-time accuracy and a sophisticated, professional tone.
    `;

    const model = toolType === 'maps' ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';
    const tools: any[] = toolType === 'maps' ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
    
    // Add Search if Maps is used, as per documentation they can be used together
    if (toolType === 'maps') {
      tools.push({ googleSearch: {} });
    }

    const config: any = {
      tools,
      systemInstruction: systemInstruction || baseInstruction,
      temperature: 0.7,
      topP: 0.95,
      topK: 40
    };

    // If Maps tool is used, try to get user location
    if (toolType === 'maps' && navigator.geolocation) {
       try {
         const pos = await new Promise<GeolocationPosition>((res, rej) => 
           navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
         );
         config.toolConfig = {
           retrievalConfig: {
             latLng: {
               latitude: pos.coords.latitude,
               longitude: pos.coords.longitude
             }
           }
         };
       } catch (e) {
         console.warn("Geolocation failed, using default context for Maps", e);
       }
    }

    return await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: 'user', parts }
      ],
      config
    });
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (isKeyResetRequired(error)) {
      throw new Error("KEY_RESET_REQUIRED");
    }
    const status = getErrorStatus(error);
    const message = error.message || "";
    if (status === 429 || message.includes("429") || message.includes("quota")) {
      throw new Error("QUOTA_EXHAUSTED: You've reached your API rate limit or quota.");
    }
    throw error;
  }
};

export const generateImage = async (
  prompt: string, 
  size: "1K" | "2K" | "4K" = "1K", 
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1"
): Promise<string | undefined> => {
  const aiCall = async () => {
    const ai = getAI();
    const isPro = size === "2K" || size === "4K";
    const modelName = isPro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    
    const config: any = {
      imageConfig: {
        aspectRatio
      }
    };
    
    if (isPro) {
      config.imageConfig.imageSize = size;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: prompt }]
      },
      config
    });

    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (isKeyResetRequired(error)) {
        throw new Error("KEY_RESET_REQUIRED");
    }
    return undefined;
  }
};

export const encodeAudio = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decodeAudio = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
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
