import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Plus, Upload, Trash2, CheckCircle, AlertCircle, 
  LayoutList, GraduationCap, Sigma, Loader2, Pencil, X, 
  RefreshCw, Eye, Tag, BookOpen, FileText
} from 'lucide-react';
import { collection, addDoc, getDocs, writeBatch, doc, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
// import { Subject, Chapter, Formula, Topic } from '../types'; // Assume these types are defined

// Simplified Type Definitions (must match actual types in your app)
interface Subject { id: string; title: string; classLevel: string; }
interface Chapter { id: string; subjectId: string; title: string; order: number; isLocked: boolean; }
interface Topic { id: string; chapterId: string; title: string; }
interface Formula { id: string; chapterId: string; title: string; formula_latex: string; description: string; }
interface MCQ { id: string; chapterId: string; topicId?: string; question: string; options: string[]; correctAnswer: number; explanation?: string; }


interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'subject' | 'chapter' | 'topic' | 'mcq' | 'formula' | 'manage'>('subject');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Admin selected class context
  const [adminSelectedClass, setAdminSelectedClass] = useState('Class 8');
  const classes = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

  // Data States
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  
  // Selection States for cascading selects
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Form Data States
  const [newSubjectTitle, setNewSubjectTitle] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newFormulaTitle, setNewFormulaTitle] = useState('');
  const [newFormulaLatex, setNewFormulaLatex] = useState('');
  const [newFormulaDescription, setNewFormulaDescription] = useState('');
  const [newMcqData, setNewMcqData] = useState<Partial<MCQ>>({
    question: '', options: ['', '', '', ''], correctAnswer: 1, explanation: ''
  });

  // --- Fetching Logic ---
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'subjects'), where('classLevel', '==', adminSelectedClass));
      const snapshot = await getDocs(q);
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    } catch (e) {
      console.error("Error fetching subjects:", e);
      setMsg({ type: 'error', text: 'Failed to load subjects.' });
    } finally {
      setLoading(false);
    }
  }, [adminSelectedClass]);

  const fetchChapters = useCallback(async (subjectId: string) => {
    if (!subjectId) return setChapters([]);
    setLoading(true);
    try {
      const q = query(collection(db, 'chapters'), where('subjectId', '==', subjectId));
      const snapshot = await getDocs(q);
      setChapters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter)).sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error("Error fetching chapters:", e);
      setMsg({ type: 'error', text: 'Failed to load chapters.' });
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchTopics = useCallback(async (chapterId: string) => {
    if (!chapterId) return setTopics([]);
    setLoading(true);
    try {
      const q = query(collection(db, 'topics'), where('chapterId', '==', chapterId));
      const snapshot = await getDocs(q);
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic)));
    } catch (e) {
      console.error("Error fetching topics:", e);
      setMsg({ type: 'error', text: 'Failed to load topics.' });
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (activeTab === 'subject' || activeTab === 'manage') {
        fetchSubjects();
    }
  }, [adminSelectedClass, activeTab, fetchSubjects]);

  useEffect(() => {
    if (selectedSubjectId) {
        fetchChapters(selectedSubjectId);
    } else {
        setChapters([]);
        setSelectedChapterId('');
    }
  }, [selectedSubjectId, fetchChapters]);
  
  useEffect(() => {
    if (selectedChapterId && (activeTab === 'topic' || activeTab === 'mcq' || activeTab === 'formula')) {
        fetchTopics(selectedChapterId);
    } else {
        setTopics([]);
        setSelectedTopicId('');
    }
  }, [selectedChapterId, activeTab, fetchTopics]);


  // --- CRUD Logic ---

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectTitle.trim()) return setMsg({ type: 'error', text: 'Subject title is required.' });
    setLoading(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        title: newSubjectTitle.trim(),
        classLevel: adminSelectedClass,
        createdAt: new Date(),
      });
      setNewSubjectTitle('');
      setMsg({ type: 'success', text: 'Subject added successfully!' });
      fetchSubjects(); // Refresh list
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to add subject.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete Chapter: "${chapterTitle}"? This will delete all associated data (topics, MCQs, formulas) from this chapter!`)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const chapterRef = doc(db, 'chapters', chapterId);
      batch.delete(chapterRef);

      // Delete associated Topics
      const topicsQ = query(collection(db, 'topics'), where('chapterId', '==', chapterId));
      const topicsSnapshot = await getDocs(topicsQ);
      topicsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // Delete associated MCQs (This can be a large operation, consider pagination in a real app)
      const mcqsQ = query(collection(db, 'mcqs'), where('chapterId', '==', chapterId));
      const mcqsSnapshot = await getDocs(mcqsQ);
      mcqsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // Delete associated Formulas
      const formulasQ = query(collection(db, 'formulas'), where('chapterId', '==', chapterId));
      const formulasSnapshot = await getDocs(formulasQ);
      formulasSnapshot.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();
      
      setMsg({ type: 'success', text: `Chapter "${chapterTitle}" and all related data deleted successfully!` });
      fetchChapters(selectedSubjectId); // Refresh chapter list
    } catch (e) {
      console.error("Error deleting chapter and related data:", e);
      setMsg({ type: 'error', text: 'Failed to delete chapter and related data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !newChapterTitle.trim()) return setMsg({ type: 'error', text: 'Subject selection and chapter title are required.' });
    setLoading(true);
    try {
      // Determine the next order number
      const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order)) + 1 : 1;

      await addDoc(collection(db, 'chapters'), {
        subjectId: selectedSubjectId,
        title: newChapterTitle.trim(),
        order: nextOrder,
        isLocked: true, // New chapters are locked by default
        mcqCount: 0, // Should be updated separately
        formulaCount: 0, // Should be updated separately
        createdAt: new Date(),
      });
      setNewChapterTitle('');
      setMsg({ type: 'success', text: 'Chapter added successfully!' });
      fetchChapters(selectedSubjectId); // Refresh list
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to add chapter.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterId || !newTopicTitle.trim()) return setMsg({ type: 'error', text: 'Chapter selection and topic title are required.' });
    setLoading(true);
    try {
      await addDoc(collection(db, 'topics'), {
        chapterId: selectedChapterId,
        title: newTopicTitle.trim(),
        createdAt: new Date(),
      });
      setNewTopicTitle('');
      setMsg({ type: 'success', text: 'Topic added successfully!' });
      fetchTopics(selectedChapterId); // Refresh list
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to add topic.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterId || !newFormulaTitle.trim() || !newFormulaLatex.trim()) return setMsg({ type: 'error', text: 'Chapter, title, and formula (LaTeX) are required.' });
    setLoading(true);
    try {
      await addDoc(collection(db, 'formulas'), {
        chapterId: selectedChapterId,
        title: newFormulaTitle.trim(),
        formula_latex: newFormulaLatex.trim(),
        description: newFormulaDescription.trim(),
        createdAt: new Date(),
      });
      setNewFormulaTitle('');
      setNewFormulaLatex('');
      setNewFormulaDescription('');
      setMsg({ type: 'success', text: 'Formula added successfully!' });
      // NOTE: Should also update chapter.formulaCount here! (Omitted for brevity)
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to add formula.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddMcq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterId || !newMcqData.question || !newMcqData.options || newMcqData.options.some(opt => !opt.trim())) {
      return setMsg({ type: 'error', text: 'Chapter, question, and all 4 options are required.' });
    }
    if (newMcqData.correctAnswer < 1 || newMcqData.correctAnswer > 4) {
      return setMsg({ type: 'error', text: 'Correct Answer must be 1, 2, 3, or 4.' });
    }
    
    setLoading(true);
    try {
      const mcqToAdd: Partial<MCQ> = {
        chapterId: selectedChapterId,
        topicId: selectedTopicId || undefined, // Optional topic ID
        question: newMcqData.question.trim(),
        options: newMcqData.options.map(o => o.trim()),
        correctAnswer: newMcqData.correctAnswer,
        explanation: newMcqData.explanation?.trim(),
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'mcqs'), mcqToAdd);
      
      setNewMcqData({ question: '', options: ['', '', '', ''], correctAnswer: 1, explanation: '' });
      setMsg({ type: 'success', text: 'MCQ added successfully!' });
      // NOTE: Should also update chapter.mcqCount here! (Omitted for brevity)
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to add MCQ.' });
    } finally {
      setLoading(false);
    }
  };

  // --- Reusable Form Component ---
  const SubjectForm = () => (
    <form onSubmit={handleAddSubject} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Class Level</label>
        <select
          value={adminSelectedClass}
          onChange={(e) => setAdminSelectedClass(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        >
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="subject-title" className="text-sm text-gray-400 mb-2 block">Subject Title (e.g., Physics)</label>
        <input
          id="subject-title"
          type="text"
          value={newSubjectTitle}
          onChange={(e) => setNewSubjectTitle(e.target.value)}
          placeholder="New Subject Title"
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        />
      </div>
      <button type="submit" disabled={loading} className="w-full py-3 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Subject</>}
      </button>
    </form>
  );

  const ChapterForm = () => (
    <form onSubmit={handleAddChapter} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Select Subject</label>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">-- Select Subject --</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.title} ({s.classLevel})</option>)}
        </select>
      </div>
      {selectedSubjectId && (
        <div>
          <label htmlFor="chapter-title" className="text-sm text-gray-400 mb-2 block">Chapter Title (e.g., Kinematics)</label>
          <input
            id="chapter-title"
            type="text"
            value={newChapterTitle}
            onChange={(e) => setNewChapterTitle(e.target.value)}
            placeholder="New Chapter Title"
            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
          />
        </div>
      )}
      <button type="submit" disabled={loading || !selectedSubjectId} className="w-full py-3 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Chapter</>}
      </button>
    </form>
  );
  
  const TopicForm = () => (
    <form onSubmit={handleAddTopic} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Select Subject</label>
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">-- Select Subject --</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>
      {selectedSubjectId && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Select Chapter</label>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
          >
            <option value="">-- Select Chapter --</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}
      {selectedChapterId && (
        <>
          <div>
            <label htmlFor="topic-title" className="text-sm text-gray-400 mb-2 block">Topic Title (e.g., Projectile Motion)</label>
            <input
              id="topic-title"
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              placeholder="New Topic Title"
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="bg-white/5 rounded-xl p-3">
             <h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1"><LayoutList className="w-3 h-3" /> Existing Topics:</h4>
             {topics.length > 0 ? (
                 <ul className="space-y-1">
                     {topics.map(t => <li key={t.id} className="text-xs text-gray-300 ml-3 list-disc">{t.title}</li>)}
                 </ul>
             ) : (
                 <p className="text-xs text-gray-500">No topics added yet.</p>
             )}
          </div>
        </>
      )}
      <button type="submit" disabled={loading || !selectedChapterId} className="w-full py-3 bg-green-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Topic</>}
      </button>
    </form>
  );

  const FormulaForm = () => (
    <form onSubmit={handleAddFormula} className="space-y-4">
      <div>
        <label className="text-sm text-gray-400 mb-2 block">Select Chapter</label>
        <select
          value={selectedChapterId}
          onChange={(e) => setSelectedChapterId(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        >
          <option value="">-- Select Chapter --</option>
          {chapters.map(c => <option key={c.id} value={c.id}>{chapters.find(chap => chap.id === c.id)?.title || 'Unknown Chapter'}</option>)}
        </select>
      </div>
      {selectedChapterId && (
        <>
          <div>
            <label htmlFor="formula-title" className="text-sm text-gray-400 mb-2 block">Formula Title</label>
            <input
              id="formula-title"
              type="text"
              value={newFormulaTitle}
              onChange={(e) => setNewFormulaTitle(e.target.value)}
              placeholder="Formula Name (e.g., Newton's Second Law)"
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label htmlFor="formula-latex" className="text-sm text-gray-400 mb-2 block flex justify-between">
                Formula (LaTeX format) 
                <span className="text-xs text-blue-400 flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Preview in FormulaList
                </span>
            </label>
            <textarea
              id="formula-latex"
              value={newFormulaLatex}
              onChange={(e) => setNewFormulaLatex(e.target.value)}
              placeholder="Enter LaTeX code, e.g., F=ma or x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
              rows={3}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm font-mono focus:outline-none focus:border-pink-500"
            />
          </div>
          <div>
            <label htmlFor="formula-desc" className="text-sm text-gray-400 mb-2 block">Description (Optional)</label>
            <textarea
              id="formula-desc"
              value={newFormulaDescription}
              onChange={(e) => setNewFormulaDescription(e.target.value)}
              placeholder="Brief explanation of the formula"
              rows={2}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-pink-500"
            />
          </div>
        </>
      )}
      <button type="submit" disabled={loading || !selectedChapterId} className="w-full py-3 bg-pink-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sigma className="w-5 h-5" /> Add Formula</>}
      </button>
    </form>
  );
  
  const MCQForm = () => (
    <form onSubmit={handleAddMcq} className="space-y-4">
      {/* Subject and Chapter Selects */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm text-gray-400 mb-2 block">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
          >
            <option value="">-- Select Subject --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-400 mb-2 block">Chapter</label>
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            disabled={!selectedSubjectId}
            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
          >
            <option value="">-- Select Chapter --</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </div>
      
      {selectedChapterId && (
        <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
          
          {/* Topic Select */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Topic (Optional)</label>
            <select
              value={selectedTopicId || ''}
              onChange={(e) => setSelectedTopicId(e.target.value || null)}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">-- Select Topic (Optional) --</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          {/* Question Text */}
          <div>
            <label htmlFor="mcq-question" className="text-sm text-gray-400 mb-2 block">MCQ Question</label>
            <textarea
              id="mcq-question"
              value={newMcqData.question}
              onChange={(e) => setNewMcqData({...newMcqData, question: e.target.value})}
              placeholder="Enter the question text here"
              rows={3}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Options & Correct Answer */}
          <div className="grid grid-cols-2 gap-4">
            {newMcqData.options!.map((option, index) => (
              <div key={index}>
                <label className="text-sm text-gray-400 mb-2 block">Option {index + 1}</label>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...newMcqData.options!];
                    newOptions[index] = e.target.value;
                    setNewMcqData({...newMcqData, options: newOptions});
                  }}
                  placeholder={`Option ${index + 1}`}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
          
          {/* Correct Answer Selector */}
          <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/10">
            <label className="text-sm text-gray-400 font-bold">Correct Answer (1-4):</label>
            <select
              value={newMcqData.correctAnswer}
              onChange={(e) => setNewMcqData({...newMcqData, correctAnswer: parseInt(e.target.value)})}
              className="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              {[1, 2, 3, 4].map(num => <option key={num} value={num}>{num}</option>)}
            </select>
          </div>
          
          {/* Explanation */}
          <div>
            <label htmlFor="mcq-explanation" className="text-sm text-gray-400 mb-2 block">Explanation (Optional)</label>
            <textarea
              id="mcq-explanation"
              value={newMcqData.explanation}
              onChange={(e) => setNewMcqData({...newMcqData, explanation: e.target.value})}
              placeholder="Detailed explanation for the answer"
              rows={2}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <button type="submit" disabled={loading || !selectedChapterId} className="w-full py-3 bg-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add MCQ</>}
      </button>
    </form>
  );

  // --- Main Render ---

  // Component to render based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case 'subject':
        return <SubjectForm />;
      case 'chapter':
        return <ChapterForm />;
      case 'topic':
        return <TopicForm />;
      case 'mcq':
        return <MCQForm />;
      case 'formula':
        return <FormulaForm />;
      case 'manage':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-300">Manage Chapters</h3>
            <p className="text-sm text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                Deleting a chapter will permanently delete ALL related topics, MCQs, and formulas. Proceed with caution.
            </p>
            
            {/* Subject Selector for Management */}
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">-- Select Subject to view Chapters --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            {selectedSubjectId && (
              <div className="bg-app-card rounded-xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-white/5 text-xs text-gray-400 font-bold flex justify-between">
                    <span>Chapter Title</span>
                    <span>Action</span>
                </div>
                {chapters.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No chapters found for this subject</div>
                ) : (
                  chapters.map((chap, idx) => (
                    <div key={chap.id} className={`flex items-center justify-between p-3 border-b border-white/5 last:border-0 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <span className="text-sm text-gray-300">{chap.title}</span>
                      <button 
                        onClick={() => handleDeleteChapter(chap.id, chap.title)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Chapter"
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
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
        <h2 className="text-2xl font-bold text-white tracking-tight">Admin Panel</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-green-500 ml-auto" />}
      </div>
      
      {/* Class Selector */}
      <div className="px-4 mb-6">
        <label className="text-xs text-gray-500 mb-1 block">Context Class Level:</label>
        <select
          value={adminSelectedClass}
          onChange={(e) => setAdminSelectedClass(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
        >
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Feedback Message */}
      {msg && (
        <div className={`mx-4 mb-6 p-3 rounded-xl border flex items-start gap-2 ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm">{msg.text}</p>
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex justify-around items-center bg-app-card rounded-xl p-2 border border-white/5 mx-4 mb-6">
        <TabButton id="subject" icon={GraduationCap} label="Subject" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="chapter" icon={BookOpen} label="Chapter" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="topic" icon={Tag} label="Topic" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="mcq" icon={FileText} label="MCQ" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="formula" icon={Sigma} label="Formula" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="manage" icon={Trash2} label="Manage" activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Content Area */}
      <div className="px-4 bg-app-card rounded-xl p-6 border border-white/5 mx-4">
        {renderContent()}
      </div>
      
    </div>
  );
};

// Helper component for tabs
interface TabButtonProps {
    id: 'subject' | 'chapter' | 'topic' | 'mcq' | 'formula' | 'manage';
    icon: React.ElementType;
    label: string;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, icon: Icon, label, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`flex flex-col items-center flex-1 py-2 rounded-lg transition-colors ${
            activeTab === id ? 'bg-green-600/20 text-green-500' : 'text-gray-400 hover:bg-white/10'
        }`}
    >
        <Icon className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
);


export default AdminPanel;
