import { GoogleGenAI, Type } from "@google/genai";
import { ExamType, Subject, Grade, Lesson, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData } from "../types";
import mammoth from "mammoth";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const cleanJsonString = (str: string): string => {
  try {
    // Remove markdown code blocks and any leading/trailing whitespace
    let cleaned = str.replace(/```json/gi, "").replace(/```/g, "").trim();
    // Find the first '[' or '{' and last ']' or '}'
    const firstBrace = cleaned.search(/[\[\{]/);
    const lastBrace = cleaned.lastIndexOf(cleaned.match(/[\]\}]/)?.[0] || "");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    // Remove non-printable characters that can break JSON.parse
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    return cleaned;
  } catch (e) {
    console.error("Error cleaning JSON string:", e);
    return str;
  }
};

const fileToPart = async (file: File): Promise<any> => {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      return { text: `Nội dung tệp ${file.name}: ${result.value}` };
    } catch (err) {
      console.error("Lỗi đọc file Word:", err);
      return { text: `Lỗi đọc file ${file.name}` };
    }
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ inlineData: { data: (reader.result as string).split(',')[1], mimeType: file.type || 'application/pdf' } });
    reader.onerror = () => resolve({ text: `Lỗi đọc file ${file.name}` });
    reader.readAsDataURL(file);
  });
};

export const validateApiKey = async (): Promise<{ valid: boolean; error?: string }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { valid: false, error: "Chưa cấu hình API_KEY hệ thống." };
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: 'Kiểm tra kết nối.' 
    });
    return { valid: !!response.text };
  } catch (error: any) { 
    return { valid: false, error: error.message }; 
  }
};

export const analyzeFilesForLessons = async (pl1File: File, pl3File: File, examType: ExamType, subject: Subject, grade: Grade): Promise<Lesson[]> => {
  const ai = getAI();
  const pl3Part = await fileToPart(pl3File);
  const prompt = `Bạn là chuyên gia giáo dục Việt Nam. Hãy phân tích Kế hoạch dạy học (Phụ lục III) môn ${subject} (${grade}) cho kỳ thi ${examType}. 
  Trích xuất danh sách các bài học/chủ đề đã dạy đến thời điểm thi.
  TRẢ VỀ JSON ARRAY: [ { "title": "Tên bài học", "chapter": "Tên chương/chủ đề", "week": "Tuần (số)", "periods": "Số tiết (số)" } ]`;
  
  const response = await ai.models.generateContent({ 
    model: 'gemini-3-flash-preview', 
    contents: { parts: [pl3Part, { text: prompt }] }, 
    config: { responseMimeType: "application/json" } 
  });
  
  const cleanedText = cleanJsonString(response.text || '[]');
  const raw = JSON.parse(cleanedText);
  return raw.map((l: any) => ({ 
    ...l, 
    id: Math.random().toString(36).substr(2, 9), 
    selected: true,
    periods: parseInt(l.periods) || 2,
    week: l.week || "?"
  }));
};

export const generateMatrixAndOutcomes = async (lessons: Lesson[], examType: ExamType, subject: Subject, grade: Grade, pl1File: File, mConfig: MatrixConfig): Promise<any> => {
  const ai = getAI();
  const pl1Part = await fileToPart(pl1File);
  const totalPeriods = lessons.reduce((acc, l) => acc + (l.periods || 1), 0);

  const prompt = `Lập ma trận đề thi 10 điểm cho môn ${subject} (${grade}) dựa trên danh sách bài học: ${JSON.stringify(lessons)}.
  Căn cứ vào Phụ lục I (Bản đặc tả) được cung cấp.

  QUY TẮC PHÂN BỔ:
  1. TỶ LỆ TIẾT: Phân bổ điểm tương ứng tỷ lệ số tiết của từng bài trên tổng ${totalPeriods} tiết.
  2. KỲ THI ${examType}: Nếu là Cuối kỳ, dành 20% (2.0đ) cho kiến thức cũ (đầu danh sách), 80% cho kiến thức mới.
  3. SỐ CÂU: MCQ=${mConfig.mcqCount}, TF=${mConfig.tfCount}, SHORT=${mConfig.shortCount}, ESSAY=${mConfig.essayCount}.
  4. ĐẶC TẢ: Viết nội dung "text" là yêu cầu cần đạt chi tiết cho từng bài dựa trên Phụ lục I.

  TRẢ VỀ JSON: { 
    "cells": [ { "lessonId": "...", "format": "MCQ/TF/SHORT/ESSAY", "level": "Nhận biết/Thông hiểu/Vận dụng", "numQuestions": 1 } ], 
    "outcomes": [ { "lessonId": "...", "text": "Yêu cầu cần đạt chi tiết..." } ] 
  }`;

  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: { parts: [pl1Part, { text: prompt }] }, 
    config: { 
      responseMimeType: "application/json", 
      thinkingConfig: { thinkingBudget: 30000 } 
    } 
  });
  
  return JSON.parse(cleanJsonString(response.text || '{}'));
};

export const generateExamAndGuide = async (matrix: any, subject: Subject, grade: Grade, mode: GenerationMode, mConfig: MatrixConfig, sgkFiles: File[]): Promise<{questions: ExamQuestion[], guide: GradingTableData}> => {
  const ai = getAI();
  const sgkParts = sgkFiles.length > 0 ? await Promise.all(sgkFiles.map(f => fileToPart(f))) : [{ text: "Sử dụng kiến thức chuẩn SGK hiện hành." }];
  
  const prompt = `Dựa trên ma trận và bản đặc tả: ${JSON.stringify(matrix)}, hãy soạn đề thi và hướng dẫn chấm môn ${subject} - ${grade}.
  
  YÊU CẦU KỸ THUẬT:
  - TOÁN HỌC: Sử dụng LaTeX bọc trong $...$. Ví dụ: $x^2 + \sqrt{y}$.
  - CẤU TRÚC ĐỀ: 
    + Phần I: Trắc nghiệm khách quan.
    + Phần II: Câu hỏi Đúng/Sai (Mỗi câu 4 ý a,b,c,d).
    + Phần III: Trả lời ngắn.
    + Phần IV: Tự luận.
  - HƯỚNG DẪN CHẤM: Chi tiết từng bước cho Tự luận.

  TRẢ VỀ JSON: { 
    "questions": [ { 
       "id": "q1", 
       "type": "MCQ", 
       "text": "Nội dung...", 
       "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
       "tfStatements": { "a": "...", "b": "...", "c": "...", "d": "..." },
       "correctAnswer": "A",
       "explanation": "Giải thích...",
       "points": 0.25
    } ], 
    "guide": { 
      "mcqAnswers": ["A", "B", ...], 
      "tfAnswers": [ { "questionNum": 1, "answers": "Đ, S, Đ, S" } ], 
      "shortAnswers": [ { "questionNum": 1, "answer": "..." } ], 
      "essayAnswers": [ { "questionNum": 1, "guide": "Các bước giải và thang điểm..." } ] 
    } 
  }`;

  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: { parts: [...sgkParts, { text: prompt }] }, 
    config: { 
      responseMimeType: "application/json", 
      thinkingConfig: { thinkingBudget: 32000 } 
    } 
  });
  
  return JSON.parse(cleanJsonString(response.text || '{}'));
};