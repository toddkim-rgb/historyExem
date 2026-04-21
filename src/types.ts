export interface Exam {
  id: string;
  round: string;
  status: 'draft' | 'published';
  createdAt: any;
  isVisible?: boolean;
  levels?: string[];
}

export interface Question {
  id?: string;
  examId: string;
  type: 'general' | 'advanced';
  number: number;
  era: string;
  difficulty: '상' | '중' | '하';
  title: string;
  keywords: string[];
  imageUrl: string;
  answer: number;
  score: number;
  correctRate: number;
  explanation: string;
  category: string;
  options?: string[];
}
