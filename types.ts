import { LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string; // Tailwind color class for text
  bgGradient?: string; // Optional gradient for icon background if needed
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
}

export interface Subject {
  id: string;
  title: string;
  chapterCount: number;
  progress: number;
  classLevel?: string;
}

export interface Chapter {
  id: string;
  title: string;
  subjectId: string;
  isLocked?: boolean;
  duration?: string;
}

export interface Topic {
  id: string;
  title: string;
  chapterId: string;
  subjectId: string;
}

export interface MCQ {
  id?: string;
  chapterId: string;
  topicId?: string; // Optional topic link
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option (0-3)
  explanation?: string;
}

export interface Formula {
  id?: string;
  chapterId: string;
  title: string;
  content: string; // LaTeX string
}