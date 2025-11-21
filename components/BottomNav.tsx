import React from 'react';
import { Home, TrendingUp, User, LayoutList, BookOpen, Icon } from 'lucide-react';

// Define the NAV_ITEMS constant here or assume it's imported from '../constants'
interface NavItem {
    id: 'home' | 'progress' | 'profile' | 'explore';
    label: string;
    icon: Icon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'হোম', icon: Home },
  { id: 'explore', label: 'এক্সপ্লোর', icon: LayoutList },
  { id: 'progress', label: 'অগ্রগতি', icon: TrendingUp },
  { id: 'profile', label: 'প্রোফাইল', icon: User },
];

interface BottomNavProps {
  onNavClick: (id: NavItem['id']) => void;
  currentView: NavItem['id'];
}

const BottomNav: React.FC<BottomNavProps> = ({ onNavClick, currentView }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-app-nav border-t border-white/5 pb-2 pt-3 px-4 z-50 max-w-md mx-auto w-full">
      <div className="flex justify-between items-center">
        {NAV_ITEMS.map((item) => {
          // Determine if this item is active based on currentView
          const isActive = item.id === currentView;

          return (
            <button
              key={item.id}
              onClick={() => onNavClick(item.id)}
              className={`flex flex-col items-center gap-1 min-w-[60px] transition-colors ${
                isActive ? 'text-green-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <item.icon 
                className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
