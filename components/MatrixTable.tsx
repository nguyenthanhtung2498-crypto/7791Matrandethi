
import React from 'react';
import { Lesson, MatrixCell, CognitiveLevel, MatrixConfig } from '../types';

interface MatrixTableProps {
  lessons: Lesson[];
  cells: MatrixCell[];
  matrixConfig: MatrixConfig;
  onCellChange?: (lessonId: string, format: string, level: CognitiveLevel, value: number) => void;
}

const MatrixTable: React.FC<MatrixTableProps> = ({ lessons, cells, matrixConfig, onCellChange }) => {
  const levels = [CognitiveLevel.KNOW, CognitiveLevel.UNDERSTAND, CognitiveLevel.APPLY];
  const formats = ['MCQ', 'TF', 'SHORT', 'ESSAY'];

  const getCellData = (lessonId: string, format: string, level: CognitiveLevel) => {
    const cell = (cells || []).find(c => {
      const cFormat = (c.format || "").trim().toUpperCase();
      const pFormat = format.trim().toUpperCase();
      const cLevel = (c.level || "").trim().toLowerCase();
      const pLevel = level.trim().toLowerCase();

      const isLevelMatch = cLevel === pLevel || 
                           (pLevel === "nhận biết" && (cLevel === "know" || cLevel === "nb" || cLevel === "nhận biết")) ||
                           (pLevel === "thông hiểu" && (cLevel === "understand" || cLevel === "th" || cLevel === "thông hiểu")) ||
                           (pLevel === "vận dụng" && (cLevel === "apply" || cLevel === "vd" || cLevel === "vận dụng"));

      return c.lessonId === lessonId && cFormat === pFormat && isLevelMatch;
    });
    return cell ? cell.numQuestions : 0;
  };

  const getPointValue = (format: string) => {
    const f = format.trim().toUpperCase();
    if (f === 'MCQ') return matrixConfig.mcqPoint;
    if (f === 'TF') return matrixConfig.tfPoint;
    if (f === 'SHORT') return matrixConfig.shortPoint;
    if (f === 'ESSAY') return matrixConfig.essayPoint;
    return 0;
  };

  const getColumnTotal = (format: string, level: CognitiveLevel) => {
    return (cells || [])
      .filter(c => {
        const cFormat = (c.format || "").trim().toUpperCase();
        const cLevel = (c.level || "").trim().toLowerCase();
        const pLevel = level.trim().toLowerCase();
        const isLevelMatch = cLevel === pLevel || 
                             (pLevel === "nhận biết" && (cLevel === "know" || cLevel === "nb" || cLevel === "nhận biết")) ||
                             (pLevel === "thông hiểu" && (cLevel === "understand" || cLevel === "th" || cLevel === "thông hiểu")) ||
                             (pLevel === "vận dụng" && (cLevel === "apply" || cLevel === "vd" || cLevel === "vận dụng"));
        return lessons.some(l => l.id === c.lessonId) && cFormat === format && isLevelMatch;
      })
      .reduce((acc, c) => acc + (c.numQuestions || 0), 0);
  };

  return (
    <div className="overflow-x-auto border rounded-[3rem] bg-white shadow-2xl custom-scrollbar w-full p-2">
      <table className="w-full border-collapse matrix-table text-[10px] leading-tight font-sans min-w-[1600px]">
        <thead>
          <tr className="bg-slate-900 text-white uppercase font-black">
            <th rowSpan={3} className="p-4 w-32 text-center bg-slate-950 border-r border-white/20">Chương/Chủ đề</th>
            <th rowSpan={3} className="p-4 w-64 text-center bg-slate-950 border-r border-white/20">Nội dung bài học</th>
            <th colSpan={3} className="p-4 bg-blue-800 border-x border-white/20">Phần I: MCQ (3đ)</th>
            <th colSpan={3} className="p-4 bg-indigo-800 border-x border-white/20">Phần II: Đúng/Sai (2đ)</th>
            <th colSpan={3} className="p-4 bg-emerald-800 border-x border-white/20">Phần III: Ngắn (2đ)</th>
            <th colSpan={3} className="p-4 bg-purple-800 border-x border-white/20">Phần IV: Tự luận (3đ)</th>
            <th colSpan={2} rowSpan={2} className="p-4 bg-slate-800 border-l border-white/20">Tổng cộng bài học</th>
          </tr>
          <tr className="bg-slate-800 text-slate-300 font-bold">
            {formats.map(f => levels.map(l => (
              <th key={`${f}-${l}`} className="border border-white/10 p-2 text-[8px] uppercase tracking-tighter">
                {l === CognitiveLevel.KNOW ? 'BIẾT' : l === CognitiveLevel.UNDERSTAND ? 'HIỂU' : 'VD'}
              </th>
            )))}
          </tr>
          <tr className="bg-slate-700 text-white font-black text-[8px]">
            {formats.map(f => levels.map(l => <th key={`sub-${f}-${l}`} className="border border-white/10 text-[8px] bg-slate-600/50">{getPointValue(f).toFixed(2)}đ</th>))}
            <th className="p-3 bg-slate-600 border border-white/10 uppercase italic">Số câu</th>
            <th className="p-3 bg-slate-600 border border-white/10 uppercase italic">Số điểm</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const lessonQuestions = (cells || []).filter(c => c.lessonId === lesson.id);
            const rowTotalQuestions = lessonQuestions.reduce((acc, c) => acc + (c.numQuestions || 0), 0);
            const rowTotalPoints = lessonQuestions.reduce((acc, c) => acc + ((c.numQuestions || 0) * getPointValue(c.format)), 0);
            
            return (
              <tr key={lesson.id} className="hover:bg-slate-50 transition-colors">
                <td className="border p-4 font-black uppercase text-[9px] bg-slate-50 text-slate-500 leading-tight">{lesson.chapter}</td>
                <td className="border p-4 text-left italic font-bold text-slate-700 leading-snug">{lesson.title}</td>
                {formats.map(f => levels.map(l => {
                  const val = getCellData(lesson.id, f, l);
                  return (
                    <td key={`${lesson.id}-${f}-${l}`} className="border p-0 text-center">
                      <input type="number" className={`w-full h-full p-4 text-center bg-transparent outline-none font-black text-xs transition-all ${val > 0 ? 'text-slate-900 bg-slate-100/50' : 'text-slate-200 focus:text-slate-400'}`}
                        value={val || ''} placeholder="0" onChange={(e) => onCellChange?.(lesson.id, f, l, parseInt(e.target.value) || 0)} />
                    </td>
                  );
                }))}
                <td className="border p-4 font-black text-slate-900 bg-slate-100 text-center text-xs">{rowTotalQuestions}</td>
                <td className="border p-4 font-black text-slate-900 bg-blue-50/50 text-center text-xs">{rowTotalPoints.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr className="bg-slate-950 text-white font-black uppercase tracking-widest text-[11px]">
            <td colSpan={2} className="p-6 text-right text-white bg-slate-900 border-r border-white/20">Tổng cộng</td>
            {formats.map(f => levels.map(l => (
              <td key={`total-${f}-${l}`} className="p-2 text-center border-slate-700 border text-white bg-slate-900/50">
                {getColumnTotal(f, l)}
              </td>
            )))}
            <td className="p-4 text-center bg-slate-800 border-slate-700 border text-white text-lg font-black">
              {(cells || []).reduce((acc, c) => acc + (c.numQuestions || 0), 0)}
            </td>
            <td className="bg-blue-700 p-4 text-center text-xl text-white font-black">
              { (cells || []).reduce((acc, c) => acc + ((c.numQuestions || 0) * getPointValue(c.format)), 0).toFixed(1) }
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MatrixTable;
