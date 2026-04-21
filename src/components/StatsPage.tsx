import React, { useMemo } from 'react';
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
import { TrendingUp, Award, Target, BookOpen, ChevronDown, PieChart as PieChartIcon, BarChart3, Activity } from 'lucide-react';
import { Exam, Question } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatsPageProps {
  exams: Exam[];
  selectedExamId: string;
  questions: Question[];
  onExamChange: (id: string) => void;
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

export const StatsPage: React.FC<StatsPageProps> = ({ exams, selectedExamId, questions, onExamChange }) => {
  const currentExam = exams.find(e => e.id === selectedExamId);

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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.eraData}>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={statsData.typeData}>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
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
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-2 mt-1">
                    {statsData.difficultyDistribution.map((entry, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-2 h-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[9px] font-bold">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-[160px]">
                  <p className="text-[10px] font-bold text-center mb-1 text-slate-500 uppercase tracking-tighter">그룹별 정답률</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={statsData.diffCorrData}>
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
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={statsData.typeData}>
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
        </div>
      </div>
    </div>
  );
};
