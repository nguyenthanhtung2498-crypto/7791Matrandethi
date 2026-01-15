
import React from 'react';

interface StepProgressBarProps {
  currentStep: number;
}

const steps = [
  "Đăng nhập",
  "Nguồn & Bài",
  "Khung Ma trận",
  "Ma trận chi tiết",
  "Bản đặc tả",
  "Đề thi",
  "HD Chấm"
];

const StepProgressBar: React.FC<StepProgressBarProps> = ({ currentStep }) => {
  return (
    <div className="w-full py-8 mb-4">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-1 relative group">
              <div className={`w-10 h-10 rounded-[1rem] flex items-center justify-center border-4 transition-all duration-500 z-10 shadow-lg ${
                index + 1 <= currentStep ? 'bg-indigo-600 border-white text-white scale-110' : 'bg-white border-slate-100 text-slate-300'
              }`}>
                {index + 1 < currentStep ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span className="font-black text-xs">{index + 1}</span>
                )}
              </div>
              <span className={`mt-3 text-[9px] font-black uppercase tracking-widest text-center max-w-[80px] leading-tight ${index + 1 <= currentStep ? 'text-indigo-900' : 'text-slate-300'}`}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-1 flex-1 -mt-8 mx-[-10px] rounded-full transition-all duration-700 ${index + 1 < currentStep ? 'bg-indigo-600' : 'bg-slate-100'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepProgressBar;
