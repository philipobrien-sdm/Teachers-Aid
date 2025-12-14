import React from 'react';
import { StudentProfile } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  students: StudentProfile[];
  currentStudentId: string;
  onSelectStudent: (id: string) => void;
  onAddStudent: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  students,
  currentStudentId,
  onSelectStudent,
  onAddStudent
}) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
            <h2 className="font-bold text-lg">Classroom</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {students.length === 0 ? (
              <div className="text-center text-gray-400 py-10">
                <p>No students yet.</p>
                <p className="text-sm">Add one to start chatting!</p>
              </div>
            ) : (
              students.map(student => (
                <button
                  key={student.id}
                  onClick={() => onSelectStudent(student.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    currentStudentId === student.id 
                      ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500 shadow-sm' 
                      : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold ${currentStudentId === student.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                      {student.name}
                    </span>
                    {student.language.toLowerCase().includes('english') ? (
                       <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full font-medium">ND</span>
                    ) : (
                       <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full font-medium">ESL</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {student.language} • {student.age} yrs
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onAddStudent}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 p-3 rounded-xl transition-all font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New Student Profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
