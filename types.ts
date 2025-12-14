export enum VoiceType {
  AI = 'AI',
  LOCAL = 'LOCAL'
}

export type SenderType = 'teacher' | 'student';

export interface StudentProfile {
  id: string;
  name: string;
  language: string;
  age: number;
  sensitivities: string;
  guideBook?: string; // AI Generated guide content
  lastAnalyzedIndex?: number; // Tracks the index of the last message processed for profile updates
}

export interface ChatMessage {
  id: string;
  originalText: string;
  translatedText: string;
  culturalNote?: string; // Helpful context or explanation if needed
  timestamp: number;
  isLoadingAudio: boolean;
  sender: SenderType;
  // New fields for AI Assist reasoning
  strategy?: string;
  reasoning?: string;
}

export interface AppData {
  teacherName: string;
  preferredVoice: VoiceType;
  students: StudentProfile[];
  currentStudentId: string;
  chats: Record<string, ChatMessage[]>;
}

export interface TranslationResponse {
  translation: string;
  culturalNote?: string;
}

export interface GuideBookResponse {
  guide: string;
  updatedSensitivities: string;
}

export interface CommunicationOption {
  id: string;
  strategy: string;
  englishText: string;
  translatedText: string;
  reasoning: string;
}
