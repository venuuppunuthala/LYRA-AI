export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  groundingUrls?: GroundingSource[];
  isThinking?: boolean;
  isQuizAction?: boolean; // For difficulty buttons
  isPPTAction?: boolean; // For Generate/Paste/Import buttons
  isDocAction?: boolean; // For Document analysis buttons
  isImageAction?: boolean; // For Image analysis buttons
  isScanAction?: boolean; // For Scan analysis state
  scanAnalysis?: ScanAnalysis; 
  pptData?: PPTData;
  quizQuestions?: QuizQuestion[]; // For the current batch of MCQ
  hasMoreInfo?: boolean; 
}

export interface ScanAnalysis {
  category: 'document' | 'business_card' | 'receipt' | 'object' | 'text' | 'handwriting';
  title: string;
  summary: string;
  extractedData: Record<string, string>;
  actionSuggestions: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  example?: string;
}

export interface PPTData {
  theme: string;
  slides: PPTSlide[];
}

export interface PPTSlide {
  layout: 'hero' | 'split' | 'grid' | 'list' | 'image-focus';
  title: string;
  subtitle?: string;
  content: string[];
  imageUrl?: string;
  accentColor?: string;
  imagePrompt?: string;
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'ppt' | 'document';
  url: string;
  mimeType: string;
  data?: string; // Base64
  name?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface QuizState {
  step: 'topic' | 'difficulty' | 'ongoing' | 'finished';
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'advanced';
  score: number;
  currentQuestionIndex: number;
}

export interface PPTState {
  step: 'topic' | 'slides' | 'method' | 'input' | 'generating' | 'completed';
  topic?: string;
  slideCount?: number;
  method?: 'generate' | 'paste' | 'import';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isQuiz?: boolean;
  quizState?: QuizState;
  isPPT?: boolean;
  pptState?: PPTState;
  isHiddenOnHome?: boolean;
  attachments: Attachment[];
}

export interface ImageGenOptions {
  imageGen: boolean;
  size: "512px" | "1K" | "2K" | "4K";
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1";
  quality: "standard" | "high" | "pro" | "nano-banana";
  useSearch?: boolean;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
