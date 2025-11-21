import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, PlayCircle, Lock, FileText, Bookmark, Sigma, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
// import { Subject, Chapter } from '../types'; // Assume these types are defined

interface Subject {
  id: string;
  title: string;
  classLevel: string;
}

interface Chapter {
  id: string;
  subjectId: string;
  title: string;
  order: number;
  isLocked: boolean;
  mcqCount: number; // For MCQ Mode
  formulaCount: number; // For Formula Mode
  revisionCount: number; // For Quick Revision Mode (e.g. number of bookmarked Qs)
}


interface ChapterSelectionProps {
  subject: Subject;
  onBack: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  isQuickRevision?: boolean;
  isFormulaMode?: boolean;
}

const ChapterSelection: React.FC<ChapterSelectionProps> = ({ 
  subject, 
  onBack, 
  onSelectChapter, 
  isQuickRevision = false,
  isFormulaMode = false
}) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChapters = async () => {
      try {
        setLoading(true);
        // Query chapters where subjectId matches the selected subject's ID
        const q = query(
          collection(db, 'chapters'), 
          where('subjectId', '==', subject.id)
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedChapters = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Chapter[];
        
        // Sort chapters by order property
        fetchedChapters.sort((a, b) => a.order - b.order);
        
        setChapters(fetchedChapters);
      } catch (error) {
        console.error("Error fetching chapters:", (error as any).message);
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [subject.id]);
  
  const handleChapterClick = (chapter: Chapter) => {
    // Prevent action if chapter is locked and not in formula/revision mode
    if (!isQuickRevision && !isFormulaMode && chapter.isLocked) {
      return; 
    }
    
    // Check for content availability in specific modes
    if (isFormulaMode && chapter.formulaCount === 0) {
        alert("Sorry, no formulas available for this chapter yet.");
        return;
    }
    
    if (isQuickRevision && chapter.revisionCount === 0) {
        alert("You have no bookmarked questions for this chapter.");
        return;
    }

    onSelectChapter(chapter);
  }

  // Helper functions for dynamic content based on mode
  const getActionText = useCallback((chapter: Chapter) => {
    if (isQuickRevision) return `${chapter.revisionCount || 0} Bookmarked Qs`;
    if (isFormulaMode) return `${chapter.formulaCount || 0} Formulas`;
    return `${chapter.mcqCount || 0} MCQs`;
  }, [isFormulaMode, isQuickRevision]);
  
  const getActionTextIcon = useCallback(() => {
    if (isQuickRevision) return <Bookmark className="w-3 h-3 text-yellow-500" />;
    if (isFormulaMode) return <Sigma className="w-3 h-3 text-pink-500" />;
    return <FileText className="w-3 h-3 text-gray-500" />;
  }, [isFormulaMode, isQuickRevision]);
  
  const getActionIcon = (chapter: Chapter) => {
    if (isFormulaMode) {
      return <Sigma className="w-5 h-5 text-pink-500" />;
    }
    if (isQuickRevision) {
      return <Bookmark className="w-5 h-5 text-yellow-500" />;
    }
    if (chapter.isLocked) {
      return <Lock className="w-5 h-5 text-red-500" />;
    }
    return <PlayCircle className="w-5 h-5 text-green-500" />;
  };


  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-300 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 mt-2 px-4">
        <button 
          onClick={onBack} 
          className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2"
        >
           <ArrowLeft className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight truncate flex-1">
           {subject.title}
        </h2>
        <span className="text-sm font-medium text-gray-500 bg-white/5 px-3 py-1 rounded-full">{subject.classLevel}</span>
      </div>

      <div className="px-4">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">
          {isQuickRevision ? 'Quick Revision' : isFormulaMode ? 'Formula List' : 'অধ্যায় নির্বাচন করুন'}
        </h3>
      </div>

      {loading ? (
        <div className="px-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-app-card rounded-xl p-4 flex justify-between items-center border border-white/5 animate-pulse h-16">
              <div className="h-4 w-1/2 bg-white/10 rounded"></div>
              <div className="h-6 w-6 bg-white/10 rounded-full"></div>
            </div>
          ))}
        </div>
      ) : chapters.length === 0 ? (
        <div className="text-center py-10 px-4">
          <AlertCircle className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400">এই বিষয়ের জন্য কোনো অধ্যায় পাওয়া যায়নি।</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              onClick={() => handleChapterClick(chapter)}
              className={`p-4 rounded-xl flex items-center justify-between border border-white/5 transition-all ${
                (!isQuickRevision && !isFormulaMode && chapter.isLocked) ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#252525] cursor-pointer active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  (!isQuickRevision && !isFormulaMode && chapter.isLocked) 
                    ? 'bg-gray-800 text-gray-500' 
                    : isFormulaMode 
                      ? 'bg-pink-500/10 text-pink-500' 
                      : 'bg-green-500/10 text-green-500'
                }`}>
                  <span className="font-bold text-sm">{index + 1}</span>
                </div>
                
                <div>
                  <h3 className="text-gray-100 font-medium text-base leading-tight">{chapter.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getActionTextIcon()}
                    <span className={`text-[10px] ${isQuickRevision ? 'text-yellow-500' : isFormulaMode ? 'text-pink-500' : 'text-gray-500'}`}>
                      {getActionText(chapter)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {getActionIcon(chapter)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChapterSelection;
