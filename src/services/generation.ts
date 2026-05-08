
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import pptxgen from "pptxgenjs";
import { PPTData, Attachment, QuizQuestion, ScanAnalysis } from "../types";
import { cleanJsonString, handleGeminiError, withRetry } from "./gemini";

export const generatePptxFile = async (data: PPTData): Promise<string> => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  for (const slideData of data.slides) {
    const slide = pres.addSlide();
    if (slideData.imageUrl) {
      slide.background = { path: slideData.imageUrl };
    } else {
      slide.background = { color: slideData.accentColor?.replace('#', '') || '0F1118' };
    }
    slide.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: '000000', transparency: 50 }
    });
    slide.addText(slideData.title, {
      x: 0.5, y: 0.5, w: '90%',
      fontSize: 44, bold: true, color: 'FFFFFF',
      fontFace: 'Inter'
    });
    if (slideData.subtitle) {
      slide.addText(slideData.subtitle, {
        x: 0.5, y: 1.5, w: '90%',
        fontSize: 24, color: 'BBBBBB',
        fontFace: 'Inter'
      });
    }
    const bulletPoints = slideData.content.map(text => ({ text, options: { bullet: true, color: 'EEEEEE', fontSize: 18 } }));
    slide.addText(bulletPoints as any, {
      x: 0.5, y: 2.5, w: '90%', h: 3,
      valign: 'top', fontFace: 'Inter'
    });
  }
  
  try {
    const blob = await pres.write({ outputType: 'blob' });
    return URL.createObjectURL(blob as Blob);
  } catch (error) {
    console.error("PPT Write error:", error);
    throw error;
  }
};

export const generatePPTData = async (
  topic: string, 
  slideCount: number, 
  context: string, 
  attachments: Attachment[], 
  apiKey: string, 
  signal?: AbortSignal,
  model = 'gemini-3.1-pro-preview'
): Promise<PPTData> => {
  const aiCall = async () => {
    if (signal?.aborted) throw new Error("AbortError");
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ 
      text: `Act as the LYRA Multimodal Intelligence Architect. Synthesize a professional, high-impact deck for "${topic}" using peak-fidelity reasoning. 
      Slide count: ${slideCount}. 
      Context/Data provided: ${context || "AI-driven research"}.
      Create a fluid narrative flow with sub-pixel attention to detail. Return ONLY valid JSON.` 
    }];
    
    for (const att of attachments) {
      if (att.data) {
        parts.push({
          inlineData: { mimeType: att.mimeType, data: att.data }
        });
      }
    }

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                layout: { type: Type.STRING, enum: ['hero', 'split', 'grid', 'list', 'image-focus'] },
                title: { type: Type.STRING },
                subtitle: { type: Type.STRING },
                content: { type: Type.ARRAY, items: { type: Type.STRING } },
                accentColor: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ['layout', 'title', 'content', 'accentColor']
            }
          }
        }
      }
    };

    if (model.includes('pro')) {
      config.thinkingConfig = { 
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH 
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config
    });

    const cleaned = cleanJsonString(response.text || "");
    return JSON.parse(cleaned);
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (model === 'gemini-3.1-pro-preview' && (error.message?.includes("429") || error.message?.includes("Quota"))) {
       console.warn("PPT Gen: Quota exceeded for Pro model, falling back to Flash synthesis.");
       return generatePPTData(topic, slideCount, context, attachments, apiKey, signal, 'gemini-1.5-flash');
    }
    throw new Error(handleGeminiError(error));
  }
};

export const generateQuizData = async (
  topic: string, 
  difficulty: string, 
  attachments: Attachment[], 
  apiKey: string, 
  signal?: AbortSignal,
  model = 'gemini-3.1-pro-preview'
): Promise<QuizQuestion[]> => {
  const aiCall = async () => {
    if (signal?.aborted) throw new Error("AbortError");
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [{ 
      text: `You are LYRA AI, a World-Class Multimodal Personal Assistant. 
      Generate 5 advanced-level multiple choice questions for the topic: "${topic}" at ${difficulty} depth.
      Focus on deep conceptual understanding, critical reasoning, and real-world application. 
      
      INSTRUCTIONS:
      1. If source data (attachments) is provided, base the questions EXCLUSIVELY on the content of the attached files.
      2. Provide detailed, high-IQ explanations for each answer.
      3. Include a "contextual example" for each question that connects the theory to a practical scenario.
      4. Ensure the options are challenging and distinguish between subtle misconceptions.
      
      Return ONLY valid JSON array of objects.` 
    }];
    
    for (const att of attachments) {
      if (att.data) {
        parts.push({
          inlineData: { mimeType: att.mimeType, data: att.data }
        });
      }
    }

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            example: { type: Type.STRING }
          },
          required: ['question', 'options', 'correctIndex', 'explanation']
        }
      }
    };

    if (model.includes('pro')) {
      config.thinkingConfig = { 
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH 
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config
    });

    const cleaned = cleanJsonString(response.text || "");
    return JSON.parse(cleaned);
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (model === 'gemini-3.1-pro-preview' && (error.message?.includes("429") || error.message?.includes("Quota"))) {
      console.warn("Quiz Gen: Quota exceeded for Pro model, falling back to Flash synthesis.");
      return generateQuizData(topic, difficulty, attachments, apiKey, signal, 'gemini-1.5-flash');
    }
    throw new Error(handleGeminiError(error));
  }
};

export const generateScanAnalysis = async (
  base64Image: string, 
  apiKey: string, 
  signal?: AbortSignal,
  model = 'gemini-3.1-pro-preview'
): Promise<ScanAnalysis> => {
  const aiCall = async () => {
    if (signal?.aborted) throw new Error("AbortError");
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [
      { 
        text: `You are LYRA Optical Intelligence. Analyze this high-resolution sensor snapshot with maximum multimodal precision.
        
        GOALS:
        1. Identify the CATEGORY of the scan (Document, Business Card, Receipt, Intelligent Object, Text, or Handwriting).
        2. Extract ALL relevant structured data points (names, dates, totals, key points, specifications).
        3. Provide a high-IQ executive summary of the content.
        4. Suggest 3 intelligent "Next-Best-Actions" based on the content (e.g., if it's a receipt, suggest expense logging; if a business card, suggest CRM sync).
        
        Return ONLY valid JSON.` 
      },
      {
        inlineData: { mimeType: 'image/jpeg', data: base64Image }
      }
    ];

    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: ['document', 'business_card', 'receipt', 'object', 'text', 'handwriting'] },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          extractedData: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
          actionSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['category', 'title', 'summary', 'extractedData', 'actionSuggestions']
      }
    };

    if (model.includes('pro')) {
      config.thinkingConfig = { 
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH 
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config
    });

    const cleaned = cleanJsonString(response.text || "");
    return JSON.parse(cleaned);
  };

  try {
    return await withRetry(aiCall);
  } catch (error: any) {
    if (model === 'gemini-3.1-pro-preview' && (error.message?.includes("429") || error.message?.includes("Quota"))) {
      console.warn("Scan Synthesis: Quota exceeded for Pro model, falling back to Flash synthesis.");
      return generateScanAnalysis(base64Image, apiKey, signal, 'gemini-1.5-flash');
    }
    throw new Error(handleGeminiError(error));
  }
};

export const generateQuizSummary = async (
  topic: string, 
  score: number, 
  total: number, 
  apiKey: string
): Promise<string> => {
  const aiCall = async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: `Generate a high-IQ, encouraging certification analysis for a student who finished a quiz on "${topic}". 
      Score: ${score}/${total}. 
      Tone: Elite Academic Assistant, professional yet inspiring.
      Use professional Markdown and mention specific proficiency levels based on their score.` }] }],
      config: {
        temperature: 0.7,
        topP: 0.95
      }
    });

    return response.text || "Assessment cycle terminated.";
  };

  try {
    return await withRetry(aiCall);
  } catch (error) {
    return `Cycle complete. Final score: **${score}/${total}**. Your performance in **${topic}** has been calibrated.`;
  }
};
