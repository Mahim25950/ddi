import React, { useState } from 'react';
import { Bell, Search, ShieldCheck, User as UserIcon, Database, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
// import { seedDatabase } from '../utils/seedData'; // Assume this utility exists

interface HeaderProps {
  user?: User | null;
  onAdminClick?: () => void;
  onProfileClick?: () => void;
  onNotificationsClick?: () => void;
}

// The specific Admin UID provided
const ADMIN_UID = "1DYoLukPV1bFYvixzb4PhoN2war2";

// Mock seedDatabase function for demonstration
const seedDatabase = async () => {
    console.log("Mocking database seeding...");
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call delay
    console.log("Mock seeding complete.");
};

const Header: React.FC<HeaderProps> = ({ user, onAdminClick, onProfileClick, onNotificationsClick }) => {
  const [showSearch, setShowSearch] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.uid === ADMIN_UID;

  const handleSeed = async () => {
     if (window.confirm("Add sample data to Firebase? This will overwrite existing data!")) {
        setSeeding(true);
        await seedDatabase();
        setSeeding(false);
        // window.location.reload(); // Uncomment in a real app to refresh state
     }
  }
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
        console.log("Searching for:", searchTerm);
        // Implement actual search logic here (e.g., navigate to a search results page)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
      <div className="flex items-center justify-between px-4 py-3">
        
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer group select-none"
          onClick={() => window.location.reload()}
        >
          <div className="relative w-8 h-8 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-green-500 transform group-hover:rotate-[15deg] transition-transform duration-300" strokeWidth={2.5} />
            <span className="absolute text-white font-extrabold text-xs -translate-y-[1px]">D</span>
          </div>
          <span className="text-xl font-extrabold text-white tracking-wider hidden sm:inline-block">
             DDI Learn
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          
          {/* Admin Button & Seeding */}
          {isAdmin && (
             <>
                <button
                   onClick={handleSeed}
                   disabled={seeding}
                   className="p-2 text-yellow-400 hover:bg-white/10 rounded-full transition-colors relative"
                   title="Seed Database"
                >
                   {seeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                </button>
                <button 
                   onClick={onAdminClick}
                   className="p-2 text-red-500 hover:bg-white/10 rounded-full transition-colors relative"
                   title="Admin Panel"
                >
                   <ShieldCheck className="w-5 h-5" />
                </button>
             </>
          )}

          {/* Search Button */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          
          {/* Notifications Button */}
          <button
            onClick={onNotificationsClick}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {/* Mock unread indicator */}
            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-black"></div>
          </button>

          {/* Profile Button */}
           <div 
              onClick={onProfileClick}
              className="relative cursor-pointer ml-1"
           >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                   {user?.photoURL ? (
                     <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-green-500 font-bold text-sm">
                       {user?.displayName?.[0]?.toUpperCase() || <UserIcon className="w-4 h-4" />}
                     </span>
                   )}
              </div>
              {/* Status Indicator */}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#121212] rounded-full"></div>
           </div>

        </div>
      </div>

      {/* Search Bar Dropdown */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${showSearch ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <form onSubmit={handleSearchSubmit} className="px-4 pb-4 pt-1">
           <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Search className="h-4 w-4 text-gray-500 group-focus-within:text-green-500 transition-colors" />
             </div>
             <input
               type="text"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Search subjects, chapters, or questions..."
               className="block w-full pl-10 pr-3 py-2.5 border border-white/10 rounded-xl leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-green-500"
             />
           </div>
        </form>
      </div>
    </header>
  );
};

export default Header;
