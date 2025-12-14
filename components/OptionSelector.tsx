import React from 'react';
import { CommunicationOption } from '../types';

interface OptionSelectorProps {
  options: CommunicationOption[];
  onSelect: (option: CommunicationOption) => void;
  onCancel: () => void;
}

const OptionSelector: React.FC<OptionSelectorProps> = ({ options, onSelect, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onCancel}></div>

      {/* Content */}
      <div className="bg-white w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 pointer-events-auto flex flex-col transform transition-transform duration-300 animate-fade-in-up">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Choose an Approach</h3>
            <p className="text-sm text-gray-500">Select the best way to convey your message.</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {options.map((option, index) => (
            <div 
              key={option.id || index}
              onClick={() => onSelect(option)}
              className="border-2 border-transparent hover:border-indigo-500 bg-gray-50 hover:bg-white rounded-xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-lg flex flex-col group relative overflow-hidden"
            >
              {/* Decoration */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-emerald-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>

              <div className="mb-3">
                <span className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-md mb-2">
                  {option.strategy}
                </span>
                <h4 className="text-lg font-semibold text-gray-900 leading-tight mb-1">{option.translatedText}</h4>
                <p className="text-sm text-gray-500 italic">"{option.englishText}"</p>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  <span className="font-bold text-gray-800">Why?</span> {option.reasoning}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OptionSelector;
