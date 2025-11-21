import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase'; // Assume '../firebase' exports the Firebase auth object
import { Mail, Lock, User, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // --- Login Logic ---
        await signInWithEmailAndPassword(auth, email, password);
        // On successful login, Firebase handles state change, and the app will navigate away
      } else {
        // --- Signup Logic ---
        if (!name.trim()) {
           setError("দয়া করে আপনার নাম লিখুন।");
           setLoading(false);
           return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
        // On successful signup, updateProfile runs, and the app navigates away
      }
    } catch (err: any) {
      console.error(err.message || String(err));
      let msg = "একটি ত্রুটি হয়েছে। আবার চেষ্টা করুন।";
      
      // Detailed error mapping for user-friendly messages in Bangla
      if (err.code === 'auth/invalid-email') msg = "ইমেইল ঠিকানাটি সঠিক নয়";
      if (err.code === 'auth/user-disabled') msg = "ব্যবহারকারী অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে";
      if (err.code === 'auth/user-not-found') msg = "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি";
      if (err.code === 'auth/wrong-password') msg = "ভুল পাসওয়ার্ড দেওয়া হয়েছে";
      if (err.code === 'auth/email-already-in-use') msg = "এই ইমেইলটি ইতিমধ্যেই ব্যবহৃত হয়েছে। লগ ইন করুন।";
      if (err.code === 'auth/weak-password') msg = "পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে";
      if (err.code === 'auth/operation-not-allowed') msg = "অ্যাকাউন্ট তৈরি বন্ধ আছে। দয়া করে অ্যাডমিনকে যোগাযোগ করুন।";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg p-4 max-w-md mx-auto">
      
      {/* App Logo/Header */}
      <div className="mb-10 text-center">
        <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-2" strokeWidth={2.5} />
        <h1 className="text-3xl font-extrabold text-white">DDI Learn</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isLogin ? 'লগ ইন করে আপনার শেখা শুরু করুন' : 'একটি নতুন অ্যাকাউন্ট তৈরি করুন'}
        </p>
      </div>
      
      <div className="bg-app-card rounded-2xl p-6 w-full border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isLogin ? 'লগ ইন' : 'সাইন আপ'}
        </h2>
        
        <form onSubmit={handleAuth} className="space-y-4">
          
          {/* Name Field (for Signup only) */}
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="আপনার নাম"
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
                required={!isLogin}
                autoComplete="name"
              />
            </div>
          )}

          {/* Email Field */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ইমেইল ঠিকানা"
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
              required
              autoComplete={isLogin ? "email" : "new-email"}
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? 'লগ ইন' : 'সাইন আপ'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            {isLogin ? 'অ্যাকাউন্ট নেই?' : 'ইতিমধ্যে অ্যাকাউন্ট আছে?'}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setPassword(''); // Clear password field on toggle
              }}
              className="text-green-500 font-semibold ml-1 hover:underline focus:outline-none"
            >
              {isLogin ? 'সাইন আপ করুন' : 'লগ ইন করুন'}
            </button>
          </p>
        </div>
      </div>
      
    </div>
  );
};

export default AuthScreen;
