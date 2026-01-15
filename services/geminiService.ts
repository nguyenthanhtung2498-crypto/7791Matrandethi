
import { GoogleGenAI, Type } from "@google/genai";
import { ExamType, Subject, Grade, Lesson, GenerationMode, MatrixConfig, ExamQuestion, GradingTableData } from "../types";
import mammoth from "mammoth";

const cleanJsonString = (str: string): string => {
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  return cleaned;
};

const fileToPart = async (file: File): Promise<any> => {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return { text: `Nội dung tệp ${file.name}: ${result.value}` };
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ inlineData: { data: (reader.result as string).split(',')[1], mimeType: file.type || 'application/pdf' } });
    reader.readAsDataURL(file);
  });
};

export const validateApiKey = async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
  if (!apiKey) return { valid: false, error: "Chưa nhập mã API Key." };
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: 'ping' 
    });
    return { valid: !!response.text };
  } catch (error: any) { 
    return { valid: false, error: error.message }; 
  }
};

export const analyzeFilesForLessons = async (apiKey: string, pl1File: File, pl3File: File, examType: ExamType, subject: Subject, grade: Grade): Promise<Lesson[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const pl3Part = await fileToPart(pl3File);
  const prompt = `Bạn là chuyên gia phân tích chương trình học. Phân tích Phụ lục III môn ${subject} (${grade}) cho kỳ thi ${examType}. 
  Hãy trích xuất danh sách bài học bao gồm: Cột Số tiết (periods), Tên bài, Tên chương, Tuần dạy.
  TRẢ VỀ JSON ARRAY: [ { "title": "...", "chapter": "...", "week": number, "periods": number } ]`;
  
  const response = await ai.models.generateContent({ 
    model: 'gemini-3-flash-preview', 
    contents: { parts: [pl3Part, { text: prompt }] }, 
    config: { responseMimeType: "application/json" } 
  });
  
  const raw = JSON.parse(cleanJsonString(response.text));
  return raw.map((l: any) => ({ ...l, id: Math.random().toString(36).substr(2, 9), selected: true }));
};

export const generateMatrixAndOutcomes = async (apiKey: string, lessons: Lesson[], examType: ExamType, subject: Subject, grade: Grade, pl1File: File, mConfig: MatrixConfig): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey });
  const pl1Part = await fileToPart(pl1File);
  const totalPeriods = lessons.reduce((acc, l) => acc + (l.periods || 1), 0);
  const isFinal = examType.toLowerCase().includes("cuối kì");

  const prompt = `Lập ma trận đề thi 10 điểm cho môn ${subject} (${grade}) dựa trên danh sách bài học: ${JSON.stringify(lessons)}.
  
  QUY TẮC ĐIỂM (BẮT BUỘC):
  1. TỈ LỆ SỐ TIẾT: Phân bổ điểm 1:1 theo khối lượng tiết dạy (${totalPeriods} tiết tổng). Khoảng 10% tổng số tiết = 1.0 điểm.
  2. QUY TẮC 20% GIỮA KỲ: Nếu đây là kỳ thi CUỐI KỲ (${examType}), bạn PHẢI dành đúng 20% tổng điểm (2.0 điểm) cho các nội dung kiến thức cũ thuộc về Giữa kỳ (các bài học đầu danh sách). 80% còn lại (8.0 điểm) dành cho nội dung mới.
  3. CẤU HÌNH CÂU HỎI: MCQ=${mConfig.mcqCount}, TF=${mConfig.tfCount}, SHORT=${mConfig.shortCount}, ESSAY=${mConfig.essayCount}.
  4. ĐẶC TẢ: Viết nội dung "text" cụ thể cho từng bài trong "outcomes".

  TRẢ VỀ JSON: { 
    "cells": [ { "lessonId": "...", "format": "MCQ", "level": "Nhận biết", "numQuestions": 1 } ], 
    "outcomes": [ { "lessonId": "...", "text": "Yêu cầu cần đạt chi tiết..." } ] 
  }`;

  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: { parts: [pl1Part, { text: prompt }] }, 
    config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 24000 } } 
  });
  
  return JSON.parse(cleanJsonString(response.text));
};

export const generateExamAndGuide = async (apiKey: string, matrix: any, subject: Subject, grade: Grade, mode: GenerationMode, mConfig: MatrixConfig, sgkFiles: File[]): Promise<{questions: ExamQuestion[], guide: GradingTableData}> => {
  const ai = new GoogleGenAI({ apiKey });
  const sgkParts = await Promise.all(sgkFiles.map(f => fileToPart(f)));
  
  const prompt = `Soạn đề thi và hướng dẫn chấm môn ${subject} - ${grade} dựa trên ma trận: ${JSON.stringify(matrix)}.
  
  YÊU CẦU:
  - LaTeX: Luôn bọc công thức bằng $...$. Ví dụ: $H_2O$, $x^2$. 
  - ĐÚNG/SAI: Mỗi câu Phần II phải có đủ 4 ý a, b, c, d trong 'tfStatements'.
  - NGÔN NGỮ: Chuẩn sư phạm, font Times New Roman.
  
  TRẢ VỀ JSON: { 
    "questions": [ { 
       "id": "...", 
       "type": "MCQ/TF/SHORT/ESSAY", 
       "text": "Câu dẫn...", 
       "options": { "A": "...", ... },
       "tfStatements": { "a": "...", "b": "...", "c": "...", "d": "..." }
    } ], 
    "guide": { 
      "mcqAnswers": ["A", "B", ...], 
      "tfAnswers": [ { "questionNum": 1, "answers": "Đ, S, Đ, S" } ], 
      "shortAnswers": [ { "questionNum": 1, "answer": "..." } ], 
      "essayAnswers": [ { "questionNum": 1, "guide": "Đáp án..." } ] 
    } 
  }`;

  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: { parts: [...sgkParts, { text: prompt }] }, 
    config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 32000 } } 
  });
  
  return JSON.parse(cleanJsonString(response.text));
};
