import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateReference(prefix = 'PQ') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export const EXAM_TYPES = ['WAEC','JAMB','NECO','KCSE','WASSCE','BECE','UTME','POST-UTME','OTHER'] as const;
export const ASSESSMENT_TYPES = ['test','exam','quiz','assignment','practice','other'] as const;
export const ACCESS_TYPES = ['free','paid','preview_paid'] as const;
export const UNIVERSITY_LEVELS = ['100 Level','200 Level','300 Level','400 Level','500 Level','600 Level','Other'] as const;
export const SEMESTERS = ['First Semester','Second Semester','First Term','Second Term','Third Term','Other'] as const;

export const SUBJECTS = [
  'Mathematics','English Language','Biology','Chemistry','Physics',
  'Economics','Government','Literature','Geography','History',
  'Agricultural Science','Further Mathematics','Commerce','Accounting',
  'Civic Education','Computer Science','French','Yoruba','Igbo','Hausa',
  'Christian Religious Studies','Islamic Studies','Technical Drawing',
  'Food and Nutrition','Home Economics',
] as const;
