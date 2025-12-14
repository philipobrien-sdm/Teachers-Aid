import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AppData, VoiceType, StudentProfile, SenderType, CommunicationOption } from './types';
import InputArea from './components/InputArea';
import ProfileModal from './components/ProfileModal';
import OptionSelector from './components/OptionSelector';
import ConfirmationModal from './components/ConfirmationModal';
import Sidebar from './components/Sidebar';
import { translateText, generateSpeech, generateCommunicationOptions, generateGuideBook } from './services/geminiService';
import { playGeminiAudio, playLocalAudio } from './services/audioUtils';

const STORAGE_KEY_DATA = 'teacher_aid_data_v1';
const STORAGE_KEY_OLD = 'teacher_aid_profile';

const INITIAL_DATA: AppData = {
  teacherName: 'Teacher',
  preferredVoice: VoiceType.AI,
  students: [],
  currentStudentId: '',
  chats: {}
};

const App: React.FC = () => {
  const [appData, setAppData] = useState<AppData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // AI Assist Flow State
  const [generatedOptions, setGeneratedOptions] = useState<CommunicationOption[] | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  
  // Analyzing State (Background)
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);

  // Message Insight Modal State
  const [inspectingMessage, setInspectingMessage] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived state
  const currentStudent = appData.students.find(s => s.id === appData.currentStudentId);
  const messages = (currentStudent && appData.chats[currentStudent.id]) ? appData.chats[currentStudent.id] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load and Migrate Data
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY_DATA);
    if (savedData) {
      try {
        setAppData(JSON.parse(savedData));
        return; // Successfully loaded new format
      } catch (e) {
        console.error("Failed to parse app data", e);
      }
    }

    // Migration fallback
    const oldProfile = localStorage.getItem(STORAGE_KEY_OLD);
    if (oldProfile) {
      try {
        const parsed = JSON.parse(oldProfile);
        const newStudentId = 'migrated_student';
        const newStudent: StudentProfile = {
          id: newStudentId,
          name: parsed.childName || 'Student',
          language: parsed.childLanguage || 'Spanish',
          age: parsed.childAge || 7,
          sensitivities: parsed.sensitivities || ''
        };
        
        const newData: AppData = {
          teacherName: parsed.teacherName || 'Teacher',
          preferredVoice: parsed.preferredVoice || VoiceType.AI,
          students: [newStudent],
          currentStudentId: newStudentId,
          chats: { [newStudentId]: [] }
        };
        
        setAppData(newData);
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(newData));
      } catch (e) {
        console.error("Failed to migrate old profile");
        setIsModalOpen(true);
      }
    } else {
       setIsModalOpen(true);
    }
  }, []);

  // Save on change
  const saveAppData = (newData: AppData) => {
    setAppData(newData);
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(newData));
  };

  // --- Background AI Analysis ---

  const analyzeStudentProfile = async (studentId: string) => {
    const student = appData.students.find(s => s.id === studentId);
    const chats = appData.chats[studentId] || [];
    
    if (!student || chats.length === 0) return;

    // Check if we have enough new data to analyze
    const lastIndex = student.lastAnalyzedIndex || 0;
    const newMessagesCount = chats.length - lastIndex;

    // Only analyze if there are at least 3 new messages to save resources
    if (newMessagesCount < 3) return;

    setIsAnalyzingProfile(true);
    try {
      // We pass the full context, but the prompt implies looking for new insights
      const result = await generateGuideBook(student, chats);
      
      setAppData(prev => ({
        ...prev,
        students: prev.students.map(s => s.id === studentId ? {
          ...s,
          sensitivities: result.updatedSensitivities,
          guideBook: result.guide,
          lastAnalyzedIndex: chats.length
        } : s)
      }));
      console.log(`Updated profile for ${student.name}`);
    } catch (e) {
      console.error("Background analysis failed", e);
    } finally {
      setIsAnalyzingProfile(false);
    }
  };

  const handleStudentSwitch = async (newStudentId: string) => {
    // 1. Trigger background analysis for the OLD student if valid
    if (currentStudent && currentStudent.id !== newStudentId) {
      // Don't await this, let it run in background
      analyzeStudentProfile(currentStudent.id).then(() => {
        // Persist to local storage after background update finishes
        // Note: This relies on the setAppData inside analyzeStudentProfile triggering a render/save cycle
        // However, since state updates are async, we might need to manually save inside the effect or rely on the user's next action.
        // For now, the user might see the spinner.
      });
    }

    // 2. Switch immediately
    setAppData(prev => ({ ...prev, currentStudentId: newStudentId }));
    setIsSidebarOpen(false);
  };

  // --- Actions ---

  const handleSendMessage = async (text: string, sender: SenderType, useAiAssist: boolean = false) => {
    if (!currentStudent) {
      alert("Please select or create a student profile first.");
      setIsModalOpen(true);
      return;
    }

    setIsLoading(true);

    if (sender === 'teacher' && useAiAssist) {
      // FLOW 1: AI Assistance Mode (Generate Options)
      try {
        const options = await generateCommunicationOptions(
          text,
          appData.teacherName,
          currentStudent,
          messages
        );
        setGeneratedOptions(options);
        setPendingIntent(text); // Keep track of what the teacher originally intended
      } catch (e) {
        console.error("Failed to generate options", e);
        alert("Sorry, I couldn't generate options. Switching to direct translation.");
        // Fallback to direct translation
        await processDirectTranslation(text, sender, currentStudent);
      } finally {
        setIsLoading(false);
      }

    } else {
      // FLOW 2: Direct Translation Mode (Interpreter)
      await processDirectTranslation(text, sender, currentStudent);
      setIsLoading(false);
    }
  };

  const processDirectTranslation = async (text: string, sender: SenderType, student: StudentProfile) => {
    const newMessageId = Date.now().toString();

    // Optimistic message
    const tempMessage: ChatMessage = {
      id: newMessageId,
      originalText: text,
      translatedText: 'Adapting...',
      timestamp: Date.now(),
      isLoadingAudio: false,
      sender: sender
    };

    setAppData(prev => ({
      ...prev,
      chats: {
        ...prev.chats,
        [student.id]: [...(prev.chats[student.id] || []), tempMessage]
      }
    }));

    try {
      const result = await translateText(text, appData.teacherName, student, sender);
      
      setAppData(prev => ({
        ...prev,
        chats: {
          ...prev.chats,
          [student.id]: prev.chats[student.id].map(msg => 
            msg.id === newMessageId 
              ? { 
                  ...msg, 
                  translatedText: result.translation, 
                  culturalNote: result.culturalNote 
                } 
              : msg
          )
        }
      }));
    } catch (error) {
      console.error("Translation failed", error);
      setAppData(prev => ({
        ...prev,
        chats: {
          ...prev.chats,
          [student.id]: prev.chats[student.id].map(msg => 
            msg.id === newMessageId 
              ? { ...msg, translatedText: "Sorry, I couldn't process that." } 
              : msg
          )
        }
      }));
    }
  };

  const handleOptionSelect = (option: CommunicationOption) => {
    if (!currentStudent) return;

    // Add selected option to chat
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      originalText: option.englishText, // Use the refined English text, not the raw intent
      translatedText: option.translatedText,
      culturalNote: `${option.strategy} approach.`,
      timestamp: Date.now(),
      isLoadingAudio: false,
      sender: 'teacher',
      strategy: option.strategy,
      reasoning: option.reasoning
    };

    setAppData(prev => ({
      ...prev,
      chats: {
        ...prev.chats,
        [currentStudent.id]: [...(prev.chats[currentStudent.id] || []), newMessage]
      }
    }));

    setGeneratedOptions(null);
    setPendingIntent(null);
  };

  const handleOptionCancel = () => {
    setGeneratedOptions(null);
    setPendingIntent(null);
  };


  const handlePlayAudio = async (msg: ChatMessage) => {
    if (playingId || !currentStudent) return;

    setPlayingId(msg.id);
    const updateMessageLoading = (isLoadingAudio: boolean) => {
      setAppData(prev => ({
        ...prev,
        chats: {
          ...prev.chats,
          [currentStudent.id]: prev.chats[currentStudent.id].map(m => m.id === msg.id ? { ...m, isLoadingAudio } : m)
        }
      }));
    };

    try {
      if (msg.sender === 'teacher') {
        // Teacher spoke -> Translate to Student's Language
        // If student language is English (Neurodivergent mode), play English
        const isEnglishTarget = currentStudent.language.toLowerCase().includes('english');
        
        if (appData.preferredVoice === VoiceType.AI && !isEnglishTarget) {
          updateMessageLoading(true);
          const audioBase64 = await generateSpeech(msg.translatedText);
          updateMessageLoading(false);
          
          if (audioBase64) {
            await playGeminiAudio(audioBase64);
          } else {
             await playLocalAudio(msg.translatedText, currentStudent.language);
          }
        } else {
          // Use Local TTS for English target or if preferred
          await playLocalAudio(msg.translatedText, currentStudent.language);
        }
      } else {
        // Student spoke -> Translate to English for Teacher (Use Local English TTS)
        await playLocalAudio(msg.translatedText, 'English');
      }

    } catch (error) {
      console.error("Audio Playback Error", error);
    } finally {
      setPlayingId(null);
      updateMessageLoading(false);
    }
  };

  // --- Import / Export / Demo ---

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `teacher_aid_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedData = JSON.parse(text);
        if (importedData.students && importedData.chats) {
          setAppData(importedData);
          alert("Backup restored successfully!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleLoadDemo = (type: 'esl' | 'neurodivergent') => {
    // Confirmation handled in ProfileModal now
    const now = Date.now();
    const demoId = 'demo_' + now;
    let demoStudent: StudentProfile;
    let demoChats: ChatMessage[] = [];

    if (type === 'neurodivergent') {
      demoStudent = {
        id: demoId,
        name: 'Sam',
        language: 'English',
        age: 10,
        sensitivities: 'Autism Spectrum Disorder, Pathological Demand Avoidance (PDA). Extremely literal thinker. Overwhelmed by direct questions or authoritative tone ("demands"). Loves trains and scheduling.',
        guideBook: `## Communication Style
Sam processes language literally. "Hop to it" might confuse him. He resists direct demands ("Do this now") due to PDA, which triggers anxiety.

## Engagement Tips
- Use declarative language ("The book is open") instead of imperatives ("Open the book").
- Offer choices to provide a sense of control.
- Incorporate his interest in trains/timetables to explain sequences.`,
        lastAnalyzedIndex: 3
      };

      demoChats = [
        {
          id: 'msg_nd_1',
          originalText: 'Sam, stop messing around and get your math book out. We are waiting.',
          translatedText: 'Sam, it is time for math. The books are on the desks.',
          timestamp: now - 300000,
          isLoadingAudio: false,
          sender: 'teacher',
          strategy: 'Low Demand & Declarative',
          reasoning: 'Replacing the demand and social pressure ("waiting") with a neutral statement of fact. This lowers the anxiety spike associated with PDA.'
        },
        {
          id: 'msg_nd_2',
          originalText: 'No! The schedule says reading!',
          translatedText: 'I am feeling distressed because this change does not match the schedule I memorized.',
          timestamp: now - 240000,
          isLoadingAudio: false,
          sender: 'student',
          culturalNote: 'Literal interpretation of the schedule provides safety. The refusal is distress, not defiance.'
        },
        {
          id: 'msg_nd_3',
          originalText: 'We changed it yesterday, remember? Don\'t be difficult.',
          translatedText: 'I remember we updated the schedule board yesterday. Would you like to check the new train timetable on the wall?',
          timestamp: now - 180000,
          isLoadingAudio: false,
          sender: 'teacher',
          strategy: 'Special Interest Bridging',
          reasoning: 'Using his interest in trains/timetables to re-frame the schedule change as a verifiable fact rather than an arbitrary authority decision. Removing the criticism "difficult".'
        }
      ];
    } else {
      // ESL Demo
      demoStudent = {
        id: demoId,
        name: 'Hiroto',
        language: 'Japanese',
        age: 8,
        sensitivities: 'High anxiety about making public mistakes ("Haji"). Responds well to visual metaphors and private encouragement. Avoids eye contact when scolded.',
        guideBook: `## Communication Style
Hiroto is quiet and observant. He processes information deeply before responding. He prefers indirect communication over direct confrontation.

## Cultural Insights
In Japanese culture, group harmony ("Wa") and saving face are critical. Public praise is appreciated but can be embarrassing if too loud; public correction is devastating. Silence often means "I'm thinking" or "I'm not sure," not necessarily defiance.`,
        lastAnalyzedIndex: 3
      };

      demoChats = [
        {
          id: 'msg_1',
          originalText: 'It is okay to make mistakes, Hiroto. That is how we learn.',
          translatedText: 'Machigai wa manabi no steppu da yo, Hiroto.',
          timestamp: now - 300000,
          isLoadingAudio: false,
          sender: 'teacher',
          strategy: 'Growth Mindset & Reassurance',
          reasoning: 'Addressing his fear of failure by framing mistakes as a necessary part of the learning process (steppu/step). Using a gentle, encouraging tone to lower anxiety.'
        },
        {
          id: 'msg_2',
          originalText: 'Boku wa... minna ga miteiru kara dekinai.',
          translatedText: 'I... I cannot do it because everyone is watching.',
          timestamp: now - 240000,
          isLoadingAudio: false,
          sender: 'student',
          culturalNote: 'Expressing social anxiety and awareness of the "group gaze".'
        },
        {
          id: 'msg_3',
          originalText: 'Let\'s look at this together at my desk later, just us.',
          translatedText: 'Ato de sensei no tsukue de, issho ni mimashou ne.',
          timestamp: now - 180000,
          isLoadingAudio: false,
          sender: 'teacher',
          strategy: 'Private & Collaborative',
          reasoning: 'Removing the pressure of the audience (public gaze). "Issho ni" (together) emphasizes support and partnership rather than authoritative correction.'
        }
      ];
    }

    setAppData(prev => ({
      ...prev,
      students: [...prev.students, demoStudent],
      chats: { ...prev.chats, [demoId]: demoChats },
      currentStudentId: demoId,
      teacherName: 'Ms. Thompson'
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        students={appData.students}
        currentStudentId={appData.currentStudentId}
        onSelectStudent={handleStudentSwitch}
        onAddStudent={() => {
          setIsSidebarOpen(false);
          setIsModalOpen(true);
        }}
      />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
              <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
            </svg>
          </div>
          <div 
            onClick={() => setIsModalOpen(true)} 
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <h1 className="font-bold text-gray-900 leading-tight">Teacher's Aid</h1>
            <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              {currentStudent ? (
                <>
                  <span>Translating for</span>
                  <span className="underline decoration-indigo-300">{currentStudent.name}</span>
                  <span>({currentStudent.language})</span>
                </>
              ) : (
                <span className="text-red-500">No student selected</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {/* Profile Updating Indicator */}
           {isAnalyzingProfile && (
             <div className="flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full animate-pulse border border-indigo-100">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                 <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
               </svg>
               Updating Profile...
             </div>
           )}

           <button 
             onClick={() => setIsModalOpen(true)}
             className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
           >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
               <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
             </svg>
           </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-4">
             <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-2">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
             </div>
             <div>
               <p className="text-lg font-medium text-gray-600">No messages yet</p>
               <p className="text-sm">Start typing or speaking to translate for {currentStudent?.name || 'the student'}.</p>
               {isAnalyzingProfile && <p className="text-xs text-indigo-500 mt-2 animate-pulse">Updating student sensitivities based on previous chats...</p>}
             </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`animate-fade-in-up flex flex-col ${msg.sender === 'teacher' ? 'items-end' : 'items-start'}`}>
              <div className="flex flex-col gap-1 max-w-[85%]">
                <div 
                  className={`px-4 py-3 shadow-md ${
                    msg.sender === 'teacher' 
                      ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none' 
                      : 'bg-emerald-600 text-white rounded-2xl rounded-tl-none'
                  }`}
                >
                   <p className={`text-sm opacity-90 mb-1 border-b pb-1 ${msg.sender === 'teacher' ? 'border-indigo-400/30' : 'border-emerald-400/30'}`}>
                     {msg.originalText}
                   </p>
                   <p className="text-lg font-medium">{msg.translatedText}</p>
                </div>
                
                {/* Actions & Meta */}
                <div className={`flex items-center gap-2 mt-1 ${msg.sender === 'teacher' ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                   {/* Reasoning / Insight Button */}
                   {msg.reasoning && (
                      <button 
                        onClick={() => setInspectingMessage(msg)}
                        className="text-[10px] bg-purple-100 text-purple-800 w-5 h-5 flex items-center justify-center rounded-full border border-purple-200 shadow-sm hover:bg-purple-200 transition-colors"
                        title="View Strategy & Reasoning"
                      >
                        <span className="font-serif italic font-bold">i</span>
                      </button>
                   )}

                   {msg.culturalNote && (
                      <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full border border-yellow-200 shadow-sm">
                        Note: {msg.culturalNote}
                      </span>
                   )}
                   
                   <button
                     onClick={() => handlePlayAudio(msg)}
                     disabled={playingId === msg.id || msg.isLoadingAudio}
                     className={`flex items-center justify-center w-8 h-8 rounded-full bg-white border shadow-sm transition-all ${
                       playingId === msg.id 
                         ? 'text-indigo-600 border-indigo-200' 
                         : 'text-gray-500 border-gray-100 hover:border-gray-300'
                     }`}
                   >
                     {msg.isLoadingAudio ? (
                       <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                     ) : playingId === msg.id ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                        </svg>
                     ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                        </svg>
                     )}
                   </button>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <InputArea 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
        studentName={currentStudent?.name}
        studentLanguage={currentStudent?.language}
      />

      {/* Option Selector Overlay */}
      {generatedOptions && (
        <OptionSelector 
          options={generatedOptions}
          onSelect={handleOptionSelect}
          onCancel={handleOptionCancel}
        />
      )}

      {/* Message Insight Modal */}
      {inspectingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setInspectingMessage(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
                Teacher's Insight
              </h3>
              <button onClick={() => setInspectingMessage(null)} className="opacity-80 hover:opacity-100">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Strategy</span>
                <p className="text-indigo-700 font-semibold text-lg">{inspectingMessage.strategy || "Direct Translation"}</p>
              </div>
              
              <div>
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Selected Message (English)</span>
                 <p className="text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1 italic">"{inspectingMessage.originalText}"</p>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Why this works</span>
                <p className="text-gray-700 mt-1 leading-relaxed">{inspectingMessage.reasoning || "No detailed reasoning available."}</p>
              </div>

              {inspectingMessage.culturalNote && (
                 <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-xl">
                   <span className="text-xs font-bold text-yellow-800 uppercase tracking-wider block mb-1">{inspectingMessage.sender === 'teacher' ? 'Adaptation Note' : 'Behavioral Insight'}</span>
                   <p className="text-sm text-yellow-800">{inspectingMessage.culturalNote}</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        data={appData}
        onSave={saveAppData}
        onImport={handleImport}
        onExport={handleExport}
        onLoadDemo={handleLoadDemo}
      />
    </div>
  );
};

export default App;
