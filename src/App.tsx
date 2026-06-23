/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Save, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon,
  Edit2,
  History,
  Download,
  Upload,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  BarChart3,
  Activity,
  FileSpreadsheet,
  X,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { auth, db } from './lib/firebase';
import { Exam, Question } from './types';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { StatsPage } from './components/StatsPage';
import { UserView } from './components/UserView';
import { SingleQuestionView } from './components/SingleQuestionView';

const ERAS = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
const DIFFICULTIES = ['상', '중', '하'];
const FIELDS = ['정치', '경제', '사회', '문화', '기타'];
const QUESTION_TYPES = [
  '역사지식 이해',
  '사료 분석 및 해석',
  '역사 상황 파악',
  '역사 탐구 설계 및 수행',
  '역사적 상상력 및 추론',
  '역사적 가치 판단 및 태도'
];

export default function App() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<'management' | 'stats' | 'rounds' | 'user' | 'user_single'>('management');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [newExamRound, setNewExamRound] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['심화']);
  const [tempSaveStatus, setTempSaveStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUploadStep, setBulkUploadStep] = useState(1);
  const [bulkExcelFile, setBulkExcelFile] = useState<File | null>(null);
  const [bulkImageFiles, setBulkImageFiles] = useState<File[]>([]);
  const [isExamDeleteConfirmOpen, setIsExamDeleteConfirmOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState('');
  const [pdfProgressPercent, setPdfProgressPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkExcelInputRef = useRef<HTMLInputElement>(null);
  const qImageRef = useRef<HTMLInputElement>(null);

  const visibleExams = useMemo(() => {
    return exams
      .filter(e => e.isVisible !== false)
      .sort((a, b) => {
        const rA = parseInt(a.round.replace(/[^0-9]/g, '')) || 0;
        const rB = parseInt(b.round.replace(/[^0-9]/g, '')) || 0;
        return rB - rA;
      })
      .slice(0, 15);
  }, [exams]);

  // Helper for Firestore Errors
  const handleFirestoreError = (error: any, operation: string) => {
    console.error(`Firestore ${operation} Error:`, error);
    if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
      setQuotaExceeded(true);
    }
  };

  // Exams Listener
  useEffect(() => {
    setCurrentPage(1);
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'), limit(100)); // Limit exams to 100
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const examData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setExams(examData);
        if (examData.length > 0 && !selectedExamId) {
          setSelectedExamId(examData[0].id);
        }
      },
      (error) => handleFirestoreError(error, 'Exams Listener')
    );
    return () => unsubscribe();
  }, [selectedExamId]);

  // Questions Listener
  useEffect(() => {
    setCurrentPage(1);
    if (!selectedExamId && activeMenu !== 'stats') return;

    let q;
    if (activeMenu === 'stats') {
      // In stats mode, we still query by examId if possible, or limit results to save quota
      // If we need cross-exam stats, we should be careful. 
      // For now, let's keep it limited to current selection or a reasonable max
      q = query(collection(db, 'questions'), limit(300)); 
    } else {
      q = query(
        collection(db, 'questions'), 
        where('examId', '==', selectedExamId),
        where('type', '==', activeTab)
      );
    }
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const questionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        if (activeMenu === 'stats') {
          setQuestions(questionData);
        } else {
          setQuestions([...questionData].sort((a, b) => a.number - b.number));
        }
      },
      (error) => handleFirestoreError(error, 'Questions Listener')
    );
    return () => unsubscribe();
  }, [selectedExamId, activeTab, activeMenu]);

  const handleTempSave = () => {
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    setTempSaveStatus(`[${timeStr}] 임시저장 되었습니다.`);
    setTimeout(() => setTempSaveStatus(null), 3000);
  };

  const createNewExam = async () => {
    if (!newExamRound.trim()) {
      alert('회차를 입력해주세요.');
      return;
    }
    
    // Ensure "회" suffix
    const roundStr = newExamRound.trim().endsWith('회') 
      ? newExamRound.trim() 
      : `${newExamRound.trim()}회`;

    try {
      const docRef = await addDoc(collection(db, 'exams'), {
        round: roundStr,
        status: 'draft',
        createdAt: serverTimestamp(),
        isVisible: true,
        levels: selectedLevels.length > 0 ? selectedLevels : ['심화']
      });
      setSelectedExamId(docRef.id);
      setIsCreateModalOpen(false);
      setNewExamRound('');
      setSelectedLevels(['심화']);
    } catch (error) {
      handleFirestoreError(error, 'Create Exam');
    }
  };

  const handleToggleVisibility = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'exams', id), {
        isVisible: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, 'Toggle Visibility');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedQuestion) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 선택 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      
      // 이미지 압축 및 리사이징 로직 추가 (1MB 제한 방지)
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 최대 너비 1000px로 제한
        const MAX_WIDTH = 1000;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // 용량을 줄이기 위해 jpeg 0.6 품질로 변환
          const compressedResult = canvas.toDataURL('image/jpeg', 0.6);
          setSelectedQuestion({ ...selectedQuestion, imageUrl: compressedResult });
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const seedSingleDummy = (num: number) => {
    if (!selectedQuestion) return;
    
    const templates = [
      {
        era: '선사',
        title: '다음 유물이 만들어진 시대의 특징으로 옳은 것은?',
        keywords: ['#비파형_동검', '#고인돌', '#사유재산'],
        options: ['평등한 공동체 생활을 하였다.', '주로 동굴이나 막집에 거주하였다.', '철제 농기구로 농사를 지었다.', '계급이 분화된 사회가 출현하였다.', '가락바퀴로 실을 뽑아 옷을 만들었다.'],
        answer: 4,
        category: '역사지식 이해',
        explanation: '비파형 동검과 고인돌은 청동기 시대의 대표적 유물입니다. 이때부터 계급 사회가 시작되었습니다.'
      },
      {
        era: '고대',
        title: '(가) 나라에 대한 설명으로 옳은 것은?',
        keywords: ['#삼국사기', '#백제', '#온조'],
        options: ['무천이라는 제천 행사를 열었다.', '정사암 회의에서 국政을 논의하였다.', '골품제라는 엄격한 신분 제도가 있었다.', '22담로에 왕족을 파견하여 지방을 관리했다.', '진대법을 실시하여 빈민을 구제하였다.'],
        answer: 4,
        category: '사료 분석 및 해석',
        explanation: '백제는 무령왕 때 22담로에 왕족을 파견하여 지방 통제력을 강화하였습니다.'
      },
      {
        era: '고려',
        title: '밑줄 친 왕의 업적으로 옳은 것을 고르시오.',
        keywords: ['#과거제', '#노비안검법', '#고려_광종'],
        options: ['독서삼품과를 설치하였다.', '의창을 두어 기근에 대비했다.', '현직 관리에게만 전지를 지급했다.', '공복을 제정하여 관리의 기강을 세웠다.', '6조 직계제를 부활시켰다.'],
        answer: 4,
        category: '역사 상황 파악',
        explanation: '고려 광종은 노비안검법과 과거제 실시 외에도 백관의 공복을 제정하여 위계질서를 세웠습니다.'
      },
      {
        era: '조선',
        title: '다음 일기가 작성된 당시의 시사 상황으로 옳은 것은?',
        keywords: ['#대동법', '#모내기법', '#상평통보'],
        options: ['병란도가 국제 무역항으로 붐볐다.', '덕대가 광산을 전문으로 경영하였다.', '과전법이 실시되어 수조권이 지급되었다.', '솔거 노비와 외거 노비가 있었다.', '솔내 마을에서 향약이 보급되었다.'],
        answer: 2,
        category: '역사적 상상력 및 추론',
        explanation: '조선 후기에는 광산 경영 방식인 덕대제가 발달하였습니다.'
      },
      {
        era: '근대',
        title: '(가) 운동에 대한 설명으로 옳은 것은?',
        keywords: ['#황토현_전투', '#전주화약', '#집강소'],
        options: ['외세의 침략에 저항하는 의병 운동이었다.', '정부의 탄압으로 간도 지역으로 이동하였다.', '백정에 대한 차별 철폐를 주장하였다.', '자주 관리와 민주적 개혁을 요구하였다.', '신식 군대인 별기군 설치에 반발하였다.'],
        answer: 4,
        category: '역사 탐구 설계 및 수행',
        explanation: '동학 농민 운동은 폐정 개혁안을 내세우며 민주적이고 자주적인 발전을 꾀했습니다.'
      }
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    setSelectedQuestion({
      ...selectedQuestion,
      era: randomTemplate.era,
      title: `[예시 문항] ${randomTemplate.title}`,
      keywords: randomTemplate.keywords,
      imageUrl: `https://picsum.photos/seed/ai-gen-${num}/800/600`,
      options: randomTemplate.options,
      answer: randomTemplate.answer,
      category: randomTemplate.category,
      field: FIELDS[num % FIELDS.length],
      explanation: randomTemplate.explanation,
      difficulty: '중',
      score: 2,
      correctRate: 85,
      expectedCorrectRate: 80,
      ratingGap: '1:85, 2:5, 3:5, 4:3, 5:2',
      source: '한능검 기출 변형',
      author: auth.currentUser?.displayName || '한능검 관리자',
      accessibleQuestion: `[전맹자용] ${randomTemplate.title}`,
      imageDescription: `[이미지 설명] ${randomTemplate.era} 시대 관련 이미지`
    });
  };

  const handleCreateQuestion = async (num: number) => {
    if (!selectedExamId) return;
    const newQ: Omit<Question, 'id'> = {
      examId: selectedExamId,
      type: activeTab,
      number: num,
      era: '조선',
      difficulty: '중',
      title: '',
      keywords: [],
      imageUrl: '',
      answer: 1,
      score: 2,
      correctRate: 0,
      expectedCorrectRate: 0,
      explanation: '',
      category: '역사지식 이해',
      field: '정치',
      options: ['', '', '', '', ''],
      author: auth.currentUser?.displayName || '한능검 관리자',
      source: '',
      ratingGap: '',
      accessibleQuestion: '',
      imageDescription: '',
      etc: ''
    };
    setSelectedQuestion({ ...newQ } as Question);
  };

  const handleDeleteExam = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'exams', id));
      // Delete questions associated with this exam
      const qs = questions.filter(q => q.examId === id);
      for (const q of qs) {
        if (q.id) await deleteDoc(doc(db, 'questions', q.id));
      }
      if (selectedExamId === id) {
        setSelectedExamId(exams.length > 0 ? (exams.find(e => e.id !== id)?.id || '') : '');
      }
    } catch (error) {
      handleFirestoreError(error, 'Delete Exam');
      alert('회차 삭제 중 오류가 발생했습니다.');
    }
  };

  const seedDummyData = async () => {
    if (!selectedExamId) {
      alert('먼저 회차를 선택하거나 생성해주세요.');
      return;
    }

    const templates = [
      {
        era: '선사',
        category: '역사지식 이해',
        title: '다음 유물이 만들어진 시대의 특징으로 옳은 것은?',
        keywords: ['구석기', '주먹도끼', '동굴'],
        options: ['주먹도끼를 사용하여 사냥하였다.', '반달 돌칼을 이용하여 곡식을 거두었다.', '가락바퀴를 이용하여 실을 뽑았다.', '철제 농기구를 사용하여 농사를 지었다.', '비파형 동검을 제작하여 사용하였다.'],
        answer: 1,
        explanation: '주먹도끼는 구석기 시대의 대표적인 유물입니다. 이때는 채집과 사냥을 하며 동굴이나 막집에 거주했습니다.'
      },
      {
        era: '고대',
        category: '사료 분석 및 해석',
        title: '밑줄 친 ‘이 나라’에 대한 설명으로 옳은 것은?',
        keywords: ['삼국사기', '백제', '온조'],
        options: ['무천이라는 제천 행사를 열었다.', '정사암 회의에서 국정을 논의하였다.', '골품제라는 엄격한 신분 제도가 있었다.', '22담로에 왕족을 파견하여 지방을 관리했다.', '진대법을 실시하여 빈민을 구제하였다.'],
        answer: 4,
        explanation: '백제는 무령왕 때 22담로에 왕족을 파견하여 지방 지방 통제력을 강화하였습니다.'
      },
      {
        era: '고려',
        category: '역사 상황 파악',
        title: '밑줄 친 ‘왕’의 업적으로 옳은 것을 고르시오.',
        keywords: ['과거제', '노비안검법', '광종'],
        options: ['독서삼품과를 설치하였다.', '의창을 두어 기근에 대비했다.', '현직 관리에게만 전지를 지급했다.', '공복을 제정하여 관리의 기강을 세웠다.', '6조 직계제를 부활시켰다.'],
        answer: 4,
        explanation: '고려 광종은 노비안검법과 과거제 실시 외에도 백관의 공복을 제정하여 위계질서를 세웠습니다.'
      },
      {
        era: '조선',
        category: '역사적 상상력 및 추론',
        title: '다음 일기가 작성된 당시의 경제 상황으로 옳은 것은?',
        keywords: ['대동법', '모내기법', '상평통보'],
        options: ['병란도가 국제 무역항으로 붐볐다.', '덕대가 광산을 전문으로 경영하였다.', '과전법이 실시되어 수조권이 지급되었다.', '민영 수공업보다 관영 수공업이 발달하였다.', '향약이 보급되어 향촌 자치가 이루어졌다.'],
        answer: 2,
        explanation: '조선 후기에는 광산 경영 방식인 덕대제가 발달하였습니다.'
      },
      {
        era: '근대',
        category: '역사 탐구 설계 및 수행',
        title: '(가) 운동에 대한 설명으로 옳은 것은?',
        keywords: ['황토현 전투', '전주화약', '집강소'],
        options: ['외세의 침략에 저항하는 의병 운동이었다.', '정부의 탄압으로 간도 지역으로 이동하였다.', '백정에 대한 차별 철폐를 주장하였다.', '자주 관리와 민주적 개혁을 요구하였다.', '신식 군대인 별기군 설치에 반발하였다.'],
        answer: 4,
        explanation: '동학 농민 운동은 폐정 개혁안을 내세우며 민주적이고 자주적인 발전을 꾀했습니다.'
      },
      {
        era: '일제강점',
        category: '역사적 가치 판단 및 태도',
        title: '밑줄 친 ‘이 단체’의 활동으로 옳은 것은?',
        keywords: ['신간회', '광주학생항일운동', '민족유일당'],
        options: ['독립 신문을 발행하여 민중을 계몽하였다.', '파리 강화 회의에 독립 청원서를 제출하였다.', '광주 학생 항일 운동에 조사단을 파견하였다.', '어린이날을 제정하고 잡지 어린이를 창간하였다.', '국채 보상 운동을 주도적으로 전개하였다.'],
        answer: 3,
        explanation: '신간회는 민족 유일당 운동의 결과로 창립되었으며, 광주 학생 항일 운동 당시 조사단을 파견하여 지원했습니다.'
      },
      {
        era: '현대',
        category: '역사지식 이해',
        title: '다음 뉴스에서 보도하고 있는 민주화 운동에 대한 설명으로 옳은 것은?',
        keywords: ['4.19 혁명', '3.15 부정선거', '시민군'],
        options: ['유신 체제가 붕괴되는 계기가 되었다.', '대통령 직선제 개헌을 이끌어내었다.', '시민군이 조직되어 계엄군에 맞섰다.', '이승만 정부의 부정 선거에 항거하여 일어났다.', '한일 협정 체결에 반대하여 전개되었다.'],
        answer: 4,
        explanation: '4.19 혁명은 3.15 부정 선거를 계기로 일어난 민주화 운동입니다.'
      }
    ];

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const toAdd = [];
      for (let i = 1; i <= 50; i++) {
        const existing = questions.find(item => item.number === i);
        if (!existing) {
          const template = templates[i % templates.length];
          const newQ: Omit<Question, 'id'> = {
            examId: selectedExamId,
            type: activeTab,
            number: i,
            era: template.era,
            difficulty: DIFFICULTIES[i % DIFFICULTIES.length] as any,
            title: template.title,
            keywords: template.keywords,
            imageUrl: `https://picsum.photos/seed/hist-${selectedExamId}-${activeTab}-${i}/800/600`,
            answer: template.answer,
            score: (i % 3) + 1,
            correctRate: 60 + Math.floor(Math.random() * 30),
            expectedCorrectRate: 70 + Math.floor(Math.random() * 10),
            explanation: template.explanation,
            category: template.category,
            field: FIELDS[i % FIELDS.length],
            options: template.options,
            author: auth.currentUser?.displayName || '한능검 관리자',
            source: `기출 ${60 + Math.floor(i/10)}회 ${i % 10 || 10}번 응용`,
            ratingGap: `①:70%, ②:10%, ③:10%, ④:5%, ⑤:5%`,
            accessibleQuestion: `[전맹자용] ${template.title}에 대한 상세 설명 및 선택지 텍스트 버전입니다.`,
            imageDescription: `[이미지 설명] ${template.era} 시대의 주요 인물 또는 사건을 묘사한 삽화입니다.`,
            etc: ''
          };
          toAdd.push(newQ);
        }
      }

      for (let i = 0; i < toAdd.length; i++) {
        await addDoc(collection(db, 'questions'), toAdd[i]);
        setUploadProgress(Math.round(((i + 1) / toAdd.length) * 100));
      }

      setIsUploading(false);
      alert(`${toAdd.length}개의 더미 문항이 생성되었습니다.`);
    } catch (error) {
      setIsUploading(false);
      handleFirestoreError(error, 'Seed Dummy Data');
      alert('데이터 생성 중 오류가 발생했습니다.');
    }
  };

  const generateResponseRates = async () => {
    if (questions.length === 0) {
      alert('생성할 문항 데이터가 없습니다.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const circledNumbers = ['①', '②', '③', '④', '⑤'];
      let count = 0;
      
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.id) continue;
        
        const correctIndex = (q.answer || 1) - 1;
        let values = [0, 0, 0, 0, 0];
        
        // Give correct answer a higher percentage (40% to 85%)
        const correctRate = 40 + Math.floor(Math.random() * 45);
        values[correctIndex] = correctRate;
        
        // Distribute remaining
        let remaining = 100 - correctRate;
        const otherIndices = [0, 1, 2, 3, 4].filter(idx => idx !== correctIndex);
        
        // Distribute remaining among others randomly
        for (let j = 0; j < otherIndices.length - 1; j++) {
          const val = Math.floor(Math.random() * (remaining / 1.5));
          values[otherIndices[j]] = val;
          remaining -= val;
        }
        values[otherIndices[otherIndices.length - 1]] = remaining;
        
        const ratingGap = circledNumbers.map((num, idx) => `${num}:${values[idx]}%`).join(', ');
        
        await updateDoc(doc(db, 'questions', q.id), { ratingGap });
        count++;
        setUploadProgress(Math.round(((i + 1) / questions.length) * 100));
      }

      setIsUploading(false);
      alert(`${count}개 문항의 답지반응률 더미 데이터가 생성되었습니다.`);
    } catch (error) {
      setIsUploading(false);
      handleFirestoreError(error, 'Generate Response Rates');
      alert('데이터 생성 중 오류가 발생했습니다.');
    }
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedExamId) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const mappedQuestions: Omit<Question, 'id'>[] = jsonData.map((row: any) => ({
        examId: selectedExamId,
        type: (row['문항유형'] === '심화' || activeTab === 'advanced') ? 'advanced' : 'general',
        number: parseInt(row['문항ID'] || row['번호'] || row['number'] || 0),
        era: row['시대'] || row['era'] || '',
        difficulty: (row['난이도'] || row['difficulty'] || '중') as '상' | '중' | '하',
        title: row['문항제목'] || row['질문'] || row['title'] || '',
        keywords: String(row['주제어'] || row['키워드'] || row['keywords'] || '').split(/[,|#]/).map((k: string) => k.trim()).filter(Boolean),
        imageUrl: row['문항이미지(파일선택)'] || row['이미지URL'] || row['imageUrl'] || '',
        answer: parseInt(row['정답'] || row['answer'] || 1),
        score: parseInt(row['배점'] || row['score'] || 2),
        correctRate: parseInt(row['실제정답률'] || row['정답률'] || row['correctRate'] || 0),
        explanation: row['해설'] || row['explanation'] || '',
        category: row['문항유형'] || row['category'] || '역사지식 이해',
        field: row['분야'] || row['field'] || '정치',
        etc: row['비고'] || row['etc'] || '',
        author: row['출제위원'] || row['author'] || '',
        source: row['출제근거'] || row['source'] || '',
        ratingGap: row['평정간극'] || row['ratingGap'] || '',
        expectedCorrectRate: parseInt(row['예상정답률'] || row['expectedCorrectRate'] || 0),
        accessibleQuestion: row['전맹자용문항'] || row['accessibleQuestion'] || '',
        imageDescription: row['이미지설명'] || row['imageDescription'] || '',
        options: row['문항내용텍스트'] 
          ? row['문항내용텍스트'].split(/[①-⑤]/).filter((s: string) => s.trim().length > 0).map((s: string) => s.trim()).slice(0, 5)
          : [
              row['선택지1'] || row['option1'] || '',
              row['선택지2'] || row['option2'] || '',
              row['선택지3'] || row['option3'] || '',
              row['선택지4'] || row['option4'] || '',
              row['선택지5'] || row['option5'] || '',
            ]
      }));

      for (let i = 0; i < mappedQuestions.length; i++) {
        const q = mappedQuestions[i];
        if (!q.title || !q.number) continue;
        
        // Update if exists, or create new
        const existingQ = questions.find(item => item.number === q.number && item.type === q.type);
        if (existingQ && existingQ.id) {
          await updateDoc(doc(db, 'questions', existingQ.id), q);
        } else {
          await addDoc(collection(db, 'questions'), q);
        }
        setUploadProgress(Math.round(((i + 1) / mappedQuestions.length) * 100));
      }

      setIsUploading(false);
      alert(`${mappedQuestions.length}개의 문항이 성공적으로 업로드 및 동기화되었습니다.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setIsUploading(false);
      handleFirestoreError(error, 'Excel Upload');
      alert('엑셀 파일 파싱 또는 업로드 중 오류가 발생했습니다.');
    }
  };

  const handleBulkExcelUpload = async () => {
    if (!bulkExcelFile || !selectedExamId) {
      alert("업로드할 엑셀 파일을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const file = bulkExcelFile;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("엑셀 파일에 데이터가 없습니다.");
      }

      // Fetch all existing questions in the database for this exam to ensure no duplicates across types (general/advanced)
      const qSnapshot = await getDocs(
        query(collection(db, 'questions'), where('examId', '==', selectedExamId))
      );
      const allExistingQuestions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      const mappedQuestions: Omit<Question, 'id'>[] = jsonData.map((row: any) => ({
        examId: selectedExamId,
        type: (row['급수'] === '심화' || (row['급수'] === undefined && activeTab === 'advanced')) ? 'advanced' : 'general',
        number: parseInt(row['문항ID'] || row['번호'] || row['number'] || 0),
        era: row['시대'] || row['era'] || '',
        difficulty: (row['난이도'] || row['difficulty'] || '중') as '상' | '중' | '하',
        title: row['문항제목'] || row['질문'] || row['title'] || '',
        keywords: String(row['주제어'] || row['키워드'] || row['keywords'] || '').split(/[,|#]/).map((k: string) => k.trim()).filter(Boolean),
        imageUrl: row['문항이미지(파일선택)'] || row['이미지URL'] || row['imageUrl'] || '',
        answer: parseInt(row['정답'] || row['answer'] || 1),
        score: parseInt(row['배점'] || row['score'] || 2),
        correctRate: parseInt(row['실제정답률'] || row['정답률'] || row['correctRate'] || 0),
        explanation: row['해설'] || row['explanation'] || '',
        category: row['문항유형'] || row['category'] || '역사지식 이해',
        field: row['분야'] || row['field'] || '정치',
        etc: row['비고'] || row['etc'] || '',
        author: row['출제위원'] || row['author'] || '',
        source: row['출제근거'] || row['source'] || '',
        ratingGap: row['평정간극'] || row['ratingGap'] || '',
        expectedCorrectRate: parseInt(row['예상정답률'] || row['expectedCorrectRate'] || 0),
        accessibleQuestion: row['전맹자용문항'] || row['accessibleQuestion'] || '',
        imageDescription: row['이미지설명'] || row['imageDescription'] || '',
        options: row['문항내용텍스트'] 
          ? row['문항내용텍스트'].split(/[①-⑤]/).filter((s: string) => s.trim().length > 0).map((s: string) => s.trim()).slice(0, 5)
          : [
              row['선택지1'] || row['option1'] || '',
              row['선택지2'] || row['option2'] || '',
              row['선택지3'] || row['option3'] || '',
              row['선택지4'] || row['option4'] || '',
              row['선택지5'] || row['option5'] || '',
            ]
      }));

      let count = 0;
      for (let i = 0; i < mappedQuestions.length; i++) {
        const q = mappedQuestions[i];
        if (!q.title || !q.number) continue;
        
        // Update if exists, or create new
        const existingQ = allExistingQuestions.find(item => item.number === q.number && item.type === q.type);
        if (existingQ && existingQ.id) {
          await updateDoc(doc(db, 'questions', existingQ.id), q);
        } else {
          await addDoc(collection(db, 'questions'), q);
        }
        count++;
        setUploadProgress(Math.round(((i + 1) / mappedQuestions.length) * 100));
      }

      setIsUploading(false);
      setBulkUploadStep(2); // Move to Step 2
      alert(`성공: ${count}개의 문항 엑셀 데이터를 정상적으로 읽고 데이터베이스에 업로드하였습니다.\n다음 단계인 이미지 일괄 업로드를 진행해 주세요.`);
    } catch (error) {
      setIsUploading(false);
      handleFirestoreError(error, 'Bulk Excel Upload');
      alert('엑셀 파일 파싱 또는 업로드 중 오류가 발생했습니다.');
    }
  };

  const handleBulkImageUpload = async () => {
    if (!selectedExamId) return;

    if (bulkImageFiles.length === 0) {
      setIsBulkUploadOpen(false);
      alert('이미지가 선택되지 않아, 엑셀 등록 데이터만 반영되었습니다.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Fetch latest questions list
      const qSnapshot = await getDocs(
        query(collection(db, 'questions'), where('examId', '==', selectedExamId))
      );
      const latestQuestions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      const totalFiles = bulkImageFiles.length;
      let matchCount = 0;

      for (let i = 0; i < totalFiles; i++) {
        const file = bulkImageFiles[i];
        
        // Match files like '68_01_1.png' or '68_advanced_12.jpg'
        const name = file.name.substring(0, file.name.lastIndexOf('.')).toLowerCase();
        const parts = name.split('_');
        
        let detectedNum = 0;
        let detectedType: 'general' | 'advanced' | null = null;
        
        if (parts.length >= 3) {
          detectedNum = parseInt(parts[2]) || 0;
          const typePart = parts[1];
          if (typePart === '02' || typePart === 'advanced' || typePart.includes('심화')) {
            detectedType = 'advanced';
          } else if (typePart === '01' || typePart === 'general' || typePart.includes('기본')) {
            detectedType = 'general';
          }
        } else if (parts.length === 2) {
          const p0 = parts[0];
          const p1 = parts[1];
          
          if (p1.includes('심화') || p1 === 'advanced' || p1 === '02') {
            detectedType = 'advanced';
            detectedNum = parseInt(p0) || 0;
          } else if (p1.includes('기본') || p1 === 'general' || p1 === '01') {
            detectedType = 'general';
            detectedNum = parseInt(p0) || 0;
          } else if (p0.includes('심화') || p0 === 'advanced' || p0 === '02') {
            detectedType = 'advanced';
            detectedNum = parseInt(p1) || 0;
          } else if (p0.includes('기본') || p0 === 'general' || p0 === '01') {
            detectedType = 'general';
            detectedNum = parseInt(p1) || 0;
          } else {
            const num1 = parseInt(p1);
            const num0 = parseInt(p0);
            if (!isNaN(num1)) detectedNum = num1;
            else if (!isNaN(num0)) detectedNum = num0;
          }
        } else if (parts.length === 1) {
          const digits = name.match(/\d+/);
          if (digits) {
            detectedNum = parseInt(digits[0]);
          }
          if (name.includes('심화') || name.includes('advanced')) {
            detectedType = 'advanced';
          } else if (name.includes('기본') || name.includes('general')) {
            detectedType = 'general';
          }
        }
        
        if (!detectedType) {
          detectedType = activeTab;
        }

        if (detectedNum > 0) {
          const targetQuestion = latestQuestions.find(
            q => q.number === detectedNum && q.type === detectedType
          );

          if (targetQuestion && targetQuestion.id) {
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                const result = event.target?.result as string;
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_WIDTH = 1000;
                  if (width > MAX_WIDTH) {
                    height = (MAX_WIDTH / width) * height;
                    width = MAX_WIDTH;
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                  } else {
                    reject(new Error('Canvas context is null'));
                  }
                };
                img.onerror = () => reject(new Error('Image load fail'));
                img.src = result;
              };
              reader.onerror = () => reject(new Error('FileReader fail'));
              reader.readAsDataURL(file);
            });

            await updateDoc(doc(db, 'questions', targetQuestion.id), {
              imageUrl: base64Data
            });
            matchCount++;
          }
        }

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      setIsUploading(false);
      setIsBulkUploadOpen(false);
      alert(`일괄 업로드 완료: 총 ${totalFiles}개의 이미지 파일 중 ${matchCount}개의 문항 이미지가 정상 매치 및 업데이트 하였습니다.`);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      alert('이미지 파일 프로세싱 또는 업로드 중 오류가 발생했습니다.');
    }
  };

  const downloadExcelTemplate = () => {
    const tableHeaders = [
      "문항ID", "급수", "출제위원", "시대", "분야", "문항유형", "배점", "난이도", "정답", 
      "예상정답률", "평정간극", "주제어", "출제근거", "문항제목", 
      "문항이미지(파일선택)", "해설", "문항내용텍스트", "전맹자용문항", "비고"
    ];

    const templates = [
      {
        era: '선사',
        category: '역사지식 이해',
        title: '다음 유물이 만들어진 시대의 특징으로 옳은 것은?',
        keywords: '구석기, 주먹도끼, 동굴',
        options: '① 주먹도끼를 사용하여 사냥하였다. ② 반달 돌칼을 이용하여 곡식을 거두었다. ③ 가락바퀴를 이용하여 실을 뽑았다. ④ 철제 농기구를 사용하여 농사를 지었다. ⑤ 비파형 동검을 제작하여 사용하였다.',
        answer: 1,
        explanation: '주먹도끼는 구석기 시대의 대표적인 유물입니다.'
      },
      {
        era: '고대',
        category: '사료 분석 및 해석',
        title: '밑줄 친 ‘이 나라’에 대한 설명으로 옳은 것은?',
        keywords: '백제, 온조, 무령왕',
        options: '① 무천이라는 제천 행사를 열었다. ② 정사암 회의에서 국정을 논의하였다. ③ 골품제라는 엄격한 신분 제도가 있었다. ④ 22담로에 왕족을 파견하여 지방을 관리했다. ⑤ 진대법을 실시하여 빈민을 구제하였다.',
        answer: 4,
        explanation: '백제는 무령왕 때 22담로에 왕족을 파견하였습니다.'
      },
      {
        era: '고려',
        category: '역사 상황 파악',
        title: '밑줄 친 ‘왕’의 업적으로 옳은 것을 고르시오.',
        keywords: '고려, 광종, 과거제',
        options: '① 독서삼품과를 설치하였다. ② 의창을 두어 기근에 대비했다. ③ 현직 관리에게만 전지를 지급했다. ④ 공복을 제정하여 관리의 기강을 세웠다. ⑤ 6조 직계제를 부활시켰다.',
        answer: 4,
        explanation: '고려 광종은 백관의 공복을 제정하였습니다.'
      }
    ];

    const dummyData = Array.from({ length: 50 }, (_, i) => {
      const num = i + 1;
      const t = templates[i % templates.length];
      return {
        "문항ID": num,
        "급수": "심화",
        "출제위원": auth.currentUser?.displayName || "한능검 관리자",
        "시대": t.era,
        "분야": FIELDS[num % FIELDS.length],
        "문항유형": t.category,
        "배점": (num % 3) + 1,
        "난이도": DIFFICULTIES[num % DIFFICULTIES.length],
        "정답": t.answer,
        "예상정답률": 70 + (num % 20),
        "평정간극": "1:70, 2:10, 3:10, 4:5, 5:5",
        "주제어": t.keywords,
        "출제근거": `기출 ${60 + Math.floor(num/10)}회 ${num % 10 || 10}번 응용`,
        "문항제목": t.title,
        "문항이미지(파일선택)": `history_q_${num}.png`,
        "해설": t.explanation,
        "문항내용텍스트": t.options,
        "전맹자용문항": `[전맹자용] ${t.title}`,
        "비고": ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dummyData, { header: tableHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, "history_exam_template_50.xlsx");
  };

  const mapQuestionToExcelRow = (q: Question) => {
    const formattedOptions = q.options && q.options.length > 0
      ? q.options.map((opt, idx) => {
          const circles = ['①', '②', '③', '④', '⑤'];
          return `${circles[idx] || (idx + 1) + '. '} ${opt}`;
        }).join(' ')
      : '';

    return {
      "문항ID": q.number,
      "급수": q.type === 'advanced' ? '심화' : '기본',
      "출제위원": q.author || '',
      "시대": q.era || '',
      "분야": q.field || '',
      "문항유형": q.category || '',
      "배점": q.score || 2,
      "난이도": q.difficulty || '중',
      "정답": q.answer || 1,
      "예상정답률": q.expectedCorrectRate || 0,
      "평정간극": q.ratingGap || '',
      "주제어": q.keywords && q.keywords.length > 0 ? q.keywords.join(', ') : '',
      "출제근거": q.source || '',
      "문항제목": q.title || '',
      "문항이미지(파일선택)": q.imageUrl || '',
      "해설": q.explanation || '',
      "문항내용텍스트": formattedOptions,
      "전맹자용문항": q.accessibleQuestion || '',
      "비고": q.etc || ''
    };
  };

  // Generate HTML block for a single question
  const createQuestionHtml = (q: Question, examRound: string) => {
    const typeLabel = q.type === 'advanced' ? '심화 (Advanced)' : '기본 (Basic)';

    const formattedOptions = q.options && q.options.length > 0
      ? q.options.map((opt, idx) => {
          const circles = ['①', '②', '③', '④', '⑤'];
          // Remove leading numbers or circles if already present to prevent duplication
          const textOnly = opt.replace(/^[①②③④⑤12345.]\s*/, '').trim();
          return `<div style="display: flex; margin-bottom: 6px; font-size: 13px; line-height: 1.5; color: #334155;">
            <span style="font-weight: bold; margin-right: 8px; color: #1e293b; flex-shrink: 0;">${circles[idx] || (idx + 1) + '.'}</span>
            <span>${textOnly}</span>
          </div>`;
        }).join('')
      : '';

    const keywordsList = q.keywords && q.keywords.length > 0 
      ? q.keywords.map(k => `<span style="background-color: #f1f5f9; color: #475569; padding: 2px 6px; font-size: 11px; font-weight: bold; margin-right: 4px;">#${k}</span>`).join('')
      : '<span style="color: #94a3b8;">-</span>';

    return `
      <div style="width: 790px; padding: 45px; background-color: #ffffff; font-family: sans-serif; box-sizing: border-box; color: #1e293b; position: relative;">
        <!-- Header -->
        <div style="border-bottom: 3px solid #1e293b; padding-bottom: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.05em;">한국사능력검정시험 문항 결과 보고서</span>
            <span style="font-size: 11px; font-family: monospace; background-color: #0f172a; color: #ffffff; padding: 4px 10px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase;">OFFICIAL DOCUMENT</span>
          </div>
          <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">
            National History Proficiency Test — Item Specification Sheet
          </div>
        </div>

        <!-- Metadata Primary Grid -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; font-weight: bold;">
          <tr>
            <td style="width: 25%; border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 10px;">
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: bold;">회차 (Exam Round)</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${examRound}</div>
            </td>
            <td style="width: 25%; border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 10px;">
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: bold;">시험급수 (Exam Level)</div>
              <div style="font-size: 14px; font-weight: 800; color: #3b82f6;">${typeLabel}</div>
            </td>
            <td style="width: 25%; border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 10px;">
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: bold;">문항번호 / 배점</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">문항 ${String(q.number).padStart(2, '0')} (${q.score || 2}점)</div>
            </td>
            <td style="width: 25%; border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 10px;">
              <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: bold;">난이도 / 정답</div>
              <div style="font-size: 14px; font-weight: 900; color: #ef4444;">${q.difficulty || '중'} / 정답 ${q.answer || 1}번</div>
            </td>
          </tr>
        </table>

        <!-- Metadata Support Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; border: 1px solid #e2e8f0; padding: 16px; background-color: #fafafa; font-size: 12.5px; border-radius: 4px; box-sizing: border-box;">
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 시대구분:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.era || '-'}</span>
          </div>
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 출제분야 / 유형:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.field || '-'} / ${q.category || '-'}</span>
          </div>
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 출제근거:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.source || '-'}</span>
          </div>
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 출제위원:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.author || '-'}</span>
          </div>
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 예상 정답률:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.expectedCorrectRate || 0}%</span>
          </div>
          <div>
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 실제 정답률:</span>
            <span style="font-weight: bold; color: #1e293b;">${q.correctRate || 0}%</span>
          </div>
          <div style="grid-column: span 2;">
            <span style="font-weight: 800; color: #64748b; margin-right: 8px;">• 키워드(주제어):</span>
            <span style="display: inline-flex; flex-wrap: wrap; gap: 4px; vertical-align: middle;">${keywordsList}</span>
          </div>
        </div>

        <!-- Question Title and Box -->
        <div style="border: 2px solid #0f172a; padding: 20px; border-radius: 4px; margin-bottom: 24px; background-color: #ffffff;">
          <div style="font-size: 15px; font-weight: 800; line-height: 1.6; color: #0f172a; margin-bottom: 16px;">
            <span style="font-size: 16px; font-weight: 950; margin-right: 4px; color: #4338ca;">[질문]</span> ${q.title || '문항 제목이 없습니다.'}
          </div>

          <!-- Image container if present -->
          ${q.imageUrl ? `
          <div style="display: flex; justify-content: center; align-items: center; border: 1px solid #e2e8f0; background-color: #f8fafc; padding: 12px; margin: 16px 0; border-radius: 4px;">
            <img src="${q.imageUrl}" style="max-height: 250px; max-width: 100%; object-fit: contain;" crossorigin="anonymous" />
          </div>
          ` : ''}

          <!-- Options -->
          <div style="margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 16px;">
            ${formattedOptions}
          </div>
        </div>

        <!-- Explanations and Accessibility -->
        <div style="border-left: 4px solid #6366f1; padding-left: 16px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 900; color: #4338ca; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">💡 해설 및 분석 (Explanation)</div>
          <div style="font-size: 12px; line-height: 1.7; color: #334155; font-weight: 500; white-space: pre-line;">${q.explanation || '등록된 해설이 없습니다.'}</div>
        </div>

        ${q.accessibleQuestion ? `
        <div style="border-left: 4px solid #0ea5e9; padding-left: 16px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 900; color: #0369a1; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">♿ 시각장애인용 대체 문항 (Accessibility Text)</div>
          <div style="font-size: 12px; line-height: 1.7; color: #334155; font-weight: 500; white-space: pre-line;">${q.accessibleQuestion}</div>
        </div>
        ` : ''}

        ${q.etc ? `
        <div style="font-size: 11px; font-weight: bold; color: #64748b; background-color: #f1f5f9; padding: 8px 12px; border-radius: 4px; margin-top: 20px; border-left: 3px solid #cbd5e1;">
          <span style="color: #475569; font-weight: 800; margin-right: 4px;">[비고]</span> ${q.etc}
        </div>
        ` : ''}

        <!-- Footer / Page Number -->
        <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; font-weight: bold;">
          <span>KOREAN HISTORY EXAM SYSTEM</span>
          <span>REPORT CODE: CR-${q.number}-${q.type === 'advanced' ? 'A' : 'B'}</span>
        </div>
      </div>
    `;
  };

  const downloadAllQuestionsPDF = async () => {
    if (!selectedExamId) {
      alert("다운로드할 회차를 선택해주세요.");
      return;
    }
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;

    setIsGeneratingPDF(true);
    setPdfProgressText(`회차 전체 문항 로딩 중...`);
    setPdfProgressPercent(5);

    try {
      const qSnapshot = await getDocs(
        query(collection(db, 'questions'), where('examId', '==', selectedExamId))
      );
      const allQuestions = qSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      
      // Sort level ('general' first, 'advanced' second) and then by number
      allQuestions.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'general' ? -1 : 1;
        }
        return a.number - b.number;
      });

      if (allQuestions.length === 0) {
        alert("이 회차에 등록된 문항이 없습니다.");
        setIsGeneratingPDF(false);
        return;
      }

      setPdfProgressText(`전체 PDF 생성 준비 중...`);
      setPdfProgressPercent(10);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const roundName = `${exam.round} 한국사능력검정시험`;

      for (let index = 0; index < allQuestions.length; index++) {
        const q = allQuestions[index];
        const progress = Math.round(10 + (index / allQuestions.length) * 85);
        setPdfProgressText(`[전체 ${allQuestions.length}문항] ${q.number}번 문항 처리 중... (${index + 1}/${allQuestions.length})`);
        setPdfProgressPercent(progress);

        // Render this question to a sandbox div
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = '790px';
        tempDiv.style.background = '#ffffff';
        tempDiv.innerHTML = createQuestionHtml(q, roundName);
        document.body.appendChild(tempDiv);

        // Wait for images
        await new Promise<void>((resolve) => {
          const imgs = tempDiv.getElementsByTagName('img');
          if (imgs.length === 0) return resolve();
          let loaded = 0;
          const total = imgs.length;
          const check = () => {
            loaded++;
            if (loaded >= total) resolve();
          };
          for (let i = 0; i < imgs.length; i++) {
            if (imgs[i].complete) {
              check();
            } else {
              imgs[i].onload = check;
              imgs[i].onerror = check; // Continue anyway even if image fails
            }
          }
        });

        const canvas = await html2canvas(tempDiv, {
          scale: 1.5, // Perfect ratio for clear details and lightweight size
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (index > 0) {
          pdf.addPage();
        }

        // Draw onto the current page
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight), undefined, 'FAST');
        
        // If question content is taller than 1 A4 page, slide onto additional heights
        if (imgHeight > pageHeight) {
          let heightLeft = imgHeight - pageHeight;
          let position = -pageHeight;
          while (heightLeft > 0) {
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;
            position -= pageHeight;
          }
        }

        tempDiv.remove();
      }

      setPdfProgressPercent(98);
      setPdfProgressText(`PDF 파일 다운로드 시작...`);
      pdf.save(`${exam.round}_한능검_전체문항.pdf`);
    } catch (error) {
      console.error("Error downloading all questions PDF:", error);
      alert("다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const downloadSingleQuestionPDF = async (q: Question) => {
    const exam = exams.find(e => e.id === selectedExamId);
    const roundName = exam ? `${exam.round} 한국사능력검정시험` : "한국사능력검정시험";
    const filename = exam ? `${exam.round}_한능검_문항_${String(q.number).padStart(2, '0')}.pdf` : `한능검_문항_${String(q.number).padStart(2, '0')}.pdf`;

    setIsGeneratingPDF(true);
    setPdfProgressText(`문항 ${q.number}번 PDF 다운로드 생성 중...`);
    setPdfProgressPercent(20);

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.style.width = '790px';
    tempDiv.style.background = '#ffffff';
    tempDiv.innerHTML = createQuestionHtml(q, roundName);
    document.body.appendChild(tempDiv);

    try {
      // Wait for images
      await new Promise<void>((resolve) => {
        const imgs = tempDiv.getElementsByTagName('img');
        if (imgs.length === 0) return resolve();
        let loaded = 0;
        const total = imgs.length;
        const check = () => {
          loaded++;
          if (loaded >= total) resolve();
        };
        for (let i = 0; i < imgs.length; i++) {
          if (imgs[i].complete) {
            check();
          } else {
            imgs[i].onload = check;
            imgs[i].onerror = check;
          }
        }
      });
      
      setPdfProgressPercent(55);

      const canvas = await html2canvas(tempDiv, {
        scale: 2, // High resolution for single sheets
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      setPdfProgressPercent(85);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      setPdfProgressPercent(100);
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation error: ", err);
      alert("PDF 생성을 진행하는 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPDF(false);
      tempDiv.remove();
    }
  };

  const handleSaveQuestion = async () => {
    if (!selectedQuestion || !selectedExamId) return;

    // 문서 크기 제한(1MB) 체크
    const jsonStr = JSON.stringify(selectedQuestion);
    if (jsonStr.length > 1000000) {
      alert('문항 데이터의 전체 크기가 1MB를 초과하여 저장할 수 없습니다. 이미지 품질이나 크기를 더 줄여주세요.');
      return;
    }

    try {
      if (selectedQuestion.id) {
        const { id, ...data } = selectedQuestion;
        await updateDoc(doc(db, 'questions', id), data);
      } else {
        await addDoc(collection(db, 'questions'), selectedQuestion);
      }
      setSelectedQuestion(null);
    } catch (error: any) {
      handleFirestoreError(error, 'Save Question');
      alert(`저장 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedQuestion) return;
    
    if (!selectedQuestion.id) {
      setSelectedQuestion(null);
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!selectedQuestion?.id) return;

    try {
      await deleteDoc(doc(db, 'questions', selectedQuestion.id));
      setSelectedQuestion(null);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, 'Delete Question');
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F0EE] font-sans overflow-hidden">
      {/* Quota Exceeded Overlay */}
      <AnimatePresence>
        {quotaExceeded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="bg-white p-10 rounded-none border-4 border-red-600 shadow-[15px_15px_0_rgba(0,0,0,1)] max-w-[500px] text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Firestore 할당량 초과</h2>
              <p className="text-slate-600 leading-relaxed mb-8">
                일일 무료 데이터 읽기 한도가 모두 소모되었습니다.<br />
                대기 중인 리스너가 중단되었습니다.<br />
                <span className="font-bold text-slate-900">내일(UTC 00:00) 초기화된 후 다시 이용하실 수 있습니다.</span>
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-none shadow-[5px_5px_0_rgba(0,0,0,0.2)]"
              >
                페이지 새로고침
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white p-8 rounded-none border-2 border-[#141414] shadow-[10px_10px_0_rgba(0,0,0,1)] w-[400px]">
              <div className="text-center mb-6">
                <div className="text-lg font-bold mb-2">엑셀파일 업로드 중입니다.</div>
                <div className="text-sm text-slate-500 font-mono">진행률: {uploadProgress}%</div>
              </div>
              
              <div className="h-4 w-full bg-[#EEE] border border-[#141414] rounded-none overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-[#D4AF37]"
                />
              </div>
              
              <div className="mt-4 text-[11px] text-center text-slate-400 italic">
                데이터를 처리하고 있습니다. 잠시만 기다려 주세요.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Generation Progress Overlay */}
      <AnimatePresence>
        {isGeneratingPDF && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white p-8 rounded-none border-2 border-[#141414] shadow-[10px_10px_0_rgba(0,0,0,1)] w-[400px]">
              <div className="text-center mb-6">
                <div className="text-lg font-bold mb-2 text-[#141414]">PDF 리포트 생성 중입니다</div>
                <div className="text-xs font-bold text-slate-500 mb-1">{pdfProgressText}</div>
                <div className="text-sm font-black text-indigo-600 font-mono">진행률: {pdfProgressPercent}%</div>
              </div>
              
              <div className="h-4 w-full bg-[#EEE] border border-[#141414] rounded-none overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${pdfProgressPercent}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
              
              <div className="mt-4 text-[11px] text-center text-slate-400 italic font-semibold">
                고품질 PDF 문서 및 레이아웃을 생성하고 있습니다.<br />잠시만 기다려 주세요.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-[240px] bg-[#1A1A1A] text-white flex flex-col py-6 shrink-0">
        <div className="px-6 mb-10 text-sm font-extrabold tracking-[2px] text-[#D4AF37]">
          한국사능력검정시험시스템
        </div>
        <nav>
          <ul className="space-y-1">
            <li 
              className={`px-6 py-3 text-[13px] cursor-pointer transition-all ${activeMenu === 'rounds' ? 'opacity-100 bg-white/5 border-l-3 border-[#D4AF37]' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setActiveMenu('rounds')}
            >
              기출문제 회차 관리
            </li>
            <li 
              className={`px-6 py-3 text-[13px] cursor-pointer transition-all ${activeMenu === 'management' ? 'opacity-100 bg-white/5 border-l-3 border-[#D4AF37]' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setActiveMenu('management')}
            >
              기출 문항 관리
            </li>
            <li 
              className={`px-6 py-3 text-[13px] cursor-pointer transition-all ${activeMenu === 'stats' ? 'opacity-100 bg-white/5 border-l-3 border-[#D4AF37]' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setActiveMenu('stats')}
            >
              성적 및 통계
            </li>
            <li 
              className={`px-6 py-3 text-[13px] cursor-pointer transition-all ${activeMenu === 'user' ? 'opacity-100 bg-white/5 border-l-3 border-[#D4AF37]' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setActiveMenu('user')}
            >
              모의시험 풀기(사용자)
            </li>
            <li 
              className={`px-6 py-3 text-[13px] cursor-pointer transition-all ${activeMenu === 'user_single' ? 'opacity-100 bg-white/5 border-l-3 border-[#D4AF37]' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setActiveMenu('user_single')}
            >
              한 문항 풀기(사용자)
            </li>
          </ul>
        </nav>
        <div className="mt-auto px-6">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-white/60 hover:text-white hover:bg-white/5 px-0 cursor-default pointer-events-none">
            시스템 정상 작동 중
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="px-4 pt-2 pb-0 shrink-0 mx-0 border-0">
          <div className="flex items-center justify-between bg-[#141414] text-white p-4 shadow-[4px_4px_0_rgba(212,175,55,0.2)]">
            <div className="flex items-center gap-4">
              <div className="h-10 w-1 bg-[#D4AF37]" />
              <div>
                <h1 className="text-lg font-black tracking-tighter flex items-center gap-2">
                  {activeMenu === 'management' ? '기출 문항 관리' : activeMenu === 'rounds' ? '기출문제 회차 관리' : activeMenu === 'stats' ? '성적 및 통계 분석' : activeMenu === 'user' ? '모의시험 풀기(사용자)' : '한 문항 풀기(사용자)'}
                  <span className="text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37] px-1.5 py-0.5 ml-2 uppercase tracking-tighter">
                    {activeMenu === 'management' ? 'Admin' : activeMenu === 'rounds' ? 'Rounds' : activeMenu === 'stats' ? 'Report' : 'User'}
                  </span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  {activeMenu === 'management' ? '한국사능력검정시험 기출문제 데이터베이스 관리' : activeMenu === 'rounds' ? '회차별 기출문제 등록 현황 및 통합 관리' : activeMenu === 'stats' ? '회차별 응시 결과 및 문항 난이도 분석' : activeMenu === 'user' ? '사용자가 직접 문제를 풀고 학습하는 인터페이스' : '단일 문항을 선택하여 집중 학습하는 인터페이스'}
                </div>
              </div>
            </div>
            <div className="text-[11px] opacity-70 font-bold border-l border-white/20 pl-4 h-10 flex flex-col justify-center">
              <div>최고 관리자</div>
              <div className="text-[#D4AF37]">한능검님 접속 중</div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col px-4 pt-2 pb-2 gap-3 overflow-y-auto shadow-inner font-sans">
          {activeMenu === 'rounds' ? (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">전체 기출회차 관리 ({exams.length})</h2>
                  <Button onClick={() => setIsCreateModalOpen(true)} className="h-9 rounded-none bg-[#141414] hover:bg-black text-white text-xs font-bold gap-1.5 flex items-center">
                    <Plus className="w-3.5 h-3.5" /> 회차 추가
                  </Button>
                </div>
                <div className="text-[10px] text-slate-400 font-medium italic">
                  * 노출 설정 시 최근 15회차까지 사용자에게 공개됩니다.
                </div>
              </div>

              <Card className="flex-1 flex flex-col rounded-none border-[#D1D1CF] shadow-none bg-white overflow-hidden">
                <div className="grid grid-cols-12 bg-[#F9F9F8] border-b border-[#D1D1CF] text-[11px] font-bold uppercase text-[#666] shrink-0">
                  <div className="col-span-1 p-3 text-center border-r border-[#D1D1CF]/30">No</div>
                  <div className="col-span-4 p-3 border-r border-[#D1D1CF]/30">기출 회차명</div>
                  <div className="col-span-2 p-3 text-center border-r border-[#D1D1CF]/30">급수</div>
                  <div className="col-span-1.5 p-3 text-center">등록일</div>
                  <div className="col-span-1.5 p-3 text-center">노출 여부</div>
                  <div className="col-span-2 p-3 text-center">작업 관리</div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-[#F0F0F0]">
                    {exams.sort((a,b) => {
                      const rA = parseInt(a.round.replace(/[^0-9]/g, '')) || 0;
                      const rB = parseInt(b.round.replace(/[^0-9]/g, '')) || 0;
                      return rB - rA;
                    }).flatMap((exam) => {
                      const displayLevels = (!exam.levels || exam.levels.length === 0) ? ['심화', '기본'] : exam.levels;
                      return displayLevels.map(level => ({ ...exam, displayLevel: level }));
                    }).map((examWithLevel, index, allRows) => (
                      <div 
                        key={`${examWithLevel.id}-${examWithLevel.displayLevel}`} 
                        className={`grid grid-cols-12 items-center hover:bg-[#FFFBF0] transition-colors text-[12px] ${examWithLevel.isVisible === false ? 'bg-slate-50/50' : ''}`}
                      >
                        <div className="col-span-1 p-3 text-center font-mono text-[11px] text-slate-400 border-r border-[#F0F0F0]">{String(allRows.length - index).padStart(2, '0')}</div>
                        <div className="col-span-4 p-3 flex items-center gap-2 border-r border-[#F0F0F0]">
                           <span className="font-bold text-[#141414] truncate text-[14px]">
                            {examWithLevel.round} 한국사능력검정시험
                           </span>
                           {index < 3 && examWithLevel.isVisible !== false && (
                             <span className="text-[9px] bg-yellow-400 text-black px-1 font-black uppercase rounded-xs">최신</span>
                           )}
                        </div>
                        <div className="col-span-2 p-3 flex justify-center border-r border-[#F0F0F0]">
                          <span className={`text-[14px] px-2 py-0.5 rounded-sm font-bold border ${
                            examWithLevel.displayLevel === '심화' 
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {examWithLevel.displayLevel}
                          </span>
                        </div>
                        <div className="col-span-1.5 p-3 text-center text-slate-500 font-mono text-[14px]">
                          {examWithLevel.createdAt ? new Date(examWithLevel.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : '2026.04.19'}
                        </div>
                        <div className="col-span-1.5 p-3 flex justify-center">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleToggleVisibility(examWithLevel.id, examWithLevel.isVisible !== false)}
                            className={`h-7 rounded-none px-2 text-[10px] font-bold gap-1 ${
                              examWithLevel.isVisible !== false 
                              ? 'text-emerald-600' 
                              : 'text-slate-400'
                            }`}
                          >
                            {examWithLevel.isVisible !== false ? (
                              <><Eye className="w-3 h-3" /> 노출</>
                            ) : (
                              <><EyeOff className="w-3 h-3" /> 비노출</>
                            )}
                          </Button>
                        </div>
                        <div className="col-span-2 p-3 flex justify-center items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] rounded-none border-[#141414] px-2 font-bold hover:bg-slate-900 hover:text-white"
                            onClick={() => {
                              setSelectedExamId(examWithLevel.id);
                              setActiveTab(examWithLevel.displayLevel === '심화' ? 'advanced' : 'general');
                              setActiveMenu('management');
                            }}
                          >
                            편집
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 w-7 p-0 rounded-none border-[#D1D1CF] hover:bg-slate-100"
                            onClick={() => {
                              setSelectedExamId(examWithLevel.id);
                              setActiveTab(examWithLevel.displayLevel === '심화' ? 'advanced' : 'general');
                              setActiveMenu('stats');
                            }}
                            title="통계 보기"
                          >
                            <BarChart3 className="w-3 h-3 text-indigo-600" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 w-7 p-0 rounded-none border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setExamToDelete(examWithLevel.id);
                              setIsExamDeleteConfirmOpen(true);
                            }}
                            title="회차 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          ) : activeMenu === 'management' ? (
            <>
              {/* Action Bar & Exam Selector */}
              <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              {selectedExamId && (
                <div className="flex items-center gap-3 px-4 py-1.5 bg-[#141414] text-white border-l-4 border-yellow-400">
                  <span className="text-[10px] font-black tracking-widest opacity-50 uppercase">편집 중</span>
                  <span className="text-[14px] font-bold tracking-tight flex items-center gap-2">
                    {(() => {
                      const exam = exams.find(e => e.id === selectedExamId);
                      if (!exam) return "회차 선택됨";
                      const examName = exam.round + " 한국사능력검정시험";
                      const isLatest = exams.sort((a,b) => {
                        const rA = parseInt(a.round.replace(/[^0-9]/g, '')) || 0;
                        const rB = parseInt(b.round.replace(/[^0-9]/g, '')) || 0;
                        return rB - rA;
                      })[0]?.id === exam.id;
                      
                      return (
                        <>
                          {examName}
                          {isLatest && (
                            <span className="text-[9px] bg-yellow-400 text-black px-1 font-black uppercase rounded-xs">최신</span>
                          )}
                        </>
                      );
                    })()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-slate-500">회차:</span>
                <Select 
                  value={selectedExamId || ""} 
                  onValueChange={(val) => setSelectedExamId(val)}
                >
                  <SelectTrigger className="w-[140px] h-9 rounded-none border-[#141414] bg-white text-xs font-bold">
                    <SelectValue placeholder="검정 회차 선택">
                      {(() => {
                        const exam = exams.find(e => e.id === selectedExamId);
                        if (!exam) return null;
                        return exam.round;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {visibleExams.length > 0 ? (
                      visibleExams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.round} 한국사능력검정시험
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-[10px] text-slate-500 text-center italic">노출 설정된 회차가 없습니다</div>
                    )}
                  </SelectContent>
                </Select>

              </div>
            </div>

            <div className="flex items-center gap-2 text-[#141414]">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
              />
              <Button 
                variant="outline" 
                className="h-9 rounded-none border-[#141414] text-xs font-bold bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                onClick={() => {
                  setBulkUploadStep(1);
                  setBulkExcelFile(null);
                  setBulkImageFiles([]);
                  setIsBulkUploadOpen(true);
                }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> 문항일괄 업로드
              </Button>
              <Button variant="outline" className="h-9 rounded-none border-[#141414] text-xs font-bold gap-2" onClick={downloadExcelTemplate}>
                <Download className="w-3.5 h-3.5" /> 양식 다운로드
              </Button>
              <Button 
                variant="outline" 
                className="h-9 rounded-none border-[#141414] text-xs font-bold gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                onClick={downloadAllQuestionsPDF}
              >
                <Download className="w-3.5 h-3.5" /> 일괄 내려받기
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-6">
            <main className="grid grid-cols-12 gap-4 p-1 pb-20 min-h-[1200px]">
                {/* Left Pane: Question List */}
                <Card className="col-span-5 flex flex-col rounded-none border-[#D1D1CF] shadow-none bg-white min-h-[760px]">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
                <TabsList className="flex p-0 h-12 bg-transparent rounded-none border-b border-[#D1D1CF] gap-2 px-4 whitespace-nowrap shrink-0">
                  <TabsTrigger value="general" className="h-full rounded-none border-x border-t border-transparent data-[state=active]:bg-white data-[state=active]:border-[#D1D1CF] data-[state=active]:border-b-white -mb-[1px] px-6 text-[14px] font-bold">일반 (Basic)</TabsTrigger>
                  <TabsTrigger value="advanced" className="h-full rounded-none border-x border-t border-transparent data-[state=active]:bg-white data-[state=active]:border-[#D1D1CF] data-[state=active]:border-b-white -mb-[1px] px-6 text-[14px] font-normal">심화 (Advanced)</TabsTrigger>
                </TabsList>
                
                <div className="grid grid-cols-12 bg-[#F9F9F8] border-b border-[#D1D1CF] text-[11px] font-bold uppercase text-[#666]">
                  <div className="col-span-2 p-3">문항</div>
                  <div className="col-span-2 p-3">시대</div>
                  <div className="col-span-2 p-3">난이도</div>
                  <div className="col-span-6 p-3">문항제목</div>
                </div>

                <div className="flex-1">
                  <div className="divide-y divide-[#F0F0F0] pb-10">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const num = (currentPage - 1) * 10 + (i + 1);
                        const q = questions.find(item => item.number === num);
                      return (
                        <div 
                          key={`q-slot-${num}`} 
                          className={`grid grid-cols-12 items-center hover:bg-[#FFFBF0] transition-colors cursor-pointer text-[12px] ${selectedQuestion?.number === num ? 'bg-[#FFFBF0]' : ''}`}
                          onClick={() => q ? setSelectedQuestion(q) : handleCreateQuestion(num)}
                        >
                          <div className="col-span-2 p-2.5 font-mono text-[11px]">#{String(num).padStart(2, '0')}</div>
                          <div className="col-span-2 p-2.5">
                            <span className="text-xs px-2 py-0.5 bg-[#EEE] rounded-sm">{q?.era || '-'}</span>
                          </div>
                          <div className="col-span-2 p-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-sm ${q?.difficulty === '상' ? 'bg-[#FFE5E5] text-[#D00]' : 'bg-[#EEE]'}`}>
                              {q?.difficulty || '-'}
                            </span>
                          </div>
                          <div className="col-span-4 p-2.5 truncate text-sm">
                            {q?.title || <span className="text-slate-300 italic">문항을 입력하세요</span>}
                          </div>
                          <div className="col-span-2 p-2.5 flex justify-end items-center gap-1.5">
                            {q && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 rounded-none hover:bg-slate-100 text-slate-500 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadSingleQuestionPDF(q);
                                }}
                                title="문항 내려받기"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 text-xs rounded-none border-[#141414] px-2 shrink-0">
                              {q ? '수정' : '+ 입력'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-[#F9F9F8] border-t border-[#D1D1CF] flex items-center justify-between gap-1 overflow-x-auto relative">
                  {tempSaveStatus && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -top-10 left-3 bg-[#141414] text-white text-[10px] px-3 py-1.5 shadow-lg border border-[#333] z-50 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      {tempSaveStatus}
                    </motion.div>
                  )}
                  <div className="flex gap-1 text-[12px]">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-none border-[#141414] text-[12px] font-bold px-3"
                      onClick={() => setIsPreviewDialogOpen(true)}
                    >
                      미리보기
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-none border-[#141414] text-[12px] font-bold bg-slate-800 text-white hover:bg-slate-700 px-3"
                      onClick={handleTempSave}
                    >
                      임시 저장
                    </Button>
                  </div>

                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const page = i + 1;
                      return (
                        <Button 
                          key={`page-${page}`}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className={`w-8 h-8 rounded-none border-[#141414] text-[12px] font-bold ${currentPage === page ? 'bg-[#141414] text-white' : 'bg-white'}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  <Button 
                    size="sm" 
                    className="h-8 rounded-none bg-[#141414] text-white text-[10px] font-bold px-4 hover:bg-slate-800"
                    onClick={async () => {
                      if (selectedExamId) {
                        try {
                          await updateDoc(doc(db, 'exams', selectedExamId), {
                            status: 'published',
                            updatedAt: serverTimestamp()
                          });
                          handleTempSave();
                          setTimeout(() => {
                            setActiveMenu('rounds');
                          }, 1000);
                        } catch (error) {
                          console.error("Error publishing exam:", error);
                          alert("게시 중 오류가 발생했습니다.");
                        }
                      } else {
                        alert("회차를 선택해주세요.");
                      }
                    }}
                  >
                    기출문제 게시
                  </Button>
                </div>
              </Tabs>
            </Card>

            {/* Right Pane: Detail Editor */}
            <Card className="col-span-7 flex flex-col rounded-none border-[#141414] shadow-[10px_10px_0_rgba(0,0,0,0.05)] bg-white min-h-[760px]">
              <CardHeader className="bg-[#F9F9F8] border-b border-[#D1D1CF] py-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                    상세 정보 {selectedQuestion ? `문항 ${String(selectedQuestion.number).padStart(2, '0')}` : '미리보기'}
                  </CardTitle>

                  {selectedQuestion && (
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => downloadSingleQuestionPDF(selectedQuestion)}
                        className="h-7 rounded-none border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-[10px] font-bold px-3 gap-1.5"
                      >
                        <Download className="w-3 h-3" />
                        문항 내려받기
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => seedSingleDummy(selectedQuestion.number)}
                        className="h-7 rounded-none border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-[10px] font-bold px-3 gap-1.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        예시 데이터 생성
                      </Button>
                    </div>
                  )}
                  {selectedQuestion && (
                    <div className="flex items-center gap-1 border-x border-[#D1D1CF] px-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-none"
                        onClick={() => {
                          const prevNum = selectedQuestion.number - 1;
                          if (prevNum > 0) {
                            const q = questions.find(item => item.number === prevNum);
                            if (q) setSelectedQuestion(q);
                            else handleCreateQuestion(prevNum);
                          }
                        }}
                        disabled={selectedQuestion.number <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="text-[10px] font-mono text-slate-400 w-8 text-center">{selectedQuestion.number}</div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-none"
                        onClick={() => {
                          const nextNum = selectedQuestion.number + 1;
                          if (nextNum <= 50) {
                            const q = questions.find(item => item.number === nextNum);
                            if (q) setSelectedQuestion(q);
                            else handleCreateQuestion(nextNum);
                          }
                        }}
                        disabled={selectedQuestion.number >= 50}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <div className="flex-1">
                <AnimatePresence mode="wait">
                  {selectedQuestion ? (
                    <motion.div 
                      key={selectedQuestion.id || selectedQuestion.number}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex-1"
                    >
                      <div className="space-y-4 px-6 py-6 pb-20">
                            {/* 고정 정보 섹션 (Read Only) */}
                            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-900 text-white border-l-4 border-yellow-400">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">문제 ID (자동생성)</Label>
                                <div className="text-sm font-mono font-bold">
                                  {exams.find(e => e.id === selectedExamId)?.round.replace(/[^0-9]/g, '') || '00'}-
                                  {activeTab === 'advanced' ? '심화' : '기본'}-
                                  {selectedQuestion.number}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">출제위원</Label>
                                <div className="text-sm font-bold truncate">
                                  {selectedQuestion.author || auth.currentUser?.displayName || '한능검 관리자'}
                                </div>
                              </div>
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">문항제목</Label>
                              <Input 
                                className="rounded-none border-[#D1D1CF] h-8 text-sm" 
                                value={selectedQuestion.title}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, title: e.target.value})}
                                placeholder="(가) 인물의 활동으로 옳은 것은?" 
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold">문항 이미지 등록</Label>
                                <div className="flex gap-2">
                                  <Input 
                                    placeholder="이미지 경로" 
                                    className="w-48 h-6 text-[10px] rounded-none border-[#D1D1CF]" 
                                    value={selectedQuestion.imageUrl}
                                    onChange={(e) => setSelectedQuestion({...selectedQuestion, imageUrl: e.target.value})}
                                  />
                                  <input 
                                    type="file"
                                    ref={qImageRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                  />
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-6 text-[10px] rounded-none border-[#141414] px-2"
                                    onClick={() => qImageRef.current?.click()}
                                  >
                                    파일 선택
                                  </Button>
                                </div>
                              </div>
                              <div className="h-[140px] overflow-auto bg-[#F9F9F9] border border-[#D1D1CF] flex flex-col items-center justify-center relative border-dashed p-2">
                                {selectedQuestion.imageUrl ? (
                                  <img 
                                    src={selectedQuestion.imageUrl} 
                                    alt="Question" 
                                    className="max-h-full w-auto object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="text-[10px] text-[#999] italic">문항 이미지가 등록되지 않았습니다.</div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">시대 (선사/고대/조선...)</Label>
                                <Select 
                                  value={selectedQuestion?.era || ""} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, era: v} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue placeholder="시대 선택">
                                      {selectedQuestion?.era || ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {ERAS.map(era => <SelectItem key={era} value={era}>{era}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">분야 (정치/경제/사회/문화...)</Label>
                                <Select 
                                  value={selectedQuestion?.field || ""} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, field: v} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue placeholder="분야 선택">
                                      {selectedQuestion?.field || ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">문제 유형 (역사지식 이해...)</Label>
                                <Select 
                                  value={selectedQuestion?.category || ""} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, category: v} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue placeholder="유형 선택">
                                      {selectedQuestion?.category || ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">출제 근거</Label>
                              <Input 
                                className="rounded-none border-[#D1D1CF] h-8 text-sm" 
                                value={selectedQuestion.source || ''}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, source: e.target.value})}
                                placeholder="예: 기출 60회 1번 응용" 
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">키워드</Label>
                              <Input 
                                className="rounded-none border-[#D1D1CF] h-8 text-sm" 
                                value={selectedQuestion.keywords.join(' ')}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, keywords: e.target.value.split(' ')})}
                                placeholder="#조선 #계보 #정치 #시대배경" 
                              />
                            </div>


                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">정답</Label>
                                <Select 
                                  value={selectedQuestion ? String(selectedQuestion.answer) : "1"} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, answer: parseInt(v)} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue>
                                      {selectedQuestion?.answer ? `${selectedQuestion.answer}번` : "1번"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={`ans-opt-${n}`} value={String(n)}>{n}번</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">배점</Label>
                                <Select 
                                  value={selectedQuestion ? String(selectedQuestion.score) : ""} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, score: parseInt(v)} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue>
                                      {selectedQuestion?.score ? `${selectedQuestion.score}점` : ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {[1,2,3,4,5].map(n => <SelectItem key={`score-opt-${n}`} value={String(n)}>{n}점</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">난이도</Label>
                                <Select 
                                  value={selectedQuestion?.difficulty || ""} 
                                  onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, difficulty: v as any} : null)}
                                >
                                  <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                                    <SelectValue placeholder="선택">
                                      {selectedQuestion?.difficulty || ""}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-none">
                                    {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold">예상 정답률 (%)</Label>
                                <Input 
                                  type="number" 
                                  className="rounded-none border-[#D1D1CF] h-8 text-sm" 
                                  value={selectedQuestion.expectedCorrectRate || 0}
                                  onChange={(e) => setSelectedQuestion({...selectedQuestion, expectedCorrectRate: parseInt(e.target.value)})}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px] font-bold flex items-center justify-between">
                                  <span>실제 정답률 (%)</span>
                                  <span className="text-[9px] text-[#2563EB] bg-blue-50 px-1.5 py-0.5 font-bold border border-blue-200">API 수신 (Read Only)</span>
                                </Label>
                                <Input 
                                  type="number" 
                                  className="rounded-none border-[#D1D1CF] h-8 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" 
                                  value={selectedQuestion.correctRate || 0}
                                  readOnly
                                />
                              </div>
                            </div>



                            <Separator className="my-4" />

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">문항 내용 (이미지/사료 설명 컨텐츠)</Label>
                              <Textarea 
                                className="min-h-[80px] rounded-none border-[#D1D1CF] bg-white text-xs leading-relaxed" 
                                placeholder="이미지에 포함된 텍스트나 사료 내용을 입력하세요..."
                                value={selectedQuestion.imageDescription || ''}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, imageDescription: e.target.value})}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">전맹자용 문항 구성</Label>
                              <Textarea 
                                className="min-h-[80px] rounded-none border-[#D1D1CF] bg-[#FDFDFD] text-xs leading-relaxed italic" 
                                placeholder="시각 장애인을 위한 대체 텍스트 문항을 입력하세요..."
                                value={selectedQuestion.accessibleQuestion || ''}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, accessibleQuestion: e.target.value})}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">정답 해설</Label>
                              <Textarea 
                                className="min-h-[100px] rounded-none border-[#D1D1CF] bg-white text-sm leading-relaxed" 
                                placeholder="오답 방지 및 정답에 대한 상세 해설을 입력하세요..."
                                value={selectedQuestion.explanation}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, explanation: e.target.value})}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">비고 (특이사항)</Label>
                              <Textarea 
                                className="min-h-[60px] rounded-none border-[#D1D1CF] bg-slate-50 text-[11px] leading-relaxed" 
                                placeholder="검토 의견이나 기타 관리용 메모를 입력하세요..."
                                value={selectedQuestion.etc || ''}
                                onChange={(e) => setSelectedQuestion({...selectedQuestion, etc: e.target.value})}
                              />
                            </div>
                        </div>


                    <div className="border-t border-[#D1D1CF] p-4 bg-slate-50 flex items-center justify-between gap-4"> 
                      <Button 
                        variant="outline" 
                        onClick={handleDeleteQuestion}
                    className="h-9 rounded-none border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-[11px] font-bold px-4"
                  >
                    데이터 삭제
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedQuestion(null)} 
                      className="h-9 rounded-none border-[#141414] text-[11px] font-bold px-6 bg-white"
                    >
                      취소
                    </Button>
                    <Button 
                      onClick={handleSaveQuestion} 
                      className="h-9 rounded-none bg-[#141414] text-white text-[11px] font-bold px-8 shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
                    >
                      저장
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
                    <div className="h-full flex flex-col items-center justify-center text-[#999] gap-4 py-20">
                      <div className="text-[11px] uppercase tracking-widest opacity-50">상세 정보 미리보기</div>
                      <div className="w-full h-[120px] bg-[#EEE] flex items-center justify-center text-[11px]">
                        [문항을 선택하세요]
                      </div>
                      <p className="text-[12px] text-center px-10 leading-relaxed">
                        좌측 목록에서 문항을 선택하여<br />상세 정보를 확인하거나 수정할 수 있습니다.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </main>
        </div>
          </>
          ) : activeMenu === 'stats' ? (
            <StatsPage 
              exams={visibleExams} 
              selectedExamId={selectedExamId} 
              questions={questions}
              onExamChange={setSelectedExamId}
              onDeleteExam={handleDeleteExam}
              onSelectQuestion={(q) => {
                setActiveMenu('management');
                setActiveTab(q.type === 'advanced' ? 'advanced' : 'general');
                setSelectedQuestion(q);
                // Calculate page based on question number (10 questions per page)
                const page = Math.ceil(q.number / 10);
                setCurrentPage(page);
              }}
            />
          ) : activeMenu === 'user' ? (
            <div className="flex-1 overflow-hidden p-2">
              <UserView 
                exams={visibleExams}
                questions={questions}
                selectedExamId={selectedExamId}
                onExamChange={setSelectedExamId}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden p-2">
              <SingleQuestionView exams={visibleExams} />
            </div>
          )}
        </div>
      </div>

      {/* Create Exam Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-none border-2 border-[#141414] shadow-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">새로운 기출회차 추가</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-[#666]">회차 정보</Label>
              <Input 
                autoFocus
                placeholder="예: 76 (자동으로 '회'가 추가됩니다)" 
                className="rounded-none border-[#141414] h-11 text-base font-bold"
                value={newExamRound}
                onChange={(e) => setNewExamRound(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createNewExam();
                }}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-bold text-[#666]">포함 급수 (중복 선택 가능)</Label>
              <div className="flex gap-2">
                {['심화', '기본'].map(level => (
                  <Button
                    key={level}
                    variant="outline"
                    className={`flex-1 h-11 rounded-none font-bold text-sm border-[#141414] transition-all ${
                      selectedLevels.includes(level) 
                      ? 'bg-[#141414] text-white' 
                      : 'bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (selectedLevels.includes(level)) {
                        setSelectedLevels(selectedLevels.filter(l => l !== level));
                      } else {
                        setSelectedLevels([...selectedLevels, level]);
                      }
                    }}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[#999] leading-relaxed pt-2">
              신규 회차를 추가하면 해당 회차의 문항을 입력할 수 있는 빈 시트가 생성됩니다. <br />
              급수는 '심화', '기본' 중 하나 이상을 선택해야 합니다.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button 
              className="bg-[#141414] text-white rounded-none flex-1 h-11 font-bold text-sm"
              onClick={createNewExam}
            >
              회차 생성하기
            </Button>
            <Button 
              variant="outline" 
              className="rounded-none border-[#141414] h-11 font-bold text-sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-none border-2 border-[#141414] shadow-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">문항 데이터 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-sm text-[#333] leading-relaxed">
              입력된 데이터를 삭제하시겠습니까? <br />
              <span className="text-destructive font-bold text-xs">이 작업은 되돌릴 수 없습니다.</span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button 
              variant="destructive"
              className="rounded-none flex-1 h-11 font-bold text-sm"
              onClick={confirmDeleteQuestion}
            >
              확인 (삭제)
            </Button>
            <Button 
              variant="outline" 
              className="rounded-none border-[#141414] h-11 font-bold text-sm px-8"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[1024px] h-[768px] sm:max-w-none sm:max-h-none flex flex-col p-0 rounded-none border-2 border-[#141414] overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-200 shrink-0">
            <DialogTitle className="text-lg font-bold">사용자 화면 미리보기</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-2 bg-slate-50">
            <UserView 
              exams={exams}
              questions={questions}
              selectedExamId={selectedExamId}
              onExamChange={setSelectedExamId}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </div>
          <DialogFooter className="p-4 border-t border-slate-200 shrink-0 bg-white flex justify-center sm:justify-center">
            <Button 
              variant="outline" 
              className="rounded-none border-[#141414] h-11 font-bold text-sm px-10"
              onClick={() => setIsPreviewDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 문항일괄 업로드 팝업 */}
      <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
        <DialogContent className="max-w-[800px] w-[800px] h-[600px] p-0 overflow-hidden flex flex-col rounded-none border-0">
          <div className="bg-[#141414] text-white p-4 flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              문항 일괄 업로드 {bulkUploadStep === 1 ? '(1/2: 엑셀)' : '(2/2: 이미지)'}
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white/50 hover:text-white" onClick={() => setIsBulkUploadOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 p-6 flex flex-col items-center justify-start bg-slate-50 overflow-y-auto">
            {bulkUploadStep === 1 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg text-center space-y-6 pt-4"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800">엑셀 데이터 업로드</h3>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    문항 정보가 담긴 엑셀 파일을 선택해주세요.<br />
                    회차, 번호, 시대, 유형, 난이도 등이 포함되어 있어야 합니다.
                  </p>
                </div>
                
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all bg-white relative",
                    bulkExcelFile ? "border-emerald-500 bg-emerald-50/20" : "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/30"
                  )}
                  onClick={() => bulkExcelInputRef.current?.click()}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={bulkExcelInputRef}
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setBulkExcelFile(file);
                    }}
                  />
                  <Upload className={cn("w-6 h-6 mx-auto mb-2", bulkExcelFile ? "text-emerald-500" : "text-emerald-400")} />
                  <span className="text-[11px] font-bold text-slate-400">
                    {bulkExcelFile ? "다른 파일로 변경하려면 클릭하세요" : "파일을 클릭하거나 여기에 드래그하세요"}
                  </span>
                </div>

                {bulkExcelFile && (
                  <div className="bg-white border border-emerald-100 p-4 rounded-lg flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-800 truncate max-w-[200px]">{bulkExcelFile.name}</div>
                        <div className="text-[9px] font-bold text-slate-400">{(bulkExcelFile.size / 1024).toFixed(1)} KB • 체크 완료</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded text-emerald-600">
                      <Check className="w-3 h-3" />
                      <span className="text-[9px] font-black">정상</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg text-center space-y-6 pt-4"
              >
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                  <ImageIcon className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800">이미지 일괄 업로드</h3>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    문항 이미지 파일들을 선택해주세요.<br />
                    파일명 형식: <span className="text-indigo-600 font-bold">'회차_01(기본)또는 02(심화)_문항번호'</span> 순 (예: 68_01_1.png)
                  </p>
                </div>
                
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all bg-white",
                    bulkImageFiles.length > 0 ? "border-indigo-500 bg-indigo-50/20" : "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30"
                  )}
                  onClick={() => qImageRef.current?.click()}
                >
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={qImageRef}
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) setBulkImageFiles(files);
                    }}
                  />
                  <Upload className={cn("w-6 h-6 mx-auto mb-2", bulkImageFiles.length > 0 ? "text-indigo-500" : "text-indigo-400")} />
                  <span className="text-[11px] font-bold text-slate-400">
                    {bulkImageFiles.length > 0 ? `${bulkImageFiles.length}개의 파일 선택됨 • 클릭하여 변경` : "이미지 폴더 또는 다중 파일을 선택하세요"}
                  </span>
                </div>

                {bulkImageFiles.length > 0 && (
                  <div className="bg-white border border-indigo-100 rounded-lg shadow-sm">
                    <div className="p-2 border-b border-indigo-50 flex items-center justify-between px-4">
                      <span className="text-[10px] font-bold text-indigo-600">선택된 파일 목록 ({bulkImageFiles.length})</span>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {bulkImageFiles.slice(0, 6).map((file, i) => (
                          <div key={i} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-[9px] font-bold text-slate-600 border border-slate-100">
                            <ImageIcon className="w-2.5 h-2.5 text-indigo-400" />
                            <span className="truncate">{file.name}</span>
                          </div>
                        ))}
                        {bulkImageFiles.length > 6 && (
                          <div className="col-span-2 text-center py-1 text-[9px] text-slate-400 font-bold">외 {bulkImageFiles.length - 6}개 파일 더 있음...</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <Button 
              variant="outline" 
              className="px-6 h-10 rounded-none border-slate-200 text-xs font-black text-slate-500"
              onClick={() => setIsBulkUploadOpen(false)}
            >
              취소
            </Button>
            
            <div className="flex items-center gap-2">
              {bulkUploadStep === 2 && (
                <Button 
                  variant="outline" 
                  className="px-6 h-10 rounded-none border-indigo-200 text-indigo-600 text-xs font-black flex items-center gap-2"
                  onClick={() => setBulkUploadStep(1)}
                >
                  <ChevronLeft className="w-4 h-4" /> 이전
                </Button>
              )}
              
              {bulkUploadStep === 1 ? (
                <Button 
                  className="px-8 h-10 rounded-none bg-[#141414] hover:bg-slate-800 text-white text-xs font-black flex items-center gap-2"
                  onClick={handleBulkExcelUpload}
                >
                  다음 <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  className="px-8 h-10 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2"
                  onClick={handleBulkImageUpload}
                >
                  업로드 완료 <Check className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회차 삭제 확인 다이얼로그 (전체 관리용) */}
      <Dialog open={isExamDeleteConfirmOpen} onOpenChange={setIsExamDeleteConfirmOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-none border-0 shadow-2xl">
          <div className="bg-red-600 p-4 flex items-center gap-3 text-white">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-sm font-black uppercase tracking-tight">회차 삭제 경고</h2>
          </div>
          <div className="p-6 bg-white space-y-4">
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-slate-900 leading-relaxed">
                정말로 <span className="text-red-600 font-black">[{exams.find(e => e.id === examToDelete)?.round}]</span> 회차를 삭제하시겠습니까?
              </p>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50 p-3 border-l-2 border-slate-200">
                삭제 시 해당 회차의 모든 문항 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0 border-t border-slate-100">
            <Button 
              className="flex-1 h-12 rounded-none bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black"
              onClick={() => setIsExamDeleteConfirmOpen(false)}
            >
              취소
            </Button>
            <Button 
              className="flex-1 h-12 rounded-none bg-red-600 hover:bg-red-700 text-white text-xs font-black"
              onClick={async () => {
                if (examToDelete) {
                  await handleDeleteExam(examToDelete);
                  setIsExamDeleteConfirmOpen(false);
                  setExamToDelete(null);
                }
              }}
            >
              삭제 승인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
