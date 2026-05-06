import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Award, 
  Target, 
  BookOpen, 
  ChevronDown, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Activity, 
  Search, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Loader2,
  Image
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Exam, Question } from '../types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auth } from '../lib/firebase';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// StatsPage Component
interface StatsPageProps {
  exams: Exam[];
  selectedExamId: string;
  questions: Question[];
  onExamChange: (id: string) => void;
  onSelectQuestion?: (question: Question) => void;
}

const COLORS = ['#1E293B', '#D4AF37', '#94A3B8', '#E2E8F0', '#475569'];
const FIELDS = ['정치', '경제', '사회', '문화', '기타'];
const QUESTION_TYPES = [
  '역사지식 이해',
  '사료 분석 및 해석',
  '역사 상황 파악',
  '역사 탐구 설계 및 수행',
  '역사적 상상력 및 추론',
  '역사적 가치 판단 및 태도'
];

// Deterministic random generator based on string seed
const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
};

export const StatsPage: React.FC<StatsPageProps> = ({ exams, selectedExamId, questions, onExamChange, onSelectQuestion }) => {
  const eras = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
  const categories = QUESTION_TYPES;
  const fields = FIELDS;
  const difficulties = ['상', '중', '하'];
  const scores = [1, 2, 3];

  const roundNumbers = useMemo(() => {
    return Array.from(new Set(exams.map(e => parseInt(e.round.replace(/[^0-9]/g, '')) || 0)))
      .sort((a: number, b: number) => a - b);
  }, [exams]);

  const gapOptions = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => -50 + i * 5);
  }, []);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchGrade, setSearchGrade] = useState<string>('전체');
  const [searchEra, setSearchEra] = useState<string[]>([]);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentExam = useMemo(() => {
    return exams.find(e => e.id === (selectedQuestion?.examId || selectedExamId));
  }, [exams, selectedExamId, selectedQuestion]);

  const handleQuestionClick = (q: Question) => {
    setSelectedQuestion(q);
    setIsQuestionDialogOpen(true);
  };
  const [searchCategory, setSearchCategory] = useState<string[]>([]);
  const [searchField, setSearchField] = useState<string[]>([]);
  const [searchDifficulty, setSearchDifficulty] = useState<string[]>([]);
  const [searchScore, setSearchScore] = useState<number[]>([]);
  const [searchRoundFrom, setSearchRoundFrom] = useState<string>('전체');
  const [searchRoundTo, setSearchRoundTo] = useState<string>('전체');
  const [searchGap, setSearchGap] = useState<string>('전체');
  
  const [sortConfig, setSortConfig] = useState<{ key: 'correctRate' | 'gap' | null, direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
  
  const [showDetails, setShowDetails] = useState(false);

  // 실제 검색에 적용될 상태
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    grade: '전체',
    era: [] as string[],
    category: [] as string[],
    field: [] as string[],
    difficulty: [] as string[],
    score: [] as number[],
    roundFrom: '전체',
    roundTo: '전체',
    gap: '전체'
  });

  const handleSearch = () => {
    setAppliedFilters({
      keyword: searchKeyword,
      grade: searchGrade,
      era: searchEra,
      category: searchCategory,
      field: searchField,
      difficulty: searchDifficulty,
      score: searchScore,
      roundFrom: searchRoundFrom,
      roundTo: searchRoundTo,
      gap: searchGap
    });
    setShowDetails(true);
  };

  const handleReset = () => {
    setSearchKeyword('');
    setSearchGrade('전체');
    setSearchEra([]);
    setSearchCategory([]);
    setSearchField([]);
    setSearchDifficulty([]);
    setSearchScore([]);
    setSearchRoundFrom('전체');
    setSearchRoundTo('전체');
    setSearchGap('전체');
    setAppliedFilters({
      keyword: '',
      grade: '전체',
      era: [],
      category: [],
      field: [],
      difficulty: [],
      score: [],
      roundFrom: '전체',
      roundTo: '전체',
      gap: '전체'
    });
  };

  const handleDownloadExcel = () => {
    if (displayQuestions.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }
    setIsDownloading(true);
    try {
      const excelData = displayQuestions.map(q => {
        const expected = 75 + (q.number % 10) - (q.difficulty === '상' ? 15 : q.difficulty === '하' ? -10 : 0);
        const actualGap = q.correctRate - expected;
        const qExam = exams.find(e => e.id === q.examId);
        
        return {
          "회차": qExam ? qExam.round.replace(/[^0-9]/g, '') : '-',
          "번호": q.number,
          "급수": q.type === 'advanced' ? '심화' : '기본',
          "시대": q.era,
          "문항 제목": q.title,
          "예상 정답률": `${expected}%`,
          "실제 정답률": `${q.correctRate}%`,
          "평정 간극": `${actualGap > 0 ? '+' : ''}${actualGap}%`,
          "유형": q.category,
          "난이도": q.difficulty,
          "배점": q.score
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "문항 통계");

      // Set column widths
      const wscols = [
        {wch: 8},  // 회차
        {wch: 8},  // 번호
        {wch: 8},  // 급수
        {wch: 10}, // 시대
        {wch: 40}, // 문항 제목
        {wch: 12}, // 예상 정답률
        {wch: 12}, // 실제 정답률
        {wch: 10}, // 평정 간극
        {wch: 25}, // 유형
        {wch: 8},  // 난이도
        {wch: 8}   // 배점
      ];
      worksheet['!cols'] = wscols;

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `한능검_문항통계_${date}.xlsx`);
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Round check
      const qExam = exams.find(e => e.id === q.examId);
      const qRound = qExam ? parseInt(qExam.round.replace(/[^0-9]/g, '')) || 0 : 0;
      
      const fromRound = appliedFilters.roundFrom === '전체' ? 0 : parseInt(appliedFilters.roundFrom);
      const toRound = appliedFilters.roundTo === '전체' ? 999 : parseInt(appliedFilters.roundTo);
      
      if (qRound < fromRound || qRound > toRound) return false;

      const matchKeyword = !appliedFilters.keyword || 
        q.title.toLowerCase().includes(appliedFilters.keyword.toLowerCase()) || 
        q.keywords.some(k => k.toLowerCase().includes(appliedFilters.keyword.toLowerCase()));
      
      const matchGrade = appliedFilters.grade === '전체' || q.type === appliedFilters.grade;
      const matchEra = appliedFilters.era.length === 0 || appliedFilters.era.includes(q.era);
      const matchCategory = appliedFilters.category.length === 0 || appliedFilters.category.includes(q.category);
      const matchField = appliedFilters.field.length === 0 || (q.field && appliedFilters.field.includes(q.field));
      const matchDifficulty = appliedFilters.difficulty.length === 0 || appliedFilters.difficulty.includes(q.difficulty);
      const matchScore = appliedFilters.score.length === 0 || appliedFilters.score.includes(q.score);
      
      // Gap check (Actual - Expected)
      // Since expected is mock in this view, let's assume it's roughly 70 or use simulated data
      let matchGap = true;
      if (appliedFilters.gap !== '전체') {
        const gapThreshold = parseInt(appliedFilters.gap);
        // We simulate expectedCorrectRate if not present
        const expected = 75 + (q.number % 10) - (q.difficulty === '상' ? 15 : q.difficulty === '하' ? -10 : 0);
        const actualGap = q.correctRate - expected;
        
        if (gapThreshold >= 0) {
          matchGap = actualGap >= gapThreshold;
        } else {
          matchGap = actualGap <= gapThreshold;
        }
      }

      return matchKeyword && matchGrade && matchEra && matchCategory && matchField && matchDifficulty && matchScore && matchGap;
    });
  }, [questions, appliedFilters, exams]);

  const displayQuestions = useMemo(() => {
    let result = [...filteredQuestions];
    
    if (sortConfig.direction && sortConfig.key) {
      result.sort((a, b) => {
        const getVal = (q: Question) => {
          if (sortConfig.key === 'correctRate') return q.correctRate;
          if (sortConfig.key === 'gap') {
            const expected = 75 + (q.number % 10) - (q.difficulty === '상' ? 15 : q.difficulty === '하' ? -10 : 0);
            return q.correctRate - expected;
          }
          return 0;
        };
        
        const valA = getVal(a);
        const valB = getVal(b);
        
        if (sortConfig.direction === 'asc') return valA - valB;
        return valB - valA;
      });
    }
    
    return result;
  }, [filteredQuestions, sortConfig]);

  const statsData = useMemo(() => {
    // We use filteredQuestions for the dashboard to reflect the current search/filter state
    if (filteredQuestions.length === 0) {
      return { 
        eraData: [], 
        typeData: [], 
        difficultyDistribution: [], 
        scoreDistribution: [], 
        diffCorrData: [], 
        avgCorrect: 0, 
        avgDifficulty: '0.0', 
        avgExpectedDifficulty: '0.0', 
        avgDiscrimination: '0.00' 
      };
    }
    
    const eraData = eras.map((era, idx) => {
      const eraQuestions = filteredQuestions.filter(q => q.era === era);
      
      // Use stable seed for dummy data based on era name
      const rng = seededRandom(`${selectedExamId}-${era}`);
      
      const expected = eraQuestions.length > 0 
        ? Math.round(eraQuestions.reduce((acc, curr) => {
            return acc + (75 + (curr.number % 10) - (curr.difficulty === '상' ? 15 : curr.difficulty === '하' ? -10 : 0));
          }, 0) / eraQuestions.length)
        : 70;

      // Dummy Actual Accuracy: Similar logic to typeData
      const noise = Math.round((rng() - 0.5) * 40); // +/- 20% noise
      const actual = Math.max(10, Math.min(95, expected + noise));
      const gap = actual - expected;

      return {
        name: era,
        '채점정답률': actual,
        '예상정답률': expected,
        '간극': gap,
        '오답률': Math.max(0, 100 - actual),
        '변별력': eraQuestions.length > 0 ? parseFloat((0.4 + rng() * 0.4).toFixed(2)) : 0.45
      };
    }).filter(d => d['채점정답률'] > 0 || d['오답률'] > 0);

    const types = Array.from(new Set(filteredQuestions.map(q => q.category))).filter(Boolean);
    const typeData = types.map((type, idx) => {
      const typeQuestions = filteredQuestions.filter(q => q.category === type);
      
      // Use stable seed for dummy data based on type name to avoid jittering
      const rng = seededRandom(`${selectedExamId}-${type}`);
      
      // Predicted accuracy: Based on actual question logic, or 65 as fallback
      const expected = typeQuestions.length > 0 
        ? Math.round(typeQuestions.reduce((acc, curr) => {
            return acc + (75 + (curr.number % 10) - (curr.difficulty === '상' ? 15 : curr.difficulty === '하' ? -10 : 0));
          }, 0) / typeQuestions.length)
        : 65;

      // Dummy Actual Accuracy: Generate a value that significantly deviates from expected to show the gap
      // Spread it around the expected value with meaningful noise
      const noise = Math.round((rng() - 0.5) * 50); // +/- 25% noise
      const actual = Math.max(10, Math.min(95, expected + noise));
      
      const gap = actual - expected;

      return {
        name: type,
        '채점정답률': actual,
        '예상정답률': expected,
        '간극': gap,
        '실제난이도': typeQuestions.length > 0 
          ? parseFloat((typeQuestions.reduce((acc, curr) => {
              const diffMap: {[key: string]: number} = { '상': 5, '중': 3, '하': 1 };
              return acc + (diffMap[curr.difficulty] || 3);
            }, 0) / typeQuestions.length).toFixed(1))
          : 3.0,
        '예상난이도': parseFloat((2 + rng() * 2).toFixed(1))
      };
    });

    const difficultyDistribution = ['상', '중', '하'].map(diff => ({
      name: diff,
      value: filteredQuestions.filter(q => q.difficulty === diff).length
    }));

    const scoreDistribution = Array.from(new Set(filteredQuestions.map(q => q.score))).sort().map(score => ({
      name: `${score}점`,
      value: filteredQuestions.filter(q => q.score === score).length
    }));

    const diffCorrData = ['상', '중', '하'].map(diff => {
      const diffQs = filteredQuestions.filter(q => q.difficulty === diff);
      const avg = diffQs.length > 0 
        ? Math.round(diffQs.reduce((acc, curr) => acc + curr.correctRate, 0) / diffQs.length) 
        : 0;
      return { name: diff, '평균정답률': avg };
    });

    const avgCorrect = Math.round(filteredQuestions.reduce((acc, curr) => acc + curr.correctRate, 0) / filteredQuestions.length);
    const avgDifficulty = (filteredQuestions.reduce((acc, curr) => {
      const diffMap: {[key: string]: number} = { '상': 5, '중': 3, '하': 1 };
      return acc + (diffMap[curr.difficulty] || 3);
    }, 0) / filteredQuestions.length).toFixed(1);

    return { 
      eraData, 
      typeData, 
      difficultyDistribution, 
      scoreDistribution, 
      diffCorrData, 
      avgCorrect, 
      avgDifficulty, 
      avgExpectedDifficulty: '3.2', 
      avgDiscrimination: '0.45' 
    };
  }, [filteredQuestions, eras]);

  const filteredStats = useMemo(() => {
    if (filteredQuestions.length === 0) return null;

    const difficultyDist = ['상', '중', '하'].map(diff => ({
      name: diff,
      value: filteredQuestions.filter(q => q.difficulty === diff).length
    }));

    const eraGapData = eras.map((era) => {
      const eraQuestions = filteredQuestions.filter(q => q.era === era);
      if (eraQuestions.length === 0) return null;
      
      const avgActual = Math.round(eraQuestions.reduce((acc, curr) => acc + curr.correctRate, 0) / eraQuestions.length);
      const avgExpected = Math.round(eraQuestions.reduce((acc, curr) => {
        return acc + (75 + (curr.number % 10) - (curr.difficulty === '상' ? 15 : curr.difficulty === '하' ? -10 : 0));
      }, 0) / eraQuestions.length);
      
      return {
        name: era,
        actual: avgActual,
        expected: avgExpected,
        gap: avgActual - avgExpected
      };
    }).filter(Boolean) as { name: string, actual: number, expected: number, gap: number }[];

    const typeDist = categories.map(cat => ({
      name: cat,
      value: filteredQuestions.filter(q => q.category === cat).length
    })).filter(item => item.value > 0);

    const avgCorr = Math.round(filteredQuestions.reduce((acc, curr) => acc + curr.correctRate, 0) / filteredQuestions.length);

    return { difficultyDist, eraGapData, typeDist, avgCorr };
  }, [filteredQuestions, eras, categories]);

  return (
    <div className="flex-1 flex flex-col gap-0 h-full overflow-hidden pb-1">
      <div className="flex-1 overflow-y-auto pr-4">
        <div className="space-y-0 pb-1">
          {/* 조건 검색 영역 */}
          <Card className="rounded-none border-0 shadow-sm bg-white mt-0 mb-[8.25px] pb-[17px]">
            <CardHeader className="py-0.5 px-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[12px] font-black flex items-center gap-2 text-slate-700">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  문항 조건 검색 및 필터링
                </CardTitle>
                {showDetails && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowDetails(false)}
                    className="h-6 text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 px-3 border border-slate-200"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    대시보드로 돌아가기
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-1 px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1">
                
                {/* 1. 기출회차 기간 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">기출회차 기간</label>
                  <div className="flex items-center gap-2">
                    <Select value={searchRoundFrom} onValueChange={setSearchRoundFrom}>
                      <SelectTrigger className="h-7 rounded-none border-slate-200 text-[11px] bg-slate-50/30">
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-slate-200">
                        <SelectItem value="전체" className="text-[11px]">전체</SelectItem>
                        {roundNumbers.map(n => (
                          <SelectItem key={`from-${n}`} value={n.toString()} className="text-[11px]">{n}회</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-slate-300">~</span>
                    <Select value={searchRoundTo} onValueChange={setSearchRoundTo}>
                      <SelectTrigger className="h-7 rounded-none border-slate-200 text-[11px] bg-slate-50/30">
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-slate-200">
                        <SelectItem value="전체" className="text-[11px]">전체</SelectItem>
                        {roundNumbers.map(n => (
                          <SelectItem key={`to-${n}`} value={n.toString()} className="text-[11px]">{n}회</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 2. 급수 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">급수</label>
                  <Select value={searchGrade} onValueChange={setSearchGrade}>
                    <SelectTrigger className="h-7 rounded-none border-slate-200 text-[11px] bg-slate-50/30">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-slate-200">
                      <SelectItem value="전체" className="text-[11px]">전체</SelectItem>
                      <SelectItem value="advanced" className="text-[11px]">심화</SelectItem>
                      <SelectItem value="general" className="text-[11px]">기본</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. 정답률 평정 간극 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">정답률 평정 간극 (±%)</label>
                  <Select value={searchGap} onValueChange={setSearchGap}>
                    <SelectTrigger className="h-7 rounded-none border-slate-200 text-[11px] bg-slate-50/30">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-slate-200">
                      <SelectItem value="전체" className="text-[11px]">전체</SelectItem>
                      {gapOptions.map(gap => (
                        <SelectItem key={`gap-${gap}`} value={gap.toString()} className="text-[11px]">{gap > 0 ? `+${gap}` : gap}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. 시대 (Multi Select) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">시대</label>
                  <Popover>
                    <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full h-7 rounded-none border-slate-200 text-[11px] justify-between px-3 bg-slate-50/30")}>
                      <span className="truncate">{searchEra.length === 0 ? "전체" : `${searchEra[0]}${searchEra.length > 1 ? ` 외 ${searchEra.length - 1}` : ""}`}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-0 rounded-none shadow-xl border-slate-200" align="start">
                      <div className="h-48 overflow-y-auto">
                        <div className="p-2 space-y-0.5 bg-white">
                          <div className="flex items-center space-x-2 p-1 hover:bg-slate-50 cursor-pointer" onClick={() => searchEra.length === eras.length ? setSearchEra([]) : setSearchEra([...eras])}>
                            <Checkbox checked={searchEra.length === eras.length} className="w-3.5 h-3.5 rounded-none" />
                            <label className="text-[11px] font-bold">전체 선택</label>
                          </div>
                          <Separator className="my-1" />
                          {eras.map(era => (
                            <div key={era} className="flex items-center space-x-2 p-1 hover:bg-slate-100 cursor-pointer" onClick={() => searchEra.includes(era) ? setSearchEra(searchEra.filter(s => s !== era)) : setSearchEra([...searchEra, era])}>
                              <Checkbox checked={searchEra.includes(era)} className="w-3.5 h-3.5 rounded-none" />
                              <label className="text-[11px]">{era}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 5. 분야 (Multi Select) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">분야 (정치/경제...)</label>
                  <Popover>
                    <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full h-7 rounded-none border-slate-200 text-[11px] justify-between px-3 bg-slate-50/30")}>
                      <span className="truncate">{searchField.length === 0 ? "전체" : `${searchField[0]}${searchField.length > 1 ? ` 외 ${searchField.length - 1}` : ""}`}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-0 rounded-none shadow-xl border-slate-200" align="start">
                      <div className="h-48 overflow-y-auto">
                        <div className="p-2 space-y-0.5 bg-white">
                          <div className="flex items-center space-x-2 p-1 hover:bg-slate-50 cursor-pointer" onClick={() => searchField.length === fields.length ? setSearchField([]) : setSearchField([...fields])}>
                            <Checkbox checked={searchField.length === fields.length} className="w-3.5 h-3.5 rounded-none" />
                            <label className="text-[11px] font-bold">전체 선택</label>
                          </div>
                          <Separator className="my-1" />
                          {fields.map(f => (
                            <div key={f} className="flex items-center space-x-2 p-1 hover:bg-slate-100 cursor-pointer" onClick={() => searchField.includes(f) ? setSearchField(searchField.filter(s => s !== f)) : setSearchField([...searchField, f])}>
                              <Checkbox checked={searchField.includes(f)} className="w-3.5 h-3.5 rounded-none" />
                              <label className="text-[11px]">{f}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 6. 문제유형 (Multi Select) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">문제유형</label>
                  <Popover>
                    <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full h-7 rounded-none border-slate-200 text-[11px] justify-between px-3 bg-slate-50/30")}>
                      <span className="truncate">{searchCategory.length === 0 ? "전체" : `${searchCategory[0]}${searchCategory.length > 1 ? ` 외 ${searchCategory.length - 1}` : ""}`}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0 rounded-none shadow-xl border-slate-200" align="start">
                      <div className="h-56 overflow-y-auto">
                        <div className="p-2 space-y-0.5 bg-white">
                          <div className="flex items-center space-x-2 p-1 hover:bg-slate-50 cursor-pointer" onClick={() => searchCategory.length === categories.length ? setSearchCategory([]) : setSearchCategory([...categories])}>
                            <Checkbox checked={searchCategory.length === categories.length} className="w-3.5 h-3.5 rounded-none" />
                            <label className="text-[11px] font-bold">전체 선택</label>
                          </div>
                          <Separator className="my-1" />
                          {categories.map(cat => (
                            <div key={cat} className="flex items-center space-x-2 p-1 hover:bg-slate-100 cursor-pointer" onClick={() => searchCategory.includes(cat) ? setSearchCategory(searchCategory.filter(s => s !== cat)) : setSearchCategory([...searchCategory, cat])}>
                              <Checkbox checked={searchCategory.includes(cat)} className="w-3.5 h-3.5 rounded-none" />
                              <label className="text-[11px]">{cat}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 6. 난이도 (Multi Select) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">난이도</label>
                  <Popover>
                    <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full h-7 rounded-none border-slate-200 text-[11px] justify-between px-3 bg-slate-50/30")}>
                      <span className="truncate">{searchDifficulty.length === 0 ? "전체" : `${searchDifficulty.join(', ')}`}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[140px] p-0 rounded-none shadow-xl border-slate-200" align="start">
                      <div className="p-2 space-y-0.5 bg-white">
                        {difficulties.map(diff => (
                          <div key={diff} className="flex items-center space-x-2 p-1 hover:bg-slate-100 cursor-pointer" onClick={() => searchDifficulty.includes(diff) ? setSearchDifficulty(searchDifficulty.filter(s => s !== diff)) : setSearchDifficulty([...searchDifficulty, diff])}>
                            <Checkbox checked={searchDifficulty.includes(diff)} className="w-3.5 h-3.5 rounded-none" />
                            <label className="text-[11px]">{diff}</label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 7. 배점 (Multi Select) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">배점</label>
                  <Popover>
                    <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full h-7 rounded-none border-slate-200 text-[11px] justify-between px-3 bg-slate-50/30")}>
                      <span className="truncate">{searchScore.length === 0 ? "전체" : `${searchScore.join(', ')}점`}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[140px] p-0 rounded-none shadow-xl border-slate-200" align="start">
                      <div className="p-2 space-y-0.5 bg-white">
                        {scores.map(s => (
                          <div key={s} className="flex items-center space-x-2 p-1 hover:bg-slate-100 cursor-pointer" onClick={() => searchScore.includes(s) ? setSearchScore(searchScore.filter(val => val !== s)) : setSearchScore([...searchScore, s])}>
                            <Checkbox checked={searchScore.includes(s)} className="w-3.5 h-3.5 rounded-none" />
                            <label className="text-[11px]">{s}점</label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* 8. 단어 검색 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">단어 검색</label>
                  <div className="relative">
                    <Input 
                      placeholder="검색어 입력..." 
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="h-7 rounded-none border-slate-200 text-[11px] pl-8 bg-slate-50/30"
                    />
                    <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-400" />
                  </div>
                </div>

              </div>

              <div className="flex justify-end items-center gap-3 mt-1.5 pt-1 border-t border-slate-100">
                <Button 
                  variant="outline"
                  onClick={handleReset}
                  className="h-8 rounded-none border-slate-200 hover:bg-slate-50 px-6 text-[10px] font-bold text-slate-500"
                >
                  필터 초기화
                </Button>
                <Button 
                  onClick={handleSearch}
                  className="h-8 rounded-none bg-[#141414] hover:bg-indigo-600 text-white px-10 text-[10px] font-black shadow-[3px_3px_0_rgba(0,0,0,0.1)] transition-all"
                >
                  조건 검색 적용
                </Button>
              </div>
            </CardContent>
          </Card>

          {!showDetails ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-0.5">
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-auto py-1">
                  <CardHeader className="flex flex-row items-center justify-between pb-0 pt-0.5 px-4 space-y-0 text-indigo-600">
                    <CardTitle className="text-[9px] font-bold uppercase text-slate-500">예상 vs 실제 난이도</CardTitle>
                    <Target className="w-2.5 h-2.5 text-red-600" />
                  </CardHeader>
                  <CardContent className="px-4 pb-0.5">
                    <div className="flex items-baseline gap-2">
                       <div className="text-lg font-black leading-tight">Lvl {statsData.avgDifficulty}</div>
                       <div className="text-[10px] font-bold text-slate-400">/ 예상 {statsData.avgExpectedDifficulty}</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-auto py-1">
                  <CardHeader className="flex flex-row items-center justify-between pb-0 pt-0.5 px-4 space-y-0">
                    <CardTitle className="text-[9px] font-bold uppercase text-slate-500">전체 정답률</CardTitle>
                    <Award className="w-2.5 h-2.5 text-emerald-600" />
                  </CardHeader>
                  <CardContent className="px-4 pb-0.5">
                    <div className="text-lg font-black leading-tight">{statsData.avgCorrect}%</div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-auto py-1">
                  <CardHeader className="flex flex-row items-center justify-between pb-0 pt-0.5 px-4 space-y-0">
                    <CardTitle className="text-[9px] font-bold uppercase text-slate-500">평균 오답률</CardTitle>
                    <TrendingUp className="w-2.5 h-2.5 text-blue-600" />
                  </CardHeader>
                  <CardContent className="px-4 pb-0.5">
                    <div className="text-lg font-black leading-tight">{100 - statsData.avgCorrect}%</div>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-auto py-1">
                  <CardHeader className="flex flex-row items-center justify-between pb-0 pt-0.5 px-4 space-y-0">
                    <CardTitle className="text-[9px] font-bold uppercase text-slate-500">변별력 지수 (Avg)</CardTitle>
                    <BookOpen className="w-2.5 h-2.5 text-amber-600" />
                  </CardHeader>
                  <CardContent className="px-4 pb-0.5">
                    <div className="text-lg font-black leading-tight">{statsData.avgDiscrimination}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                <Card className="rounded-none border-0 bg-white shadow-sm mt-[5px] mb-[5px]">
                  <CardHeader className="border-b border-slate-100 mb-1 bg-slate-50/50 py-1 px-4 text-indigo-700">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-2">
                        시대별 변별력 및 정답률 분석
                      </CardTitle>
                      <span className="text-[9px] font-mono bg-[#141414] text-white px-2 py-0.5 rounded-none uppercase">Era</span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`era-container-${selectedExamId}`}>
                        <ComposedChart id={`era-stats-${selectedExamId}`} data={statsData.eraData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                          <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} id={`x-axis-era-${selectedExamId}`} />
                          <YAxis yAxisId="left" domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} unit="%" id={`y-axis-era-left-${selectedExamId}`} />
                          <YAxis yAxisId="right" orientation="right" domain={[-50, 50]} fontSize={10} tickLine={false} axisLine={false} id={`y-axis-era-right-${selectedExamId}`} hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '5px' }} verticalAlign="top" align="right" />
                          <Bar yAxisId="right" name="평정 간극" dataKey="간극" barSize={30} radius={[2, 2, 0, 0]}>
                            {statsData.eraData.map((entry, index) => (
                              <Cell key={`era-cell-${index}`} fill={entry.간극 >= 0 ? '#BFDBFE' : '#FECACA'} />
                            ))}
                          </Bar>
                          <Line yAxisId="left" name="채점 정답률" type="monotone" dataKey="채점정답률" stroke="#1E293B" strokeWidth={3} dot={{ fill: '#1E293B', r: 3 }} />
                          <Line yAxisId="left" name="예상 정답률" type="monotone" dataKey="예상정답률" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: '#94A3B8', r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-0 bg-white shadow-sm ml-0 mr-0 mt-[5px] mb-[5px]">
                  <CardHeader className="border-b border-slate-100 mb-1 bg-slate-50/50 py-1 px-4 text-indigo-700">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-2">
                        유형별 정답률 및 평정 간극 분석
                      </CardTitle>
                      <span className="text-[9px] font-mono bg-[#D4AF37] text-[#141414] px-2 py-0.5 rounded-none uppercase">Category</span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-2">
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`type-container-${selectedExamId}`}>
                        <ComposedChart id={`type-stats-${selectedExamId}`} data={statsData.typeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                          <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} id={`x-axis-type-${selectedExamId}`} interval={0} tick={({x, y, payload}) => (
                            <text x={x} y={y} fontSize={8} textAnchor="middle" fill="#666" dy={10} width={60}>
                              {payload.value.length > 8 ? `${payload.value.substring(0, 7)}..` : payload.value}
                            </text>
                          )}/>
                          <YAxis yAxisId="left" domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} unit="%" id={`y-axis-type-left-${selectedExamId}`} />
                          <YAxis yAxisId="right" orientation="right" domain={[-50, 50]} fontSize={10} tickLine={false} axisLine={false} id={`y-axis-type-right-${selectedExamId}`} hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                            formatter={(value: any, name: string) => [
                              `${value}${name !== '실제난이도' && name !== '예상난이도' ? '%' : ''}`, 
                              name
                            ]}
                          />
                          <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '5px' }} verticalAlign="top" align="right" />
                          <Bar yAxisId="right" name="평정 간극" dataKey="간극" barSize={30} radius={[2, 2, 0, 0]}>
                            {statsData.typeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.간극 >= 0 ? '#BFDBFE' : '#FECACA'} />
                            ))}
                          </Bar>
                          <Line yAxisId="left" name="채점 정답률" type="monotone" dataKey="채점정답률" stroke="#1E293B" strokeWidth={3} dot={{ fill: '#1E293B', r: 3 }} activeDot={{ r: 5 }} />
                          <Line yAxisId="left" name="예상 정답률" type="monotone" dataKey="예상정답률" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: '#94A3B8', r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-1 px-4 text-indigo-700">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                        난이도 통합 분석
                      </CardTitle>
                      <div className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">Integration</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-1 pb-2 space-y-2 px-4 text-slate-900">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-[120px]">
                        <p className="text-[9px] font-bold text-center mb-0 text-slate-500 uppercase tracking-tighter">난이도 구성비</p>
                        <ResponsiveContainer width="100%" height="100%" key={`pie-container-${selectedExamId}`}>
                          <PieChart id={`pie-stats-${selectedExamId}`}>
                            <Pie
                              data={statsData.difficultyDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {statsData.difficultyDistribution.map((entry, index) => (
                                <Cell key={`cell-${selectedExamId}-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-2 mt-1">
                          {statsData.difficultyDistribution.map((entry, i) => (
                            <div key={`legend-${selectedExamId}-${entry.name}-${i}`} className="flex items-center gap-1">
                              <div className="w-2 h-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-[9px] font-bold">{entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="h-[120px]">
                        <p className="text-[9px] font-bold text-center mb-0 text-slate-500 uppercase tracking-tighter">그룹별 정답률</p>
                        <ResponsiveContainer width="100%" height="100%" key={`corr-container-${selectedExamId}`}>
                          <ComposedChart id={`composed-stats-${selectedExamId}`} data={statsData.diffCorrData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} id={`x-axis-corr-${selectedExamId}`} />
                            <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" id={`y-axis-corr-${selectedExamId}`} />
                            <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '0' }} />
                            <Bar dataKey="평균정답률" barSize={15} fill="#1E293B" />
                            <Area type="monotone" dataKey="평균정답률" fill="#D4AF37" fillOpacity={0.1} stroke="#D4AF37" strokeWidth={1} />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div className="mt-1 text-[8px] text-slate-400 text-center italic font-medium">
                          * 난이도-성취도 상관 지표
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-1 px-4 text-indigo-700">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-bold flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-indigo-500" />
                        균형적 난이도 분석
                      </CardTitle>
                      <div className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">Radar</div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-center pt-0 pb-1 px-4">
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`radar-container-${selectedExamId}`}>
                        <RadarChart id={`radar-stats-${selectedExamId}`} cx="50%" cy="50%" outerRadius="70%" data={statsData.typeData}>
                          <PolarGrid stroke="#E2E8F0" />
                          <PolarAngleAxis dataKey="name" fontSize={9} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} fontSize={8} />
                          <Radar
                            name="실제 난이도"
                            dataKey="실제난이도"
                            stroke="#1E293B"
                            fill="#1E293B"
                            fillOpacity={0.4}
                          />
                          <Radar
                            name="예상 난이도"
                            dataKey="예상난이도"
                            stroke="#D4AF37"
                            fill="#D4AF37"
                            fillOpacity={0.3}
                          />
                          <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '0' }} />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <>
              {/* 문항 정보 조회 결과 영역 (상세 보기 모드) */}
              <Card className="rounded-none border-0 bg-white shadow-sm mt-2 mb-10 overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      문항 정보 상세 조회 ({filteredQuestions.length}건)
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleDownloadExcel}
                        disabled={isDownloading}
                        className="h-7 text-[10px] font-bold border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1.5 min-w-[100px]"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            준비 중...
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="w-3 h-3" />
                            엑셀 다운로드
                          </>
                        )}
                      </Button>
                      <div className="text-[10px] text-slate-400 font-mono tracking-tighter italic">
                        * 검색 결과가 아래에 표시됩니다.
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setShowDetails(false)}
                        className="h-7 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        대시보드로 돌아가기
                      </Button>
                    </div>
                  </div>
                </CardHeader>
            <CardContent className="p-0">
              <div className="border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[600px] rounded-none">
                
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-[11px] table-fixed">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#f8f9fa] border-b border-slate-200 shadow-sm">
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12 font-black text-slate-500 uppercase tracking-tighter">회차</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12 font-black text-slate-500 uppercase tracking-tighter">번호</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-16 font-black text-slate-500 uppercase tracking-tighter">급수</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-16 font-black text-slate-500 uppercase tracking-tighter">시대</th>
                        <th className="py-2.5 px-4 text-left border-r border-slate-200 w-auto font-black text-slate-500 uppercase tracking-tighter">문항 제목</th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-24 font-black text-slate-400 uppercase tracking-tighter italic">예상 정답률</th>
                        <th 
                          className="py-2.5 px-3 text-center border-r border-slate-200 w-24 font-black text-slate-500 uppercase tracking-tighter cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => {
                            let dir: 'asc' | 'desc' | null = 'desc';
                            if (sortConfig.key === 'correctRate') {
                              if (sortConfig.direction === 'desc') dir = 'asc';
                              else if (sortConfig.direction === 'asc') dir = null;
                            }
                            setSortConfig({ key: 'correctRate', direction: dir });
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            실제 정답률
                            {sortConfig.key === 'correctRate' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                            ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                          </div>
                        </th>
                        <th 
                          className="py-2.5 px-3 text-center border-r border-slate-200 w-28 font-black text-slate-500 uppercase tracking-tighter cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => {
                            let dir: 'asc' | 'desc' | null = 'desc';
                            if (sortConfig.key === 'gap') {
                              if (sortConfig.direction === 'desc') dir = 'asc';
                              else if (sortConfig.direction === 'asc') dir = null;
                            }
                            setSortConfig({ key: 'gap', direction: dir });
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            평정 간극
                            {sortConfig.key === 'gap' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                            ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200 w-32 font-black text-slate-500 uppercase tracking-tighter">유형</th>
                        <th className="py-2.5 px-2 text-center border-r border-slate-200 w-16 font-black text-slate-500 uppercase tracking-tighter">난이도</th>
                        <th className="py-2.5 px-2 text-center w-14 font-black text-slate-500 uppercase tracking-tighter">배점</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayQuestions.length > 0 ? (
                        displayQuestions.map((q, idx) => {
                          const expected = 75 + (q.number % 10) - (q.difficulty === '상' ? 15 : q.difficulty === '하' ? -10 : 0);
                          const gap = q.correctRate - expected;
                          const qExam = exams.find(e => e.id === q.examId);
                          const round = qExam ? qExam.round.replace(/[^0-9]/g, '') : '-';
                          
                          return (
                            <tr key={q.id || `stats-q-${q.number}-${idx}`} className="hover:bg-indigo-50/30 even:bg-slate-50/20 group transition-colors">
                              <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-500">
                                {round}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center font-mono text-slate-400">
                                {String(q.number).padStart(2, '0')}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center">
                                <span className={`text-[10px] font-black ${q.type === 'advanced' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                  {q.type === 'advanced' ? '심화' : '기본'}
                                </span>
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center">
                                <span className="text-[10px] font-bold text-slate-600">{q.era}</span>
                              </td>
                              <td 
                                className="py-2 px-4 border-r border-slate-100 truncate font-medium cursor-pointer group-hover:text-indigo-600 group-hover:underline transition-colors text-slate-700" 
                                title={q.title}
                                onClick={() => handleQuestionClick(q)}
                              >
                                {q.title}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-400 bg-slate-50/10 italic">
                                {expected}%
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center font-black text-indigo-600 bg-indigo-50/10">
                                {q.correctRate}%
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-center uppercase">
                                <span className={cn(
                                  "text-[10px] font-black",
                                  gap > 0 ? "text-emerald-500" : gap < 0 ? "text-rose-500" : "text-slate-400"
                                )}>
                                  {gap > 0 ? `+${gap}` : gap}%
                                </span>
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 text-[10px] text-slate-500 truncate text-center">
                                {q.category}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-100 text-center">
                                <span className={cn(
                                  "text-[10px] font-black px-1.5 py-0.5 rounded-none",
                                  q.difficulty === '상' ? 'bg-red-50 text-red-500' : q.difficulty === '중' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                                )}>
                                  {q.difficulty}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-600">{q.score}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={11} className="py-20 text-center text-slate-400 italic">
                            조회 조건에 일치하는 데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                  <div className="flex gap-4 items-center">
                    <span className="font-bold text-slate-400">데이터 요약:</span>
                    <span>Total {displayQuestions.length} Items</span>
                    <Separator orientation="vertical" className="h-3 bg-slate-200" />
                    <span>Selected Page 1</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-6 w-16 rounded-none text-[10px] font-bold border-slate-200 bg-white">이전</Button>
                    <Button variant="outline" size="sm" className="h-6 w-16 rounded-none text-[10px] font-bold border-slate-200 bg-white">다음</Button>
                  </div>
                </div>
              </div>
            </CardContent>
              </Card>

              {/* 검색 결과 통계 요약 (필터링된 데이터 기반) */}
              {filteredStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-2 px-4">
                      <CardTitle className="text-[10px] font-bold flex items-center gap-2">
                        <PieChartIcon className="w-3 h-3 text-indigo-500" />
                        결과 내 난이도 분포
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center">
                      <div className="h-[140px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart id="filter-diff-pie">
                            <Pie
                              data={filteredStats.difficultyDist}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={50}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {filteredStats.difficultyDist.map((entry, index) => (
                                <Cell key={`f-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-3 mt-2">
                        {filteredStats.difficultyDist.map((entry, i) => (
                          <div key={`f-leg-${i}`} className="flex items-center gap-1">
                            <div className="w-2 h-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-[9px] font-bold">{entry.name}: {entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-2 px-4">
                      <CardTitle className="text-[10px] font-bold flex items-center gap-2">
                        <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                        결과 내 시대별 평정 간극
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="h-[160px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={filteredStats.eraGapData} margin={{ left: -10, right: 10, top: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 100]} fontSize={9} tickLine={false} axisLine={false} hide />
                            <YAxis yAxisId="gap" domain={[-40, 40]} hide />
                            <Tooltip 
                              contentStyle={{ fontSize: '10px', borderRadius: '0' }}
                              formatter={(value: any, name: string) => [`${value}%`, name === 'gap' ? '평정 간극' : name === 'actual' ? '실제 정답률' : '예상 정답률']}
                            />
                            <Bar yAxisId="gap" dataKey="gap" barSize={20}>
                              {filteredStats.eraGapData.map((entry, index) => (
                                <Cell key={`f-era-cell-${index}`} fill={entry.gap >= 0 ? '#BFDBFE' : '#FECACA'} />
                              ))}
                            </Bar>
                            <Line type="monotone" dataKey="actual" stroke="#1E293B" strokeWidth={2} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="expected" stroke="#94A3B8" strokeWidth={1} strokeDasharray="3 3" dot={{ r: 1 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-1">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-[#BFDBFE]" />
                          <span className="text-[8px] text-slate-500">양의 간극</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-[#FECACA]" />
                          <span className="text-[8px] text-slate-500">음의 간극</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-2 px-4">
                      <CardTitle className="text-[10px] font-bold flex items-center gap-2">
                        <Activity className="w-3 h-3 text-indigo-500" />
                        결과 요약 지표
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="text-[10px] text-slate-500">평균 정답률</span>
                          <span className="text-lg font-black text-indigo-600">{filteredStats.avgCorr}%</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="text-[10px] text-slate-500">검색된 문항 수</span>
                          <span className="text-lg font-black">{filteredQuestions.length}건</span>
                        </div>
                        <div className="pt-2">
                          <p className="text-[9px] text-slate-400 italic">
                            * 설정한 검색 조건에 부합하는 {filteredQuestions.length}개 문항의 원시 데이터 분석 결과입니다.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="w-[1600px] max-w-[95vw] h-[1200px] max-h-[95vh] p-0 overflow-hidden flex flex-col rounded-none border-0 shadow-2xl">
          <DialogHeader className="bg-slate-900 text-white px-6 py-4 shrink-0 flex-row items-center justify-between space-y-0 relative">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-lg font-black tracking-tighter">문항 상세 정보</DialogTitle>
              <div className="h-4 w-px bg-slate-700" />
              <span className="text-xs font-medium text-slate-400">총 {displayQuestions.length}건 중 선택됨</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700">
                 <span className="text-[10px] font-bold text-slate-500">EXAM:</span>
                 <span className="text-[11px] font-black text-indigo-400">{exams.find(e => e.id === selectedQuestion?.examId)?.round || '-'}</span>
              </div>
              <button 
                onClick={() => setIsQuestionDialogOpen(false)}
                className="p-1 hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar: List of questions */}
            <div className="w-[300px] border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
              <div className="p-3 bg-white border-b border-slate-200 font-bold text-[11px] text-slate-500 uppercase tracking-widest bg-slate-50/50">
                검색 결과 리스트
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {displayQuestions.map((q) => (
                    <button
                      key={`dialog-list-${q.id || q.number}`}
                      onClick={() => setSelectedQuestion(q)}
                      className={cn(
                        "w-full p-3 text-left rounded-none border transition-all group relative",
                        selectedQuestion?.id === q.id || (selectedQuestion?.examId === q.examId && selectedQuestion?.number === q.number && selectedQuestion?.type === q.type)
                          ? "bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500/20 z-10"
                          : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-300"
                      )}
                      style={{ 
                        marginBottom: '1.5px', 
                        paddingRight: '10.5px', 
                        paddingTop: '5.5px', 
                        paddingBottom: '6.5px' 
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-slate-400">Q{String(q.number).padStart(2, '0')}</span>
                          <span className="text-[9px] font-medium text-slate-300">ID: {currentExam?.round.replace(/[^0-9]/g, '')}-{q.type === 'advanced' ? '심화' : '기본'}-{q.number}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-none text-[8px] font-black uppercase ${
                          q.type === 'advanced' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {q.type === 'advanced' ? '심화' : '기본'}
                        </div>
                      </div>
                      <div className={cn(
                        "text-[11px] font-bold truncate transition-colors",
                        selectedQuestion?.id === q.id ? "text-indigo-600" : "text-slate-700"
                      )}>
                        {q.title}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-medium">{q.era}</span>
                        {(() => {
                           const expected = 75 + (q.number % 10) - (q.difficulty === '상' ? 15 : q.difficulty === '하' ? -10 : 0);
                           const gap = q.correctRate - expected;
                           return (
                             <span className={cn(
                               "text-[9px] font-black",
                               gap > 0 ? "text-emerald-500" : gap < 0 ? "text-rose-500" : "text-slate-400"
                             )}>
                               평정간극 {gap > 0 ? '+' : ''}{gap}%
                             </span>
                           );
                        })()}
                      </div>
                      
                      {(selectedQuestion?.id === q.id || (selectedQuestion?.examId === q.examId && selectedQuestion?.number === q.number && selectedQuestion?.type === q.type)) && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden bg-white flex flex-col">
              {selectedQuestion ? (
                <>
                  <div className="flex-1 overflow-y-auto bg-white">
                    <div className="p-6">
                      <div className="max-w-4xl mx-auto space-y-10">
                      {/* Header in content area */}
                      <div className="border-b-2 border-slate-900 pb-4 flex items-end justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{selectedQuestion.era}</span>
                            <span className="text-xs text-slate-300">|</span>
                            <span className="text-xs font-medium text-slate-500">{selectedQuestion.category}</span>
                            <span className="text-xs text-slate-300">|</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold">
                              ID: {currentExam?.round.replace(/[^0-9]/g, '')}-{selectedQuestion.type === 'advanced' ? '심화' : '기본'}-{selectedQuestion.number}
                            </div>
                            <span className="text-xs text-slate-300">|</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 uppercase">
                              출제위원: {selectedQuestion.author || auth.currentUser?.displayName || '한능검 관리자'}
                            </div>
                          </div>
                          <h2 className="font-black tracking-tighter text-slate-900" style={{ fontSize: '19px', lineHeight: '36.1875px' }}>
                            <span className="text-indigo-500 mr-3">Q{selectedQuestion.number}.</span>
                            {selectedQuestion.title}
                          </h2>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">배점</div>
                          <div className="text-2xl font-black text-slate-900">{selectedQuestion.score}점</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        {/* Image area */}
                        <div className="lg:col-span-7 space-y-6">
                          <div className="relative group">
                            <div className="absolute inset-0 bg-slate-900 opacity-0 group-hover:opacity-5 transition-opacity" />
                            <div className="border-4 border-slate-100 p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
                              {selectedQuestion.imageUrl ? (
                                <img 
                                  src={selectedQuestion.imageUrl} 
                                  alt="문항 이미지" 
                                  className="max-w-full h-auto shadow-2xl border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="text-slate-300 italic font-medium">이미지가 없습니다.</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Info and Explanation area */}
                        <div className="lg:col-span-5 space-y-8">
                          <div className="bg-slate-50 border border-slate-200 p-6 space-y-6">
                            <div className="space-y-4">
                              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                                <span className="p-1 bg-indigo-500 rounded-none transform rotate-45" />
                                문항 기본 정보
                              </h3>
                              <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200">
                                <div className="bg-slate-50 p-3">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">분야</div>
                                  <div className="text-xs font-bold text-slate-700">{selectedQuestion.field || '-'}</div>
                                </div>
                                <div className="bg-slate-50 p-3">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">문제 유형</div>
                                  <div className="text-xs font-bold text-slate-700">{selectedQuestion.category}</div>
                                </div>
                                <div className="bg-slate-50 p-3">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">출제 근거</div>
                                  <div className="text-xs font-bold text-slate-700">{selectedQuestion.source || '-'}</div>
                                </div>
                                <div className="bg-white p-3">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">예상 정답률</div>
                                  <div className="text-lg font-black text-slate-400">{selectedQuestion.expectedCorrectRate || '75'}%</div>
                                </div>
                                <div className="bg-white p-3">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">실제 정답률</div>
                                  <div className="text-lg font-black text-indigo-600">{selectedQuestion.correctRate}%</div>
                                </div>
                                <div className="bg-indigo-50 p-3 border-l-2 border-indigo-500">
                                  <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">평정 간극</div>
                                  {(() => {
                                    const expected = selectedQuestion.expectedCorrectRate || (75 + (selectedQuestion.number % 10) - (selectedQuestion.difficulty === '상' ? 15 : selectedQuestion.difficulty === '하' ? -10 : 0));
                                    const gap = selectedQuestion.correctRate - expected;
                                    return (
                                      <div className={cn(
                                        "text-lg font-black",
                                        gap > 0 ? "text-emerald-500" : gap < 0 ? "text-rose-500" : "text-slate-400"
                                      )}>
                                        {gap > 0 ? `+${gap}` : gap}%
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="bg-white p-3 text-center">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">난이도</div>
                                  <div className={cn(
                                    "text-lg font-black",
                                    selectedQuestion.difficulty === '상' ? 'text-rose-500' : selectedQuestion.difficulty === '중' ? 'text-amber-500' : 'text-emerald-500'
                                  )}>
                                    {selectedQuestion.difficulty}
                                  </div>
                                </div>
                                <div className="bg-white p-3 text-center">
                                  <div className="text-[9px] font-black text-slate-400 uppercase mb-1">배점</div>
                                  <div className="text-lg font-black text-slate-900">{selectedQuestion.score}점</div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-slate-200">
                              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                                <Activity className="w-4 h-4 text-indigo-500" />
                                답지반응률 (요약)
                              </h3>
                              <div className="bg-white p-3 border border-slate-100">
                                {selectedQuestion.ratingGap ? (
                                  <div className="grid grid-cols-5 gap-1">
                                    {selectedQuestion.ratingGap.split(',').map((rate, i) => {
                                      const parts = rate.split(':').map(s => s.trim());
                                      const optionNum = parts[0];
                                      const percent = parts[1];
                                      const isCorrect = parseInt(optionNum) === selectedQuestion.answer;
                                      return (
                                        <div key={i} className={cn(
                                          "text-center p-1.5 border",
                                          isCorrect ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-50 border-slate-100"
                                        )}>
                                          <div className={cn("text-[9px] font-black mb-1", isCorrect ? "text-indigo-200" : "text-slate-400")}>{optionNum}번</div>
                                          <div className="text-[11px] font-bold">{percent || '-'}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-2 text-[10px] text-slate-400 italic">데이터가 없습니다.</div>
                                )}
                              </div>
                            </div>

                            {selectedQuestion.options && selectedQuestion.options.length > 0 && (
                              <div className="space-y-4 pt-6 border-t border-slate-200">
                                <h3 className="flex items-center justify-between text-sm font-black text-slate-900 uppercase">
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-500" />
                                    답지반응률
                                  </div>
                                  <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-none font-bold">정답: {selectedQuestion.answer}번</span>
                                </h3>
                                <div className="bg-white p-0 border border-slate-100 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr>
                                        <th className="py-2 px-3 text-left font-black text-slate-400 w-12">번호</th>
                                        <th className="py-2 px-3 text-left font-black text-slate-400">선택지 내용</th>
                                        <th className="py-2 px-3 text-right font-black text-slate-400 w-24">반응률</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {selectedQuestion.options.map((opt, i) => {
                                        const isCorrect = (i + 1) === selectedQuestion.answer;
                                        const rates = selectedQuestion.ratingGap ? selectedQuestion.ratingGap.split(',').map(s => s.trim()) : [];
                                        const rateText = rates[i]?.split(':')[1] || '0%';
                                        const rateValue = parseInt(rateText);

                                        return (
                                          <tr key={i} className={cn(
                                            isCorrect ? "bg-indigo-50/50" : "hover:bg-slate-50/30"
                                          )}>
                                            <td className="py-2.5 px-3 font-bold text-center">
                                              <span className={cn(
                                                "inline-flex items-center justify-center w-5 h-5 rounded-none text-[10px]",
                                                isCorrect ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                                              )}>
                                                {['①', '②', '③', '④', '⑤'][i]}
                                              </span>
                                            </td>
                                            <td className={cn(
                                              "py-2.5 px-3 leading-relaxed",
                                              isCorrect ? "text-indigo-900 font-bold" : "text-slate-600"
                                            )}>
                                              {opt}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                              <div className="flex flex-col items-end gap-1">
                                                <span className={cn(
                                                  "font-black tabular-nums",
                                                  isCorrect ? "text-indigo-600" : rateValue > 20 ? "text-slate-900" : "text-slate-400"
                                                )}>
                                                  {rateText}
                                                </span>
                                                <div className="w-16 h-1 bg-slate-100 overflow-hidden">
                                                  <div 
                                                    className={cn("h-full", isCorrect ? "bg-indigo-500" : "bg-slate-300")} 
                                                    style={{ width: rateText }} 
                                                  />
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <div className="space-y-4 pt-6 border-t border-slate-200">
                                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                                  <Image className="w-4 h-4 text-indigo-500" />
                                  문항 내용 (이미지 설명)
                                </h3>
                                <div className="bg-indigo-50 p-4 border border-indigo-100 text-indigo-900 text-xs leading-relaxed font-medium">
                                  {selectedQuestion.imageDescription || selectedQuestion.accessibleQuestion || '이미지에 대한 설명이 없습니다.'}
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-slate-200">
                              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                전맹자용 문항
                              </h3>
                              <div className="bg-white p-4 border border-slate-100 italic text-slate-600 text-[11px] leading-relaxed">
                                {selectedQuestion.accessibleQuestion || '전맹자용 문항 데이터가 없습니다.'}
                              </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-slate-200">
                              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                                <X className="w-4 h-4 text-indigo-500" />
                                해설
                              </h3>
                              <div className="bg-white p-4 border border-slate-100 min-h-[100px]">
                                <p className="text-slate-700" style={{ lineHeight: '30px', fontWeight: 'bold', fontSize: '12px' }}>
                                  {selectedQuestion.explanation || '등록된 해설이 없습니다.'}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-slate-200">
                              <h3 className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase">
                                비고
                              </h3>
                              <div className="bg-slate-50 p-3 text-[11px] text-slate-500 italic border border-dashed border-slate-200">
                                {selectedQuestion.etc || '특이 사항 없음'}
                              </div>
                            </div>

                            {selectedQuestion.keywords && selectedQuestion.keywords.length > 0 && (
                              <div className="pt-6 border-t border-slate-200">
                                <div className="flex flex-wrap gap-2">
                                  {selectedQuestion.keywords.map((kw, i) => (
                                    <span key={i} className="text-[10px] font-black px-2 py-1 bg-slate-900 text-white rounded-none">
                                      #{kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  
                  <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center px-6">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Question Detailed View Mode
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="rounded-none font-bold text-xs"
                        onClick={() => {
                          const idx = displayQuestions.findIndex(q => q.id === selectedQuestion.id || (q.examId === selectedQuestion.examId && q.number === selectedQuestion.number && q.type === selectedQuestion.type));
                          if (idx > 0) setSelectedQuestion(displayQuestions[idx - 1]);
                        }}
                        disabled={displayQuestions.findIndex(q => q.id === selectedQuestion.id || (q.examId === selectedQuestion.examId && q.number === selectedQuestion.number && q.type === selectedQuestion.type)) === 0}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        이전 문항
                      </Button>
                      <Button 
                        variant="outline" 
                        className="rounded-none font-bold text-xs"
                        onClick={() => {
                          const idx = displayQuestions.findIndex(q => q.id === selectedQuestion.id || (q.examId === selectedQuestion.examId && q.number === selectedQuestion.number && q.type === selectedQuestion.type));
                          if (idx < displayQuestions.length - 1) setSelectedQuestion(displayQuestions[idx + 1]);
                        }}
                        disabled={displayQuestions.findIndex(q => q.id === selectedQuestion.id || (q.examId === selectedQuestion.examId && q.number === selectedQuestion.number && q.type === selectedQuestion.type)) === displayQuestions.length - 1}
                      >
                        다음 문항
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                      <div className="w-px h-8 bg-slate-200 mx-2" />
                      <Button 
                        className="rounded-none font-black text-xs bg-slate-900 hover:bg-slate-800 text-white min-w-[80px]"
                        onClick={() => setIsQuestionDialogOpen(false)}
                      >
                        닫기
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 italic">
                  문항을 선택해주세요.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
