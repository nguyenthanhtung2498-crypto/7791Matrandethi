
import React, { useState, useEffect } from 'react';
import { ExamType, Subject, Grade, Lesson, AppState, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData } from './types';
import { analyzeFilesForLessons, generateMatrixAndOutcomes, generateExamAndGuide, validateApiKey } from './services/geminiService';
import StepProgressBar from './components/StepProgressBar';
import MatrixTable from './components/MatrixTable';
import SpecificationTable from './components/SpecificationTable';
import { 
  Zap, CheckCircle, LayoutGrid, Layers, Info, 
  ShieldCheck, FileDown, Lock, Brain, ChevronRight, Trash2,
  BookOpen, Key, Settings, AlertCircle, Eye, EyeOff, LogOut, ExternalLink, HelpCircle
} from 'lucide-react';

const ALLOWED_USERNAMES = ["admin", "huynhthuckhang", "giaovien", "root", "admin123"];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('7991_ai_pro_state_v21');
    const storedKey = localStorage.getItem('7991_gemini_key') || '';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          config: { ...parsed.config, filePL1: null, filePL3: null, sgkFiles: [] },
          apiKey: storedKey
        };
      } catch (e) { console.error("Error loading state", e); }
    }
    return {
      currentPage: 1,
      apiKey: storedKey,
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
  const [showKey, setShowKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', apiKey: state.apiKey });

  useEffect(() => {
    const { apiKey, ...persistentState } = state;
    localStorage.setItem('7991_ai_pro_state_v21', JSON.stringify({
      ...persistentState,
      config: { ...persistentState.config, filePL1: null, filePL3: null, sgkFiles: [] }
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

    if (state.currentPage >= 4 || showSettings) {
      const timer = setTimeout(renderMath, 200);
      return () => clearTimeout(timer);
    }
  }, [state.currentPage, state.examQuestions, state.gradingGuide, state.matrix, showSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginForm.username) return setAuthError("Vui lòng nhập tên người dùng.");
    if (!loginForm.apiKey) return setAuthError("Hệ thống yêu cầu Gemini API Key cá nhân.");
    if (!ALLOWED_USERNAMES.includes(loginForm.username.toLowerCase())) return setAuthError("Bạn không có quyền truy cập hệ thống này.");
    
    setValidating(true);
    const result = await validateApiKey(loginForm.apiKey);
    setValidating(false);
    
    if (result.valid) {
      setState(p => ({ ...p, user: { username: loginForm.username }, apiKey: loginForm.apiKey, currentPage: 2 }));
      setShowSettings(false);
    } else {
      setAuthError(`Mã API Key không hợp lệ hoặc đã hết hạn: ${result.error}`);
    }
  };

  const handleUpdateKeyInSettings = async () => {
    setValidating(true);
    const result = await validateApiKey(loginForm.apiKey);
    setValidating(false);
    if (result.valid) {
      setState(p => ({ ...p, apiKey: loginForm.apiKey }));
      alert("Cập nhật API Key thành công!");
    } else {
      alert(`Lỗi: ${result.error}`);
    }
  };

  const handleClearData = () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ mã khóa và dữ liệu cục bộ?")) {
      localStorage.removeItem('7991_gemini_key');
      localStorage.removeItem('7991_ai_pro_state_v21');
      window.location.reload();
    }
  };

  const handleAnalyze = async () => {
    if (!state.apiKey) return alert("Vui lòng cấu hình API Key trong phần Cài đặt.");
    if (!state.config.filePL1 || !state.config.filePL3) return alert("Đính kèm đầy đủ Phụ lục I và III.");
    setLoading(true);
    try {
      const lessons = await analyzeFilesForLessons(state.apiKey, state.config.filePL1!, state.config.filePL3!, state.config.examType, state.config.subject, state.config.grade);
      setState(p => ({ ...p, selectedLessons: lessons || [] }));
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  const handleGenerateMatrix = async () => {
    const selected = state.selectedLessons.filter(l => l.selected);
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
    const blob = new Blob(['\ufeff', element.innerHTML], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `7991_Exam_Export.doc`;
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
            <p className="text-[8px] font-bold text-indigo-400 tracking-[0.2em] uppercase">Teacher's Digital Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {state.user && (
            <>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-800 text-indigo-300'}`}
                title="Cài đặt hệ thống"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-indigo-800 mx-2" />
              <div className="flex items-center gap-3 bg-indigo-900/50 px-4 py-2 rounded-xl border border-indigo-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider">{state.user.username}</span>
                <button onClick={() => setState(p => ({ ...p, user: null, currentPage: 1 }))} className="ml-2 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className={`container mx-auto px-4 mt-6 transition-all duration-500 ${state.currentPage >= 4 ? 'wide-container' : 'max-w-6xl'}`}>
        <StepProgressBar currentStep={state.currentPage} />

        <div className="relative bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] p-6 md:p-12 border border-slate-200/60 min-h-[700px] overflow-hidden">
          {/* Settings Overlay */}
          {showSettings && (
            <div className="absolute inset-0 z-[200] bg-white/95 backdrop-blur-md p-10 flex flex-col items-center">
              <div className="w-full max-w-2xl">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-3xl font-black uppercase text-slate-900 tracking-tighter">Cấu hình hệ thống</h3>
                  <button onClick={() => setShowSettings(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><Trash2 className="w-6 h-6 text-slate-400 rotate-45" /></button>
                </div>
                
                <div className="space-y-8">
                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex gap-4">
                    <Info className="w-6 h-6 text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-indigo-900 mb-1">Quyền riêng tư tuyệt đối (BYOK)</p>
                      <p className="text-xs text-indigo-700 leading-relaxed">Mã API Key được lưu trữ trực tiếp trong trình duyệt của bạn. Chúng tôi không thu thập, không lưu trữ và không nhìn thấy mã khóa này. Bạn có thể xóa bất cứ lúc nào.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase text-slate-500 ml-2">Google Gemini API Key</label>
                    <div className="relative">
                      <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type={showKey ? "text" : "password"} 
                        className="w-full p-5 pl-14 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-sm focus:border-indigo-500 outline-none transition-all"
                        placeholder="AIZA..."
                        value={loginForm.apiKey}
                        onChange={e => setLoginForm(p => ({ ...p, apiKey: e.target.value }))}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowKey(!showKey)} 
                        className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600"
                      >
                        {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={handleUpdateKeyInSettings} disabled={validating} className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      {validating ? "Đang xác thực..." : "Kiểm tra & Cập nhật"} <ShieldCheck className="w-5 h-5" />
                    </button>
                    <button onClick={handleClearData} className="px-8 border-2 border-red-100 text-red-500 py-5 rounded-2xl font-black uppercase hover:bg-red-50 transition-all">
                      Xóa trắng dữ liệu
                    </button>
                  </div>

                  <div className="pt-10 border-t border-slate-100">
                    <h4 className="font-black uppercase text-[10px] text-slate-400 mb-4">Hướng dẫn lấy mã</h4>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-300 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded-lg border border-slate-200"><ExternalLink className="w-4 h-4 text-indigo-600" /></div>
                        <span className="text-sm font-bold text-slate-700">Lấy API Key miễn phí tại Google AI Studio</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {state.currentPage === 1 && (
            <div className="max-w-md mx-auto py-10">
              <div className="text-center mb-10">
                <div className="bg-indigo-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-100/50">
                  <Lock className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter">Bắt đầu</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-3 tracking-widest">Hệ thống soạn đề AI chuẩn Công văn 7991</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Tên đăng nhập</label>
                  <input 
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all" 
                    placeholder="Ví dụ: giaovien_thcs" 
                    value={loginForm.username} 
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Gemini API Key</label>
                    <button type="button" onClick={() => setShowKey(!showKey)} className="text-[9px] font-black text-indigo-500 uppercase hover:underline">
                      {showKey ? "Ẩn mã" : "Hiện mã"}
                    </button>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      type={showKey ? "text" : "password"} 
                      className="w-full p-5 pl-14 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-500" 
                      placeholder="Dán mã API Key của bạn..." 
                      value={loginForm.apiKey} 
                      onChange={e => setLoginForm({...loginForm, apiKey: e.target.value})} 
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl mt-2">
                    <HelpCircle className="w-3 h-3 text-blue-500" />
                    <p className="text-[9px] text-blue-600 font-bold uppercase leading-tight">Mã khóa được lưu cục bộ trên trình duyệt này. Tuyệt đối an toàn.</p>
                  </div>
                </div>

                {authError && <div className="p-4 bg-red-50 text-red-600 font-bold text-xs rounded-2xl border border-red-100 flex items-center gap-3"><AlertCircle className="w-4 h-4" /> {authError}</div>}
                
                <button type="submit" disabled={validating} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 hover:bg-indigo-700 hover:-translate-y-1 transition-all">
                  {validating ? "Đang kết nối AI..." : "KÍCH HOẠT HỆ THỐNG"} <Zap className="w-5 h-5 fill-current" />
                </button>
                
                <p className="text-center text-[9px] font-bold text-slate-300 uppercase mt-8 tracking-widest">Powered by Google Gemini 2.5/3.0</p>
              </form>
            </div>
          )}

          {state.currentPage === 2 && (
             <div className="grid lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
               <div className="space-y-8 text-slate-900">
                 <h3 className="text-2xl font-black uppercase border-l-[6px] border-indigo-600 pl-4 tracking-tight">Cấu hình kỳ thi</h3>
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
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Phụ lục I (Bản đặc tả mẫu)</p>
                      <input type="file" className="text-xs file:bg-white file:border file:border-slate-200 file:rounded-lg file:px-4 file:py-2 file:font-bold file:text-indigo-600 file:mr-4 file:hover:bg-indigo-50 cursor-pointer" onChange={e => setState(p => ({...p, config: {...p.config, filePL1: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 group hover:border-indigo-400 transition-all">
                      <p className="text-[10px] font-black uppercase mb-3 text-indigo-900 flex items-center gap-2"><Layers className="w-3 h-3" /> Phụ lục III (Kế hoạch GD)</p>
                      <input type="file" className="text-xs file:bg-white file:border file:border-slate-200 file:rounded-lg file:px-4 file:py-2 file:font-bold file:text-indigo-600 file:mr-4 file:hover:bg-indigo-50 cursor-pointer" onChange={e => setState(p => ({...p, config: {...p.config, filePL3: e.target.files ? e.target.files[0] : null}}))} />
                    </div>
                 </div>
                 
                 <button onClick={handleAnalyze} disabled={!state.config.filePL1 || !state.config.filePL3 || loading} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                   {loading ? "Đang phân tích..." : "Phân tích chương trình"} <Zap className="w-5 h-5 fill-current" />
                 </button>
               </div>
               
               <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black uppercase text-indigo-700 tracking-tighter flex items-center gap-3"><Layers className="w-5 h-5" /> Đơn vị kiến thức trích xuất</h3>
                    {state.selectedLessons.length > 0 && <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{state.selectedLessons.length} bài</span>}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                    {state.selectedLessons.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                        <Info className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Đang chờ dữ liệu phân tích</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {state.selectedLessons.map(l => (
                          <div key={l.id} className={`flex items-start gap-4 p-5 bg-white border-2 rounded-2xl transition-all ${l.selected ? 'border-indigo-400 shadow-md translate-x-1' : 'border-transparent opacity-40 hover:opacity-60'}`}>
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
                                <span className="text-[8px] uppercase font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{l.periods} tiết dạy</span>
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
              <h3 className="text-5xl font-black uppercase text-indigo-950 tracking-tighter mb-4 italic">Cấu trúc khung đề</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-16 tracking-widest flex items-center justify-center gap-2">
                <AlertCircle className="w-3 h-3 text-indigo-400" /> AI tự động phân bổ 20% điểm Giữa kỳ cho kỳ thi Cuối kỳ
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Phần I: MCQ (3.0đ)', key: 'mcqCount', icon: <Layers className="w-5 h-5 text-indigo-500" /> },
                  { label: 'Phần II: Đúng/Sai (2.0đ)', key: 'tfCount', icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
                  { label: 'Phần III: Ngắn (2.0đ)', key: 'shortCount', icon: <Info className="w-5 h-5 text-blue-500" /> },
                  { label: 'Phần IV: Tự luận (3.0đ)', key: 'essayCount', icon: <Brain className="w-5 h-5 text-purple-500" /> }
                ].map(item => (
                  <div key={item.key} className="bg-slate-50 p-10 rounded-[3.5rem] border border-slate-200 text-center shadow-inner hover:bg-white hover:shadow-2xl transition-all group">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <p className="text-[10px] font-black uppercase mb-8 text-slate-400 tracking-tighter">{item.label}</p>
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
                <button onClick={() => setState(p => ({...p, currentPage: 2}))} className="px-14 py-6 border-2 border-slate-200 rounded-full font-black uppercase text-slate-400 hover:bg-slate-50 transition-all">Quay lại</button>
                <button onClick={handleGenerateMatrix} className="px-32 py-6 bg-indigo-600 text-white rounded-full font-black uppercase shadow-[0_20px_40px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                  XÂY DỰNG MA TRẬN <Zap className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          )}

          {state.currentPage === 4 && state.matrix && (
            <div className="space-y-10 animate-in slide-in-from-bottom-10 duration-700">
              <div className="flex justify-between items-end border-b border-slate-100 pb-10 text-slate-900">
                <div>
                  <h3 className="text-5xl font-black uppercase tracking-tighter italic leading-none">Ma trận chi tiết</h3>
                  <p className="text-[10px] font-black text-indigo-500 uppercase mt-4 tracking-widest flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> ĐÃ TỐI ƯU TỈ LỆ ĐIỂM THEO CÔNG VĂN 7991
                  </p>
                </div>
                <button onClick={() => setState(p => ({...p, currentPage: 5}))} className="bg-indigo-950 text-white px-16 py-7 rounded-full font-black uppercase shadow-2xl hover:bg-black transition-all flex items-center gap-3">
                  TIẾP TỤC: XÂY DỰNG BẢN ĐẶC TẢ <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <MatrixTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} matrixConfig={state.matrixConfig} />
            </div>
          )}

          {state.currentPage === 5 && state.matrix && (
             <div className="space-y-10 animate-in slide-in-from-bottom-10 duration-700">
                <div className="flex justify-between items-center bg-indigo-50/50 p-10 rounded-[3.5rem] border border-indigo-100 shadow-inner">
                  <div className="max-w-2xl text-slate-900">
                    <h3 className="text-4xl font-black uppercase tracking-tighter italic">Bản đặc tả chi tiết</h3>
                    <div className="mt-6 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100"><BookOpen className="w-5 h-5 text-indigo-600" /></div>
                        <p className="text-[11px] font-black text-indigo-900 uppercase tracking-tight">Đính kèm SGK (PDF) để soạn câu hỏi chuẩn ngữ liệu:</p>
                      </div>
                      <input type="file" multiple className="text-xs font-bold text-slate-500 file:bg-white file:border file:border-slate-200 file:rounded-xl file:px-6 file:py-3 file:text-indigo-600 file:mr-4 file:hover:bg-indigo-50 cursor-pointer" onChange={e => setState(p => ({...p, config: {...p.config, sgkFiles: e.target.files ? Array.from(e.target.files) : []}}))} />
                    </div>
                  </div>
                  <button onClick={handleCreateFinalExam} className="bg-indigo-600 text-white px-20 py-10 rounded-full font-black uppercase shadow-[0_30px_60px_rgba(79,70,229,0.3)] flex flex-col items-center gap-2 hover:bg-black transition-all hover:scale-105 group">
                    <div className="flex items-center gap-3">
                      <Brain className="w-8 h-8" />
                      <span className="text-2xl">SOẠN ĐỀ THI AI</span>
                      <Zap className="w-6 h-6 fill-current group-hover:animate-bounce" />
                    </div>
                    <span className="text-[10px] font-bold opacity-60">Chuẩn Times New Roman & LaTeX</span>
                  </button>
                </div>
                <SpecificationTable lessons={state.selectedLessons.filter(l => l.selected)} cells={state.matrix.cells} outcomes={state.matrix.outcomes} />
             </div>
          )}

          {state.currentPage === 6 && (
            <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
               <div className="flex justify-between items-center bg-indigo-50/50 p-12 rounded-[4rem] border border-indigo-100 shadow-inner">
                  <div>
                    <h3 className="text-4xl font-black uppercase text-indigo-950 tracking-tighter leading-none italic">Đề kiểm tra dự thảo</h3>
                    <p className="text-[10px] font-black text-indigo-500 uppercase mt-4 italic flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> 
                      Times New Roman 12pt • LaTeX Rendering Active
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => exportToWord('exam-doc')} className="bg-white border-2 border-slate-200 text-slate-700 px-12 py-5 rounded-3xl font-black uppercase flex items-center gap-3 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm">
                      <FileDown className="w-6 h-6 text-indigo-600" /> Xuất Word (.doc)
                    </button>
                    <button onClick={() => setState(p => ({...p, currentPage: 7}))} className="bg-indigo-950 text-white px-12 py-5 rounded-3xl font-black uppercase shadow-2xl hover:bg-black transition-all">
                      Xem HD Chấm & Đáp án
                    </button>
                  </div>
               </div>
               
               <div id="exam-doc" className="bg-white border p-20 rounded-[4rem] shadow-2xl mx-auto max-w-5xl times-new-roman text-[12pt] leading-relaxed min-h-[1000px] text-black">
                  <div className="grid grid-cols-2 mb-16 text-center font-bold uppercase">
                    <div>{state.matrixConfig.schoolName}<br/>{state.matrixConfig.department}</div>
                    <div>{state.matrixConfig.examTitle}<br/>NĂM HỌC {state.matrixConfig.academicYear}</div>
                  </div>
                  <div className="text-center font-bold text-2xl uppercase mb-16 border-b-4 pb-8 border-slate-900">
                    ĐỀ KIỂM TRA MÔN: {state.config.subject} - {state.config.grade}<br/>
                    <span className="text-[11pt] font-normal italic">Thời gian: {state.matrixConfig.duration} • Mã đề: {state.matrixConfig.examCode}</span>
                  </div>
                  
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
                                <p key={l} className="flex gap-4 border-b border-dotted border-slate-200 pb-2">
                                  <b className="w-8 shrink-0">{l})</b> 
                                  <span className="flex-1" dangerouslySetInnerHTML={{__html: (q.tfStatements as any)?.[l] || "...................................................................................."}}></span>
                                  <span className="w-24 shrink-0 text-right text-[10pt] italic font-bold">Đúng / Sai</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    <section>
                      <p className="font-bold uppercase underline mb-8">PHẦN III. CÂU HỎI TRẢ LỜI NGẮN (2,0 ĐIỂM)</p>
                      <div className="space-y-10">
                        {state.examQuestions.filter(q => q.type === 'SHORT').map((q, i) => (
                          <div key={q.id} className="mb-6">
                            <p className="font-bold">Câu {i + 1}. <span dangerouslySetInnerHTML={{__html: q.text}}></span></p>
                            <div className="h-4 w-full border-b border-dotted border-slate-400 mt-8" />
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
                            <div className="space-y-4 mt-6">
                              <div className="h-px w-full border-b border-dotted border-slate-300" />
                              <div className="h-px w-full border-b border-dotted border-slate-300" />
                            </div>
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
            <div className="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
               <div className="flex justify-between items-center bg-emerald-50/50 p-12 rounded-[4rem] border border-emerald-100 shadow-inner">
                  <h3 className="text-4xl font-black text-emerald-950 uppercase italic tracking-tighter">Hướng dẫn chấm & Đáp án</h3>
                  <button onClick={() => exportToWord('guide-doc')} className="bg-emerald-700 text-white px-14 py-6 rounded-3xl font-black uppercase flex items-center gap-4 shadow-2xl shadow-emerald-700/20 hover:bg-black transition-all">
                    <FileDown className="w-6 h-6" /> Tải File Đáp án
                  </button>
               </div>
               
               <div id="guide-doc" className="bg-white border p-20 rounded-[4rem] shadow-2xl mx-auto max-w-5xl times-new-roman text-[12pt] min-h-[1000px] text-black">
                  <h2 className="text-center font-bold text-3xl uppercase mb-16 border-b-4 pb-8 border-slate-900 text-black">HƯỚNG DẪN CHẤM VÀ BIỂU ĐIỂM</h2>
                  
                  <div className="mb-16">
                    <p className="font-bold uppercase underline mb-8 text-black">PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN (3,0đ)</p>
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
                            <p className="font-black mb-6 uppercase tracking-tight text-indigo-900 flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs">S{i+1}</div> 
                              Đáp án Câu trả lời ngắn {item.questionNum}:
                            </p>
                            <div className="pl-6 border-l-4 border-indigo-200 italic" dangerouslySetInnerHTML={{__html: item.answer}}></div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="space-y-8">
                        {state.gradingGuide.essayAnswers.map((item, i) => (
                          <div key={`e-${i}`} className="p-10 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-black">
                            <p className="font-black mb-6 uppercase tracking-tight text-emerald-900 flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs">E{i+1}</div> 
                              Hướng dẫn chấm Tự luận {item.questionNum}:
                            </p>
                            <div className="pl-6 border-l-4 border-emerald-200 bg-white p-6 rounded-2xl shadow-sm leading-relaxed" dangerouslySetInnerHTML={{__html: item.guide}}></div>
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
            <div className="w-32 h-32 border-[12px] border-indigo-900/50 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_80px_rgba(52,211,153,0.3)]" />
            <Brain className="absolute inset-0 m-auto w-10 h-10 text-white animate-pulse" />
          </div>
          <h4 className="text-white font-black text-4xl uppercase tracking-tighter mt-12 animate-pulse text-center max-w-4xl italic">AI ĐANG XỬ LÝ DỮ LIỆU SƯ PHẠM</h4>
          <p className="text-indigo-400 font-bold uppercase text-[10px] mt-6 tracking-[0.5em]">Optimizing points distribution • Ensuring 7991 standards</p>
          <div className="mt-12 w-64 h-1.5 bg-indigo-900/50 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 w-1/2 animate-[progress_3s_infinite_linear]" />
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;
