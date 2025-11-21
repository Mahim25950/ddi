import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sigma, AlertCircle, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
// import { Chapter, Formula } from '../types'; // Assume these types are defined

interface Chapter {
  id: string;
  title: string;
  subjectId: string;
}

interface Formula {
  id: string;
  chapterId: string;
  title: string;
  formula_latex: string;
  description: string;
}

interface FormulaListProps {
  chapter: Chapter;
  onBack: () => void;
}

const FormulaList: React.FC<FormulaListProps> = ({ chapter, onBack }) => {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFormulas = async () => {
      try {
        setLoading(true);
        // In a real app, you would fetch from Firestore:
        const q = query(
          collection(db, 'formulas'),
          where('chapterId', '==', chapter.id)
        );
        const snapshot = await getDocs(q);
        const fetchedFormulas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Formula[];
        
        // Mock Data for testing/demonstration:
        // const fetchedFormulas: Formula[] = [
        //   { id: 'f1', chapterId: chapter.id, title: 'Pythagorean Theorem', formula_latex: 'a^2 + b^2 = c^2', description: 'Describes the relation among the three sides of a right triangle.' },
        //   { id: 'f2', chapterId: chapter.id, title: 'Quadratic Formula', formula_latex: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', description: 'Solves the general quadratic equation $ax^2 + bx + c = 0$.' },
        // ];
        
        setFormulas(fetchedFormulas);
      } catch (error) {
        console.error("Error fetching formulas:", (error as any).message);
      } finally {
        setLoading(false);
      }
    };

    fetchFormulas();
  }, [chapter.id]);

  // Trigger MathJax typeset when formulas update
  useEffect(() => {
    // MathJax is a common library for rendering LaTeX/math formulas in web apps
    if (!loading && formulas.length > 0 && (window as any).MathJax) {
      (window as any).MathJax.typesetPromise && (window as any).MathJax.typesetPromise();
    }
  }, [loading, formulas]);

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
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sigma className="w-6 h-6 text-pink-500" /> {chapter.title} Formulas
        </h2>
      </div>

      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-app-card rounded-xl p-5 border border-white/5 h-32 animate-pulse">
                <div className="h-4 w-1/3 bg-white/10 rounded mb-4"></div>
                <div className="h-8 w-2/3 bg-white/10 rounded mx-auto"></div>
              </div>
            ))}
          </div>
        ) : formulas.length === 0 ? (
          <div className="text-center py-10 bg-app-card rounded-xl border border-white/5 flex flex-col items-center">
            <AlertCircle className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-400">এই অধ্যায়ে কোনো সূত্র যোগ করা হয়নি।</p>
          </div>
        ) : (
          <div className="space-y-4">
            {formulas.map((formula) => (
              <div 
                key={formula.id}
                className="bg-app-card rounded-2xl p-6 border border-white/5 shadow-lg relative overflow-hidden group hover:shadow-pink-900/10 transition-shadow duration-300"
              >
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/5 rounded-bl-full -mr-4 -mt-4 group-hover:bg-pink-500/10 transition-colors"></div>
                
                <h3 className="text-pink-400 text-sm font-bold uppercase tracking-wider mb-3 border-b border-white/5 pb-2">
                  {formula.title}
                </h3>

                {/* Formula Display (MathJax will process this) */}
                <div className="text-center py-4 bg-black/10 rounded-lg mb-4 text-2xl font-serif">
                   <span className="text-white formula-display">
                     {`$$${formula.formula_latex}$$`}
                   </span>
                </div>
                
                {/* Description */}
                <div>
                   <h4 className="text-gray-400 text-xs font-bold uppercase mb-1">Details:</h4>
                   <p className="text-sm text-gray-300 leading-relaxed">{formula.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormulaList;
