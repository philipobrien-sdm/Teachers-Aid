import React, { useState, useEffect } from 'react';
import { AppData, StudentProfile, VoiceType } from '../types';
import { generateGuideBook } from '../services/geminiService';
import ConfirmationModal from './ConfirmationModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSave: (data: AppData) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onLoadDemo: (type: 'esl' | 'neurodivergent') => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const ProfileModal: React.FC<ProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  data, 
  onSave, 
  onImport, 
  onExport,
  onLoadDemo
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'students' | 'data' | 'about'>('general');
  const [formData, setFormData] = useState<AppData>(data);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  
  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {}
  });

  // Temporary state for the student being edited/created
  const [tempStudent, setTempStudent] = useState<StudentProfile>({
    id: '',
    name: '',
    language: '',
    age: 6,
    sensitivities: '',
    guideBook: ''
  });

  useEffect(() => {
    setFormData(data);
  }, [data, isOpen]);

  if (!isOpen) return null;

  // --- Handlers for Global Data ---

  const handleTeacherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, teacherName: e.target.value }));
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, preferredVoice: e.target.value as VoiceType }));
  };

  // --- Handlers for Student Management ---

  const startEditStudent = (student: StudentProfile) => {
    setEditingStudentId(student.id);
    setTempStudent({ ...student });
  };

  const startNewStudent = () => {
    setEditingStudentId('new');
    setTempStudent({
      id: generateId(),
      name: '',
      language: '',
      age: 6,
      sensitivities: '',
      guideBook: ''
    });
  };

  const cancelEditStudent = () => {
    setEditingStudentId(null);
  };

  const saveStudent = () => {
    if (!tempStudent.name || !tempStudent.language) return;

    setFormData(prev => {
      let updatedStudents;
      let newChats = { ...prev.chats };

      if (editingStudentId === 'new') {
        updatedStudents = [...prev.students, tempStudent];
        newChats[tempStudent.id] = [];
      } else {
        updatedStudents = prev.students.map(s => s.id === tempStudent.id ? tempStudent : s);
      }
      
      const newCurrentId = prev.currentStudentId || tempStudent.id;

      return {
        ...prev,
        students: updatedStudents,
        chats: newChats,
        currentStudentId: newCurrentId
      };
    });
    setEditingStudentId(null);
  };

  const confirmDeleteStudent = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Student?",
      message: "Are you sure you want to delete this student profile? All chat history and generated guides will be permanently lost.",
      isDestructive: true,
      onConfirm: () => {
        setFormData(prev => {
          const remainingStudents = prev.students.filter(s => s.id !== id);
          const newChats = { ...prev.chats };
          delete newChats[id];
          
          let newCurrentId = prev.currentStudentId;
          if (id === prev.currentStudentId) {
            newCurrentId = remainingStudents.length > 0 ? remainingStudents[0].id : '';
          }

          return {
            ...prev,
            students: remainingStudents,
            chats: newChats,
            currentStudentId: newCurrentId
          };
        });
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSelectStudent = (id: string) => {
    setFormData(prev => ({ ...prev, currentStudentId: id }));
  };

  const handleTempStudentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTempStudent(prev => ({ ...prev, [name]: name === 'age' ? parseInt(value) || 0 : value }));
  };

  const handleGenerateGuide = async () => {
    if (!tempStudent.id || editingStudentId === 'new') {
      alert("Please save the student first before generating a guide.");
      return;
    }

    setIsGeneratingGuide(true);
    const chats = formData.chats[tempStudent.id] || [];
    try {
      const result = await generateGuideBook(tempStudent, chats);
      setTempStudent(prev => ({
        ...prev,
        guideBook: result.guide,
        sensitivities: result.updatedSensitivities // Automatically update sensitivities with new insights
      }));
    } catch (e) {
      console.error(e);
      alert("Failed to generate guide.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // --- Final Save ---

  const handleSaveAll = () => {
    onSave(formData);
    onClose();
  };

  // --- Import/Export ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  // --- Demo Loading ---
  const confirmLoadDemo = (type: 'esl' | 'neurodivergent') => {
    const label = type === 'esl' ? 'ESL Demo (Hiroto)' : 'Neurodivergent Demo (Sam)';
    setConfirmModal({
      isOpen: true,
      title: `Load ${label}?`,
      message: "This will create a new student profile with pre-filled history. Your existing data will not be overwritten, but it's good practice to save first.",
      isDestructive: false,
      onConfirm: () => {
        onLoadDemo(type);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        onClose(); // Close the modal to see the new data
      }
    });
  };

  return (
    <>
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold text-white">Settings & Profiles</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6 pt-4 space-x-6 shrink-0 overflow-x-auto">
            <button onClick={() => setActiveTab('general')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>General</button>
            <button onClick={() => setActiveTab('students')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'students' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Students</button>
            <button onClick={() => setActiveTab('data')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'data' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Data</button>
            <button onClick={() => setActiveTab('about')} className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'about' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>About</button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher's Name</label>
                  <input
                    type="text"
                    value={formData.teacherName}
                    onChange={handleTeacherChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Mrs. Robinson"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Voice</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${formData.preferredVoice === VoiceType.AI ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'}`}>
                      <input 
                        type="radio" 
                        name="preferredVoice" 
                        value={VoiceType.AI}
                        checked={formData.preferredVoice === VoiceType.AI}
                        onChange={handleVoiceChange}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block font-medium text-gray-900">AI Voice (Gemini)</span>
                        <span className="text-xs text-gray-500">Natural & Expressive</span>
                      </div>
                    </label>
                    
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${formData.preferredVoice === VoiceType.LOCAL ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'}`}>
                      <input 
                        type="radio" 
                        name="preferredVoice" 
                        value={VoiceType.LOCAL}
                        checked={formData.preferredVoice === VoiceType.LOCAL}
                        onChange={handleVoiceChange}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block font-medium text-gray-900">Local TTS</span>
                        <span className="text-xs text-gray-500">Offline & Fast</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === 'students' && (
              <div className="h-full flex flex-col">
                {!editingStudentId ? (
                  // Student List View
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-gray-900 font-semibold">Class List</h3>
                      <button 
                        onClick={startNewStudent}
                        className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-200"
                      >
                        + Add Student
                      </button>
                    </div>
                    
                    {formData.students.length === 0 ? (
                       <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          No students added yet.
                       </div>
                    ) : (
                      <div className="space-y-3">
                        {formData.students.map(student => (
                          <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border ${formData.currentStudentId === student.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}>
                            <div 
                              className="flex-1 cursor-pointer" 
                              onClick={() => handleSelectStudent(student.id)}
                            >
                               <div className="flex items-center gap-2">
                                 <span className="font-bold text-gray-900">{student.name}</span>
                                 {formData.currentStudentId === student.id && (
                                   <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Active</span>
                                 )}
                                 {student.guideBook && (
                                   <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full uppercase tracking-wide border border-emerald-200">Guide Ready</span>
                                 )}
                               </div>
                               <div className="text-sm text-gray-500">{student.language} • {student.age} yrs</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => startEditStudent(student)}
                                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="Edit Profile & Guide"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                              </button>
                              <button 
                                onClick={() => confirmDeleteStudent(student.id)}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Add/Edit Form
                  <div className="space-y-5 animate-fade-in-up">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <h3 className="text-gray-900 font-bold text-lg">{editingStudentId === 'new' ? 'New Student' : 'Edit Profile'}</h3>
                      {editingStudentId !== 'new' && (
                         <button
                           onClick={handleGenerateGuide}
                           disabled={isGeneratingGuide}
                           className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full font-medium hover:bg-indigo-200 disabled:opacity-50 flex items-center gap-1"
                         >
                           {isGeneratingGuide ? (
                              <>
                                <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                              </>
                           ) : (
                             <>
                               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M10 1c3.866 0 7 1.79 7 4s-3.134 4-7 4-7-1.79-7-4 3.134-4 7-4zm5.694 8.13c.464-.264.91-.583 1.306-.952V10c0 2.21-3.134 4-7 4s-7-1.79-7-4V8.178c.396.37.842.689 1.306.953C5.838 10.006 7.854 10.5 10 10.5s4.162-.494 5.694-1.37z" clipRule="evenodd" /></svg>
                               Update Guide & Sensitivities
                             </>
                           )}
                         </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          name="name"
                          value={tempStudent.name}
                          onChange={handleTempStudentChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Miguel"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                        <input
                          type="number"
                          name="age"
                          value={tempStudent.age}
                          onChange={handleTempStudentChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                      <input
                        type="text"
                        name="language"
                        value={tempStudent.language}
                        onChange={handleTempStudentChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. Spanish"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sensitivities</label>
                      <textarea
                        name="sensitivities"
                        rows={3}
                        value={tempStudent.sensitivities}
                        onChange={handleTempStudentChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        placeholder="e.g. Shy, likes praise..."
                      />
                      <p className="text-xs text-gray-400 mt-1">Can be auto-updated by analyzing chats.</p>
                    </div>
                    
                    {tempStudent.guideBook && (
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" /></svg>
                           AI Guide Book
                        </h4>
                        <div className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {tempStudent.guideBook}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button onClick={saveStudent} className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700">Save Student</button>
                      <button onClick={cancelEditStudent} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                   <h4 className="font-bold text-yellow-800 mb-1">Backup & Restore</h4>
                   <p className="text-sm text-yellow-700 mb-4">
                     Save your student profiles and chat history to your computer, or restore from a previous backup.
                   </p>
                   <div className="flex gap-3">
                     <button 
                       onClick={onExport}
                       className="flex items-center justify-center gap-2 bg-white border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg font-medium hover:bg-yellow-100 transition-colors w-full"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>
                       Download Backup
                     </button>
                     <label className="flex items-center justify-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors w-full cursor-pointer">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03l2.955-3.129v8.614z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>
                       Restore Backup
                       <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
                     </label>
                   </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                   <h4 className="font-bold text-indigo-800 mb-1">Demo Data</h4>
                   <p className="text-sm text-indigo-700 mb-4">
                     Load a sample student profile and conversation history to see how the app works.
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={() => confirmLoadDemo('esl')}
                        className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="text-lg">🇯🇵</span> Load ESL Demo
                      </button>
                      <button 
                        onClick={() => confirmLoadDemo('neurodivergent')}
                        className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="text-lg">🧩</span> Load Neurodivergent Demo
                      </button>
                   </div>
                </div>
              </div>
            )}
            
            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-6 text-gray-700">
                 <div>
                   <h3 className="font-bold text-2xl text-gray-900 mb-2">Teacher's Aid</h3>
                   <p className="text-lg font-light leading-relaxed text-gray-600">
                     A culturally sensitive communication bridge for the modern classroom.
                   </p>
                 </div>

                 <div className="grid grid-cols-1 gap-6">
                    <section className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                      <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                        Purpose & Mission
                      </h4>
                      <p className="text-sm text-blue-800 leading-relaxed">
                        To help teachers build trust and understanding with students who face communication barriers. Whether bridging a language gap or navigating neurodivergent processing styles, Teacher's Aid prioritizes <b>intent</b> and <b>sensitivity</b> over literal translation.
                      </p>
                    </section>

                    <section className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-3">Key Features</h4>
                      <ul className="space-y-3 text-sm">
                        <li className="flex gap-3">
                          <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                          <span><b>Bi-Directional Translation:</b> Supports real-time voice and text translation between English and dozens of world languages.</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                          <span><b>Neurodiversity Support:</b> For English-speaking neurodivergent students, the AI adapts language to be low-demand, literal, or interest-based (e.g. for Autism/PDA).</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                          <span><b>AI Strategic Options:</b> Instead of just translating, the app offers 3 strategic ways to convey a message (e.g. "Direct", "Soft", "Visual") based on the child's profile.</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shrink-0">4</span>
                          <span><b>Guide Book Generation:</b> The AI analyzes your chat history to automatically generate a personalized guide with tips on how to best engage that specific student.</span>
                        </li>
                      </ul>
                    </section>

                    <section className="bg-red-50 p-5 rounded-2xl border border-red-100">
                      <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        Important Limitations
                      </h4>
                      <div className="space-y-2 text-sm text-red-800">
                        <p>
                          <b>Not a Medical or Legal Tool:</b> This app is an educational aid. It should never be used for critical medical, legal, or safety communications. In those cases, a certified human interpreter is required by law.
                        </p>
                        <p>
                          <b>AI Accuracy:</b> Large Language Models can occasionally hallucinate or misinterpret context. Always use your professional judgment.
                        </p>
                      </div>
                    </section>

                    <section className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                       <h4 className="font-bold text-gray-900 mb-2">Privacy & Data</h4>
                       <p className="text-sm text-gray-600 mb-2">
                         This application is designed with privacy in mind.
                       </p>
                       <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-1">
                         <li>All student profiles and chat history are stored <b>locally in your browser</b>.</li>
                         <li>We do not have a central database of your students.</li>
                         <li>Text is sent to Google's Gemini API for processing but is not used to train their models (enterprise privacy standards apply).</li>
                         <li>If you clear your browser cache, your data will be lost unless you use the "Backup" feature in the Data tab.</li>
                       </ul>
                    </section>
                 </div>

                 <p className="text-center text-xs text-gray-400 pt-8 pb-4">
                   Teacher's Aid v1.0 • Powered by Google Gemini Flash 2.5
                 </p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-6 pt-2 shrink-0 bg-white border-t border-gray-100 mt-auto">
            <button
              onClick={handleSaveAll}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 active:transform active:scale-[0.98] transition-all shadow-lg shadow-indigo-200"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileModal;
