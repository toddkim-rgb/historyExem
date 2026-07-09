import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Exam, Question } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight, Target, Search, AlertCircle, HelpCircle, X, Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Input } from '@/components/ui/input';

interface SingleQuestionViewProps {
  exams: Exam[];
}

export const SingleQuestionView: React.FC<SingleQuestionViewProps> = ({ exams }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('advanced');
  const [questionNumber, setQuestionNumber] = useState<string>('1');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Stopwatch logic
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && currentQuestion && !isLoading && !showResult) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, currentQuestion, isLoading, showResult]);

  const formatStopwatchTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const filteredExamsForTab = useMemo(() => {
    return exams.filter(e => {
      const isLevelVisible = activeTab === 'advanced'
        ? e.isVisibleAdvanced !== false
        : e.isVisibleGeneral !== false;
      return isLevelVisible && (!e.levels || e.levels.length === 0 || e.levels.includes(activeTab === 'advanced' ? '심화' : '기본'));
    });
  }, [exams, activeTab]);

  useEffect(() => {
    if (filteredExamsForTab.length > 0) {
      const exists = filteredExamsForTab.some(e => e.id === selectedExamId);
      if (!exists) {
        setSelectedExamId(filteredExamsForTab[0].id);
      }
    }
  }, [filteredExamsForTab, selectedExamId]);

  const ratingOptions = useMemo(() => {
    if (!currentQuestion) return [];
    
    const ratingGap = currentQuestion.ratingGap;
    const correctAnswer = currentQuestion.answer;
    const correctRate = currentQuestion.correctRate || 0;
    
    if (ratingGap) {
      try {
        const parts = ratingGap.split(',');
        const parsed = parts.map(part => {
          const [optStr, rateStr] = part.split(':').map(s => s.trim());
          const option = parseInt(optStr);
          const percentage = parseFloat(rateStr.replace('%', '')) || 0;
          return { option, rate: rateStr, percentage };
        });
        if (parsed.length === 5) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse ratingGap:", e);
      }
    }

    // Fallback: generate realistic percentages based on correctRate
    const rates = [];
    const correctVal = correctRate || 75;
    const remaining = 100 - correctVal;

    const dist = [0.4, 0.3, 0.2, 0.1];
    let distIndex = 0;

    for (let i = 1; i <= 5; i++) {
      if (i === correctAnswer) {
        rates.push({ option: i, rate: `${correctVal}%`, percentage: correctVal });
      } else {
        const weight = dist[distIndex] || 0.15;
        distIndex++;
        const val = Math.max(1, Math.round(remaining * weight));
        rates.push({ option: i, rate: `${val}%`, percentage: val });
      }
    }

    const total = rates.reduce((acc, r) => acc + r.percentage, 0);
    if (total !== 100) {
      const diff = 100 - total;
      const adjustIdx = rates.findIndex(r => r.option !== correctAnswer);
      if (adjustIdx !== -1) {
        rates[adjustIdx].percentage += diff;
        rates[adjustIdx].rate = `${rates[adjustIdx].percentage}%`;
      }
    }

    return rates;
  }, [currentQuestion]);

  const fetchQuestion = async () => {
    if (!selectedExamId || !questionNumber) return;
    
    setIsLoading(true);
    setShowResult(false);
    setUserAnswer(null);
    setCurrentQuestion(null);
    setElapsedTime(0);
    setIsTimerRunning(true);

    try {
      const q = query(
        collection(db, 'questions'),
        where('examId', '==', selectedExamId),
        where('type', '==', activeTab),
        where('number', '==', parseInt(questionNumber)),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Question;
        setCurrentQuestion({ ...data, id: snapshot.docs[0].id });
      }
    } catch (error) {
      console.error("Error fetching question:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId && questionNumber) {
      fetchQuestion();
    }
  }, [selectedExamId, activeTab]);

  const handleAnswerSelect = (optionNum: number) => {
    if (showResult) return;
    setUserAnswer(optionNum);
  };

  const handleCheck = () => {
    if (userAnswer === null) return;
    setShowResult(true);
    setIsTimerRunning(false);
  };

  const nextQuestion = () => {
    const nextNum = parseInt(questionNumber) + 1;
    if (nextNum <= 50) {
      setQuestionNumber(String(nextNum));
      // fetchQuestion will be triggered by useEffect
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, [questionNumber]);

  return (
    <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden pb-4">
      {/* Top Controller */}
      <div className="flex flex-wrap items-center justify-start gap-4 shrink-0 px-1">
        <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase">회차:</span>
          <Select value={selectedExamId} onValueChange={(val) => setSelectedExamId(val)}>
            <SelectTrigger className="w-[160px] h-7 rounded-none border-0 bg-slate-50 text-slate-900 font-bold text-[11px] hover:bg-slate-100">
              <SelectValue placeholder="회차 선택" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {filteredExamsForTab.map((exam) => (
                <SelectItem key={exam.id} value={exam.id} className="text-[11px]">
                  {exam.round}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex bg-slate-100 p-1 border border-[#D1D1CF]">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-1 text-[11px] font-bold transition-all ${activeTab === 'general' ? 'bg-[#141414] text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            기본
          </button>
          <button 
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-1 text-[11px] font-bold transition-all ${activeTab === 'advanced' ? 'bg-[#141414] text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            심화
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase">문항 번호:</span>
          <div className="flex items-center gap-1">
            <Input 
              type="number" 
              className="w-16 h-7 rounded-none border-[#D1D1CF] text-[11px] font-bold bg-slate-50"
              value={questionNumber}
              min={1}
              max={50}
              onChange={(e) => setQuestionNumber(e.target.value)}
            />
            <Button 
              size="sm" 
              className="h-7 rounded-none bg-[#141414] text-white text-[10px] px-2"
              onClick={fetchQuestion}
            >
              <Search className="w-3 h-3 mr-1" /> 이동
            </Button>
          </div>
        </div>

        {/* 문항 타이머 */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm md:ml-auto">
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${isTimerRunning ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-[10px] font-black text-slate-400 uppercase">풀이 시간:</span>
            <span className="text-xs font-mono font-black text-slate-900">{formatStopwatchTime(elapsedTime)}</span>
          </div>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="w-6 h-6 rounded-none p-0 hover:bg-slate-100 text-slate-600"
              title={isTimerRunning ? "일시정지" : "시작"}
            >
              {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setElapsedTime(0);
                setIsTimerRunning(true);
              }}
              className="w-6 h-6 rounded-none p-0 hover:bg-slate-100 text-slate-600"
              title="시간 초기화"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden max-w-7xl mx-auto w-full relative">
        <Card className={`flex-1 flex flex-col rounded-none border-[#141414] shadow-[8px_8px_0_rgba(0,0,0,0.05)] bg-white overflow-hidden transition-all duration-500 ${showResult ? 'max-w-[65%]' : ''}`}>
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#141414] mr-3"></div>
              문항을 불러오는 중...
            </div>
          ) : currentQuestion ? (
            <>
              <CardHeader className="bg-[#141414] text-white py-3 shrink-0 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-[#D4AF37]">Q{String(currentQuestion.number).padStart(2, '0')}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">{currentQuestion.era} | {currentQuestion.category}</span>
                    <span className="text-xs font-bold leading-none">{currentQuestion.title}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] bg-white/10 px-2 py-1 font-bold">배점: {currentQuestion.score}점</div>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-8">
                  {currentQuestion.imageUrl && (
                    <div className="flex justify-center bg-slate-50 border border-[#D1D1CF] p-4">
                      <img 
                        src={currentQuestion.imageUrl} 
                        alt={`Question ${currentQuestion.number}`} 
                        className="max-h-[500px] w-auto border shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-6 py-6 border-t border-slate-100">
                    <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">정답 선택</div>
                    <div className="flex justify-center gap-4">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const isSelected = userAnswer === num;
                        const isCorrect = showResult && currentQuestion.answer === num;
                        const isWrong = showResult && isSelected && currentQuestion.answer !== num;

                        return (
                          <button
                            key={`single-opt-${num}`}
                            onClick={() => handleAnswerSelect(num)}
                            disabled={showResult}
                            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-lg font-black transition-all relative ${
                              isCorrect 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' 
                                : isWrong 
                                ? 'bg-red-500 border-red-500 text-white shadow-lg'
                                : isSelected 
                                ? 'bg-[#141414] border-[#141414] text-white shadow-md' 
                                : 'border-[#D1D1CF] hover:border-[#141414] bg-white text-slate-400'
                            }`}
                          >
                            {isCorrect ? <Check className="w-6 h-6" /> : num}
                            {showResult && currentQuestion.answer === num && !isSelected && (
                              <div className="absolute -inset-2 border-2 border-emerald-500 rounded-full animate-pulse" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border-t border-[#D1D1CF] flex justify-between items-center shrink-0">
                <Button 
                  variant="outline" 
                  className="rounded-none border-[#D1D1CF] h-11 px-6 font-bold"
                  onClick={() => {
                    const prev = Math.max(1, parseInt(questionNumber) - 1);
                    setQuestionNumber(String(prev));
                  }}
                  disabled={parseInt(questionNumber) === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> 이전 문제
                </Button>

                {!showResult ? (
                  <Button 
                    className="rounded-none bg-[#141414] text-white h-11 px-10 font-bold shadow-[4px_4px_0_rgba(0,0,0,0.15)]"
                    onClick={handleCheck}
                    disabled={userAnswer === null}
                  >
                    정답 확인하기
                  </Button>
                ) : (
                  <Button 
                    className="rounded-none bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-10 font-bold shadow-[4px_4px_0_rgba(0,0,0,0.15)]"
                    onClick={nextQuestion}
                  >
                    다음 문제 풀기 <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#999] gap-4">
              <AlertCircle className="w-12 h-12 opacity-20" />
              <div className="text-[11px] uppercase tracking-widest opacity-50">문항 정보 없음</div>
              <p className="text-[12px] text-center px-10 leading-relaxed text-slate-500 font-medium">
                해당 회차({exams.find(e => e.id === selectedExamId)?.round})의 {questionNumber}번 문항({activeTab === 'advanced' ? '심화' : '기본'})이 존재하지 않습니다.<br />
                다른 문항 번호를 선택해 보세요.
              </p>
            </div>
          )}
        </Card>

        {/* Right Pane: Result Judgement */}
        <AnimatePresence>
          {showResult && currentQuestion && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="flex-1 max-w-[35%] flex flex-col gap-4"
            >
              <Card className={`flex-1 flex flex-col rounded-none shadow-[8px_8px_0_rgba(0,0,0,0.05)] bg-white overflow-hidden border-t-8 ${
                userAnswer === currentQuestion.answer 
                  ? 'border-emerald-500 shadow-[8px_8px_0_rgba(16,185,129,0.05)]' 
                  : 'border-rose-500 shadow-[8px_8px_0_rgba(244,63,94,0.05)]'
              }`}>
                {/* Result Message Section */}
                <div className={`p-8 text-center shrink-0 flex flex-col items-center justify-center gap-4 border-b ${
                  userAnswer === currentQuestion.answer 
                    ? 'bg-emerald-50/50 border-emerald-100' 
                    : 'bg-rose-50/50 border-rose-100'
                }`}>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
                    userAnswer === currentQuestion.answer 
                      ? 'bg-emerald-500 border-emerald-200 text-white animate-bounce' 
                      : 'bg-rose-500 border-rose-200 text-white'
                  }`}>
                    {userAnswer === currentQuestion.answer ? (
                      <Check className="w-8 h-8 stroke-[3]" />
                    ) : (
                      <X className="w-8 h-8 stroke-[3]" />
                    )}
                  </div>
                  
                  <div>
                    <h3 className={`text-xl font-black ${
                      userAnswer === currentQuestion.answer ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {userAnswer === currentQuestion.answer ? '정답입니다! 🎉' : '오답입니다... 😢'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-bold">
                      {userAnswer === currentQuestion.answer 
                        ? '훌륭합니다! 다음 문제를 풀고 기세를 이어가세요.' 
                        : '아쉽네요! 실제 정답과 아래 정답을 비교해보세요.'}
                    </p>
                    <div className="mt-3 flex justify-center">
                      <span className="px-3 py-1 bg-white border border-slate-200 text-[10px] font-black text-slate-600 inline-flex items-center gap-1.5 shadow-sm rounded-none uppercase tracking-wide">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>풀이 시간: <strong className="font-black text-indigo-600 text-[11px]">{formatStopwatchTime(elapsedTime)}</strong></span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scroll Area for Details */}
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                  {/* Answer Comparison Grid */}
                  <div className="w-full grid grid-cols-2 gap-4">
                    <div className={`p-4 border text-center transition-all ${
                      userAnswer === currentQuestion.answer 
                        ? 'bg-emerald-50/30 border-emerald-100' 
                        : 'bg-rose-50/30 border-rose-100'
                    }`}>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        내가 선택한 답
                      </span>
                      <div className={`inline-flex w-12 h-12 rounded-full items-center justify-center text-xl font-black ${
                        userAnswer === currentQuestion.answer 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-rose-500 text-white'
                      }`}>
                        {userAnswer}
                      </div>
                    </div>

                    <div className="p-4 border border-emerald-100 bg-emerald-50/10 text-center transition-all">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-emerald-600/70 mb-1">
                        실제 정답
                      </span>
                      <div className="inline-flex w-12 h-12 rounded-full items-center justify-center text-xl font-black bg-emerald-500 text-white">
                        {currentQuestion.answer}
                      </div>
                    </div>
                  </div>

                  {/* Option Response Rates (답지반응률) */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                      <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                      문항 답지반응률 (선택 분포)
                    </h4>
                    <div className="bg-slate-50 p-3.5 border border-slate-100 space-y-2.5">
                      {ratingOptions.map(({ option, rate, percentage }) => {
                        const isCorrectOpt = option === currentQuestion.answer;
                        const isSelectedOpt = option === userAnswer;
                        
                        return (
                          <div key={`rate-single-${option}`} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border ${
                                  isCorrectOpt 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : isSelectedOpt 
                                    ? 'bg-rose-500 border-rose-500 text-white' 
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}>
                                  {option}
                                </span>
                                <span className={
                                  isCorrectOpt ? "text-emerald-700 font-extrabold" : isSelectedOpt ? "text-rose-700 font-extrabold" : "text-slate-600"
                                }>
                                  {option}번
                                  {isCorrectOpt && " (정답)"}
                                  {isSelectedOpt && " (내가 선택)"}
                                </span>
                              </div>
                              <span className={
                                isCorrectOpt ? "text-emerald-600 font-black" : isSelectedOpt ? "text-rose-600 font-black" : "text-slate-500 font-bold"
                              }>
                                {rate}
                              </span>
                            </div>
                            
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden relative">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  isCorrectOpt ? "bg-emerald-500" : isSelectedOpt ? "bg-rose-500" : "bg-slate-400"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question Details (문항 상세 정보) */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                      <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                      문항 상세 정보
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">시대 / 유형</span>
                        <span className="font-bold text-slate-700 truncate block">{currentQuestion.era} | {currentQuestion.category}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">분야</span>
                        <span className="font-bold text-slate-700 block">{currentQuestion.field || '기타'}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">출제 근거</span>
                        <span className="font-bold text-slate-700 truncate block">{currentQuestion.source || '-'}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">난이도 / 배점</span>
                        <span className="font-bold text-slate-700 block">{currentQuestion.difficulty} | {currentQuestion.score}점</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">실제 정답률</span>
                        <span className="font-black text-indigo-600">{currentQuestion.correctRate}%</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-2">
                        <span className="block text-[8px] text-slate-400 font-bold uppercase mb-0.5">예상 정답률</span>
                        <span className="font-black text-slate-600">{currentQuestion.expectedCorrectRate || '75'}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Explanation (정답 해설) */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase">
                      <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                      정답 해설
                    </h4>
                    <div className="bg-indigo-50/40 p-3 border border-indigo-100/30 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                      {currentQuestion.explanation || '등록된 해설이 없습니다.'}
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 italic">
                  <Button 
                    variant="outline"
                    className="w-full h-12 rounded-none border-slate-200 text-slate-500 hover:text-slate-900 font-bold bg-white"
                    onClick={() => setShowResult(false)}
                  >
                    결과 확인창 닫기
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
