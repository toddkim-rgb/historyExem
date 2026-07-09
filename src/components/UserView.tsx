import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Exam, Question } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight, Target, Clock, AlertCircle, Play, Pause, RotateCcw, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserViewProps {
  exams: Exam[];
  questions: Question[];
  selectedExamId: string;
  onExamChange: (id: string) => void;
  activeTab: 'general' | 'advanced';
  setActiveTab: (tab: 'general' | 'advanced') => void;
}

export const UserView: React.FC<UserViewProps> = ({ 
  exams, 
  questions, 
  selectedExamId, 
  onExamChange,
  activeTab,
  setActiveTab
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{[key: number]: number}>({});
  const [showResult, setShowResult] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isExamStarted, setIsExamStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeLimit, setTimeLimit] = useState<number>(80); // Default 80 minutes
  const [timeLeft, setTimeLeft] = useState<number>(80 * 60);
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  
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
  
  // Sync timeLeft when timeLimit changes before the exam starts
  useEffect(() => {
    if (!isExamStarted) {
      setTimeLeft(timeLimit * 60);
    }
  }, [timeLimit, isExamStarted]);

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
        onExamChange(filteredExamsForTab[0].id);
      }
    }
  }, [filteredExamsForTab, selectedExamId, onExamChange]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isExamStarted && !isPaused && !showResult) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isExamStarted, isPaused, showResult, timeLimit]);

  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = absSeconds % 60;
    
    let timeStr = "";
    if (h > 0) {
      timeStr = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
      timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return isNegative ? `-${timeStr}` : timeStr;
  };

  const score = useMemo(() => {
    if (!showResult) return 0;
    return questions.reduce((acc, q) => {
      if (userAnswers[q.number] === q.answer) {
        return acc + q.score;
      }
      return acc;
    }, 0);
  }, [showResult, questions, userAnswers]);

  const handleAnswerSelect = (optionNum: number) => {
    if (showResult || !isExamStarted || isPaused) return;
    
    const newAnswers = {
      ...userAnswers,
      [currentQuestion.number]: optionNum
    };
    setUserAnswers(newAnswers);
    
    // Show confirmation modal instead of auto-finishing
    if (Object.keys(newAnswers).length === questions.length && questions.length > 0) {
      setShowConfirmModal(true);
    }
  };

  const finishExam = () => {
    setShowResult(true);
    setShowResultModal(true);
    setIsExamStarted(false);
    setShowConfirmModal(false);
    setTimeLeft(prev => {
      setTotalTime(timeLimit * 60 - prev);
      return prev;
    });
  };

  const startExam = () => {
    setIsExamStarted(true);
    setIsPaused(false);
    setTimeLeft(timeLimit * 60);
    setUserAnswers({});
    setShowResult(false);
    setShowResultModal(false);
    setCurrentQuestionIndex(0);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const resetExam = () => {
    setUserAnswers({});
    setShowResult(false);
    setShowResultModal(false);
    setCurrentQuestionIndex(0);
    setIsExamStarted(false);
    setIsPaused(false);
    setTimeLeft(timeLimit * 60);
    setTotalTime(null);
  };

  return (
    <div className="flex-1 flex flex-col gap-3 h-full overflow-hidden pb-4">
      {/* Top Controller */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase">회차 선택:</span>
            <Select value={selectedExamId} onValueChange={(val) => { onExamChange(val); resetExam(); }}>
              <SelectTrigger className="w-[160px] h-7 rounded-none border-0 bg-slate-50 text-slate-900 font-bold text-[11px] hover:bg-slate-100">
                <SelectValue placeholder="회차 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {filteredExamsForTab.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id} className="text-[11px]">
                    {exam.round} 한국사능력검정시험
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex bg-slate-100 p-1 border border-[#D1D1CF]">
            <button 
              onClick={() => { setActiveTab('general'); resetExam(); }}
              className={`px-4 py-1 text-[11px] font-bold transition-all ${activeTab === 'general' ? 'bg-[#141414] text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              기본
            </button>
            <button 
              onClick={() => { setActiveTab('advanced'); resetExam(); }}
              className={`px-4 py-1 text-[11px] font-bold transition-all ${activeTab === 'advanced' ? 'bg-[#141414] text-white' : 'text-slate-500 hover:text-slate-800'}`}
            >
              심화
            </button>
          </div>
        </div>

        {/* Timer UI */}
        <div className="flex items-center gap-4">
          {!isExamStarted && totalTime === null && (
            <div className="flex items-center gap-2 bg-white px-3 py-1 border border-[#D1D1CF] shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">제한시간:</span>
              <Select value={String(timeLimit)} onValueChange={(val) => setTimeLimit(parseInt(val))}>
                <SelectTrigger className="w-[85px] h-6 rounded-none border-0 bg-slate-50 text-slate-900 font-bold text-[11px] hover:bg-slate-100 px-2">
                  <SelectValue placeholder="시간 설정" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="100" className="text-[11px]">100분</SelectItem>
                  <SelectItem value="90" className="text-[11px]">90분</SelectItem>
                  <SelectItem value="80" className="text-[11px]">80분</SelectItem>
                  <SelectItem value="70" className="text-[11px]">70분</SelectItem>
                  <SelectItem value="60" className="text-[11px]">60분</SelectItem>
                  <SelectItem value="50" className="text-[11px]">50분</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(isExamStarted || totalTime !== null) && (
            <div className={`flex items-center gap-3 px-4 py-1.5 border ${
              isPaused 
                ? 'bg-amber-50 border-amber-200' 
                : timeLeft < 0
                  ? 'bg-red-50 border-red-300 animate-pulse'
                  : timeLeft < 300 
                    ? 'bg-rose-50 border-rose-200' 
                    : 'bg-white border-[#D1D1CF]'
            } shadow-sm transition-colors`}>
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${
                  isPaused 
                    ? 'text-amber-500' 
                    : timeLeft < 0
                      ? 'text-red-500 animate-bounce'
                      : timeLeft < 300 
                        ? 'text-rose-500 animate-pulse' 
                        : 'text-slate-400'
                }`} />
                <span className={`text-[12px] font-mono font-black ${
                  isPaused 
                    ? 'text-amber-600' 
                    : timeLeft < 0
                      ? 'text-red-600 font-extrabold'
                      : timeLeft < 300 
                        ? 'text-rose-600 font-extrabold animate-pulse' 
                        : 'text-slate-900'
                }`}>
                  {formatTime(timeLeft)}
                </span>
                {timeLeft < 0 && !showResult && (
                  <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 font-bold uppercase animate-pulse">시간 초과</span>
                )}
              </div>
              
              {isExamStarted && !showResult && (
                <div className="flex gap-1 border-l border-slate-200 pl-3 ml-1">
                  <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1 hover:bg-slate-100 transition-colors"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                  <button 
                    onClick={resetExam}
                    className="p-1 hover:bg-slate-100 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {showResult && totalTime !== null && (
            <div className="bg-indigo-600 text-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              최종 소요 시간: {formatTime(totalTime)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-3 overflow-hidden relative">
        {/* Left Pane: Question (Flexible Width) */}
        <Card className="flex-1 flex flex-col rounded-none border-[#141414] shadow-[8px_8px_0_rgba(0,0,0,0.05)] bg-white overflow-hidden relative">
          {!isExamStarted && !showResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <div className="bg-[#141414] p-8 text-center text-white shadow-2xl border-4 border-white">
                <div className="w-16 h-16 bg-[#D4AF37] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Play className="w-8 h-8 text-[#141414] fill-current ml-1" />
                </div>
                <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">모의고사 풀기</h3>
                <div className="space-y-1 mb-8">
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                    {exams.find(e => e.id === selectedExamId)?.round} | {activeTab === 'advanced' ? '심화' : '기본'}
                  </p>
                  <p className="text-rose-400 text-[10px] font-black animate-pulse flex items-center justify-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    응시와 동시에 제한시간의 카운트다운이 시작됩니다.
                  </p>
                </div>
                <Button 
                  onClick={startExam}
                  className="bg-[#D4AF37] hover:bg-[#B8962D] text-[#141414] px-10 py-6 rounded-none font-black text-lg transition-all active:scale-95 shadow-[0_4px_0_#94781E]"
                  disabled={questions.length === 0}
                >
                  지금 시작하기
                </Button>
                {questions.length === 0 && (
                  <p className="mt-4 text-rose-400 text-[10px] font-bold">등록된 문항이 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {isPaused && !showResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#141414]/10 backdrop-blur-[4px]">
              <div className="bg-[#141414] p-8 text-center text-white shadow-2xl border-4 border-white">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Pause className="w-8 h-8 text-white fill-current" />
                </div>
                <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">시험 일시 중지</h3>
                <p className="text-white/60 text-xs mb-8 font-bold uppercase tracking-widest">
                  남은 시간: {formatTime(timeLeft)}
                </p>
                <Button 
                  onClick={() => setIsPaused(false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-6 rounded-none font-black text-lg transition-all active:scale-95 shadow-[0_4px_0_#065F46]"
                >
                  다시 시작하기
                </Button>
              </div>
            </div>
          )}

          {currentQuestion ? (
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
                <div className="p-6 space-y-6">
                  {currentQuestion.imageUrl && (
                    <div className="flex justify-center bg-slate-50 border border-[#D1D1CF] p-4">
                      <img 
                        src={currentQuestion.imageUrl} 
                        alt={`Question ${currentQuestion.number}`} 
                        className="max-h-[600px] w-auto border shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border-t border-[#D1D1CF] flex justify-between items-center shrink-0">
                <Button 
                  variant="outline" 
                  className="rounded-none border-[#D1D1CF] h-11 px-6 font-bold"
                  onClick={prevQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> 이전 문제
                </Button>

                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                      <Clock className="w-3 h-3" />
                      {isExamStarted ? (isPaused ? '일시 정지 중' : '시간 측정 중') : showResult ? '시험 종료' : '대기 중'}
                   </div>
                </div>

                <Button 
                  variant="outline" 
                  className="rounded-none border-[#D1D1CF] h-11 px-6 font-bold"
                  onClick={nextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                >
                  다음 문제 <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-[#999] gap-4">
              <AlertCircle className="w-12 h-12 opacity-20" />
              <div className="text-[11px] uppercase tracking-widest opacity-50">문항 등록 대기</div>
              <p className="text-[12px] text-center px-10 leading-relaxed text-slate-500 font-medium">
                해당 회차({exams.find(e => e.id === selectedExamId)?.round})의 문항 정보가 아직 관리자 화면에 등록되지 않았습니다.<br />
                다른 회차나 문제 유형을 선택해 주세요.
              </p>
            </div>
          )}
        </Card>

        {/* Middle Pane: Explanation, Stats & 답지반응률 Panel (Shown only during result review) */}
        {showResult && currentQuestion && (
          <Card className="w-[340px] shrink-0 flex flex-col rounded-none border-t-8 border-indigo-600 border-[#141414] shadow-[8px_8px_0_rgba(0,0,0,0.05)] bg-white overflow-hidden relative">
            <div className="bg-indigo-600 text-white text-center py-2 text-[12px] font-black tracking-widest uppercase">
              문항 해설 및 반응률
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
              {/* Question Correct / Incorrect Summary */}
              {(() => {
                const answer = userAnswers[currentQuestion.number];
                const isCorrect = answer === currentQuestion.answer;
                return (
                  <div className={`p-3.5 border text-center flex flex-col items-center justify-center gap-2 ${
                    isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${
                      isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}>
                      {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className={`text-xs font-black ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {isCorrect ? '정답입니다! 🎉' : '오답입니다... 😢'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                        내 답: <span className="font-mono">{answer || '미선택'}</span> | 정답: <span className="font-mono">{currentQuestion.answer}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Option Selection Rates (답지반응률) */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase">
                  <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                  문항 답지반응률 (선택 분포)
                </h4>
                <div className="bg-slate-50 p-3 border border-slate-100 space-y-2.5">
                  {ratingOptions.map(({ option, rate, percentage }) => {
                    const isCorrectOpt = option === currentQuestion.answer;
                    const isSelectedOpt = option === userAnswers[currentQuestion.number];
                    
                    return (
                      <div key={`rate-user-${option}`} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border ${
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
                              {isSelectedOpt && " (내 선택)"}
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
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase">
                  <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                  문항 상세 정보
                </h4>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
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
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 uppercase">
                  <span className="w-1.5 h-3 bg-indigo-500 inline-block" />
                  정답 해설
                </h4>
                <div className="bg-indigo-50/40 p-3 border border-indigo-100/30 text-[10px] leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                  {currentQuestion.explanation || '등록된 해설이 없습니다.'}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Right Pane: OMR Sheet */}
        <Card className="w-[280px] shrink-0 flex flex-col rounded-none border-[#7c4dff] shadow-[8px_8px_0_rgba(124,77,255,0.05)] bg-white overflow-hidden relative border-t-8">
          <div className="bg-[#7c4dff] text-white text-center py-2 text-[12px] font-black tracking-[0.5em] uppercase">
            답 란
          </div>
          
          <div className="flex-1 overflow-y-auto bg-white border-x border-[#7c4dff]/20">
            <div className="grid grid-cols-2 h-full divide-x divide-[#7c4dff]/20">
              {[0, 25].map((start) => (
                <div key={`col-${start}`} className="flex flex-col">
                  {Array.from({ length: 25 }).map((_, i) => {
                    const qNum = start + i + 1;
                    const isActive = currentQuestion?.number === qNum;
                    const answer = userAnswers[qNum];
                    const q = questions.find(question => question.number === qNum);
                    const originalAnswer = q?.answer;
                    
                    return (
                      <div 
                        key={`omr-wrap-${qNum}`}
                        className={`flex items-center h-[28px] border-b border-[#7c4dff]/10 transition-colors ${isActive ? 'bg-[#7c4dff]/5' : ''} ${qNum % 5 === 0 ? 'border-b-[#7c4dff]/40 border-b-2' : ''}`}
                      >
                        <div className={`w-8 h-full flex items-center justify-center shrink-0 border-r border-[#7c4dff]/20 text-[9px] font-bold ${isActive ? 'bg-[#7c4dff] text-white' : 'bg-[#f3f0ff] text-[#7c4dff]'}`}>
                          {qNum}
                        </div>
                        <div className="flex-1 flex items-center justify-around px-1">
                          {[1, 2, 3, 4, 5].map((num) => {
                            const isChosen = answer === num;
                            const isCorrectCircle = showResult && originalAnswer === num;
                            
                            return (
                              <button
                                key={`omr-${qNum}-${num}`}
                                disabled={showResult || isPaused || !isExamStarted}
                                onClick={() => {
                                  const idx = questions.findIndex(q => q.number === qNum);
                                  if (idx !== -1) {
                                    setCurrentQuestionIndex(idx);
                                    handleAnswerSelect(num);
                                  }
                                }}
                                className={`w-3.5 h-3.5 flex items-center justify-center rounded-full border border-rose-400 text-[8px] font-bold transition-all relative ${
                                  isChosen 
                                    ? 'bg-rose-500 text-white border-rose-500' 
                                    : 'text-rose-400 hover:bg-rose-100'
                                } ${isPaused || !isExamStarted ? 'opacity-30 cursor-not-allowed' : ''}`}
                              >
                                {num}
                                {showResult && isCorrectCircle && !isChosen && (
                                  <div className="absolute -inset-1 border border-[#7c4dff] rounded-full animate-pulse" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t-2 border-[#7c4dff]/40 bg-[#f8f5fc]">
            {!showResult && isExamStarted ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5 px-1">
                  <div className="flex justify-between text-[10px] font-black text-[#7c4dff] uppercase tracking-tighter">
                    <span>답변현황</span>
                    <span>{Object.keys(userAnswers).length} / {questions.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#7c4dff]/10 overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#7c4dff]"
                      initial={{ width: 0 }}
                      animate={{ width: `${(Object.keys(userAnswers).length / (questions.length || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>답변한 문항: {Object.keys(userAnswers).length}</span>
                    <span>남은 문항: {questions.length - Object.keys(userAnswers).length}</span>
                  </div>
                </div>
                <Button 
                  className="w-full h-10 rounded-none bg-[#7c4dff] hover:bg-[#6a3de8] text-white text-[12px] font-black shadow-[4px_4px_0_rgba(124,77,255,0.2)]"
                  onClick={finishExam}
                  disabled={questions.length === 0}
                >
                  채점 및 제출하기
                </Button>
              </div>
            ) : showResult ? (
              <div className="space-y-3 p-1">
                <div className="text-center bg-[#7c4dff] text-white py-3 px-2 rounded-none shadow-md">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-indigo-100 mb-1">최종 시험 결과</span>
                  <div className="text-2xl font-black">{score}점</div>
                  <div className="text-[10px] text-indigo-100 font-bold mt-1">
                    (소요 시간: {totalTime !== null ? formatTime(totalTime) : '-'})
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-none space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-bold text-slate-500">
                    <span>정답 수</span>
                    <span className="text-emerald-600 font-black">
                      {questions.filter(q => userAnswers[q.number] === q.answer).length} / {questions.length}문항
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-500">
                    <span>틀린 문항 수</span>
                    <span className="text-rose-600 font-black">
                      {questions.filter(q => userAnswers[q.number] !== undefined && userAnswers[q.number] !== q.answer).length} / {questions.length}문항
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1 h-9 rounded-none border-[#7c4dff] text-[10px] font-black bg-white text-[#7c4dff] hover:bg-[#7c4dff]/5 px-1"
                    onClick={() => setShowResultModal(true)}
                  >
                    결과 팝업
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 h-9 rounded-none border-[#7c4dff] bg-[#7c4dff] text-white hover:bg-[#6a3de8] text-[10px] font-black px-1"
                    onClick={resetExam}
                  >
                    다시 풀기
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[10px] text-[#7c4dff]/60 font-bold uppercase tracking-widest mb-1">Status</p>
                <div className="h-9 flex items-center justify-center border border-dashed border-[#7c4dff]/30 text-[#7c4dff]/40 text-[11px] font-bold">
                  시험 대기 중
                </div>
              </div>
            )}
          </div>
        </Card>

        {showConfirmModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#141414]/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 text-center shadow-2xl border-4 border-[#141414] max-w-sm w-full mx-4"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <HelpCircle className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-black mb-2 text-[#141414]">모든 문항을 풀었습니다</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                답안 제출을 완료하시겠습니까?<br />제출 후에는 수정이 불가능합니다.
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowConfirmModal(false)}
                  variant="outline"
                  className="flex-1 rounded-none border-[#D1D1CF] h-12 font-bold hover:bg-slate-50"
                >
                  취소
                </Button>
                <Button 
                  onClick={finishExam}
                  className="flex-1 rounded-none bg-[#141414] text-white h-12 font-bold shadow-[4px_4px_0_rgba(0,0,0,0.15)]"
                >
                  완료하기
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showResultModal && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#141414]/60 backdrop-blur-[4px]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 shadow-2xl border-4 border-[#141414] max-w-md w-full mx-4 text-center rounded-none relative"
            >
              <button 
                onClick={() => setShowResultModal(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Target className="w-7 h-7 text-emerald-600" />
              </div>
              
              <h3 className="text-2xl font-black mb-1 text-[#141414] tracking-tight">시험이 종료되었습니다!</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">
                한국사능력검정시험 모의고사 결과
              </p>
              
              <div className="bg-[#fcfbf7] border-2 border-[#141414] p-4 mb-5 text-left space-y-3.5 shadow-[4px_4px_0_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center pb-2.5 border-b border-dashed border-slate-200">
                  <span className="text-xs font-black text-slate-500 uppercase">최종 점수</span>
                  <span className="text-2xl font-black text-[#141414]">{score} <span className="text-xs font-bold text-slate-400">/ 100점</span></span>
                </div>
                
                <div className="flex justify-between items-center pb-2.5 border-b border-dashed border-slate-200">
                  <span className="text-xs font-black text-slate-500 uppercase">총 소요 시간</span>
                  <span className="text-base font-mono font-black text-slate-900">
                    {totalTime !== null ? formatTime(totalTime) : '-'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-emerald-50 border border-emerald-100 p-2 text-center">
                    <span className="block text-[8px] text-emerald-600 font-bold uppercase mb-0.5">맞은 문항 수</span>
                    <span className="font-black text-emerald-700">
                      {questions.filter(q => userAnswers[q.number] === q.answer).length} / {questions.length}
                    </span>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-2 text-center">
                    <span className="block text-[8px] text-rose-600 font-bold uppercase mb-0.5">틀린 문항 수</span>
                    <span className="font-black text-rose-700">
                      {questions.filter(q => userAnswers[q.number] !== undefined && userAnswers[q.number] !== q.answer).length} / {questions.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Button 
                  onClick={resetExam}
                  variant="outline"
                  className="flex-1 rounded-none border-[#141414] border-2 h-11 font-black text-[11px] hover:bg-slate-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> 다시 풀기
                </Button>
                <Button 
                  onClick={() => setShowResultModal(false)}
                  className="flex-1 rounded-none bg-[#141414] text-white h-11 font-black text-[11px] shadow-[4px_4px_0_rgba(0,0,0,0.15)] hover:bg-slate-800"
                >
                  오답 해설 검토하기
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
