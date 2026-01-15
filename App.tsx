import React, { useState, useEffect, useCallback } from 'react';
import { ExamType, Subject, Grade, Lesson, AppState, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData } from './types';
import { analyzeFilesForLessons, generateMatrixAndOutcomes, generateExamAndGuide, validateApiKey } from './services/geminiService';
import StepProgressBar from './components/StepProgressBar';
import MatrixTable from './components/MatrixTable';
import SpecificationTable from './components/SpecificationTable';
import { 
  Zap, LayoutGrid, Layers, Info, 
  FileDown, Lock, Brain, ChevronRight, Trash2,
  BookOpen, AlertCircle, LogOut, RefreshCw
} from 'lucide-react';

const ALLOWED_USERNAMES = ["admin", "huynhthuckhang", "giaovien", "root", "admin123"];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('7991_ai_pro_stable_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.user) parsed.currentPage = 1;
        return { 
          ...parsed, 
          config: { ...parsed.config, filePL1: null, filePL3: null, sgkFiles: [] }
        };
      } catch (e) { console.error("Error loading state", e); }
    }
    return {
      currentPage: 1,
      user: null,
      config: { 
        examType: ExamType.GK_I, 
        subject: Subject.KHTN, 
        grade: Grade.GRADE_8, 
        filePL1: null, 
        filePL3: null, 
        sgkFiles: [], 
        generationMode: GenerationMode.AUTO 
      },
      matrixConfig: {
        schoolName: 'TRƯỜNG THCS HUỲNH THÚC KHÁNG', department: 'Tổ Khoa học tự nhiên', examTitle: 'KIỂM TRA GIỮA HỌC KÌ I', academicYear: 'NĂM HỌC 2024 - 2025',
        duration: '60 phút', examCode: '04', difficulty: 'Trung bình', 
        mcqCount: 12, mcqPoint: 0.25,   
        tfCount: 2, tfPoint: 1.0,       
        shortCount: 4, shortPoint: 0.5, 
        essayCount: 3, essayPoint: 1.0, 
        knowPercent: 40, understandPercent: 30, applyPercent: 30
      },
      selectedLessons: [], matrix: null, examQuestions: [], gradingGuide: null
    };
  });

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '' });
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('7991_ai_pro_stable_v2', JSON.stringify({
      ...state,
      config: { ...state.config, filePL1: null, filePL3: null, sgkFiles: [] }
    }));
  }, [state]);

  const renderMath = useCallback(() => {
    if (state.currentPage >= 6) {
      setTimeout(() => {
        ['exam-doc', 'guide-doc'].forEach(id => {
          const el = document.getElementById(id);
          if (el && (window as any).renderMathInElement) {
            try {
              (window as any).renderMathInElement(el, {
                delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false}
                ],
                ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
                throwOnError: false
              });
            } catch (err) { console.warn("KaTeX render issue:", err); }
          }
        });
      }, 500);
    }
  }, [state.currentPage, state.examQuestions]);

  useEffect(() => {
    renderMath();
  }, [renderMath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginForm.username) return setAuthError("Vui lòng nhập tên đăng nhập.");
    if (!ALLOWED_USERNAMES.includes(loginForm.username.toLowerCase())) return setAuthError("Tài khoản không được cấp phép.");
    
    setValidating(true);
    try {
      // Check for API key selection as per environment guidelines
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
          // Proceed assuming key selection was triggered or successful
        }
      }

      const result = await validateApiKey();
      if (result.valid) {
        setState(p => ({ ...p, user: { username: loginForm.username }, currentPage: 2 }));
      } else {
        setAuthError(`Lỗi kết nối AI: ${result.error || 'Kiểm tra lại kết nối mạng.'}`);
      }
    } catch (err: any) {
      setAuthError(`Lỗi hệ thống: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleClearData = () => {
    if (confirm("Làm mới toàn bộ hệ thống? Mọi dữ liệu đang soạn sẽ bị xóa.")) {
      localStorage.removeItem('7991_ai_pro_stable_v2');
      window.location.reload();
    }
  };

  const wrapAiCall = async (fn: () => Promise<void>) => {
    setLoading(true);
    setGlobalError(null);
    try {
      await fn();
    } catch (e: any) {
      console.error(e);
      setGlobalError(`Lỗi AI: ${e.message || "Không xác định"}. Thử lại hoặc kiểm tra file đầu vào.`);
      // If error is "entity not found", might need to re-select key
      if (e.message?.includes("Requested entity was not found")) {
        if (typeof (window as any).aistudio?.openSelectKey === 'function') {
           await (window as any).aistudio.openSelectKey();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => wrapAiCall(async () => {
    if (!state.config.filePL1 || !state.config.filePL3) throw new Error("Vui lòng đính kèm đủ Phụ lục I và III.");
    const lessons = await analyzeFilesForLessons(state.config.filePL1!, state.config.filePL3!, state.config.examType, state.config.subject, state.config.grade);
    setState(p => ({ ...p, selectedLessons: lessons || [] }));
  });

  const handleGenerateMatrix = () => wrapAiCall(async () => {
    const selected = state.selectedLessons.filter(l => l.selected);
    if (selected.length === 0) throw new Error("Vui lòng chọn ít nhất một bài học.");
    const matrix = await generateMatrixAndOutcomes(selected, state.config.examType, state.config.subject, state.config.grade, state.config.filePL1!, state.matrixConfig);
    setState(p => ({ ...p, matrix, currentPage: 4 }));
  });

  const handleCreateFinalExam = () => wrapAiCall(async () => {
    if (!state.matrix) throw new Error("Ma trận chưa được khởi tạo.");
    const result = await generateExamAndGuide(state.matrix!, state.config.subject, state.config.grade, state.config.generationMode, state.matrixConfig, state.config.sgkFiles);
    setState(p => ({ ...p, examQuestions: result.questions || [], gradingGuide: result.guide, currentPage: 6 }));
  });

  const exportToWord = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const content = `<html><head><meta charset='utf-8'><style>body{font-family:'Times New Roman', serif; padding: 1in;}</style></head><body>${element.innerHTML}</body></html>`;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `7991_AI_Export_${new Date().getTime()}.doc`;
    link.click();
  };

  return (
    <div className="min-h-screen pb-10 bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-indigo-950 text-white p-5 sticky top-0 z-[100] flex justify-between items-center shadow-xl px-10 border-b border-indigo-800 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg animate-pulse">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic">7991 AI PRO</h1>
            <p className="text-[8px] font-bold text-indigo-400 tracking-[0.2em] uppercase">THCS HUỲNH THÚC KHÁNG • v2.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state.user && (
            <div className="hidden md:flex items-center gap-3 bg-indigo-900/50 px-4 py-2 rounded-xl border border-indigo-800">
              <span className="text-xs font-black uppercase tracking-wider">{state.user.username}</span>
              <button onClick={() => setState(p => ({ ...p, user: null, currentPage: 1 }))} className="ml-2 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={handleClearData} className="p-2 hover:bg-red-900/50 rounded-lg text-indigo-300 transition-colors" title="Làm mới">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className={`container mx-auto px-4 mt-6 transition-all duration-500 ${state.currentPage >= 4 ? 'wide-container' : 'max-w-6xl'}`}>
        <StepProgressBar currentStep={state.currentPage} />

        {globalError && (
          <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3 text-red-700 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              {globalError}
            </div>
            <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        <div className="relative bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-6 md:p-12 border border-slate-200/60 min-h-[600px] flex flex-col">
          {state.currentPage === 1 && (
            <div className="max-w-md mx-auto py-16 w-full animate-in fade-in duration-700">
              <div className="text-center mb-12">
                <div className="bg-indigo-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-indigo-100 shadow-inner">
                  <Lock className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-3xl font-black uppercase text-slate-900 tracking-tighter leading-tight italic">Hệ thống AI Pro 7991</h2>
                <p className="text-[18px] font-black text-indigo-600 uppercase tracking-tight mt-2">THCS HUỲNH THÚC KHÁNG</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 italic">CÔNG CỤ HỖ TRỢ GIÁO VIÊN CHUẨN CV 7991</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Tên đăng nhập nội bộ</label>
                  <input 
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-bold outline-none focus:border-indigo-500 transition-all shadow-sm text-lg" 
                    placeholder="Username..." 
                    autoFocus
                    value={loginForm.username} 
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                  />
                </div>
                
                {authError && (
                  <div className="p-5 bg-red-50 text-red-600 font-bold text-xs rounded-2xl border border-red-100 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" /> {authError}
                  </div>
                )}
                
                <button type="submit" disabled={validating} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-2xl flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all">
                  {validating ? <RefreshCw className="w-5 h-5 animate-spin" /> : "TRUY CẬP HỆ THỐNG"} <Zap className="w-5 h-5 fill-current" />
                </button>
              </form>
            </div>
          )}

          {state.currentPage === 2 && (
             <div className="grid lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
               <div className="space-y-8">
                 <h3 className="text-2xl font-black uppercase border-l-[6px] border-indigo-600 pl-4 tracking-tight italic">Cấu hình kỳ thi</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-1">
                     <label className="text-[8px] font-bold text-slate-400 uppercase ml-2">Loại kỳ thi</label>
                     <select className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 outline-none" value={state.config.examType} onChange={e => setState(p => ({...p, config: {...p.config, examType: e.target.value as ExamType}}))}>
                          {Object.values(ExamType).map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-bold text-slate-400 uppercase ml-2">Môn học</label>
                     <select className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 outline-none" value={state.config.subject} onChange={e => setState(p => ({...p, config: {...p.config, subject: e.target.value as Subject}}))}>
                          {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[8px] font-bold text-slate-400 uppercase ml-2">Khối lớp</label>
                     <select className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 outline-none" value={state.config.grade} onChange={e => setState(p => ({...p, config: {...p.config, grade: e.target.value as Grade}}))}>
                          {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                     </select>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:border-indigo-400 transition-all group">
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Bản đặc tả (PL I) .docx/pdf</p>
                      <input type="file" className="text-xs file:hidden cursor-pointer" id="pl1-input" onChange={e => setState(p => ({...p, config: {...p.config, filePL1: e.target.files ? e.target.files[0] : null}}))} />
                      <label htmlFor="pl1-input" className="block w-full text-center py-2 bg-white border rounded-xl text-[9px] font-black uppercase cursor-pointer hover:bg-slate-100">
                        {state.config.filePL1 ? `✓ ${state.config.filePL1.name}` : "Chọn tệp"}
                      </label>
                    </div>
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:border-indigo-400 transition-all group">
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><Layers className="w-3 h-3" /> KH dạy học (PL III) .docx/pdf</p>
                      <input type="file" className="text-xs file:hidden cursor-pointer" id="pl3-input" onChange={e => setState(p => ({...p, config: {...p.config, filePL3: e.target.files ? e.target.files[0] : null}}))} />
                      <label htmlFor="pl3-input" className="block w-full text-center py-2 bg-white border rounded-xl text-[9px] font-black uppercase cursor-pointer hover:bg-slate-100">
                        {state.config.filePL3 ? `✓ ${state.config.filePL3.name}` : "Chọn tệp"}
                      </label>
                    </div>
                 </div>
                 
                 <button onClick={handleAnalyze} disabled={!state.config.filePL1 || !state.config.filePL3 || loading} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50">
                   {loading ? "Đang phân tích..." : "XÁC NHẬN DỮ LIỆU ĐẦU VÀO"}
                 </button>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col shadow-inner min-h-[400px]">
                  <h3 className="font-black uppercase text-indigo-700 mb-6 tracking-tighter flex items-center gap-3 italic"><Layers className="w-5 h-5" /> Bài học AI trích xuất</h3>
                  <div className="flex-1 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                    {state.selectedLessons.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20 opacity-40">
                        <Info className="w-16 h-16 mb-4" />
                        <p className="font-black uppercase text-[10px] tracking-widest text-center">Tải Phụ lục III để AI trích xuất bài học</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {state.selectedLessons.map(l => (
                          <div key={l.id} className={`flex items-start gap-4 p-5 bg-white border-2 rounded-2xl transition-all ${l.selected ? 'border-indigo-400 shadow-md scale-[1.01]' : 'border-transparent opacity-50'}`}>
                            <input type="checkbox" className="w-5 h-5 accent-indigo-600 mt-1 cursor-pointer" checked={l.selected} onChange={() => setState(p => ({...p, selectedLessons: p.selectedLessons.map(sl => sl.id === l.id ? {...sl, selected: !sl.selected} : sl)}))} />
                            <div className="flex-1 text-slate-900 font-bold">
                              <p className="text-sm">{l.title}</p>
                              <div className="flex justify-between items-center mt-1">
                                <p className="text-[8px] uppercase font-black text-indigo-500">Tuần {l.week} • {l.periods} tiết</p>
                                <p className="text-[8px] font-black text-slate-300 italic">{l.chapter}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {state.selectedLessons.length > 0 && (
                    <button onClick={() => setState(p => ({...p, currentPage: 3}))} className="mt-8 bg-indigo-950 text-white py-6 rounded-3xl font-black uppercase hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2">
                      TIẾP THEO <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
               </div>
             </div>
          )}

          {state.currentPage === 3 && (
            <div className="max-w-5xl mx-auto py-10 text-center animate-in zoom-in-95 duration-500">
              <h3 className="text-4xl font-black uppercase text-indigo-950 mb-4 italic">Cấu trúc đề thi</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-16 tracking-widest italic leading-relaxed">Điều chỉnh số lượng câu hỏi. AI sẽ tự động tính điểm theo quy chuẩn.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Trắc nghiệm (I)', key: 'mcqCount' },
                  { label: 'Đúng/Sai (II)', key: 'tfCount' },
                  { label: 'Trả lời ngắn (III)', key: 'shortCount' },
                  { label: 'Tự luận (IV)', key: 'essayCount' }
                ].map(item => (
                  <div key={item.key} className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-200 text-center hover:bg-white hover:shadow-xl hover:border-indigo-200 transition-all group">
                    <p className="text-[10px] font-black uppercase mb-8 text-slate-400 group-hover:text-indigo-500 transition-colors">{item.label}</p>
                    <input 
                      type="number" 
                      className="w-full text-7xl font-black text-center text-slate-900 outline-none bg-transparent" 
                      value={state.matrixConfig[item.key as keyof MatrixConfig] || 0} 
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setState(p => ({ ...p, matrixConfig: { ...p.matrixConfig, [item.key]: val } }));
                      }} 
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col md:flex-row justify-center items-center gap-6 mt-20">
                <button onClick={() => setState(p => ({...p, currentPage: 2}))} className="px-14 py-6 border-2 border-slate-200 rounded-full font-black uppercase text-slate-400 hover:bg-slate-50 active:scale-95 transition-all">Quay lại</button>
                <button onClick={handleGenerateMatrix} className="px-32 py-6 bg-indigo-600 text-white rounded-full font-black uppercase shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                  THIẾT LẬP MA TRẬN <Zap className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          )}

          {state.currentPage === 4 && state.matrix && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="flex justify-between items-end border-b border-slate-100 pb-10">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Bản ma trận chi tiết</h3>
                <button onClick={() => setState(p => ({...p, currentPage: 5}))} className="bg-indigo-950 text-white px-16 py-7 rounded-full font-black uppercase shadow-2xl hover:bg-black active:scale-95 transition-all">
                  TIẾP TỤC <ChevronRight className="w-5 h-5 inline ml-2" />
                </button>
              </div>
              <MatrixTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} matrixConfig={state.matrixConfig} />
            </div>
          )}

          {state.currentPage === 5 && state.matrix && (
             <div className="space-y-10 animate-in fade-in duration-700">
                <div className="flex flex-col lg:flex-row justify-between items-center bg-indigo-50/50 p-10 rounded-[3.5rem] border border-indigo-100 italic gap-8">
                  <div className="flex-1">
                    <h3 className="text-3xl font-black uppercase tracking-tighter italic leading-tight">Bản đặc tả chi tiết (PL I)</h3>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase mt-2">Dữ liệu đặc tả được AI xây dựng dựa trên Phụ lục I</p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                      <div className="p-3 bg-white border border-indigo-100 rounded-2xl flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span className="text-[9px] font-black uppercase">Tài liệu SGK (Tùy chọn)</span>
                        <input type="file" multiple className="text-[8px] w-40" onChange={e => setState(p => ({...p, config: {...p.config, sgkFiles: e.target.files ? Array.from(e.target.files) : []}}))} />
                      </div>
                    </div>
                  </div>
                  <button onClick={handleCreateFinalExam} className="bg-indigo-600 text-white px-20 py-10 rounded-full font-black uppercase shadow-2xl flex items-center gap-4 hover:bg-black active:scale-95 transition-all">
                    <Brain className="w-8 h-8" /> <span>SOẠN ĐỀ THI AI</span>
                  </button>
                </div>
                <SpecificationTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} outcomes={state.matrix.outcomes} />
             </div>
          )}

          {(state.currentPage === 6 || state.currentPage === 7) && (
            <div className="space-y-12 animate-in fade-in duration-700">
               <div className="flex flex-col md:flex-row justify-between items-center bg-indigo-50/50 p-12 rounded-[4rem] border border-indigo-100 shadow-inner italic gap-6">
                  <div>
                    <h3 className="text-4xl font-black uppercase text-indigo-950 tracking-tighter italic leading-none">
                      {state.currentPage === 6 ? 'Dự thảo đề thi' : 'Hướng dẫn chấm'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 mt-2">ĐÃ ĐƯỢC AI TỰ ĐỘNG CHÈN LATEX VÀ TRÌNH BÀY CHUẨN SƯ PHẠM</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                    <button onClick={() => exportToWord(state.currentPage === 6 ? 'exam-doc' : 'guide-doc')} className="bg-emerald-600 text-white px-12 py-5 rounded-3xl font-black uppercase flex items-center gap-3 shadow-xl hover:bg-emerald-700 transition-all">
                      <FileDown className="w-6 h-6" /> Xuất Word
                    </button>
                    <button onClick={() => setState(p => ({...p, currentPage: state.currentPage === 6 ? 7 : 6}))} className="bg-indigo-950 text-white px-12 py-5 rounded-3xl font-black uppercase shadow-2xl hover:bg-black transition-all">
                      {state.currentPage === 6 ? 'Xem HD Chấm' : 'Xem Đề Thi'}
                    </button>
                  </div>
               </div>
               
               <div id={state.currentPage === 6 ? "exam-doc" : "guide-doc"} className="bg-white border p-8 md:p-16 rounded-[4rem] shadow-2xl mx-auto max-w-5xl times-new-roman text-[12pt] leading-relaxed min-h-[1000px] text-black overflow-x-auto">
                  {state.currentPage === 6 ? (
                    <div className="space-y-10">
                       <div className="grid grid-cols-1 md:grid-cols-2 text-center font-bold uppercase mb-10 gap-4">
                          <div>{state.matrixConfig.schoolName}<br/>TỔ {state.config.subject.toUpperCase()}</div>
                          <div>{state.matrixConfig.examTitle}<br/>NĂM HỌC {state.matrixConfig.academicYear}</div>
                       </div>
                       <div className="text-center font-bold text-2xl uppercase mb-10 border-b-2 pb-6 border-black">
                          ĐỀ KIỂM TRA MÔN: {state.config.subject.toUpperCase()} - {state.config.grade.toUpperCase()}<br/>
                          <span className="text-[11pt] font-normal italic lowercase">Thời gian: {state.matrixConfig.duration} • Mã đề: {state.matrixConfig.examCode}</span>
                       </div>
                       <div className="space-y-8">
                         {state.examQuestions.map((q, i) => (
                           <div key={q.id} className="break-inside-avoid">
                             <p><b>Câu {i+1}:</b> <span dangerouslySetInnerHTML={{__html: q.text}} /></p>
                             {q.options && (
                               <div className="grid grid-cols-1 sm:grid-cols-2 ml-8 mt-2 gap-2">
                                 {Object.entries(q.options).map(([k, v]) => <p key={k}><b>{k}.</b> {v}</p>)}
                               </div>
                             )}
                             {q.tfStatements && (
                               <div className="ml-8 mt-2 space-y-1">
                                 {Object.entries(q.tfStatements).map(([k, v]) => <p key={k}><b>{k})</b> {v}</p>)}
                               </div>
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : state.gradingGuide && (
                    <div className="space-y-8">
                       <h2 className="text-center font-bold text-3xl uppercase mb-10 italic">HƯỚNG DẪN CHẤM CHI TIẾT</h2>
                       <p className="font-bold underline uppercase">I. Phần trắc nghiệm khách quan</p>
                       <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 border border-black text-center">
                         {state.gradingGuide.mcqAnswers.map((ans, i) => (
                           <div key={i} className="border p-2"><b>Câu {i+1}:</b> {ans}</div>
                         ))}
                       </div>
                       
                       {state.gradingGuide.tfAnswers && state.gradingGuide.tfAnswers.length > 0 && (
                         <div className="mt-8">
                            <p className="font-bold underline uppercase">II. Phần Đúng/Sai</p>
                            <table className="w-full border-collapse border border-black mt-4 text-center">
                              <thead>
                                <tr>
                                  <th className="border border-black p-2">Câu hỏi</th>
                                  <th className="border border-black p-2">Ý a</th>
                                  <th className="border border-black p-2">Ý b</th>
                                  <th className="border border-black p-2">Ý c</th>
                                  <th className="border border-black p-2">Ý d</th>
                                </tr>
                              </thead>
                              <tbody>
                                {state.gradingGuide.tfAnswers.map((tf, i) => (
                                  <tr key={i}>
                                    <td className="border border-black p-2 font-bold">{tf.questionNum}</td>
                                    {tf.answers.split(',').map((a, idx) => <td key={idx} className="border border-black p-2">{a.trim()}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                         </div>
                       )}

                       <div className="space-y-6 mt-10">
                          <p className="font-bold underline uppercase">III. Phần tự luận / Trả lời ngắn</p>
                          {state.gradingGuide.essayAnswers.map((item, i) => (
                            <div key={i} className="bg-slate-50 p-6 border rounded-3xl break-inside-avoid">
                              <p className="font-bold mb-3 italic">Câu hỏi số {item.questionNum}:</p>
                              <div className="pl-4 border-l-2 border-indigo-200" dangerouslySetInnerHTML={{__html: item.guide}} />
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-indigo-950/98 backdrop-blur-2xl flex flex-col items-center justify-center z-[5000] p-10">
          <div className="w-24 h-24 border-[8px] border-indigo-900 border-t-emerald-400 rounded-full animate-spin mb-8 shadow-[0_0_50px_rgba(52,211,153,0.3)]" />
          <h4 className="text-white font-black text-3xl uppercase tracking-tighter animate-pulse text-center italic">Hệ thống AI đang thiết kế dữ liệu...</h4>
          <p className="text-indigo-400 font-bold uppercase text-[10px] mt-4 tracking-[0.4em]">Đang sử dụng Gemini 3 Pro • THCS Huỳnh Thúc Kháng</p>
          <div className="mt-10 max-w-xs w-full bg-white/10 h-1 rounded-full overflow-hidden">
             <div className="bg-emerald-400 h-full w-1/2 animate-[loading_2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default App;