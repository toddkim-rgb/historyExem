import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Exam, Question } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, ChevronLeft, ChevronRight, Target, Search, AlertCircle, HelpCircle, X } from 'lucide-react';
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

  const fetchQuestion = async () => {
    if (!selectedExamId || !questionNumber) return;
    
    setIsLoading(true);
    setShowResult(false);
    setUserAnswer(null);
    setCurrentQuestion(null);

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
              {exams.map((exam) => (
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
                  </div>
                </div>

                {/* Answer Comparison Grid */}
                <div className="flex-1 p-6 flex flex-col justify-center items-center gap-6">
                  <div className="w-full grid grid-cols-2 gap-4">
                    <div className={`p-5 border text-center transition-all ${
                      userAnswer === currentQuestion.answer 
                        ? 'bg-emerald-50/30 border-emerald-100' 
                        : 'bg-rose-50/30 border-rose-100'
                    }`}>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        내가 선택한 답
                      </span>
                      <div className={`inline-flex w-14 h-14 rounded-full items-center justify-center text-2xl font-black ${
                        userAnswer === currentQuestion.answer 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-rose-500 text-white'
                      }`}>
                        {userAnswer}
                      </div>
                    </div>

                    <div className="p-5 border border-emerald-100 bg-emerald-50/10 text-center transition-all">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-600/70 mb-2">
                        실제 정답
                      </span>
                      <div className="inline-flex w-14 h-14 rounded-full items-center justify-center text-2xl font-black bg-emerald-500 text-white">
                        {currentQuestion.answer}
                      </div>
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
