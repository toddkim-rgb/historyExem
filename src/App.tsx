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
  BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  orderBy
} from 'firebase/firestore';
import { db } from './lib/firebase';
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

const ERAS = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
const DIFFICULTIES = ['상', '중', '하'];

export default function App() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [activeMenu, setActiveMenu] = useState<'management' | 'stats' | 'rounds' | 'user'>('management');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [newExamRound, setNewExamRound] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['심화']);
  const [tempSaveStatus, setTempSaveStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Exams Listener
  useEffect(() => {
    setCurrentPage(1);
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(examData);
      if (examData.length > 0 && !selectedExamId) {
        setSelectedExamId(examData[0].id);
      }
    });
    return () => unsubscribe();
  }, [selectedExamId]);

  // Questions Listener
  useEffect(() => {
    setCurrentPage(1);
    if (!selectedExamId) return;
    const q = query(
      collection(db, 'questions'), 
      where('examId', '==', selectedExamId),
      where('type', '==', activeTab)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      setQuestions([...questionData].sort((a, b) => a.number - b.number));
    });
    return () => unsubscribe();
  }, [selectedExamId, activeTab]);

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
      console.error('Error creating exam:', error);
    }
  };

  const handleToggleVisibility = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'exams', id), {
        isVisible: !currentStatus
      });
    } catch (error) {
      console.error("Error toggling visibility:", error);
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
      setSelectedQuestion({ ...selectedQuestion, imageUrl: result });
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
      explanation: randomTemplate.explanation,
      difficulty: '중',
      score: 2,
      correctRate: 85
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
      explanation: '',
      category: '역사지식 이해',
      options: ['', '', '', '', '']
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
      console.error("Error deleting exam:", error);
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

    try {
      for (let i = 1; i <= 50; i++) {
        const existing = questions.find(item => item.number === i);
        if (!existing) {
          const template = templates[Math.floor(Math.random() * templates.length)];
          const newQ: Omit<Question, 'id'> = {
            examId: selectedExamId,
            type: activeTab,
            number: i,
            era: template.era,
            difficulty: '중',
            title: `[더미] #${i} ${template.title}`,
            keywords: template.keywords,
            imageUrl: `https://picsum.photos/seed/history-dummy-${selectedExamId}-${i}/800/600`,
            answer: template.answer,
            score: Math.floor(Math.random() * 2) + 2,
            correctRate: Math.floor(Math.random() * 15) + 83,
            explanation: template.explanation,
            category: template.category,
            options: template.options
          };
          await addDoc(collection(db, 'questions'), newQ);
        }
      }
      alert('전체 문항(1~50번) 중 비어있는 항목에 대해 더미 데이터가 생성되었습니다.');
    } catch (error) {
      console.error('Error seeding dummy data:', error);
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
        type: activeTab,
        number: parseInt(row['번호'] || row['number'] || 0),
        era: row['시대'] || row['era'] || '',
        difficulty: (row['난이도'] || row['difficulty'] || '중') as '상' | '중' | '하',
        title: row['질문'] || row['title'] || '',
        keywords: String(row['키워드'] || row['keywords'] || '').split(',').map((k: string) => k.trim()),
        imageUrl: row['이미지URL'] || row['imageUrl'] || '',
        answer: parseInt(row['정답'] || row['answer'] || 1),
        score: parseInt(row['배점'] || row['score'] || 2),
        correctRate: parseInt(row['정답률'] || row['correctRate'] || 0),
        explanation: row['해설'] || row['explanation'] || '',
        category: row['문제유형'] || row['category'] || '역사지식 이해',
        options: [
          row['선택지1'] || row['option1'] || '',
          row['선택지2'] || row['option2'] || '',
          row['선택지3'] || row['option3'] || '',
          row['선택지4'] || row['option4'] || '',
          row['선택지5'] || row['option5'] || '',
        ]
      }));

      for (let i = 0; i < mappedQuestions.length; i++) {
        const q = mappedQuestions[i];
        if (!q.title) continue;
        await addDoc(collection(db, 'questions'), q);
        setUploadProgress(Math.round(((i + 1) / mappedQuestions.length) * 100));
      }

      setIsUploading(false);
      alert(`${mappedQuestions.length}개의 문항이 성공적으로 업로드되었습니다.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setIsUploading(false);
      console.error('Error parsing Excel:', error);
      alert('엑셀 파일 파싱 중 오류가 발생했습니다.');
    }
  };

  const downloadExcelTemplate = () => {
    const categories = [
      '역사지식 이해',
      '사료 분석 및 해석',
      '역사 상황 파악',
      '역사 탐구 설계 및 수행',
      '역사적 상상력 및 추론',
      '역사적 가치 판단 및 태도'
    ];

    const exampleData = [
      {
        '번호': 1,
        '시대': '선사',
        '난이도': '하',
        '질문': '(가) 시대의 생활 모습으로 옳은 것은?',
        '키워드': '#구석기 #주먹도끼 #동굴 #채집',
        '이미지URL': 'https://picsum.photos/seed/history1/800/600',
        '정답': 1,
        '배점': 2,
        '정답률': 85,
        '선택지1': '주먹도끼를 사용하여 짐승을 사냥하였다.',
        '선택지2': '반달 돌칼을 이용하여 곡식을 수확하였다.',
        '선택지3': '가락바퀴를 이용하여 실을 뽑았다.',
        '선택지4': '철제 농기구를 사용하여 농사를 지었다.',
        '선택지5': '비파형 동검을 제작하여 사용하였다.',
        '해설': '주먹도끼는 구석기 시대의 대표적인 유물입니다.',
        '문제유형': '역사지식 이해'
      },
      {
        '번호': 2,
        '시대': '고대',
        '난이도': '중',
        '질문': '밑줄 친 ‘이 왕’에 대한 설명으로 옳은 것은?',
        '키워드': '#광개토대왕 #신라구원 #영토확장',
        '이미지URL': 'https://picsum.photos/seed/history2/800/600',
        '정답': 3,
        '배점': 3,
        '정답률': 72,
        '선택지1': '병부를 설치하고 율령을 반포하였다.',
        '선택지2': '불교를 공인하여 사상적 통합을 꾀하였다.',
        '선택지3': '신라에 침입한 왜구를 격퇴하였다.',
        '선택지4': '독서삼품과를 실시하여 인재를 등용하였다.',
        '선택지5': '수도를 사비로 옮기고 국호를 남부여로 바꾸었다.',
        '해설': '광개토대왕은 신라 내물왕의 요청으로 왜구를 격퇴하였습니다.',
        '문제유형': '사료 분석 및 해석'
      },
      {
        '번호': 3,
        '시대': '고려',
        '난이도': '중',
        '질문': '다음 외교 문서를 보낸 국가에 대한 고려의 대응으로 옳은 것은?',
        '키워드': '#서희 #강동6주 #거란',
        '이미지URL': 'https://picsum.photos/seed/history3/800/600',
        '정답': 2,
        '배점': 2,
        '정답률': 68,
        '선택지1': '박위를 파견하여 근거지를 토벌하였다.',
        '선택지2': '서희가 외교 담판을 벌여 강동 6주를 확보하였다.',
        '선택지3': '윤관이 별무반을 이끌고 동북 9성을 축조하였다.',
        '선택지4': '강화도로 천도하여 끈질기게 항전하였다.',
        '선택지5': '쌍성총관부를 공격하여 철령 이북의 땅을 되찾았다.',
        '해설': '고려는 거란의 침입 때 서희의 외교 담판으로 강동 6주를 얻었습니다.',
        '문제유형': '역사 상황 파악'
      },
      {
        '번호': 4,
        '시대': '조선',
        '난이도': '하',
        '질문': '(가) 지도에 대한 설명으로 옳은 것은?',
        '키워드': '#혼일강리역대국도지도 #태종 #세계지도',
        '이미지URL': 'https://picsum.photos/seed/history4/800/600',
        '정답': 4,
        '배점': 2,
        '정답률': 91,
        '선택지1': '목판으로 인쇄되어 대량으로 보급되었다.',
        '선택지2': '정상기의 백리척을 사용하여 제작되었다.',
        '선택지3': '한반도의 지형이 실제와 매우 유사하게 묘사되었다.',
        '선택지4': '현존하는 동양 최고의 세계 지도 중 하나이다.',
        '선택지5': '중국에서 들여온 곤여만국전도를 바탕으로 그렸다.',
        '해설': '혼일강리역대국도지도는 조선 태종 때 만들어진 동양 최고의 세계지도 중 하나입니다.',
        '문제유형': '역사 탐구 설계 및 수행'
      },
      {
        '번호': 5,
        '시대': '근대',
        '난이도': '상',
        '질문': '다음 사건이 일어난 이후의 사실로 옳은 것은?',
        '키워드': '#갑신정변 #3일천하 #우정총국',
        '이미지URL': 'https://picsum.photos/seed/history5/800/600',
        '정답': 5,
        '배점': 3,
        '정답률': 42,
        '선택지1': '어재연 장군이 광성보에서 항전하였다.',
        '선택지2': '운요호 사건을 계기로 강화도 조약이 체결되었다.',
        '선택지3': '구식 군인들이 차별에 반발하여 임오군란을 일으켰다.',
        '선택지4': '정부가 근대적 조세 제도를 마련하기 위해 지계아문을 설치하였다.',
        '선택지5': '청과 일본 사이의 세력 균형을 위해 한성 조약이 체결되었다.',
        '해설': '갑신정변 이후 텐진 조약과 한성 조약이 체결되었습니다.',
        '문제유형': '역사적 가치 판단 및 태도'
      }
    ];

    const templateData = exampleData.concat(
      Array.from({ length: 45 }, (_, i) => {
        const num = i + 6;
        const era = ERAS[i % ERAS.length];
        const category = categories[i % categories.length];
        const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
        
        return {
          '번호': num,
          '시대': era,
          '난이도': difficulty,
          '질문': `[제 ${num}번] ${era} 시대의 주요 사건이나 인물에 대한 탐구 문항입니다.`,
          '키워드': `#${era}, #역사탐구, #기출`,
          '이미지URL': `https://picsum.photos/seed/history${num}/800/600`,
          '정답': (num % 5) + 1,
          '배점': (num % 3) + 1,
          '정답률': Math.floor(Math.random() * 15) + 80,
          '선택지1': '1번 선택지 내용입니다.',
          '선택지2': '2번 선택지 내용입니다.',
          '선택지3': '3번 선택지 내용입니다.',
          '선택지4': '4번 선택지 내용입니다.',
          '선택지5': '5번 선택지 내용입니다.',
          '해설': `제 ${num}번 문항에 대한 해설입니다.`,
          '문제유형': category
        };
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, "history_exam_full_template.xlsx");
  };

  const handleSaveQuestion = async () => {
    if (!selectedQuestion || !selectedExamId) return;
    try {
      if (selectedQuestion.id) {
        const { id, ...data } = selectedQuestion;
        await updateDoc(doc(db, 'questions', id), data);
      } else {
        await addDoc(collection(db, 'questions'), selectedQuestion);
      }
      setSelectedQuestion(null);
    } catch (error) {
      console.error('Error saving question:', error);
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
      console.error('Error deleting question:', error);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F0EE] font-sans overflow-hidden">
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
              사용자화면
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
                  {activeMenu === 'management' ? '기출 문항 관리' : activeMenu === 'rounds' ? '기출문제 회차 관리' : activeMenu === 'stats' ? '성적 및 통계 분석' : '사용자 문제풀이 화면'}
                  <span className="text-[10px] font-bold text-[#D4AF37] border border-[#D4AF37] px-1.5 py-0.5 ml-2 uppercase tracking-tighter">
                    {activeMenu === 'management' ? 'Admin' : activeMenu === 'rounds' ? 'Rounds' : activeMenu === 'stats' ? 'Report' : 'User'}
                  </span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  {activeMenu === 'management' ? '한국사능력검정시험 기출문제 데이터베이스 관리' : activeMenu === 'rounds' ? '회차별 기출문제 등록 현황 및 통합 관리' : activeMenu === 'stats' ? '회차별 응시 결과 및 문항 난이도 분석' : '사용자가 직접 문제를 풀고 학습하는 인터페이스'}
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
                           <span className="font-bold text-[#141414] truncate">
                            {examWithLevel.round.includes('회') ? examWithLevel.round : `${examWithLevel.round}회`} 한국사능력검정시험
                           </span>
                           {index < 3 && examWithLevel.isVisible !== false && (
                             <span className="text-[9px] bg-yellow-400 text-black px-1 font-black uppercase rounded-xs">최신</span>
                           )}
                        </div>
                        <div className="col-span-2 p-3 flex justify-center border-r border-[#F0F0F0]">
                          <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold border ${
                            examWithLevel.displayLevel === '심화' 
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {examWithLevel.displayLevel}
                          </span>
                        </div>
                        <div className="col-span-1.5 p-3 text-center text-slate-500 font-mono text-[10px]">
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
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 rounded-none text-red-500 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`'${examWithLevel.round} ${examWithLevel.displayLevel}' 의 모든 데이터가 삭제됩니다. 정말 삭제하시겠습니까?`)) {
                                handleDeleteExam(examWithLevel.id);
                              }
                            }}
                          >
                            <Plus className="w-3 h-3 rotate-45" />
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
                  <span className="text-[14px] font-bold tracking-tight">
                    {(() => {
                      const exam = exams.find(e => e.id === selectedExamId);
                      if (!exam) return "회차 선택됨";
                      return (exam.round.includes('회') ? exam.round : `${exam.round}회`) + " 한국사능력검정시험";
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
                        return exam.round.includes('회') ? exam.round : `${exam.round}회`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {visibleExams.length > 0 ? (
                      visibleExams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.round.includes('회') ? exam.round : `${exam.round}회`} 한국사능력검정시험
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-[10px] text-slate-500 text-center italic">노출 설정된 회차가 없습니다</div>
                    )}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)} className="h-9 px-3 rounded-none border-[#141414] text-[11px] font-bold gap-1.5 flex items-center bg-white hover:bg-slate-50">
                  <Plus className="w-3.5 h-3.5" />
                  <span>기출회차 추가</span>
                </Button>
                {selectedExamId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-3 rounded-none text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] font-bold"
                    onClick={() => {
                      if (confirm('해당 회차와 포함된 모든 데이터가 삭제됩니다. 계속하시겠습니까?')) {
                        handleDeleteExam(selectedExamId);
                      }
                    }}
                  >
                    회차 삭제
                  </Button>
                )}
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
              <Button variant="outline" className="h-9 rounded-none border-[#141414] text-xs font-bold" onClick={seedDummyData}>더미 데이터 생성</Button>
              <Button variant="outline" className="h-9 rounded-none border-[#141414] text-xs font-bold gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> 엑셀 업로드
              </Button>
              <Button variant="outline" className="h-9 rounded-none border-[#141414] text-xs font-bold gap-2" onClick={downloadExcelTemplate}>
                <Download className="w-3.5 h-3.5" /> 양식 다운로드
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-6">
            <main className="grid grid-cols-12 gap-4 p-1 pb-20 min-h-[1200px]">
                {/* Left Pane: Question List */}
                <Card className="col-span-5 flex flex-col rounded-none border-[#D1D1CF] shadow-none bg-white min-h-[760px]">
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
                <TabsList className="flex p-0 h-12 bg-transparent rounded-none border-b border-[#D1D1CF] gap-2 px-4 whitespace-nowrap shrink-0">
                  <TabsTrigger value="general" className="h-full rounded-none border-x border-t border-transparent data-[state=active]:bg-white data-[state=active]:border-[#D1D1CF] data-[state=active]:border-b-white -mb-[1px] px-6 text-sm font-bold">일반 (Basic)</TabsTrigger>
                  <TabsTrigger value="advanced" className="h-full rounded-none border-x border-t border-transparent data-[state=active]:bg-white data-[state=active]:border-[#D1D1CF] data-[state=active]:border-b-white -mb-[1px] px-6 text-sm font-bold">심화 (Advanced)</TabsTrigger>
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
                          <div className="col-span-2 p-2.5 flex justify-end">
                            <Button variant="outline" size="sm" className="h-7 text-xs rounded-none border-[#141414] px-2">
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
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-none border-[#141414] text-[10px] font-bold px-3"
                      onClick={() => setIsPreviewDialogOpen(true)}
                    >
                      미리보기
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-none border-[#141414] text-[10px] font-bold bg-slate-800 text-white hover:bg-slate-700 px-3"
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
                          className={`w-8 h-8 rounded-none border-[#141414] text-[11px] font-bold ${currentPage === page ? 'bg-[#141414] text-white' : 'bg-white'}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  <Button size="sm" className="h-8 rounded-none bg-[#141414] text-white text-[10px] font-bold px-4">기출문제 게시</Button>
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => seedSingleDummy(selectedQuestion.number)}
                      className="h-7 rounded-none border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-[10px] font-bold px-3 gap-1.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      예시 데이터 생성
                    </Button>
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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] font-bold">시대</Label>
                      <Select 
                        value={selectedQuestion?.era || ""} 
                        onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, era: v} : null)}
                      >
                        <SelectTrigger className="w-[90px] h-7 rounded-none border-[#D1D1CF] bg-white text-[11px]">
                          <SelectValue placeholder="선택">
                            {selectedQuestion?.era || ""}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          {ERAS.map(era => <SelectItem key={era} value={era}>{era}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] font-bold">난이도</Label>
                      <Select 
                        value={selectedQuestion?.difficulty || ""} 
                        onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, difficulty: v as any} : null)}
                      >
                        <SelectTrigger className="w-[70px] h-7 rounded-none border-[#D1D1CF] bg-white text-[11px]">
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
                            <div className="space-y-1">
                        <Label className="text-[11px] font-bold">문항제목</Label>
                        <Input 
                          className="rounded-none border-[#D1D1CF] h-8 text-sm" 
                          value={selectedQuestion.title}
                          onChange={(e) => setSelectedQuestion({...selectedQuestion, title: e.target.value})}
                          placeholder="(가) 인물의 활동으로 옳은 것은? (2점)" 
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

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold">문항내용 (이미지 등록)</Label>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="이미지 경로를 입력하세요" 
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
                              찾아보기
                            </Button>
                          </div>
                        </div>
                        <div className="h-[160px] overflow-auto bg-[#EEE] rounded-none border border-[#D1D1CF] flex flex-col items-center justify-start text-slate-400 relative border-dashed p-2">
                          {selectedQuestion.imageUrl ? (
                            <img 
                              src={selectedQuestion.imageUrl} 
                              alt="Question" 
                              className="max-w-full h-auto"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-[11px] text-[#999]">[이미지 없음]</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label className="text-[11px] font-bold">선다형 문항 입력 (1~5번)</Label>
                        <div className="space-y-2">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <div key={`choice-input-${num}`} className="flex gap-2 items-center">
                              <div 
                                onClick={() => setSelectedQuestion({...selectedQuestion, answer: num})}
                                className={`w-8 h-8 flex items-center justify-center cursor-pointer border-2 transition-all ${
                                  selectedQuestion.answer === num 
                                  ? 'bg-[#141414] border-[#141414] text-white' 
                                  : 'bg-white border-[#D1D1CF] text-[#999] hover:border-[#141414]'
                                }`}
                              >
                                {selectedQuestion.answer === num ? <Check className="w-4 h-4" /> : <span className="text-[11px] font-bold">{num}</span>}
                              </div>
                              <Input 
                                className="flex-1 rounded-none border-[#D1D1CF] h-8 text-sm bg-white" 
                                placeholder={`${num}번 선택지 내용을 입력하세요`}
                                value={selectedQuestion.options?.[num-1] || ''}
                                onChange={(e) => {
                                  const newOptions = [...(selectedQuestion.options || ['', '', '', '', ''])];
                                  newOptions[num-1] = e.target.value;
                                  setSelectedQuestion({...selectedQuestion, options: newOptions});
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
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
                          <Label className="text-[11px] font-bold">정답률</Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm" 
                              value={selectedQuestion.correctRate}
                              onChange={(e) => setSelectedQuestion({...selectedQuestion, correctRate: parseInt(e.target.value)})}
                            />
                            <span className="text-sm font-bold">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold">문제유형</Label>
                        <Select 
                          value={selectedQuestion?.category || ""} 
                          onValueChange={(v) => setSelectedQuestion(prev => prev ? {...prev, category: v} : null)}
                        >
                          <SelectTrigger className="rounded-none border-[#D1D1CF] h-8 bg-white text-sm">
                            <SelectValue>
                              {selectedQuestion?.category || ""}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            <SelectItem value="역사지식 이해">역사지식 이해</SelectItem>
                            <SelectItem value="사료 분석 및 해석">사료 분석 및 해석</SelectItem>
                            <SelectItem value="역사 상황 파악">역사 상황 파악</SelectItem>
                            <SelectItem value="역사 탐구 설계 및 수행">역사 탐구 설계 및 수행</SelectItem>
                            <SelectItem value="역사적 상상력 및 추론">역사적 상상력 및 추론</SelectItem>
                            <SelectItem value="역사적 가치 판단 및 태도">역사적 가치 판단 및 태도</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold">문제해설</Label>
                        <Textarea 
                          className="min-h-[80px] rounded-none border-[#D1D1CF] bg-white text-sm leading-relaxed" 
                          placeholder="문제에 대한 상세 해설을 입력하세요..."
                          value={selectedQuestion.explanation}
                          onChange={(e) => setSelectedQuestion({...selectedQuestion, explanation: e.target.value})}
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
            />
          ) : (
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
    </div>
  );
}
