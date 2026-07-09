export interface Exam {
  id: string;
  round: string;
  status: 'draft' | 'published';
  createdAt: any;
  isVisible?: boolean;
  isVisibleAdvanced?: boolean;
  isVisibleGeneral?: boolean;
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
  expectedCorrectRate?: number;
  ratingGap?: string;
  author?: string;
  source?: string;
  explanation: string;
  category: string;
  field?: string;
  etc?: string;
  options?: string[];
  accessibleQuestion?: string;
  imageDescription?: string;
}
