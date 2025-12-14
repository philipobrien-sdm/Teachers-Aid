import React, { useState, useEffect, useRef } from 'react';
import { SenderType } from '../types';

interface InputAreaProps {
  onSendMessage: (text: string, sender: SenderType, useAiAssist: boolean) => void;
  isLoading: boolean;
  studentName?: string;
  studentLanguage?: string;
}

// Speech Recognition Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}
declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition };
    webkitSpeechRecognition: { new (): SpeechRecognition };
  }
}

// Simple language mapper
const getLangCode = (langName: string) => {
  const map: Record<string, string> = {
    'spanish': 'es-ES',
    'french': 'fr-FR',
    'german': 'de-DE',
    'italian': 'it-IT',
    'japanese': 'ja-JP',
    'chinese': 'zh-CN',
    'mandarin': 'zh-CN',
    'korean': 'ko-KR',
    'portuguese': 'pt-BR',
    'russian': 'ru-RU',
    'arabic': 'ar-SA',
    'hindi': 'hi-IN'
  };
  return map[langName.toLowerCase().trim()] || 'en-US';
};

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading, 
  studentName = 'Student',
  studentLanguage = 'English' 
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sender, setSender] = useState<SenderType>('teacher');
  const [useAiAssist, setUseAiAssist] = useState(true); // Default to AI assist for teacher
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    }
  }, []);

  const handleSend = () => {
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText, sender, sender === 'teacher' ? useAiAssist : false);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.lang = sender === 'teacher' ? 'en-US' : getLangCode(studentLanguage);
        
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInputText(prev => (prev ? prev + ' ' + transcript : transcript));
          setIsListening(false);
        };
        recognitionRef.current.onerror = (e: any) => {
          console.error("Speech error", e);
          setIsListening(false);
        };
        recognitionRef.current.onend = () => setIsListening(false);

        setIsListening(true);
        recognitionRef.current.start();
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };

  return (
    <div className="border-t bg-white p-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sticky bottom-0 z-40">
      <div className="max-w-3xl mx-auto space-y-3">
        
        {/* Top Controls: Speaker Toggle & AI Mode */}
        <div className="flex justify-between items-center px-2">
           {/* Sender Switch */}
           <div className="bg-gray-100 p-1 rounded-full inline-flex relative shadow-inner">
             <div 
               className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out ${sender === 'teacher' ? 'left-1' : 'left-[calc(50%+4px)]'}`}
             ></div>
             <button
               onClick={() => setSender('teacher')}
               className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-2 ${sender === 'teacher' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               TEACHER
             </button>
             <button
               onClick={() => setSender('student')}
               className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-2 ${sender === 'student' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
             >
               {studentName ? studentName.toUpperCase() : 'STUDENT'}
             </button>
          </div>

          {/* AI Assist Toggle (Only visible for Teacher) */}
          {sender === 'teacher' && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className={`text-xs font-medium transition-colors ${useAiAssist ? 'text-indigo-600' : 'text-gray-400'}`}>
                AI Assist
              </span>
              <div className="relative inline-block w-10 h-6 align-middle select-none">
                <input 
                  type="checkbox" 
                  checked={useAiAssist} 
                  onChange={() => setUseAiAssist(!useAiAssist)} 
                  className="hidden" 
                />
                <div className={`block w-10 h-6 rounded-full shadow-inner transition-colors duration-300 ${useAiAssist ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute block w-4 h-4 mt-1 ml-1 bg-white rounded-full shadow inset-y-0 left-0 focus-within:shadow-outline transition-transform duration-300 ease-in-out ${useAiAssist ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className={`flex-1 rounded-2xl flex items-center p-2 border transition-all ${sender === 'teacher' ? 'bg-indigo-50 border-indigo-100 focus-within:ring-indigo-500' : 'bg-emerald-50 border-emerald-100 focus-within:ring-emerald-500'} focus-within:bg-white focus-within:ring-2`}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sender === 'teacher' 
                  ? (useAiAssist ? "What is your intent? (e.g. 'Ask him to focus')" : "Type message to translate...") 
                  : `Type in ${studentLanguage}...`
              }
              rows={1}
              className="w-full bg-transparent border-none outline-none resize-none px-2 py-2 max-h-32 text-gray-800 placeholder-gray-400"
              style={{ minHeight: '44px' }}
            />
            
            <button
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all duration-300 ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse shadow-red-200' 
                  : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
              }`}
              title={sender === 'teacher' ? "Speak English" : `Speak ${studentLanguage}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className={`p-3.5 rounded-2xl text-white transition-colors shadow-lg disabled:opacity-50 disabled:hover:bg-opacity-100 ${sender === 'teacher' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
          >
            {isLoading ? (
              <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : sender === 'teacher' && useAiAssist ? (
              // Sparkles icon for AI Assist
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813a3.75 3.75 0 0 0 2.576-2.576l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5M16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
              </svg>
            ) : (
              // Send icon
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
