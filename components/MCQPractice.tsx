import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, CheckCircle, XCircle, AlertCircle, RotateCcw, 
  Bookmark, Tag, SlidersHorizontal, Settings2, X, Clock, 
  ChevronDown, ChevronUp, Eye, Star, Loader2 
} from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { Chapter, MCQ, Topic } from '../types'; // Assume these types are defined

interface MCQPracticeProps {
  chapter: Chapter;
  onBack: () => void;
  user: User;
  isQuickRevision?: boolean;
}

interface UserAnswerResult {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number; // 1-based index from DB
  selectedOption: number; // 0-based index from UI
  isCorrect: boolean;
  explanation?: string;
}

const MAX_QUESTIONS_PER_SESSION = 20;

const MCQPractice: React.FC<MCQPracticeProps> = ({ chapter, onBack, user, isQuickRevision = false }) => {
  const [allQuestions, setAllQuestions] = useState<MCQ[]>([]); // Store all fetched source data
  const [questions, setQuestions] = useState<MCQ[]>([]); // Store filtered & sliced current session data
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Filter State
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Temporary Filter State (inside modal)
  const [tempTopicId, setTempTopicId] = useState<string | null>(selectedTopicId);
  const [tempLimit, setTempLimit] = useState(MAX_QUESTIONS_PER_SESSION);
  const [tempFilterMode, setTempFilterMode] = useState<'all' | 'new' | 'bookmarked'>('all');
  
  // Practice Session State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null); // 0-based index
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [sessionResults, setSessionResults] = useState<UserAnswerResult[]>([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  
  // Quick Revision State
  const [userBookmarks, setUserBookmarks] = useState<Set<string>>(new Set());

  // --- Data Fetching ---

  const fetchTopics = useCallback(async () => {
    const q = query(collection(db, 'topics'), where('chapterId', '==', chapter.id));
    const snapshot = await getDocs(q);
    const fetchedTopics = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Topic[];
    setTopics([{ id: 'all', title: 'All Topics', chapterId: chapter.id, order: 0 }, ...fetchedTopics]);
  }, [chapter.id]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all questions for the chapter
      const questionsQ = query(collection(db, 'mcqs'), where('chapterId', '==', chapter.id));
      const qSnapshot = await getDocs(questionsQ);
      const fetchedQuestions = qSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MCQ[];
      setAllQuestions(fetchedQuestions);

      // 2. Fetch user bookmarks
      const bookmarksQ = query(collection(db, `users/${user.uid}/bookmarks`), where('chapterId', '==', chapter.id));
      const bSnapshot = await getDocs(bookmarksQ);
      const bookmarks = new Set(bSnapshot.docs.map(doc => doc.id));
      setUserBookmarks(bookmarks);
      
      // Initial filtering and setting up the session
      setupSession(fetchedQuestions, bookmarks, tempFilterMode, tempTopicId, tempLimit);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [chapter.id, user.uid]);

  useEffect(() => {
    fetchTopics();
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id, user.uid]);
  
  // --- Session Setup & Filtering Logic ---

  const setupSession = useCallback((
    sourceQuestions: MCQ[], 
    bookmarks: Set<string>, 
    mode: 'all' | 'new' | 'bookmarked', 
    topicId: string | null,
    limit: number
  ) => {
    let filtered: MCQ[] = sourceQuestions;

    // 1. Filter by Topic
    if (topicId && topicId !== 'all') {
      filtered = filtered.filter(q => q.topicId === topicId);
    }

    // 2. Filter by Mode (Bookmarked only for Quick Revision)
    if (isQuickRevision || mode === 'bookmarked') {
        filtered = filtered.filter(q => bookmarks.has(q.id));
    } else if (mode === 'new') {
        // Mock logic for 'new' - in a real app, this would check user progress/history
        // For now, let's skip 'new' filter if it's not a real feature.
        // filtered = filtered.filter(q => !userHistory.has(q.id));
    }
    
    // 3. Shuffle (optional, but good practice for practice)
    const shuffled = filtered.sort(() => Math.random() - 0.5);

    // 4. Slice to limit
    const finalQuestions = shuffled.slice(0, limit);
    
    setQuestions(finalQuestions);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setSessionResults([]);
    setIsSessionComplete(finalQuestions.length === 0);

  }, [isQuickRevision]);

  // --- Handlers ---

  const handleApplyFilter = () => {
    setSelectedTopicId(tempTopicId);
    setTempLimit(tempLimit);
    setTempFilterMode(tempFilterMode);
    setupSession(allQuestions, userBookmarks, tempFilterMode, tempTopicId, tempLimit);
    setShowFilterModal(false);
  };

  const handleOpenFilter = () => {
    setTempTopicId(selectedTopicId);
    setTempLimit(questions.length > 0 ? questions.length : MAX_QUESTIONS_PER_SESSION);
    setShowFilterModal(true);
  };

  const handleCheckAnswer = async () => {
    if (selectedOption === null || isAnswerChecked) return;

    const currentQ = questions[currentQuestionIndex];
    const isCorrect = selectedOption === currentQ.correctAnswer - 1;

    setIsAnswerChecked(true);
    
    const result: UserAnswerResult = {
      questionId: currentQ.id,
      question: currentQ.question,
      options: currentQ.options,
      correctAnswer: currentQ.correctAnswer,
      selectedOption: selectedOption,
      isCorrect: isCorrect,
      explanation: currentQ.explanation,
    };
    
    setSessionResults(prev => [...prev, result]);

    // Update user progress (e.g., Firestore)
    try {
      const statsRef = doc(db, `users/${user.uid}/progress/${currentQ.id}`);
      await setDoc(statsRef, {
        isCorrect: isCorrect,
        chapterId: currentQ.chapterId,
        subjectId: chapter.subjectId,
        timestamp: new Date(),
        attemptCount: 1, // simplified
      }, { merge: true });
    } catch (e) {
      console.error("Error saving progress:", e);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerChecked(false);
    } else {
      setIsSessionComplete(true);
    }
  };
  
  const handleResetSession = () => {
    setupSession(allQuestions, userBookmarks, tempFilterMode, tempTopicId, tempLimit);
    setIsSessionComplete(false);
  }

  const handleToggleBookmark = async (questionId: string, isBookmarked: boolean) => {
    const bookmarkRef = doc(db, `users/${user.uid}/bookmarks/${questionId}`);
    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setUserBookmarks(prev => {
          const newSet = new Set(prev);
          newSet.delete(questionId);
          return newSet;
        });
      } else {
        await setDoc(bookmarkRef, {
          chapterId: chapter.id,
          subjectId: chapter.subjectId,
          timestamp: new Date(),
        });
        setUserBookmarks(prev => new Set(prev).add(questionId));
      }
      setMsg({ type: 'success', text: isBookmarked ? 'Bookmark Removed' : 'Question Bookmarked!' });
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      console.error("Error toggling bookmark:", e);
      setMsg({ type: 'error', text: 'Failed to update bookmark.' });
      setTimeout(() => setMsg(null), 2000);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const totalCorrect = sessionResults.filter(r => r.isCorrect).length;
  const totalAttempted = sessionResults.length;
  
  const [msg, setMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  // --- Components ---

  const FilterModal = () => (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-app-card rounded-2xl w-full max-w-sm p-6 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings2 className="w-5 h-5" /> Practice Settings</h3>
          <button onClick={() => setShowFilterModal(false)} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          
          {/* Topic Filter */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2"><Tag className="w-4 h-4" /> Filter by Topic</label>
            <select
              value={tempTopicId || 'all'}
              onChange={(e) => setTempTopicId(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:border-green-500 outline-none"
            >
              {topics.map(t => (
                <option key={t.id} value={t.id} className="bg-gray-900">{t.title}</option>
              ))}
            </select>
          </div>

          {/* Question Limit */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2"><LayoutList className="w-4 h-4" /> Number of Questions</label>
            <input 
              type="number" 
              value={tempLimit} 
              onChange={(e) => setTempLimit(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              min="1"
              max="100"
              className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:border-green-500 outline-none"
            />
          </div>

          {/* Filter Mode (Only visible if not Quick Revision) */}
          {!isQuickRevision && (
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Filter Mode</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setTempFilterMode('all')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tempFilterMode === 'all' ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setTempFilterMode('bookmarked')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tempFilterMode === 'bookmarked' ? 'bg-yellow-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  Bookmarked <Bookmark className="w-4 h-4 inline-block ml-1" />
                </button>
                {/* <button
                  onClick={() => setTempFilterMode('new')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tempFilterMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  New
                </button> */}
              </div>
            </div>
          )}

          <button
            onClick={handleApplyFilter}
            className="w-full py-3 mt-4 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" /> Apply Filters
          </button>
        </div>
      </div>
    </div>
  );

  const SessionCompleteScreen = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 min-h-[400px]">
      <Star className="w-12 h-12 text-yellow-500 mb-4 animate-bounce" />
      <h2 className="text-2xl font-bold text-white mb-2">অভিনন্দন! 🎉</h2>
      <p className="text-gray-400 mb-8">আপনার {questions.length} প্রশ্নের অনুশীলন সেশন শেষ হয়েছে।</p>
      
      <div className="bg-app-card rounded-2xl p-6 border border-white/5 w-full max-w-sm space-y-3 mb-8">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <span className="text-gray-300 font-medium">মোট প্রশ্ন:</span>
          <span className="text-lg font-bold text-white">{questions.length}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> সঠিক উত্তর:</span>
          <span className="text-lg font-bold text-green-500">{totalCorrect}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-300 font-medium flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> ভুল উত্তর:</span>
          <span className="text-lg font-bold text-red-500">{totalAttempted - totalCorrect}</span>
        </div>
        <div className="flex justify-between items-center border-t border-white/5 pt-3">
          <span className="text-gray-300 font-medium">স্কোর:</span>
          <span className="text-xl font-extrabold text-green-400">
            {questions.length > 0 ? ((totalCorrect / questions.length) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>

      <button
        onClick={handleResetSession}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-5 h-5" /> আবার শুরু করুন
      </button>

      <button
        onClick={onBack}
        className="mt-4 text-gray-400 hover:text-white text-sm font-medium transition-colors"
      >
        Go back to Chapter Selection
      </button>
      
    </div>
  );
  
  // --- Main Render ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white">
        <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-3" />
        <p>Questions are loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto relative pb-24">
      {showFilterModal && <FilterModal />}
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md flex items-center justify-between px-4 py-4 border-b border-white/5">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
          <ArrowLeft className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>
        <div className="text-center flex-1 mx-2">
          <h2 className="text-lg font-bold text-white truncate">{chapter.title}</h2>
          <p className="text-xs text-gray-500">{isQuickRevision ? 'Quick Revision' : 'MCQ Practice'}</p>
        </div>
        <button 
          onClick={handleOpenFilter}
          className="p-2 text-gray-400 hover:text-green-500 rounded-full transition-colors relative"
          title="Filter Settings"
        >
          <Settings2 className="w-5 h-5" />
          {(selectedTopicId && selectedTopicId !== 'all') && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-black"></div>
          )}
        </button>
      </div>

      {msg && (
        <div className={`mx-4 mt-3 p-3 rounded-xl flex items-center justify-center gap-2 ${msg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          <p className="text-sm font-medium">{msg.text}</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {isSessionComplete ? (
          <SessionCompleteScreen />
        ) : questions.length > 0 && currentQuestion ? (
          <>
             {/* Progress Bar */}
             <div className="flex justify-between items-center mb-3">
               <span className="text-sm font-bold text-green-500">
                 Question {currentQuestionIndex + 1} of {questions.length}
               </span>
               <div className="flex items-center gap-2">
                  {/* Bookmark Button */}
                  <button 
                    onClick={() => handleToggleBookmark(currentQuestion.id, userBookmarks.has(currentQuestion.id))}
                    className={`p-1.5 rounded-full transition-colors ${userBookmarks.has(currentQuestion.id) ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                    title={userBookmarks.has(currentQuestion.id) ? 'Remove Bookmark' : 'Bookmark Question'}
                  >
                     <Bookmark className={`w-4 h-4 ${userBookmarks.has(currentQuestion.id) ? 'fill-yellow-400' : ''}`} />
                  </button>
               </div>
             </div>
             <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-6">
                <div 
                   className="h-full bg-green-600 transition-all duration-300" 
                   style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                ></div>
             </div>
             
             {/* Question Card */}
             <div className="bg-app-card rounded-2xl p-6 border border-white/5 shadow-xl animate-in fade-in slide-in-from-right-2 duration-300">
                
                {/* Topic Label */}
                {currentQuestion.topicId && (
                   <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full mb-3 inline-flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {topics.find(t => t.id === currentQuestion.topicId)?.title || 'General'}
                   </span>
                )}
                
                {/* Question Text */}
                <h3 className="text-base font-medium text-white mb-4 leading-relaxed mt-2">
                   {currentQuestion.question}
                </h3>
                
                {/* Options */}
                <div className="space-y-3">
                   {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedOption === index;
                      const isCorrectAnswer = index === currentQuestion.correctAnswer - 1;
                      
                      let optionClass = 'bg-white/5 hover:bg-white/10 border-white/10';
                      let icon = null;
                      
                      if (isAnswerChecked) {
                         if (isCorrectAnswer) {
                            optionClass = 'bg-green-500/10 border-green-500 text-green-400';
                            icon = <CheckCircle className="w-5 h-5 shrink-0" />;
                         } else if (isSelected) {
                            optionClass = 'bg-red-500/10 border-red-500 text-red-400';
                            icon = <XCircle className="w-5 h-5 shrink-0" />;
                         }
                      } else if (isSelected) {
                         optionClass = 'bg-green-500/10 border-green-500 text-green-400';
                      }

                      return (
                         <button
                           key={index}
                           onClick={() => !isAnswerChecked && setSelectedOption(index)}
                           disabled={isAnswerChecked}
                           className={`w-full text-left p-4 rounded-xl border flex items-start gap-3 transition-all ${optionClass} disabled:cursor-default`}
                         >
                            <span className="font-bold text-sm min-w-[20px] pt-0.5">{String.fromCharCode(65 + index)}.</span>
                            <span className="flex-1 text-sm font-medium">{option}</span>
                            {icon}
                         </button>
                      );
                   })}
                </div>
                
                {/* Explanation */}
                {isAnswerChecked && (
                   <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h4 className="flex items-center gap-2 text-sm font-bold mb-2 border-b border-blue-500/20 pb-1"><Eye className="w-4 h-4" /> ব্যাখ্যা</h4>
                      <p className="text-xs leading-relaxed">{currentQuestion.explanation || "No explanation available."}</p>
                   </div>
                )}
             </div>
          </>
        ) : (
           <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center pt-20">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-base font-medium">No questions match the current filter.</p>
              <button onClick={handleOpenFilter} className="text-green-500 text-sm mt-4 underline flex items-center gap-1">
                <Settings2 className="w-3 h-3" /> Change Settings
              </button>
           </div>
        )}
      </div>

      {/* Footer Action Button */}
      <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto z-20">
        {!isSessionComplete && questions.length > 0 && !isAnswerChecked ? (
          <button
            onClick={handleCheckAnswer}
            disabled={selectedOption === null}
            className="w-full py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10"
          >
            যাচাই করুন
          </button>
        ) : !isSessionComplete && questions.length > 0 ? (
          <button
            onClick={handleNext}
            className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-500 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
          >
            {currentQuestionIndex < questions.length - 1 ? 'পরবর্তী প্রশ্ন' : 'ফলাফল দেখুন'}
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default MCQPractice;
