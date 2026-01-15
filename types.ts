
export enum ExamType {
  GK_I = 'Giữa kì I',
  CK_I = 'Cuối kì I',
  GK_II = 'Giữa kì II',
  CK_II = 'Cuối kì II'
}

export enum Subject {
  TOAN = 'Toán',
  VAN = 'Ngữ văn',
  KHTN = 'Khoa học tự nhiên',
  SU_DIA = 'Lịch sử và Địa lí',
  GDCD = 'Giáo dục công dân',
  ANH = 'Tiếng Anh',
  TIN = 'Tin học',
  CONG_NGHE = 'Công nghệ'
}

export enum Grade {
  GRADE_6 = 'Khối 6',
  GRADE_7 = 'Khối 7',
  GRADE_8 = 'Khối 8',
  GRADE_9 = 'Khối 9'
}

export enum GenerationMode {
  SGK = 'Soạn theo SGK',
  AUTO = 'AI tự động soạn'
}

export enum CognitiveLevel {
  KNOW = 'Nhận biết',
  UNDERSTAND = 'Thông hiểu',
  APPLY = 'Vận dụng'
}

export interface Lesson {
  id: string;
  title: string;
  chapter: string;
  week: string | number;
  selected: boolean;
  isOldMaterial?: boolean;
  periods?: number;
}

export interface MatrixCell {
  id: string;
  lessonId: string;
  format: string;
  level: CognitiveLevel;
  numQuestions: number;
  points: number;
}

export interface Outcome {
  id: string;
  lessonId: string;
  text: string;
}

export interface ExamMatrix {
  cells: MatrixCell[];
  outcomes: Outcome[];
}

export interface ExamQuestion {
  id: string;
  type: 'MCQ' | 'TF' | 'SHORT' | 'ESSAY';
  text: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  tfStatements?: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  correctAnswer: string;
  explanation: string;
  points: number;
}

export interface GradingTableData {
  mcqAnswers: string[];
  tfAnswers: { questionNum: number; answers: string }[];
  shortAnswers: { questionNum: number; answer: string }[];
  essayAnswers: { questionNum: number; guide: string }[];
}

export interface MatrixConfig {
  schoolName: string;
  department: string;
  examTitle: string;
  academicYear: string;
  duration: string;
  examCode: string;
  difficulty: string;
  mcqCount: number;
  mcqPoint: number;
  tfCount: number;
  tfPoint: number;
  shortCount: number;
  shortPoint: number;
  essayCount: number;
  essayPoint: number;
  knowPercent: number;
  understandPercent: number;
  applyPercent: number;
}

export interface AppState {
  currentPage: number;
  user: {
    username: string;
  } | null;
  config: {
    examType: ExamType;
    subject: Subject;
    grade: Grade;
    filePL1: File | null;
    filePL3: File | null;
    sgkFiles: File[];
    generationMode: GenerationMode;
  };
  matrixConfig: MatrixConfig;
  selectedLessons: Lesson[];
  matrix: ExamMatrix | null;
  examQuestions: ExamQuestion[];
  gradingGuide: GradingTableData | null;
}