import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Upload, Trash2, CheckCircle, AlertCircle, LayoutList, GraduationCap, Sigma, Loader2, Pencil, X, RefreshCw, Eye, Tag } from 'lucide-react';
import { collection, addDoc, getDocs, writeBatch, doc, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Subject, Chapter, Formula, Topic } from '../types';

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
  
  // Formula Management State
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  
  // Form States
  const [subjectTitle, setSubjectTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  
  const [chapterTitle, setChapterTitle] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');

  const [topicTitle, setTopicTitle] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState(''); // For MCQ upload filtering
  
  const [jsonInput, setJsonInput] = useState('');

  // Formula Form States
  const [formulaTitle, setFormulaTitle] = useState('');
  const [formulaContent, setFormulaContent] = useState('');
  const [latexError, setLatexError] = useState<string | null>(null);

  // Fetch Subjects when adminSelectedClass or tab changes
  useEffect(() => {
    fetchSubjects();
    setChapters([]); // Clear chapters when class/subjects reload
    setTopics([]);
    setSelectedSubjectId('');
    setFormulas([]);
    setSelectedChapterId('');
    setSelectedTopicId('');
  }, [adminSelectedClass]);

  // Fetch Chapters when Subject Changes
  useEffect(() => {
    if (selectedSubjectId) {
      fetchChapters(selectedSubjectId);
    } else {
      setChapters([]);
      setSelectedChapterId('');
    }
  }, [selectedSubjectId]);

  // Fetch Topics when Chapter Changes
  useEffect(() => {
    if (selectedChapterId) {
      fetchTopics(selectedChapterId);
      // Also fetch formulas if needed, but separate function handles that for Formula tab
      if (activeTab === 'formula') {
        fetchFormulas(selectedChapterId);
      }
    } else {
      setTopics([]);
      setFormulas([]);
    }
  }, [selectedChapterId, activeTab]);

  // Trigger MathJax Typeset when content changes
  useEffect(() => {
    if ((window as any).MathJax && (formulas.length > 0 || formulaContent)) {
      const timer = setTimeout(() => {
        (window as any).MathJax.typesetPromise && (window as any).MathJax.typesetPromise();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [formulas, formulaContent, activeTab]);

  const validateLatex = (latex: string): string | null => {
    if (!latex) return null;
    let braceCount = 0;
    let dollarCount = 0;
    let isEscaped = false;

    for (let i = 0; i < latex.length; i++) {
      const char = latex[i];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount < 0) return "Error: Unexpected closing brace '}'";
      }
      if (char === '$') dollarCount++;
    }

    if (braceCount > 0) return "Error: Missing closing brace '}'";
    if (dollarCount > 0 && dollarCount % 2 !== 0) return "Warning: Uneven number of '$' delimiters.";

    return null;
  };

  const handleFormulaContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setFormulaContent(val);
    setLatexError(validateLatex(val));
  };

  const fetchSubjects = async () => {
    const q = query(collection(db, 'subjects'), where('classLevel', '==', adminSelectedClass));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Subject[];
    setSubjects(data);
  };

  const fetchChapters = async (subjId: string) => {
    const q = query(collection(db, 'chapters'), where('subjectId', '==', subjId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Chapter[];
    setChapters(data);
  };

  const fetchTopics = async (chapId: string) => {
    const q = query(collection(db, 'topics'), where('chapterId', '==', chapId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Topic[];
    setTopics(data);
  };

  const fetchFormulas = async (chapId: string) => {
    try {
      const q = query(collection(db, 'formulas'), where('chapterId', '==', chapId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Formula[];
      setFormulas(data);
    } catch (err) {
      console.error("Error fetching formulas", (err as any).message);
    }
  };

  // --- Handlers ---

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = subjectTitle.trim();
    if (!trimmedTitle) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'subjects'), 
        where('classLevel', '==', adminSelectedClass),
        where('title', '==', trimmedTitle)
      );
      const existingDocs = await getDocs(q);

      if (!existingDocs.empty) {
        setMsg({ type: 'error', text: `Subject "${trimmedTitle}" already exists in ${adminSelectedClass}!` });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'subjects'), {
        title: trimmedTitle,
        chapterCount: 0,
        progress: 0,
        classLevel: adminSelectedClass 
      });
      setMsg({ type: 'success', text: `Subject added to ${adminSelectedClass} successfully!` });
      setSubjectTitle('');
      fetchSubjects();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to add subject.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = chapterTitle.trim();
    if (!selectedSubjectId || !trimmedTitle) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'chapters'),
        where('subjectId', '==', selectedSubjectId),
        where('title', '==', trimmedTitle)
      );
      const existingDocs = await getDocs(q);

      if (!existingDocs.empty) {
        setMsg({ type: 'error', text: `Chapter "${trimmedTitle}" already exists in this subject!` });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'chapters'), {
        title: trimmedTitle,
        subjectId: selectedSubjectId,
        isLocked: false,
        duration: '45 min'
      });
      setMsg({ type: 'success', text: 'Chapter added successfully!' });
      setChapterTitle('');
      if (selectedSubjectId) {
        fetchChapters(selectedSubjectId);
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to add chapter.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = topicTitle.trim();
    if (!selectedSubjectId || !selectedChapterId || !trimmedTitle) {
       setMsg({ type: 'error', text: 'Select Subject, Chapter and enter Topic name.' });
       return;
    }

    setLoading(true);
    try {
      // Check for duplicates
      const q = query(
        collection(db, 'topics'),
        where('chapterId', '==', selectedChapterId),
        where('title', '==', trimmedTitle)
      );
      const existingDocs = await getDocs(q);

      if (!existingDocs.empty) {
         setMsg({ type: 'error', text: 'Topic already exists in this chapter.' });
         setLoading(false);
         return;
      }

      await addDoc(collection(db, 'topics'), {
        title: trimmedTitle,
        chapterId: selectedChapterId,
        subjectId: selectedSubjectId
      });
      setMsg({ type: 'success', text: 'Topic added successfully!' });
      setTopicTitle('');
      fetchTopics(selectedChapterId);
    } catch (err) {
      console.error((err as any).message);
      setMsg({ type: 'error', text: 'Failed to add topic.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if(!window.confirm("Delete this topic?")) return;
    try {
       await deleteDoc(doc(db, 'topics', id));
       setMsg({ type: 'success', text: 'Topic deleted.' });
       setTopics(prev => prev.filter(t => t.id !== id));
    } catch(err) {
       console.error((err as any).message);
       setMsg({ type: 'error', text: 'Failed to delete topic.' });
    }
  };

  // Unified handler for Add/Update Formula
  const handleFormulaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valError = validateLatex(formulaContent);
    if (valError && valError.startsWith("Error")) {
      setMsg({ type: 'error', text: "Please fix LaTeX errors before submitting." });
      return;
    }

    if (!selectedSubjectId || !selectedChapterId || !formulaTitle.trim() || !formulaContent.trim()) {
      setMsg({ type: 'error', text: 'Please fill all fields.' });
      return;
    }

    setLoading(true);
    try {
      if (editingFormulaId) {
        const formulaRef = doc(db, 'formulas', editingFormulaId);
        await updateDoc(formulaRef, {
          title: formulaTitle,
          content: formulaContent,
        });
        setMsg({ type: 'success', text: 'Formula updated successfully!' });
      } else {
        await addDoc(collection(db, 'formulas'), {
          classLevel: adminSelectedClass,
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId,
          title: formulaTitle,
          content: formulaContent,
          createdAt: Date.now()
        });
        setMsg({ type: 'success', text: 'Formula added successfully!' });
      }
      
      setFormulaTitle('');
      setFormulaContent('');
      setLatexError(null);
      setEditingFormulaId(null);
      
      if (selectedChapterId) fetchFormulas(selectedChapterId);
      
    } catch (err) {
      setMsg({ type: 'error', text: editingFormulaId ? 'Failed to update formula.' : 'Failed to add formula.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFormula = (formula: Formula) => {
    if (!formula.id) return;
    setFormulaTitle(formula.title);
    setFormulaContent(formula.content);
    setLatexError(validateLatex(formula.content));
    setEditingFormulaId(formula.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMsg(null);
  };

  const handleCancelEdit = () => {
    setFormulaTitle('');
    setFormulaContent('');
    setLatexError(null);
    setEditingFormulaId(null);
    setMsg(null);
  };

  const handleDeleteFormula = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this formula?")) return;
    try {
      await deleteDoc(doc(db, 'formulas', id));
      setMsg({ type: 'success', text: 'Formula deleted successfully.' });
      setFormulas(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error((err as any).message);
      setMsg({ type: 'error', text: 'Failed to delete formula.' });
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedSubjectId || !selectedChapterId || !jsonInput.trim()) {
      setMsg({ type: 'error', text: 'Select subject, chapter and provide valid JSON.' });
      return;
    }

    setLoading(true);
    try {
      const mcqs = JSON.parse(jsonInput);
      if (!Array.isArray(mcqs)) throw new Error('JSON must be an array');

      const batch = writeBatch(db);
      const questionsRef = collection(db, 'questions');

      mcqs.forEach((mcq: any) => {
        const docRef = doc(questionsRef);
        batch.set(docRef, {
          chapterId: selectedChapterId,
          topicId: selectedTopicId || null, // Attach topic if selected
          question: mcq.question,
          options: mcq.options,
          correctAnswer: mcq.correctAnswer,
          explanation: mcq.explanation || ''
        });
      });

      await batch.commit();
      setMsg({ type: 'success', text: `${mcqs.length} Questions uploaded successfully!` });
      setJsonInput('');
    } catch (err: any) {
      console.error(err.message || String(err));
      setMsg({ type: 'error', text: 'Invalid JSON format or Upload Failed. format: [{question: "...", options: ["A","B"], correctAnswer: 0}, ...]' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" from ${adminSelectedClass}?`)) return;
    try {
      await deleteDoc(doc(db, 'subjects', id));
      setSubjects(prev => prev.filter(s => s.id !== id));
      setMsg({ type: 'success', text: 'Subject deleted successfully.' });
      if (selectedSubjectId === id) {
        setSelectedSubjectId('');
        setChapters([]);
      }
    } catch (err) {
      console.error((err as any).message);
      setMsg({ type: 'error', text: 'Failed to delete subject.' });
    }
  };

  const handleDeleteChapter = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'chapters', id));
      setChapters(prev => prev.filter(c => c.id !== id));
      setMsg({ type: 'success', text: 'Chapter deleted successfully.' });
    } catch (err) {
      console.error((err as any).message);
      setMsg({ type: 'error', text: 'Failed to delete chapter.' });
    }
  };

  const clearMsg = () => setMsg(null);

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-300 pb-24">
      <div className="flex items-center gap-3 mb-4 mt-2">
        <button 
          onClick={onBack} 
          className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2"
        >
           <ArrowLeft className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
           অ্যাডমিন প্যানেল
        </h2>
      </div>

      {/* Global Class Selector for Admin */}
      <div className="mb-6 bg-app-card p-4 rounded-xl border border-white/10">
        <div className="flex items-center gap-3 mb-3">
           <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Target Class</p>
              <p className="text-sm text-gray-200">Select class to manage</p>
            </div>
        </div>
        <select
          value={adminSelectedClass}
          onChange={(e) => setAdminSelectedClass(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-green-500 appearance-none cursor-pointer hover:bg-black/30 transition-colors"
        >
          {classes.map((c) => (
            <option key={c} value={c} className="bg-gray-900">{c}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-app-card p-1 rounded-xl mb-6 border border-white/10 scrollbar-hide">
        <button 
          onClick={() => { setActiveTab('subject'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'subject' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Subject
        </button>
        <button 
          onClick={() => { setActiveTab('chapter'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'chapter' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Chapter
        </button>
        <button 
          onClick={() => { setActiveTab('topic'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'topic' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Topic
        </button>
        <button 
          onClick={() => { setActiveTab('formula'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'formula' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Formulas
        </button>
        <button 
          onClick={() => { setActiveTab('mcq'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'mcq' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Bulk MCQ
        </button>
        <button 
          onClick={() => { setActiveTab('manage'); clearMsg(); }}
          className={`py-2 px-3 rounded-lg text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'manage' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
        >
          Manage
        </button>
      </div>

      {/* Feedback Message */}
      {msg && (
        <div className={`mb-6 p-3 rounded-xl border flex items-start gap-2 ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm">{msg.text}</p>
        </div>
      )}

      {/* --- SECTION: ADD SUBJECT --- */}
      {activeTab === 'subject' && (
        <form onSubmit={handleAddSubject} className="space-y-4">
          <div className="space-y-2">
            <label className="text-gray-400 text-sm ml-1">Subject Name ({adminSelectedClass})</label>
            <input
              type="text"
              value={subjectTitle}
              onChange={(e) => setSubjectTitle(e.target.value)}
              className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-green-500"
              placeholder={`e.g. Math (${adminSelectedClass})`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Subject</>}
          </button>
        </form>
      )}

      {/* --- SECTION: ADD CHAPTER --- */}
      {activeTab === 'chapter' && (
        <form onSubmit={handleAddChapter} className="space-y-4">
           <div className="space-y-2">
            <label className="text-gray-400 text-sm ml-1">Select Subject ({adminSelectedClass})</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-green-500 appearance-none"
            >
              <option value="">-- Select Subject --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-gray-400 text-sm ml-1">Chapter Name</label>
            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-green-500"
              placeholder="e.g. Real Numbers"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Chapter</>}
          </button>
        </form>
      )}

      {/* --- SECTION: ADD TOPIC --- */}
      {activeTab === 'topic' && (
         <div className="space-y-6">
            <form onSubmit={handleAddTopic} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm ml-1">Subject</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm ml-1">Chapter</label>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    disabled={!selectedSubjectId}
                    className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
                  >
                    <option value="">Select</option>
                    {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-400 text-sm ml-1">Topic Name</label>
                <input
                  type="text"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-green-500"
                  placeholder="e.g. Prime Numbers"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Add Topic</>}
              </button>
            </form>

            {selectedChapterId && (
               <div className="pt-4 border-t border-white/10">
                  <h3 className="text-gray-300 font-medium text-sm ml-1 mb-3">Existing Topics</h3>
                  {topics.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center">No topics found in this chapter.</p>
                  ) : (
                    <div className="grid gap-2">
                       {topics.map(topic => (
                          <div key={topic.id} className="flex justify-between items-center bg-app-card border border-white/5 p-3 rounded-lg">
                             <span className="text-sm text-gray-200">{topic.title}</span>
                             <button onClick={() => handleDeleteTopic(topic.id)} className="text-red-400 hover:text-red-300 p-1">
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            )}
         </div>
      )}

      {/* --- SECTION: MANAGE FORMULAS (Add/Edit/List) --- */}
      {activeTab === 'formula' && (
        <div className="space-y-6">
          
          {/* 1. Selection Area */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-400 text-sm ml-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm ml-1">Chapter</label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                disabled={!selectedSubjectId}
                className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
              >
                <option value="">Select Chapter</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          {/* 2. Edit/Add Form */}
          <form onSubmit={handleFormulaSubmit} className="space-y-4 bg-app-card/50 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center">
               <h3 className="text-white font-bold flex items-center gap-2">
                 {editingFormulaId ? <Pencil className="w-4 h-4 text-yellow-500" /> : <Plus className="w-4 h-4 text-pink-500" />}
                 {editingFormulaId ? 'Edit Formula' : 'Add New Formula'}
               </h3>
               {editingFormulaId && (
                 <button type="button" onClick={handleCancelEdit} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                   <X className="w-3 h-3" /> Cancel
                 </button>
               )}
            </div>

            <div className="space-y-2">
              <label className="text-gray-400 text-sm ml-1">Formula Title</label>
              <input
                type="text"
                value={formulaTitle}
                onChange={(e) => setFormulaTitle(e.target.value)}
                className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-green-500"
                placeholder="e.g. Pythagoras Theorem"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <label className="text-gray-400 text-sm ml-1">Formula LaTeX</label>
                 <a href="https://en.wikibooks.org/wiki/LaTeX/Mathematics" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">LaTeX Help</a>
              </div>
              <textarea
                value={formulaContent}
                onChange={handleFormulaContentChange}
                rows={4}
                className={`w-full bg-app-card border rounded-xl p-4 text-white font-mono text-sm focus:outline-none transition-colors ${
                  latexError && latexError.startsWith("Error") 
                    ? 'border-red-500 focus:border-red-500' 
                    : latexError && latexError.startsWith("Warning")
                      ? 'border-yellow-500 focus:border-yellow-500'
                      : 'border-white/10 focus:border-green-500'
                }`}
                placeholder="e.g. $$ a^2 + b^2 = c^2 $$ (Use $$ for display, $ for inline)"
              />
              
              {/* Validation Feedback */}
              {latexError && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${latexError.startsWith("Error") ? "text-red-400" : "text-yellow-400"}`}>
                   <AlertCircle className="w-3 h-3" />
                   {latexError}
                </div>
              )}
              
              {/* Live Preview */}
              {formulaContent && (
                <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-gray-400">
                    <Eye className="w-3 h-3" /> Preview
                  </div>
                  <div className="text-center text-lg text-white">
                     {formulaContent}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70 ${editingFormulaId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-pink-600 hover:bg-pink-500'}`}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                editingFormulaId 
                  ? <><RefreshCw className="w-5 h-5" /> Update Formula</>
                  : <><Sigma className="w-5 h-5" /> Add Formula</>
              )}
            </button>
          </form>

          {/* 3. Existing Formulas List */}
          {selectedChapterId && (
            <div className="space-y-3 pt-4 border-t border-white/10">
               <h3 className="text-gray-300 font-medium text-sm ml-1">Existing Formulas ({formulas.length})</h3>
               {formulas.length === 0 ? (
                 <p className="text-gray-500 text-xs text-center py-4">No formulas found in this chapter.</p>
               ) : (
                 formulas.map((formula) => (
                   <div key={formula.id} className={`bg-app-card rounded-xl p-4 border transition-colors flex items-start justify-between group ${editingFormulaId === formula.id ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5 hover:bg-white/[0.02]'}`}>
                      <div className="flex-1 overflow-hidden">
                         <h4 className="text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">{formula.title}</h4>
                         <div className="text-sm text-gray-200 overflow-x-auto pb-1">{formula.content}</div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button 
                          onClick={() => handleEditFormula(formula)}
                          className="p-2 bg-white/5 hover:bg-yellow-500/20 text-gray-400 hover:text-yellow-500 rounded-lg transition-colors"
                          title="Edit"
                        >
                           <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => formula.id && handleDeleteFormula(formula.id)}
                          className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                          title="Delete"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          )}
        </div>
      )}

      {/* --- SECTION: BULK MCQ --- */}
      {activeTab === 'mcq' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-400 text-sm ml-1">Subject ({adminSelectedClass})</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
              >
                <option value="">Select</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm ml-1">Chapter</label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                disabled={!selectedSubjectId}
                className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
              >
                <option value="">Select</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          {/* Topic Select (Optional) */}
          <div className="space-y-2">
             <label className="text-gray-400 text-sm ml-1 flex items-center gap-2">
                <Tag className="w-3 h-3" /> Topic (Optional)
             </label>
             <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedChapterId}
                className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50"
             >
               <option value="">-- No Specific Topic --</option>
               {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
             </select>
             <p className="text-[10px] text-gray-500 ml-1">Select a topic to assign all uploaded questions to it.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-gray-400 text-sm ml-1">Paste JSON Data</label>
              <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-1 rounded">
                Format: [{"question": "...", "options": ["A","B"], "correctAnswer": 0}]
              </span>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={10}
              className="w-full bg-app-card border border-white/10 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:border-green-500"
              placeholder={`[
  {
    "question": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "correctAnswer": 1,
    "explanation": "Basic math"
  }
]`}
            />
          </div>

          <button
            onClick={handleBulkUpload}
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-500 transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Upload className="w-5 h-5" /> Upload Questions</>}
          </button>
        </div>
      )}

      {/* --- SECTION: MANAGE / DELETE --- */}
      {activeTab === 'manage' && (
        <div className="space-y-8">
          
          {/* Delete Subjects */}
          <div className="space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-green-500" /> 
              Manage Subjects ({adminSelectedClass})
            </h3>
            <div className="bg-app-card rounded-xl border border-white/5 overflow-hidden">
              {subjects.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No subjects found for {adminSelectedClass}</div>
              ) : (
                subjects.map((sub, idx) => (
                  <div key={sub.id} className={`flex items-center justify-between p-3 border-b border-white/5 last:border-0 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                    <span className="text-sm text-gray-300">{sub.title}</span>
                    <button 
                      onClick={() => handleDeleteSubject(sub.id, sub.title)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Delete Chapters */}
          <div className="space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <LayoutList className="w-4 h-4 text-blue-500" /> 
              Manage Chapters
            </h3>
            
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-app-card border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">-- Select Subject to view Chapters --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>

            {selectedSubjectId && (
              <div className="bg-app-card rounded-xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-top-2">
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
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default AdminPanel;
