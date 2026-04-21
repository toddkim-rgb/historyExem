import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Exam, Question } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight, Target, Clock, AlertCircle } from 'lucide-react';
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

  const currentQuestion = questions[currentQuestionIndex];
  
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
    if (showResult) return;
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.number]: optionNum
    }));
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
    setCurrentQuestionIndex(0);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden pb-4">
      {/* Top Controller */}
      <div className="flex items-center justify-start gap-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#D1D1CF] shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase">회차 선택:</span>
            <Select value={selectedExamId} onValueChange={(val) => { onExamChange(val); resetExam(); }}>
              <SelectTrigger className="w-[160px] h-7 rounded-none border-0 bg-slate-50 text-slate-900 font-bold text-[11px] hover:bg-slate-100">
                <SelectValue placeholder="회차 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id} className="text-[11px]">
                    {exam.round.includes('회') ? exam.round : `${exam.round}회`} 한국사능력검정시험
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
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* Left Pane: Question Status List */}
        <Card className="w-[280px] flex flex-col rounded-none border-[#D1D1CF] shadow-none bg-white overflow-hidden shrink-0">
          <CardHeader className="bg-[#F9F9F8] border-b border-[#D1D1CF] py-3">
            <CardTitle className="text-[11px] font-bold uppercase text-slate-500 flex items-center justify-between">
              <span>문항 리스트</span>
              {showResult && <span className="text-emerald-600">점수: {score}점</span>}
            </CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.number];
                const isCurrent = currentQuestionIndex === idx;
                const isCorrect = showResult && userAnswers[q.number] === q.answer;
                const isWrong = showResult && isAnswered && userAnswers[q.number] !== q.answer;

                return (
                  <button
                    key={q.id || `q-nav-${q.number}`}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 text-[11px] font-bold flex items-center justify-center border transition-all ${
                      isCurrent 
                        ? 'border-[#141414] bg-[#141414] text-white ring-2 ring-yellow-400 ring-offset-1' 
                        : isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : isWrong
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : isAnswered 
                        ? 'border-[#141414] bg-slate-50 text-[#141414]' 
                        : 'border-[#D1D1CF] bg-white text-slate-400 hover:border-[#141414]'
                    }`}
                  >
                    {q.number}
                  </button>
                );
              })}
            </div>
            {questions.length === 0 && (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-400 italic text-center px-4">
                선택된 회차에 등록된 문항이 없습니다.
              </div>
            )}
          </div>
          <div className="p-3 border-t border-[#D1D1CF] bg-slate-50">
            {!showResult ? (
              <Button 
                className="w-full h-10 rounded-none bg-[#141414] text-white text-[12px] font-bold shadow-[4px_4px_0_rgba(0,0,0,0.1)]"
                onClick={() => setShowResult(true)}
                disabled={questions.length === 0}
              >
                채점하기
              </Button>
            ) : (
              <Button 
                variant="outline"
                className="w-full h-10 rounded-none border-[#141414] text-[12px] font-bold bg-white"
                onClick={resetExam}
              >
                다시 풀기
              </Button>
            )}
          </div>
        </Card>

        {/* Right Pane: Question Content */}
        <Card className="flex-1 flex flex-col rounded-none border-[#141414] shadow-[8px_8px_0_rgba(0,0,0,0.05)] bg-white overflow-hidden">
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
                <div className="p-6 space-y-8">
                  {/* Image Area */}
                  {currentQuestion.imageUrl && (
                    <div className="flex justify-center bg-slate-50 border border-[#D1D1CF] p-4">
                      <img 
                        src={currentQuestion.imageUrl} 
                        alt={`Question ${currentQuestion.number}`} 
                        className="max-h-[400px] w-auto border shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Options */}
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((num) => {
                      const isSelected = userAnswers[currentQuestion.number] === num;
                      const isCorrect = showResult && currentQuestion.answer === num;
                      const isWrong = showResult && isSelected && currentQuestion.answer !== num;

                      return (
                        <button
                          key={`opt-${num}`}
                          onClick={() => handleAnswerSelect(num)}
                          disabled={showResult}
                          className={`w-full flex items-center gap-4 p-4 border transition-all text-left ${
                            isCorrect 
                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' 
                              : isWrong 
                              ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                              : isSelected 
                              ? 'border-[#141414] bg-slate-50' 
                              : 'border-[#D1D1CF] hover:border-[#141414] bg-white'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 font-bold transition-all ${
                            isCorrect 
                              ? 'bg-emerald-500 border-emerald-500 text-white' 
                              : isWrong 
                              ? 'bg-red-500 border-red-500 text-white'
                              : isSelected 
                              ? 'bg-[#141414] border-[#141414] text-white' 
                              : 'border-[#D1D1CF] text-slate-400'
                          }`}>
                            {isCorrect ? <Check className="w-5 h-5" /> : num}
                          </div>
                          <span className={`text-[13px] font-bold ${isSelected || isCorrect || isWrong ? 'text-slate-900' : 'text-slate-600'}`}>
                            {currentQuestion.options?.[num - 1] || `${num}번 선택지 내용이 없습니다.`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Area */}
                  {showResult && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-10 p-6 bg-indigo-50 border border-indigo-100 border-l-4 border-l-indigo-500"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-black text-sm text-indigo-900 uppercase">해설 및 정답 분석</h4>
                      </div>
                      <p className="text-[13px] text-indigo-900/80 leading-relaxed font-medium">
                        {currentQuestion.explanation || '등록된 해설이 없습니다.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {currentQuestion.keywords.map((kw, i) => (
                          <span key={i} className="text-[10px] bg-white px-2 py-1 border border-indigo-200 text-indigo-600 font-bold">
                            {kw.startsWith('#') ? kw : `#${kw}`}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#F9F9F8] border-t border-[#D1D1CF] flex justify-between items-center shrink-0">
                <Button 
                  variant="outline" 
                  className="rounded-none border-[#D1D1CF] h-10 px-4 gap-2 flex items-center font-bold"
                  onClick={prevQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" /> 이전 문항
                </Button>

                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                      <Clock className="w-3 h-3" />
                      실시간 시간 측정 중
                   </div>
                </div>

                <Button 
                  variant="outline" 
                   className="rounded-none border-[#D1D1CF] h-10 px-4 gap-2 flex items-center font-bold"
                  onClick={nextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                >
                  다음 문항 <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#999] gap-4">
              <AlertCircle className="w-12 h-12 opacity-20" />
              <div className="text-[11px] uppercase tracking-widest opacity-50">문제풀이 대기 중</div>
              <p className="text-[12px] text-center px-10 leading-relaxed">
                좌측 문항 리스트에서 풀고 싶은 문항을 선택하거나<br />상단에서 기출 회차를 선택해 주세요.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
