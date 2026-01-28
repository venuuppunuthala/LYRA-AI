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
  pptData?: PPTData;
  quizQuestions?: QuizQuestion[]; // For the current batch of MCQ
  hasMoreInfo?: boolean; 
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
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'ppt';
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
}