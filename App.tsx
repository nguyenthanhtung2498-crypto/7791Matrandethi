
import React, { useState, useEffect } from 'react';
import { ExamType, Subject, Grade, Lesson, AppState, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData } from './types';
import { analyzeFilesForLessons, generateMatrixAndOutcomes, generateExamAndGuide, validateApiKey } from './services/geminiService';
import StepProgressBar from './components/StepProgressBar';
import MatrixTable from './components/MatrixTable';
import SpecificationTable from './components/SpecificationTable';
import { 
  Zap, CheckCircle, LayoutGrid, Layers, Info, 
  ShieldCheck, FileDown, Lock, Brain, ChevronRight, Trash2,
  BookOpen, Settings, AlertCircle, LogOut
} from 'lucide-react';

const ALLOWED_USERNAMES = ["admin", "huynhthuckhang", "giaovien", "root", "admin123"];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('7991_ai_pro_state_v22');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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

  useEffect(() => {
    localStorage.setItem('7991_ai_pro_state_v22', JSON.stringify({
      ...state,
      config: { ...state.config, filePL1: null, filePL3: null, sgkFiles: [] }
    }));
  }, [state]);

  useEffect(() => {
    const renderMath = () => {
      const elIds = ['exam-doc', 'guide-doc', 'root'];
      elIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && (window as any).renderMathInElement) {
          (window as any).renderMathInElement(el, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ],
            throwOnError: false
          });
        }
      });
    };

    if (state.currentPage >= 4) {
      const timer = setTimeout(renderMath, 200);
      return () => clearTimeout(timer);
    }
  }, [state.currentPage, state.examQuestions, state.gradingGuide, state.matrix]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginForm.username) return setAuthError("Vui lòng nhập tên người dùng.");
    if (!ALLOWED_USERNAMES.includes(loginForm.username.toLowerCase())) return setAuthError("Bạn không có quyền truy cập hệ thống này.");
    
    setValidating(true);
    const result = await validateApiKey();
    setValidating(false);
    
    if (result.valid) {
      setState(p => ({ ...p, user: { username: loginForm.username }, currentPage: 2 }));
    } else {
      setAuthError(`Hệ thống AI chưa sẵn sàng: ${result.error}`);
    }
  };

  const handleClearData = () => {
    if (confirm("Xóa toàn bộ dữ liệu phiên làm việc này?")) {
      localStorage.removeItem('7991_ai_pro_state_v22');
      window.location.reload();
    }
  };

  const handleAnalyze = async () => {
    if (!state.config.filePL1 || !state.config.filePL3) return alert("Đính kèm đầy đủ Phụ lục I và III.");
    setLoading(true);
    try {
      const lessons = await analyzeFilesForLessons(state.config.filePL1!, state.config.filePL3!, state.config.examType, state.config.subject, state.config.grade);
      setState(p => ({ ...p, selectedLessons: lessons || [] }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const handleGenerateMatrix = async () => {
    const selected = state.selectedLessons.filter(l => l.selected);
    if (selected.length === 0) return alert("Chọn ít nhất một đơn vị kiến thức.");
    setLoading(true);
    try {
      const matrix = await generateMatrixAndOutcomes(selected, state.config.examType, state.config.subject, state.config.grade, state.config.filePL1!, state.matrixConfig);
      setState(p => ({ ...p, matrix, currentPage: 4 }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const handleCreateFinalExam = async () => {
    setLoading(true);
    try {
      const result = await generateExamAndGuide(state.matrix!, state.config.subject, state.config.grade, state.config.generationMode, state.matrixConfig, state.config.sgkFiles);
      setState(p => ({ ...p, examQuestions: result.questions || [], gradingGuide: result.guide, currentPage: 6 }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const exportToWord = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const blob = new Blob(['\ufeff', element.innerHTML], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `7991_Export.doc`;
    link.click();
  };

  return (
    <div className="min-h-screen pb-10 bg-slate-100 text-slate-900 font-sans selection:bg-indigo-100">
      <header className="bg-indigo-950 text-white p-5 sticky top-0 z-[100] flex justify-between items-center shadow-xl px-10 border-b border-indigo-800">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <LayoutGrid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter italic">7991 AI PRO</h1>
            <p className="text-[8px] font-bold text-indigo-400 tracking-[0.2em] uppercase">Hệ thống hỗ trợ Giáo viên</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {state.user && (
            <div className="flex items-center gap-3 bg-indigo-900/50 px-4 py-2 rounded-xl border border-indigo-800">
              <span className="text-xs font-black uppercase tracking-wider">{state.user.username}</span>
              <button onClick={() => setState(p => ({ ...p, user: null, currentPage: 1 }))} className="ml-2 hover:text-red-400 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={handleClearData} className="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-indigo-300 hover:text-white" title="Reset dữ liệu">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className={`container mx-auto px-4 mt-6 transition-all duration-500 ${state.currentPage >= 4 ? 'wide-container' : 'max-w-6xl'}`}>
        <StepProgressBar currentStep={state.currentPage} />

        <div className="relative bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-6 md:p-12 border border-slate-200/60 min-h-[700px] overflow-hidden">
          {state.currentPage === 1 && (
            <div className="max-w-md mx-auto py-10">
              <div className="text-center mb-10">
                <div className="bg-indigo-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-100/50">
                  <Lock className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Đăng nhập</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest">Hệ thống soạn đề AI chuẩn Công văn 7991</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Tên đăng nhập</label>
                  <input 
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" 
                    placeholder="Nhập username..." 
                    value={loginForm.username} 
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                  />
                </div>
                
                {authError && <div className="p-4 bg-red-50 text-red-600 font-bold text-xs rounded-2xl border border-red-100 flex items-center gap-3"><AlertCircle className="w-4 h-4" /> {authError}</div>}
                
                <button type="submit" disabled={validating} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 hover:bg-indigo-700 hover:-translate-y-1 transition-all">
                  {validating ? "Đang kiểm tra hệ thống..." : "TRUY CẬP HỆ THỐNG"} <Zap className="w-5 h-5 fill-current" />
                </button>
              </form>
            </div>
          )}

          {state.currentPage === 2 && (
             <div className="grid lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
               <div className="space-y-8 text-slate-900">
                 <h3 className="text-2xl font-black uppercase border-l-[6px] border-indigo-600 pl-4 tracking-tight">Nguồn dữ liệu</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <select className="p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 transition-all outline-none" value={state.config.examType} onChange={e => setState(p => ({...p, config: {...p.config, examType: e.target.value as ExamType}}))}>
                        {Object.values(ExamType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <select className="p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 transition-all outline-none" value={state.config.subject} onChange={e => setState(p => ({...p, config: {...p.config, subject: e.target.value as Subject}}))}>
                        {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   <select className="p-4 border-2 border-slate-100 rounded-2xl font-bold bg-slate-50 focus:border-indigo-500 transition-all outline-none" value={state.config.grade} onChange={e => setState(p => ({...p, config: {...p.config, grade: e.target.value as Grade}}))}>
                        {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                   </select>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 group hover:border-indigo-400 transition-all">
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Phụ lục I (Bản đặc tả)</p>
                      <input type="file" className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, filePL1: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 group hover:border-indigo-400 transition-all">
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><Layers className="w-3 h-3" /> Phụ lục III (Kế hoạch GD)</p>
                      <input type="file" className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, filePL3: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                 </div>
                 
                 <button onClick={handleAnalyze} disabled={!state.config.filePL1 || !state.config.filePL3 || loading} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all">
                   {loading ? "Đang xử lý..." : "PHÂN TÍCH CHƯƠNG TRÌNH"} <Zap className="w-5 h-5 fill-current" />
                 </button>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black uppercase text-indigo-700 tracking-tighter flex items-center gap-3"><Layers className="w-5 h-5" /> Bài học trích xuất</h3>
                    {state.selectedLessons.length > 0 && <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{state.selectedLessons.length} bài</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                    {state.selectedLessons.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                        <Info className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Đang chờ dữ liệu</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {state.selectedLessons.map(l => (
                          <div key={l.id} className={`flex items-start gap-4 p-5 bg-white border-2 rounded-2xl transition-all ${l.selected ? 'border-indigo-400 shadow-md' : 'border-transparent opacity-40'}`}>
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 accent-indigo-600 mt-1 cursor-pointer" 
                              checked={l.selected} 
                              onChange={() => setState(p => ({...p, selectedLessons: p.selectedLessons.map(sl => sl.id === l.id ? {...sl, selected: !sl.selected} : sl)}))} 
                            />
                            <div className="flex-1 text-slate-900 font-bold">
                              <p className="text-sm leading-tight">{l.title}</p>
                              <div className="flex gap-3 mt-2">
                                <span className="text-[8px] uppercase font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">Tuần {l.week}</span>
                                <span className="text-[8px] uppercase font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{l.periods} tiết</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {state.selectedLessons.length > 0 && (
                    <button onClick={() => setState(p => ({...p, currentPage: 3}))} className="mt-8 bg-indigo-950 text-white py-6 rounded-3xl font-black uppercase hover:bg-black transition-all flex items-center justify-center gap-2">
                      TIẾP THEO <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
               </div>
             </div>
          )}

          {state.currentPage === 3 && (
            <div className="max-w-5xl mx-auto py-10 text-slate-900 text-center animate-in zoom-in-95 duration-500">
              <h3 className="text-5xl font-black uppercase text-indigo-950 tracking-tighter mb-4 italic">Cấu trúc đề thi</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-16 tracking-widest">Tự động phân bổ 20% kiến thức cũ khi thi Cuối kỳ</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Phần I: MCQ (3.0đ)', key: 'mcqCount' },
                  { label: 'Phần II: Đúng/Sai (2.0đ)', key: 'tfCount' },
                  { label: 'Phần III: Ngắn (2.0đ)', key: 'shortCount' },
                  { label: 'Phần IV: Tự luận (3.0đ)', key: 'essayCount' }
                ].map(item => (
                  <div key={item.key} className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-200 text-center shadow-inner hover:bg-white transition-all">
                    <p className="text-[10px] font-black uppercase mb-8 text-slate-400">{item.label}</p>
                    <input 
                      type="number" 
                      className="w-full text-8xl font-black text-center text-slate-900 outline-none bg-transparent" 
                      value={state.matrixConfig[item.key as keyof MatrixConfig] || 0} 
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setState(p => ({ ...p, matrixConfig: { ...p.matrixConfig, [item.key]: val } }));
                      }} 
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center gap-6 mt-20">
                <button onClick={() => setState(p => ({...p, currentPage: 2}))} className="px-14 py-6 border-2 border-slate-200 rounded-full font-black uppercase text-slate-400">Quay lại</button>
                <button onClick={handleGenerateMatrix} className="px-32 py-6 bg-indigo-600 text-white rounded-full font-black uppercase shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                  SINH MA TRẬN <Zap className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          )}

          {state.currentPage === 4 && state.matrix && (
            <div className="space-y-10">
              <div className="flex justify-between items-end border-b border-slate-100 pb-10 text-slate-900">
                <h3 className="text-5xl font-black uppercase tracking-tighter italic leading-none">Ma trận chi tiết</h3>
                <button onClick={() => setState(p => ({...p, currentPage: 5}))} className="bg-indigo-950 text-white px-16 py-7 rounded-full font-black uppercase shadow-2xl hover:bg-black transition-all">
                  BẢN ĐẶC TẢ <ChevronRight className="w-5 h-5 inline ml-2" />
                </button>
              </div>
              <MatrixTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} matrixConfig={state.matrixConfig} />
            </div>
          )}

          {state.currentPage === 5 && state.matrix && (
             <div className="space-y-10">
                <div className="flex justify-between items-center bg-indigo-50/50 p-10 rounded-[3.5rem] border border-indigo-100 shadow-inner">
                  <div className="max-w-2xl text-slate-900">
                    <h3 className="text-4xl font-black uppercase tracking-tighter italic">Bản đặc tả Công văn 7991</h3>
                    <div className="mt-6 flex flex-col gap-4">
                      <p className="text-[11px] font-black text-indigo-900 uppercase tracking-tight">Tùy chọn: Đính kèm SGK (PDF) để nâng cao chất lượng câu hỏi:</p>
                      <input type="file" multiple className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, sgkFiles: e.target.files ? Array.from(e.target.files) : []}}))} />
                    </div>
                  </div>
                  <button onClick={handleCreateFinalExam} className="bg-indigo-600 text-white px-20 py-10 rounded-full font-black uppercase shadow-2xl flex items-center gap-4 hover:bg-black transition-all">
                    <Brain className="w-8 h-8" /> <span>SOẠN ĐỀ THI AI</span> <Zap className="w-6 h-6 fill-current" />
                  </button>
                </div>
                <SpecificationTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} outcomes={state.matrix.outcomes} />
             </div>
          )}

          {state.currentPage === 6 && (
            <div className="space-y-12">
               <div className="flex justify-between items-center bg-indigo-50/50 p-12 rounded-[4rem] border border-indigo-100 shadow-inner">
                  <div>
                    <h3 className="text-4xl font-black uppercase text-indigo-950 tracking-tighter">Đề thi dự thảo</h3>
                    <p className="text-[10px] font-black text-indigo-500 uppercase mt-2 italic tracking-widest">Times New Roman 12pt • LaTeX Ready</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => exportToWord('exam-doc')} className="bg-emerald-600 text-white px-12 py-5 rounded-3xl font-black uppercase flex items-center gap-3 shadow-xl">
                      <FileDown className="w-6 h-6" /> Xuất Word (.doc)
                    </button>
                    <button onClick={() => setState(p => ({...p, currentPage: 7}))} className="bg-indigo-950 text-white px-12 py-5 rounded-3xl font-black uppercase shadow-2xl hover:bg-black transition-all">
                      Đáp án & HD Chấm
                    </button>
                  </div>
               </div>
               
               <div id="exam-doc" className="bg-white border p-20 rounded-[4rem] shadow-2xl mx-auto max-w-5xl times-new-roman text-[12pt] leading-relaxed min-h-[1000px] text-black">
                  {/* Header */}
                  <div className="grid grid-cols-2 mb-16 text-center font-bold uppercase">
                    <div>{state.matrixConfig.schoolName}<br/>{state.matrixConfig.department}</div>
                    <div>{state.matrixConfig.examTitle}<br/>NĂM HỌC {state.matrixConfig.academicYear}</div>
                  </div>
                  <div className="text-center font-bold text-2xl uppercase mb-16 border-b-4 pb-8 border-slate-900">
                    ĐỀ KIỂM TRA MÔN: {state.config.subject} - {state.config.grade}<br/>
                    <span className="text-[11pt] font-normal italic">Thời gian: {state.matrixConfig.duration} • Mã đề: {state.matrixConfig.examCode}</span>
                  </div>
                  
                  {/* Content */}
                  <div className="space-y-16">
                    <section>
                      <p className="font-bold uppercase underline mb-8">PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN (3,0 ĐIỂM)</p>
                      <div className="space-y-8">
                        {state.examQuestions.filter(q => q.type === 'MCQ').map((q, i) => (
                          <div key={q.id} className="mb-6">
                            <p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                            {q.options && (
                              <div className="grid grid-cols-2 ml-10 mt-4 gap-y-2">
                                {Object.entries(q.options).map(([k, v]) => (
                                  <p key={k}><span className="font-bold mr-2">{k}.</span> {v}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <section>
                      <p className="font-bold uppercase underline mb-8">PHẦN II. TRẮC NGHIỆM ĐÚNG SAI (2,0 ĐIỂM)</p>
                      <div className="space-y-12">
                        {state.examQuestions.filter(q => q.type === 'TF').map((q, i) => (
                          <div key={q.id} className="mb-8">
                            <p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                            <div className="ml-10 mt-6 space-y-4">
                              {['a', 'b', 'c', 'd'].map(l => (
                                <p key={l} className="flex gap-4">
                                  <b className="w-8 shrink-0">{l})</b> 
                                  <span className="flex-1" dangerouslySetInnerHTML={{__html: (q.tfStatements as any)?.[l] || "..................................................."}}></span>
                                  <span className="w-24 shrink-0 text-right text-[10pt] italic">Đúng / Sai</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <section>
                      <p className="font-bold uppercase underline mb-8">PHẦN III. TRẢ LỜI NGẮN (2,0 ĐIỂM)</p>
                      <div className="space-y-10">
                        {state.examQuestions.filter(q => q.type === 'SHORT').map((q, i) => (
                          <div key={q.id} className="mb-6">
                            <p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <section>
                      <p className="font-bold uppercase underline mb-8">PHẦN IV. TỰ LUẬN (3,0 ĐIỂM)</p>
                      <div className="space-y-16">
                        {state.examQuestions.filter(q => q.type === 'ESSAY').map((q, i) => (
                          <div key={q.id} className="mb-8">
                            <p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <div className="text-center mt-32 font-bold italic tracking-widest uppercase">--- HẾT ---</div>
                  </div>
               </div>
            </div>
          )}

          {state.currentPage === 7 && state.gradingGuide && (
            <div className="space-y-12">
               <div className="flex justify-between items-center bg-emerald-50/50 p-12 rounded-[4rem] border border-emerald-100 shadow-inner">
                  <h3 className="text-4xl font-black text-emerald-950 uppercase italic tracking-tighter">HD Chấm & Biểu điểm</h3>
                  <button onClick={() => exportToWord('guide-doc')} className="bg-emerald-700 text-white px-14 py-6 rounded-3xl font-black uppercase flex items-center gap-4 shadow-2xl hover:bg-black transition-all">
                    <FileDown className="w-6 h-6" /> Tải Đáp án
                  </button>
               </div>
               
               <div id="guide-doc" className="bg-white border p-20 rounded-[4rem] shadow-2xl mx-auto max-w-5xl times-new-roman text-[12pt] min-h-[1000px] text-black">
                  <h2 className="text-center font-bold text-3xl uppercase mb-16 border-b-4 pb-8 border-slate-900 text-black">HƯỚNG DẪN CHẤM VÀ BIỂU ĐIỂM</h2>
                  
                  <div className="mb-16">
                    <p className="font-bold uppercase underline mb-8 text-black">PHẦN I. MCQ (3,0đ)</p>
                    <table className="word-export-table border-collapse w-full text-center text-black">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="p-3">Câu</th>
                          {state.gradingGuide.mcqAnswers.map((_, i) => <th key={i} className="p-3">{i+1}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-xl font-black">
                          <td className="p-4 bg-slate-50">Đ/A</td>
                          {state.gradingGuide.mcqAnswers.map((ans, i) => <td key={i} className="p-4 text-emerald-600">{ans}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mb-16">
                    <p className="font-bold uppercase underline mb-10 text-black">PHẦN III & IV. TRẢ LỜI NGẮN & TỰ LUẬN (5,0đ)</p>
                    <div className="space-y-12">
                      <div className="space-y-8">
                        {state.gradingGuide.shortAnswers.map((item, i) => (
                          <div key={`s-${i}`} className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-black">
                            <p className="font-black mb-6 uppercase tracking-tight text-indigo-900">Đáp án Câu {item.questionNum}:</p>
                            <div className="pl-6 border-l-4 border-indigo-200" dangerouslySetInnerHTML={{__html: item.answer}}></div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="space-y-8">
                        {state.gradingGuide.essayAnswers.map((item, i) => (
                          <div key={`e-${i}`} className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-black">
                            <p className="font-black mb-6 uppercase tracking-tight text-emerald-900">Hướng dẫn chấm Câu {item.questionNum}:</p>
                            <div className="pl-6 border-l-4 border-emerald-200 leading-relaxed" dangerouslySetInnerHTML={{__html: item.guide}}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-indigo-950/98 backdrop-blur-2xl flex flex-col items-center justify-center z-[5000] p-10">
          <div className="relative">
            <div className="w-32 h-32 border-[12px] border-indigo-900/50 border-t-emerald-400 rounded-full animate-spin shadow-2xl" />
            <Brain className="absolute inset-0 m-auto w-10 h-10 text-white animate-pulse" />
          </div>
          <h4 className="text-white font-black text-4xl uppercase tracking-tighter mt-12 animate-pulse text-center max-w-4xl italic leading-tight">AI ĐANG THIẾT KẾ ĐỀ THI <br/> (TUÂN THỦ 20% ĐIỂM GIỮA KỲ CHO CUỐI KỲ)</h4>
          <p className="text-indigo-400 font-bold uppercase text-[10px] mt-6 tracking-[0.5em]">Tối ưu hóa phân phối điểm • Công văn 7991</p>
        </div>
      )}
    </div>
  );
};

export default App;