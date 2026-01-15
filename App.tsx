
import React, { useState, useEffect } from 'react';
import { ExamType, Subject, Grade, Lesson, AppState, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData, CognitiveLevel } from './types';
import { analyzeFilesForLessons, generateMatrixAndOutcomes, generateExamAndGuide, validateApiKey } from './services/geminiService';
import StepProgressBar from './components/StepProgressBar';
import MatrixTable from './components/MatrixTable';
import SpecificationTable from './components/SpecificationTable';
import { 
  Zap, CheckCircle, LayoutGrid, Layers, Info, 
  ShieldCheck, FileDown, Lock, Brain, ChevronRight, Trash2,
  BookOpen, Key, Settings, AlertCircle
} from 'lucide-react';

const ALLOWED_USERNAMES = ["admin", "huynhthuckhang", "giaovien", "root", "admin123"];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('7991_ai_pro_state_v20');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          config: { ...parsed.config, filePL1: null, filePL3: null, sgkFiles: [] },
          // Key được ưu tiên lấy từ localStorage nếu có
          apiKey: localStorage.getItem('7991_gemini_key') || parsed.apiKey || ''
        };
      } catch (e) { console.error("Error loading state", e); }
    }
    return {
      currentPage: 1,
      apiKey: localStorage.getItem('7991_gemini_key') || '',
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
  const [loginForm, setLoginForm] = useState({ username: '', apiKey: state.apiKey });

  useEffect(() => {
    localStorage.setItem('7991_ai_pro_state_v20', JSON.stringify({
      ...state,
      config: { ...state.config, filePL1: null, filePL3: null, sgkFiles: [] }
    }));
    if (state.apiKey) {
      localStorage.setItem('7991_gemini_key', state.apiKey);
    }
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
    if (!loginForm.username) return setAuthError("Vui lòng nhập tên đăng nhập.");
    if (!loginForm.apiKey) return setAuthError("Vui lòng nhập Gemini API Key.");
    if (!ALLOWED_USERNAMES.includes(loginForm.username.toLowerCase())) return setAuthError("Tài khoản không được cấp quyền.");
    
    setValidating(true);
    const result = await validateApiKey(loginForm.apiKey);
    setValidating(false);
    
    if (result.valid) {
      setState(p => ({ ...p, user: { username: loginForm.username }, apiKey: loginForm.apiKey, currentPage: 2 }));
    } else {
      setAuthError(`Mã API Key không hoạt động: ${result.error}`);
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('7991_gemini_key');
    setLoginForm(p => ({ ...p, apiKey: '' }));
    setState(p => ({ ...p, apiKey: '' }));
    alert("Đã xóa mã API Key khỏi trình duyệt.");
  };

  const handleAnalyze = async () => {
    if (!state.config.filePL1 || !state.config.filePL3) return alert("Vui lòng đính kèm Phụ lục I và III!");
    setLoading(true);
    try {
      const lessons = await analyzeFilesForLessons(state.apiKey, state.config.filePL1!, state.config.filePL3!, state.config.examType, state.config.subject, state.config.grade);
      setState(p => ({ ...p, selectedLessons: lessons || [] }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const handleGenerateMatrix = async () => {
    const selected = state.selectedLessons.filter(l => l.selected);
    if (selected.length === 0) return alert("Chọn ít nhất một bài học.");
    setLoading(true);
    try {
      const matrix = await generateMatrixAndOutcomes(state.apiKey, selected, state.config.examType, state.config.subject, state.config.grade, state.config.filePL1!, state.matrixConfig);
      setState(p => ({ ...p, matrix, currentPage: 4 }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const handleCreateFinalExam = async () => {
    setLoading(true);
    try {
      const result = await generateExamAndGuide(state.apiKey, state.matrix!, state.config.subject, state.config.grade, state.config.generationMode, state.matrixConfig, state.config.sgkFiles);
      setState(p => ({ ...p, examQuestions: result.questions || [], gradingGuide: result.guide, currentPage: 6 }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const exportToWord = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const content = element.innerHTML;
    const blob = new Blob(['\ufeff', `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>
        body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
        table { border-collapse: collapse; width: 100%; border: 1px solid black; }
        td, th { border: 1px solid black; padding: 5px; }
      </style></head>
      <body>${content}</body></html>
    `], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `7991_DeThi_AI.doc`;
    link.click();
  };

  return (
    <div className="min-h-screen pb-10 bg-slate-100 text-black font-sans">
      <header className="bg-blue-900 text-white p-5 sticky top-0 z-[100] flex justify-between items-center shadow-lg px-10">
        <div className="flex items-center gap-3">
          <LayoutGrid className="text-blue-200" />
          <h1 className="text-lg font-black uppercase tracking-tight italic">7991 AI PRO</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => { localStorage.removeItem('7991_ai_pro_state_v20'); window.location.reload(); }} className="text-xs font-bold flex items-center gap-2 hover:bg-red-600 p-2 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" /> Reset
          </button>
          {state.user && <div className="text-xs font-black bg-blue-800 px-4 py-1.5 rounded-full border border-white/20 uppercase">{state.user.username}</div>}
        </div>
      </header>

      <main className={`container mx-auto px-4 mt-6 ${state.currentPage >= 4 ? 'wide-container' : 'max-w-6xl'}`}>
        <StepProgressBar currentStep={state.currentPage} />

        <div className="bg-white rounded-[3rem] shadow-2xl p-6 md:p-12 border border-slate-200 min-h-[750px]">
          {state.currentPage === 1 && (
            <div className="max-w-md mx-auto py-10">
              <div className="text-center mb-10">
                <div className="bg-blue-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner"><Lock className="w-10 h-10 text-blue-600" /></div>
                <h2 className="text-3xl font-black uppercase text-blue-950 tracking-tighter">Đăng nhập</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Hệ thống bảo mật BYOK cho Giáo viên</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Tên người dùng</label>
                  <input className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all" placeholder="admin, giaovien..." value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Gemini API Key</label>
                    {loginForm.apiKey && <button type="button" onClick={handleClearKey} className="text-[9px] text-red-500 font-bold uppercase hover:underline">Xóa mã cũ</button>}
                  </div>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="password" className="w-full p-5 pl-14 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500" placeholder="Dán mã API Key từ Google AI Studio..." value={loginForm.apiKey} onChange={e => setLoginForm({...loginForm, apiKey: e.target.value})} />
                  </div>
                  <p className="text-[9px] text-slate-400 px-4 mt-2 italic flex items-start gap-1">
                    <Info className="w-3 h-3 shrink-0" /> Mã của bạn được lưu cục bộ trên trình duyệt này, không bao giờ gửi về máy chủ của chúng tôi.
                  </p>
                </div>
                {authError && <div className="p-4 bg-red-50 text-red-600 font-bold text-xs rounded-2xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {authError}</div>}
                <button type="submit" disabled={validating} className="w-full bg-blue-800 text-white py-6 rounded-[2.5rem] font-black uppercase shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                  {validating ? "Đang kiểm tra mã AI..." : "KẾT NỐI AI & VÀO HỆ THỐNG"} <ShieldCheck />
                </button>
              </form>
            </div>
          )}

          {state.currentPage === 2 && (
             <div className="grid lg:grid-cols-2 gap-12">
               <div className="space-y-8 text-black">
                 <h3 className="text-2xl font-black uppercase border-l-8 border-blue-600 pl-4">CẤU HÌNH DỮ LIỆU</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <select className="p-4 border-2 rounded-xl font-bold bg-slate-50" value={state.config.examType} onChange={e => setState(p => ({...p, config: {...p.config, examType: e.target.value as ExamType}}))}>
                        {Object.values(ExamType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <select className="p-4 border-2 rounded-xl font-bold bg-slate-50" value={state.config.subject} onChange={e => setState(p => ({...p, config: {...p.config, subject: e.target.value as Subject}}))}>
                        {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                   <select className="p-4 border-2 rounded-xl font-bold bg-slate-50" value={state.config.grade} onChange={e => setState(p => ({...p, config: {...p.config, grade: e.target.value as Grade}}))}>
                        {Object.values(Grade).map(g => <option key={g} value={g}>{g}</option>)}
                   </select>
                 </div>
                 <div className="space-y-4">
                    <div className="p-6 border-2 border-dashed rounded-3xl bg-slate-50">
                      <p className="text-[10px] font-black uppercase mb-3 text-blue-900">Phụ lục I (Đặc tả mẫu)</p>
                      <input type="file" className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, filePL1: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                    <div className="p-6 border-2 border-dashed rounded-3xl bg-slate-50">
                      <p className="text-[10px] font-black uppercase mb-3 text-blue-900">Phụ lục III (Kế hoạch GD)</p>
                      <input type="file" className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, filePL3: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                 </div>
                 <button onClick={handleAnalyze} disabled={!state.config.filePL1 || !state.config.filePL3} className="w-full bg-blue-800 text-white py-6 rounded-[2rem] font-black uppercase shadow-xl flex items-center justify-center gap-2">BẮT ĐẦU PHÂN TÍCH <Zap className="w-5 h-5" /></button>
               </div>
               <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 flex flex-col">
                  <h3 className="font-black uppercase mb-6 text-blue-700 tracking-tighter flex items-center gap-3"><Layers /> Các bài học trích xuất</h3>
                  <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                    {state.selectedLessons.map(l => (
                      <div key={l.id} className={`flex items-start gap-4 p-5 bg-white border-2 rounded-2xl mb-3 transition-all ${l.selected ? 'border-blue-400 shadow-sm' : 'opacity-40'}`}>
                        <input type="checkbox" className="w-5 h-5 accent-blue-600 mt-1" checked={l.selected} onChange={() => setState(p => ({...p, selectedLessons: p.selectedLessons.map(sl => sl.id === l.id ? {...sl, selected: !sl.selected} : sl)}))} />
                        <div className="flex-1 text-black font-bold">
                          <p className="text-sm">{l.title}</p>
                          <p className="text-[9px] uppercase text-slate-400 mt-1">Tuần {l.week} • {l.periods} tiết</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {state.selectedLessons.length > 0 && <button onClick={() => setState(p => ({...p, currentPage: 3}))} className="mt-8 bg-blue-900 text-white py-6 rounded-[2.5rem] font-black uppercase">TIẾP THEO <ChevronRight className="inline ml-2" /></button>}
               </div>
             </div>
          )}

          {state.currentPage === 3 && (
            <div className="max-w-5xl mx-auto py-10 text-black text-center">
              <h3 className="text-4xl font-black uppercase text-blue-950 tracking-tighter mb-4 italic">Khung ma trận (10 điểm)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-12 italic">AI TỰ ĐỘNG PHÂN BỔ 20% ĐIỂM GIỮA KÌ CHO CUỐI KÌ THEO TỈ LỆ TIẾT DẠY.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'P.I: MCQ (3.0đ)', key: 'mcqCount' },
                  { label: 'P.II: Đúng/Sai (2.0đ)', key: 'tfCount' },
                  { label: 'P.III: Ngắn (2.0đ)', key: 'shortCount' },
                  { label: 'P.IV: Tự luận (3.0đ)', key: 'essayCount' }
                ].map(item => (
                  <div key={item.key} className="bg-white p-8 rounded-[3.5rem] border-2 border-slate-100 text-center shadow-xl">
                    <p className="text-[10px] font-black uppercase mb-8 text-black">{item.label}</p>
                    <input type="number" className="w-full text-7xl font-black text-center text-black outline-none" 
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
                <button onClick={() => setState(p => ({...p, currentPage: 2}))} className="px-14 py-6 border-2 rounded-full font-black uppercase text-slate-400">Quay lại</button>
                <button onClick={handleGenerateMatrix} className="px-28 py-6 bg-blue-800 text-white rounded-full font-black uppercase shadow-2xl flex items-center justify-center gap-2">SINH MA TRẬN <Zap className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {state.currentPage === 4 && state.matrix && (
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b pb-8 text-black">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">Ma trận chi tiết chuẩn 7991</h3>
                <button onClick={() => setState(p => ({...p, currentPage: 5}))} className="bg-blue-800 text-white px-16 py-6 rounded-full font-black uppercase shadow-xl">BẢN ĐẶC TẢ <ChevronRight className="inline ml-2" /></button>
              </div>
              <MatrixTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} matrixConfig={state.matrixConfig} />
            </div>
          )}

          {state.currentPage === 5 && state.matrix && (
             <div className="space-y-8">
                <div className="flex justify-between items-center bg-emerald-50/50 p-8 rounded-[3rem] border-2 border-emerald-100">
                  <div className="max-w-xl text-black">
                    <h3 className="text-3xl font-black uppercase tracking-tighter">Bản đặc tả chi tiết</h3>
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="text-[11px] font-black text-emerald-700 uppercase flex items-center gap-2"><BookOpen className="w-4 h-4" /> Bổ sung SGK (PDF) để soạn chính xác hơn:</p>
                      <input type="file" multiple className="text-xs" onChange={e => setState(p => ({...p, config: {...p.config, sgkFiles: e.target.files ? Array.from(e.target.files) : []}}))} />
                    </div>
                  </div>
                  <button onClick={handleCreateFinalExam} className="bg-emerald-700 text-white px-16 py-8 rounded-full font-black uppercase shadow-2xl flex items-center gap-4 hover:bg-black transition-all">SOẠN ĐỀ THI AI <Brain /> <Zap /></button>
                </div>
                <SpecificationTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} outcomes={state.matrix.outcomes} />
             </div>
          )}

          {state.currentPage === 6 && (
            <div className="space-y-10">
               <div className="flex justify-between items-center bg-blue-50 p-10 rounded-[4rem] border-2 border-blue-100 shadow-inner">
                  <div>
                    <h3 className="text-3xl font-black uppercase text-blue-900 tracking-tighter">Đề kiểm tra dự thảo</h3>
                    <p className="text-[10px] font-bold text-blue-500 uppercase mt-2 italic flex items-center gap-2"><CheckCircle className="w-4 h-4" /> TIMES NEW ROMAN 12PT • LaTeX CÔNG THỨC</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => exportToWord('exam-doc')} className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-black uppercase flex items-center gap-3 shadow-xl"><FileDown className="w-6 h-6" /> Xuất Word (.doc)</button>
                    <button onClick={() => setState(p => ({...p, currentPage: 7}))} className="bg-blue-900 text-white px-12 py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-colors">HD Chấm</button>
                  </div>
               </div>
               <div id="exam-doc" className="bg-white border p-20 rounded-[4rem] shadow-sm mx-auto max-w-5xl times-new-roman text-[12pt] leading-relaxed min-h-[900px] text-black">
                  <div className="grid grid-cols-2 mb-12 text-center font-bold uppercase">
                    <div>{state.matrixConfig.schoolName}<br/>{state.matrixConfig.department}</div>
                    <div>{state.matrixConfig.examTitle}<br/>NĂM HỌC {state.matrixConfig.academicYear}</div>
                  </div>
                  <div className="text-center font-bold text-xl uppercase mb-12 border-b-2 pb-6 border-slate-900">
                    ĐỀ KIỂM TRA MÔN: {state.config.subject} - {state.config.grade}<br/>
                    <span className="text-[10pt] font-normal italic">Thời gian: {state.matrixConfig.duration} • Mã đề: {state.matrixConfig.examCode}</span>
                  </div>
                  <div className="space-y-12">
                    <section><p className="font-bold uppercase underline mb-6">PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN (3,0 ĐIỂM)</p>
                      <div className="space-y-6">{state.examQuestions.filter(q => q.type === 'MCQ').map((q, i) => (
                        <div key={q.id} className="mb-4"><p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                        {q.options && <div className="grid grid-cols-2 ml-8 mt-2">{Object.entries(q.options).map(([k, v]) => <p key={k}><span className="font-bold mr-2">{k}.</span> {v}</p>)}</div>}</div>
                      ))}</div>
                    </section>
                    <section><p className="font-bold uppercase underline mb-6">PHẦN II. TRẮC NGHIỆM ĐÚNG SAI (2,0 ĐIỂM)</p>
                      <div className="space-y-10">{state.examQuestions.filter(q => q.type === 'TF').map((q, i) => (
                        <div key={q.id} className="mb-4"><p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                        <div className="ml-8 mt-4 space-y-3">
                          {['a', 'b', 'c', 'd'].map(l => (
                            <p key={l} className="flex gap-4">
                              <b className="w-6 shrink-0">{l})</b> 
                              <span className="flex-1" dangerouslySetInnerHTML={{__html: (q.tfStatements as any)?.[l] || "..................................................."}}></span>
                              <span className="w-20 shrink-0 text-right text-[10pt] italic">Đúng / Sai</span>
                            </p>
                          ))}
                        </div></div>
                      ))}</div>
                    </section>
                    <section><p className="font-bold uppercase underline mb-6">PHẦN III. CÂU HỎI TRẢ LỜI NGẮN (2,0 ĐIỂM)</p>
                      <div className="space-y-8">{state.examQuestions.filter(q => q.type === 'SHORT').map((q, i) => (
                        <div key={q.id} className="mb-4"><p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p></div>
                      ))}</div>
                    </section>
                    <section><p className="font-bold uppercase underline mb-6">PHẦN IV. TỰ LUẬN (3,0 ĐIỂM)</p>
                      <div className="space-y-12">{state.examQuestions.filter(q => q.type === 'ESSAY').map((q, i) => (
                        <div key={q.id} className="mb-4"><p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p></div>
                      ))}</div>
                    </section>
                    <div className="text-center mt-20 font-bold italic">--- HẾT ---</div>
                  </div>
               </div>
            </div>
          )}

          {state.currentPage === 7 && state.gradingGuide && (
            <div className="space-y-10">
               <div className="flex justify-between items-center bg-indigo-50 p-10 rounded-[3rem] border-2 border-indigo-100 shadow-inner">
                  <h3 className="text-3xl font-black text-indigo-900 uppercase">Hướng dẫn chấm chi tiết</h3>
                  <button onClick={() => exportToWord('guide-doc')} className="bg-indigo-700 text-white px-12 py-5 rounded-2xl font-black uppercase flex items-center gap-3"><FileDown className="w-6 h-6" /> Tải HD Chấm</button>
               </div>
               <div id="guide-doc" className="bg-white border p-20 rounded-[4rem] shadow-sm mx-auto max-w-5xl times-new-roman text-[12pt] min-h-[900px] text-black">
                  <h2 className="text-center font-bold text-2xl uppercase mb-12 border-b-4 pb-6 border-slate-900 text-black">HƯỚNG DẪN CHẤM VÀ BIỂU ĐIỂM</h2>
                  <div className="mb-12"><p className="font-bold uppercase underline mb-6 text-black">PHẦN I. MCQ (3,0đ)</p>
                    <table className="word-export-table border-collapse w-full text-center text-black">
                      <thead><tr className="bg-slate-50 font-black"><th>Câu</th>{state.gradingGuide.mcqAnswers.map((_, i) => <th key={i}>{i+1}</th>)}</tr></thead>
                      <tbody><tr className="text-lg"><td>Đáp án</td>{state.gradingGuide.mcqAnswers.map((ans, i) => <td key={i} className="font-bold">{ans}</td>)}</tr></tbody>
                    </table>
                  </div>
                  <div className="mb-12"><p className="font-bold uppercase underline mb-8 text-black">PHẦN III & IV. TRẢ LỜI NGẮN & TỰ LUẬN</p>
                    <div className="space-y-10">
                      {state.gradingGuide.shortAnswers.map((item, i) => (
                        <div key={`s-${i}`} className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100 text-black"><p className="font-black mb-4 uppercase">Câu {item.questionNum}:</p><div dangerouslySetInnerHTML={{__html: item.answer}}></div></div>
                      ))}
                      {state.gradingGuide.essayAnswers.map((item, i) => (
                        <div key={`e-${i}`} className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100 text-black"><p className="font-black mb-4 uppercase">Câu {item.questionNum}:</p><div dangerouslySetInnerHTML={{__html: item.guide}}></div></div>
                      ))}
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-blue-950/95 backdrop-blur-xl flex flex-col items-center justify-center z-[5000]">
          <div className="w-28 h-28 border-[12px] border-blue-900 border-t-emerald-400 rounded-full animate-spin mb-10 shadow-2xl" />
          <h4 className="text-white font-black text-3xl uppercase tracking-widest animate-pulse text-center px-10">AI ĐANG XÂY DỰNG ĐỀ THI <br/> (20% ĐIỂM GK CHO CK)</h4>
        </div>
      )}
    </div>
  );
};

export default App;
