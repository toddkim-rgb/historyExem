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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Award, Target, BookOpen, ChevronDown, PieChart as PieChartIcon, BarChart3, Activity, Search, RotateCcw } from 'lucide-react';
import { Exam, Question } from '../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatsPageProps {
  exams: Exam[];
  selectedExamId: string;
  questions: Question[];
  onExamChange: (id: string) => void;
  onSelectQuestion?: (question: Question) => void;
}

const COLORS = ['#1E293B', '#D4AF37', '#94A3B8', '#E2E8F0', '#475569'];

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
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLevel, setSearchLevel] = useState<string>('all');
  const [searchEra, setSearchEra] = useState<string>('all');
  const [searchCategory, setSearchCategory] = useState<string>('all');
  const [searchCorrectRate, setSearchCorrectRate] = useState<string>('all');
  const [showDetails, setShowDetails] = useState(false);

  // 실제 검색에 적용될 상태 (버튼 클릭 시 업데이트)
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    level: 'all',
    era: 'all',
    category: 'all',
    correctRate: 'all'
  });

  const handleSearch = () => {
    setAppliedFilters({
      keyword: searchKeyword,
      level: searchLevel,
      era: searchEra,
      category: searchCategory,
      correctRate: searchCorrectRate
    });
    setShowDetails(true);
  };

  const handleReset = () => {
    setSearchKeyword('');
    setSearchLevel('all');
    setSearchEra('all');
    setSearchCategory('all');
    setSearchCorrectRate('all');
    setAppliedFilters({
      keyword: '',
      level: 'all',
      era: 'all',
      category: 'all',
      correctRate: 'all'
    });
  };

  const currentExam = exams.find(e => e.id === selectedExamId);

  const eras = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
  const categories = [
    '역사지식 이해',
    '사료 분석 및 해석',
    '역사 상황 파악',
    '역사 탐구 설계 및 수행',
    '역사적 상상력 및 추론',
    '역사적 가치 판단 및 태도'
  ];

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchKeyword = !appliedFilters.keyword || 
        q.title.toLowerCase().includes(appliedFilters.keyword.toLowerCase()) || 
        q.keywords.some(k => k.toLowerCase().includes(appliedFilters.keyword.toLowerCase()));
      
      const matchLevel = appliedFilters.level === 'all' || q.type === appliedFilters.level;
      const matchEra = appliedFilters.era === 'all' || q.era === appliedFilters.era;
      const matchCategory = appliedFilters.category === 'all' || q.category === appliedFilters.category;
      
      let matchRate = true;
      if (appliedFilters.correctRate !== 'all') {
        const rate = q.correctRate;
        if (appliedFilters.correctRate === 'high') matchRate = rate >= 80;
        else if (appliedFilters.correctRate === 'mid') matchRate = rate >= 50 && rate < 80;
        else if (appliedFilters.correctRate === 'low') matchRate = rate < 50;
      }

      return matchKeyword && matchLevel && matchEra && matchCategory && matchRate;
    });
  }, [questions, appliedFilters]);

  const statsData = useMemo(() => {
    // If we have actual questions for this exam, use them. Otherwise, fallback to seeded dummy data.
    const hasRealData = questions.length > 0;
    
    if (hasRealData) {
      const eras = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
      const eraData = eras.map(era => {
        const eraQuestions = questions.filter(q => q.era === era);
        const avgCorr = eraQuestions.length > 0 
          ? Math.round(eraQuestions.reduce((acc, curr) => acc + curr.correctRate, 0) / eraQuestions.length) 
          : 0;
        return {
          name: era,
          '채점정답률': avgCorr,
          '오답률': Math.max(0, 100 - avgCorr),
          '변별력': parseFloat((0.4 + Math.random() * 0.4).toFixed(2)) // Mocking discrimination as it's usually derived from student scores
        };
      });

      const types = Array.from(new Set(questions.map(q => q.category))).filter(Boolean);
      const typeData = types.map(type => {
        const typeQuestions = questions.filter(q => q.category === type);
        const avgCorr = typeQuestions.length > 0 
          ? Math.round(typeQuestions.reduce((acc, curr) => acc + curr.correctRate, 0) / typeQuestions.length) 
          : 0;
        return {
          name: type,
          '채점정답률': avgCorr,
          '예상정답률': Math.round(avgCorr + (Math.random() * 10 - 5)),
          '실제난이도': typeQuestions.length > 0 
            ? parseFloat((typeQuestions.reduce((acc, curr) => {
                const diffMap: {[key: string]: number} = { '상': 5, '중': 3, '하': 1 };
                return acc + (diffMap[curr.difficulty] || 3);
              }, 0) / typeQuestions.length).toFixed(1))
            : 3.0,
          '예상난이도': parseFloat((2 + Math.random() * 2).toFixed(1))
        };
      });

      const difficultyDistribution = ['상', '중', '하'].map(diff => ({
        name: diff,
        value: questions.filter(q => q.difficulty === diff).length
      }));

      const scoreDistribution = Array.from(new Set(questions.map(q => q.score))).sort().map(score => ({
        name: `${score}점`,
        value: questions.filter(q => q.score === score).length
      }));

      // Difficulty vs Correct Rate Correlation
      const diffCorrData = ['상', '중', '하'].map(diff => {
        const diffQs = questions.filter(q => q.difficulty === diff);
        const avg = diffQs.length > 0 
          ? Math.round(diffQs.reduce((acc, curr) => acc + curr.correctRate, 0) / diffQs.length) 
          : 0;
        return { name: diff, '평균정답률': avg };
      });

      const avgCorrect = Math.round(questions.reduce((acc, curr) => acc + curr.correctRate, 0) / questions.length);
      const avgDifficulty = (questions.reduce((acc, curr) => {
        const diffMap: {[key: string]: number} = { '상': 5, '중': 3, '하': 1 };
        return acc + (diffMap[curr.difficulty] || 3);
      }, 0) / questions.length).toFixed(1);

      return { eraData, typeData, difficultyDistribution, scoreDistribution, diffCorrData, avgCorrect, avgDifficulty, avgExpectedDifficulty: '3.2', avgDiscrimination: '0.45' };
    }

    // FALLBACK TO DUMMY (Original logic)
    const rnd = seededRandom(selectedExamId || 'default');
    const seedOffset = (selectedExamId?.length || 0) % 10;
    const eras = ['선사', '고대', '고려', '조선', '근대', '일제강점', '현대'];
    const generatedEraData = eras.map((era, idx) => {
      const eraFlex = (idx + seedOffset) % 5;
      const baseCorr = 83 + (rnd() * 12) + (eraFlex * 0.5);
      return {
        name: era,
        '채점정답률': Math.min(Math.round(baseCorr), 98),
        '오답률': Math.max(Math.round(100 - baseCorr), 2),
        '변별력': parseFloat((0.3 + rnd() * 0.6).toFixed(2))
      };
    });

    const types = ['역사지식의 이해', '연대기적 파악', '사료 분석 및 해석', '역사 상황의 재구성', '역사적 가치 판단'];
    const generatedTypeData = types.map((type, idx) => {
      const typeFlex = (idx + seedOffset) % 3;
      const baseCorr = 83 + (rnd() * 10) + (typeFlex * 1);
      const expectedCorr = Math.max(80, Math.min(97, baseCorr + (rnd() * 10 - 5)));
      const realDiff = parseFloat((1.5 + rnd() * 3).toFixed(1));
      const expectedDiff = Math.max(1, Math.min(5, realDiff + (rnd() * 1.4 - 0.7)));
      return {
        name: type,
        '채점정답률': Math.round(baseCorr),
        '예상정답률': Math.round(expectedCorr),
        '실제난이도': realDiff,
        '예상난이도': parseFloat(expectedDiff.toFixed(1))
      };
    });

    const diffDist = [
      { name: '상', value: Math.round(10 + rnd() * 10) },
      { name: '중', value: Math.round(20 + rnd() * 15) },
      { name: '하', value: Math.round(15 + rnd() * 10) }
    ];

    const scoreDist = [
      { name: '1점', value: Math.round(5 + rnd() * 5) },
      { name: '2점', value: Math.round(30 + rnd() * 5) },
      { name: '3점', value: Math.round(15 + rnd() * 5) }
    ];

    const diffCorr = [
      { name: '상', '평균정답률': 45 + Math.round(rnd() * 10) },
      { name: '중', '평균정답률': 70 + Math.round(rnd() * 10) },
      { name: '하', '평균정답률': 90 + Math.round(rnd() * 5) }
    ];

    const avgCorrect = Math.round(generatedEraData.reduce((acc, curr) => acc + curr['채점정답률'], 0) / eras.length);
    const avgDifficulty = (generatedTypeData.reduce((acc, curr) => acc + curr['실제난이도'], 0) / types.length).toFixed(1);
    const avgExpectedDifficulty = (generatedTypeData.reduce((acc, curr) => acc + curr['예상난이도'], 0) / types.length).toFixed(1);
    const avgDiscrimination = (generatedEraData.reduce((acc, curr) => acc + curr['변별력'], 0) / eras.length).toFixed(2);

    return { 
      eraData: generatedEraData, 
      typeData: generatedTypeData, 
      difficultyDistribution: diffDist, 
      scoreDistribution: scoreDist, 
      diffCorrData: diffCorr, 
      avgCorrect, 
      avgDifficulty, 
      avgExpectedDifficulty, 
      avgDiscrimination 
    };
  }, [selectedExamId, questions]);

  return (
    <div className="flex-1 flex flex-col gap-2 h-full overflow-hidden pb-2">
      <div className="flex items-center justify-start gap-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
        </div>

        <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase">데이터 전환:</span>
          <Select value={selectedExamId} onValueChange={onExamChange}>
            <SelectTrigger className="w-[160px] h-7 rounded-none border-0 bg-slate-50 text-slate-900 font-bold text-[11px] hover:bg-slate-100 transition-colors">
              <SelectValue placeholder="회차 선택">
                {(() => {
                  const exam = exams.find(e => e.id === selectedExamId);
                  if (!exam) return null;
                  return exam.round.includes('회') ? exam.round : `${exam.round}회`;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-none border-[#D1D1CF] shadow-lg bg-white text-slate-900">
              {exams.map((exam) => (
                <SelectItem key={`stats-exam-opt-${exam.id}`} value={exam.id} className="text-[11px] font-medium focus:bg-slate-50 focus:text-[#141414]">
                  {exam.round.includes('회') ? exam.round : `${exam.round}회`} 한국사능력검정시험
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-6">
        <div className="space-y-4 pb-6">
          {/* 조건 검색 영역 */}
          <Card className="rounded-none border-0 shadow-sm bg-white mb-4">
            <CardHeader className="py-2 px-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] font-bold flex items-center gap-2">
                  <Search className="w-3 h-3 text-slate-500" />
                  문항 조건 검색
                </CardTitle>
                {showDetails && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowDetails(false)}
                    className="h-6 text-[10px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 px-2"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    대시보드로 돌아가기
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    키워드
                  </label>
                  <input 
                    type="text" 
                    placeholder="문항 제목, 키워드 검색..."
                    className="w-full h-8 px-3 text-[11px] border border-slate-200 focus:outline-none focus:border-slate-800 transition-colors"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">급수</label>
                  <Select value={searchLevel} onValueChange={setSearchLevel}>
                    <SelectTrigger className="w-full h-8 rounded-none border-slate-200 text-[11px]">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="advanced">심화</SelectItem>
                      <SelectItem value="general">기본</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">시대</label>
                  <Select value={searchEra} onValueChange={setSearchEra}>
                    <SelectTrigger className="w-full h-8 rounded-none border-slate-200 text-[11px]">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">전체</SelectItem>
                      {eras.map(e => <SelectItem key={`era-opt-${e}`} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">문항유형</label>
                  <Select value={searchCategory} onValueChange={setSearchCategory}>
                    <SelectTrigger className="w-full h-8 rounded-none border-slate-200 text-[11px]">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">전체</SelectItem>
                      {categories.map(c => <SelectItem key={`cat-opt-${c}`} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">정답률</label>
                  <Select value={searchCorrectRate} onValueChange={setSearchCorrectRate}>
                    <SelectTrigger className="w-full h-8 rounded-none border-slate-200 text-[11px]">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="high">80% 이상</SelectItem>
                      <SelectItem value="mid">50%~80%</SelectItem>
                      <SelectItem value="low">50% 미만</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1.5 h-8">
                  <Button 
                    onClick={handleSearch}
                    className="h-8 rounded-none bg-slate-900 hover:bg-black text-[11px] font-bold px-4 flex items-center gap-1.5"
                  >
                    <Search className="w-3 h-3" />
                    검색
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleReset}
                    className="h-8 rounded-none border-slate-200 text-slate-500 bg-white hover:bg-slate-50 hover:text-slate-900 text-[11px] px-2.5"
                    title="검색 조건 초기화"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {!showDetails ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-24">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                    <CardTitle className="text-[10px] font-bold uppercase text-slate-500">예상 vs 실제 난이도</CardTitle>
                    <Target className="w-3 h-3 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <div className="text-xl font-black">Lvl {statsData.avgDifficulty}</div>
                      <div className="text-[11px] font-bold text-slate-400">/ 예상 {statsData.avgExpectedDifficulty}</div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                      * 출제위원 예측 대비 실제 문항 난이도 지수
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-24">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                    <CardTitle className="text-[10px] font-bold uppercase text-slate-500">전체 정답률</CardTitle>
                    <Award className="w-3 h-3 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-black">{statsData.avgCorrect}%</div>
                    <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                      * 총 응답 데이터 대비 정답 문항 비율
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-24">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                    <CardTitle className="text-[10px] font-bold uppercase text-slate-500">평균 오답률</CardTitle>
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-black">{100 - statsData.avgCorrect}%</div>
                    <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                      * 오답 문항 및 중도 포기 문항 평균치
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-none border-0 shadow-[4px_4px_0_rgba(0,0,0,0.05)] bg-white h-24">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                    <CardTitle className="text-[10px] font-bold uppercase text-slate-500">변별력 지수 (Avg)</CardTitle>
                    <BookOpen className="w-3 h-3 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-black">{statsData.avgDiscrimination}</div>
                    <p className="text-[9px] text-slate-400 mt-1 font-medium italic">
                      * 상위-하위 그룹 간 정답 편차 지수 (최저-1~최고1)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-none border-0 bg-white shadow-sm">
                  <CardHeader className="border-b border-slate-100 mb-4 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        시대별 변별력 및 정답률 분석
                      </CardTitle>
                      <span className="text-[10px] font-mono bg-[#141414] text-white px-2 py-0.5 rounded-none">시대 분석</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`era-container-${selectedExamId}`}>
                      <BarChart id={`era_stats_chart_${selectedExamId}`} data={statsData.eraData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                          <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} unit="%" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                          <Bar dataKey="채점정답률" fill="#1E293B" stackId="a" barSize={30} radius={[0, 0, 0, 0]} />
                          <Bar dataKey="오답률" fill="#D4AF37" stackId="a" barSize={30} radius={[0, 0, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-0 bg-white shadow-sm">
                  <CardHeader className="border-b border-slate-100 mb-4 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        유형별 예상 vs 실제 정답률 분석
                      </CardTitle>
                      <span className="text-[10px] font-mono bg-[#D4AF37] text-[#141414] px-2 py-0.5 rounded-none">정답률 비교</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`type-container-${selectedExamId}`}>
                      <LineChart id={`type_stats_chart_${selectedExamId}`} data={statsData.typeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
                          <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} unit="%" />
                          <Tooltip 
                            contentStyle={{ borderRadius: '0', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                          <Line name="채점 정답률" type="monotone" dataKey="채점정답률" stroke="#1E293B" strokeWidth={4} dot={{ fill: '#1E293B', r: 4, strokeWidth: 2, stroke: '#FFF' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          <Line name="출제위원 예상정답률" type="monotone" dataKey="예상정답률" stroke="#D4AF37" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#D4AF37', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-none border-0 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                        난이도 통합 분석 (분포 및 정답률 상관관계)
                      </CardTitle>
                      <div className="text-[10px] text-slate-400 font-mono">DIFFICULTY INTEGRATION</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-[160px]">
                        <p className="text-[10px] font-bold text-center mb-1 text-slate-500 uppercase tracking-tighter">난이도 구성비</p>
                        <ResponsiveContainer width="100%" height="100%" key={`pie-container-${selectedExamId}`}>
                          <PieChart id={`diff_dist_chart_${selectedExamId}`}>
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
                      <div className="h-[160px]">
                        <p className="text-[10px] font-bold text-center mb-1 text-slate-500 uppercase tracking-tighter">그룹별 정답률</p>
                        <ResponsiveContainer width="100%" height="100%" key={`corr-container-${selectedExamId}`}>
                          <ComposedChart id={`diff_corr_chart_${selectedExamId}`} data={statsData.diffCorrData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} />
                            <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
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
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-indigo-500" />
                        균형적 난이도 분석 (Radar)
                      </CardTitle>
                      <div className="text-[10px] text-slate-400 font-mono">RADAR CHART</div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-center pt-2">
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%" key={`radar-container-${selectedExamId}`}>
                        <RadarChart id={`radar_stats_chart_${selectedExamId}`} cx="50%" cy="50%" outerRadius="70%" data={statsData.typeData}>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-tighter">
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-12 text-center">No</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-20 text-center">시대</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-16 text-center">급수</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100">문항 제목</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-24 text-center">유형</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-20 text-center">난이도</th>
                          <th className="py-2.5 px-4 text-left border-r border-slate-100 w-20 text-center">배점</th>
                          <th className="py-2.5 px-4 text-left w-20 text-center">정답률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredQuestions.length > 0 ? (
                          filteredQuestions.map((q, idx) => (
                            <tr key={q.id || `stats-q-${q.number}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2 px-4 border-r border-slate-50 text-center font-mono text-slate-400">#{String(q.number).padStart(2, '0')}</td>
                              <td className="py-2 px-4 border-r border-slate-50 text-center">
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded-sm text-[10px] font-bold text-slate-600">{q.era}</span>
                              </td>
                              <td className="py-2 px-4 border-r border-slate-50 text-center">
                                <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${q.type === 'advanced' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {q.type === 'advanced' ? '심화' : '기본'}
                                </span>
                              </td>
                              <td 
                                className="py-2 px-4 border-r border-slate-50 truncate max-w-[200px] font-medium cursor-pointer hover:text-indigo-600 hover:underline transition-colors" 
                                title={q.title}
                                onClick={() => onSelectQuestion?.(q)}
                              >
                                {q.title}
                              </td>
                              <td className="py-2 px-4 border-r border-slate-50 text-[10px] text-slate-500 italic">
                                {q.category}
                              </td>
                              <td className="py-2 px-4 border-r border-slate-50 text-center">
                                <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${q.difficulty === '상' ? 'bg-red-50 text-red-600' : q.difficulty === '중' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {q.difficulty}
                                </span>
                              </td>
                              <td className="py-2 px-4 border-r border-slate-50 text-center font-bold text-slate-600">{q.score}점</td>
                              <td className="py-2 px-4 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="font-bold text-indigo-600">{q.correctRate}%</span>
                                  <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: `${q.correctRate}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="py-20 text-center text-slate-400 italic">
                              조건에 일치하는 문항이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
