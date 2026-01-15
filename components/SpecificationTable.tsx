
import React from 'react';
import { Lesson, MatrixCell, Outcome, CognitiveLevel } from '../types';

interface SpecificationTableProps {
  lessons: Lesson[];
  cells: MatrixCell[];
  outcomes: Outcome[];
}

const SpecificationTable: React.FC<SpecificationTableProps> = ({ lessons, cells, outcomes }) => {
  const levels = [CognitiveLevel.KNOW, CognitiveLevel.UNDERSTAND, CognitiveLevel.APPLY];
  const formats = ['MCQ', 'TF', 'SHORT', 'ESSAY'];

  const activeLessons = lessons.filter(l => l.selected);
  const sortedLessons = [...activeLessons].sort((a, b) => a.chapter.localeCompare(b.chapter));

  const getChapterRowSpan = (index: number) => {
    const currentChapter = sortedLessons[index].chapter;
    if (index > 0 && sortedLessons[index - 1].chapter === currentChapter) return 0;
    let span = 1;
    for (let i = index + 1; i < sortedLessons.length; i++) {
      if (sortedLessons[i].chapter === currentChapter) span++;
      else break;
    }
    return span;
  };

  const getCellData = (lessonId: string, format: string, level: CognitiveLevel) => {
    const cell = cells.find(c => 
      c.lessonId === lessonId && 
      (c.format?.toUpperCase() === format.toUpperCase() || c.format?.toUpperCase().includes(format.toUpperCase())) && 
      c.level?.toLowerCase() === level.toLowerCase()
    );
    return cell && cell.numQuestions > 0 ? cell.numQuestions : '';
  };

  const getOutcomeText = (lessonId: string) => {
    const outcome = outcomes.find(o => o.lessonId === lessonId);
    return outcome ? outcome.text : null;
  };

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
      <table className="w-full border-collapse matrix-table text-[10px] leading-tight font-sans">
        <thead>
          <tr className="bg-slate-50 font-bold text-slate-800">
            <th rowSpan={4} className="border p-2 w-8 text-center uppercase">TT</th>
            <th rowSpan={4} className="border p-2 w-32 text-center uppercase">Chương/Chủ đề</th>
            <th rowSpan={4} className="border p-2 w-48 text-center uppercase">Đơn vị kiến thức</th>
            <th rowSpan={4} className="border p-2 w-64 text-center uppercase">Yêu cầu cần đạt</th>
            <th colSpan={12} className="border p-1 text-center bg-slate-100 uppercase">Số câu hỏi</th>
          </tr>
          <tr className="bg-slate-50 font-bold text-slate-800">
            <th colSpan={9} className="border p-1 text-center uppercase">Trắc nghiệm</th>
            <th colSpan={3} className="border p-1 text-center uppercase">Tự luận</th>
          </tr>
          <tr className="bg-slate-50 font-bold text-slate-700">
            <th colSpan={3} className="border p-1 text-center italic">MCQ (I)</th>
            <th colSpan={3} className="border p-1 text-center italic">Đúng/Sai (II)</th>
            <th colSpan={3} className="border p-1 text-center italic">Ngắn (III)</th>
            <th colSpan={3} className="border p-1 text-center italic">Tự luận (IV)</th>
          </tr>
          <tr className="bg-slate-50 font-medium text-slate-600 text-[8px]">
            {[1, 2, 3, 4].map((_, i) => (
              <React.Fragment key={i}>
                <th className="border p-1">Biết</th>
                <th className="border p-1">Hiểu</th>
                <th className="border p-1">VD</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-900 font-medium">
          {sortedLessons.map((lesson, idx) => {
            const chapterSpan = getChapterRowSpan(idx);
            const outcomeText = getOutcomeText(lesson.id);
            return (
              <tr key={lesson.id} className="hover:bg-slate-50 transition-all">
                <td className="border p-2 text-center font-bold text-slate-400">{idx + 1}</td>
                {chapterSpan > 0 && (
                  <td rowSpan={chapterSpan} className="border p-3 font-bold text-slate-900 uppercase align-middle bg-white">
                    {lesson.chapter}
                  </td>
                )}
                <td className="border p-3 text-left font-bold text-slate-900 leading-snug">
                  {lesson.title}
                </td>
                <td className="border p-3 text-left text-slate-700 text-[9px] leading-relaxed bg-slate-50/20 min-h-[50px]">
                  {outcomeText ? (
                    <div className="whitespace-pre-wrap">{outcomeText}</div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-300 animate-pulse font-bold uppercase text-[7px]">
                      AI đang soạn đặc tả...
                    </div>
                  )}
                </td>
                {formats.map(f => (
                  levels.map(l => (
                    <td key={`${f}-${l}`} className="border p-1 text-center font-black text-slate-900 text-xs">
                      {getCellData(lesson.id, f, l)}
                    </td>
                  ))
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SpecificationTable;
