export type UserRole = 'student' | 'vendor' | 'admin';
export type ExamType = 'WAEC' | 'JAMB' | 'NECO' | 'KCSE' | 'WASSCE' | 'BECE' | 'UTME' | 'POST-UTME' | 'OTHER';
export type BankStatus = 'pending' | 'approved' | 'live' | 'rejected';
export type PurchaseStatus = 'pending' | 'success' | 'failed';
export type AssessmentType = 'test' | 'exam' | 'quiz' | 'assignment' | 'practice' | 'other';
export type AccessType = 'free' | 'paid' | 'preview_paid';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  school?: string;
  phone?: string;
  total_earnings: number;
  total_paid_out: number;
  pending_payout: number;
  avatar_url?: string;
  created_at: string;
}

export interface QuestionBank {
  id: string;
  vendor_id: string;
  title: string;
  description?: string;
  subject: string;
  exam_type: ExamType;
  year_start?: number;
  year_end?: number;
  school?: string;
  university?: string;
  faculty?: string;
  department?: string;
  programme?: string;
  level?: string;
  semester?: string;
  course_code?: string;
  course_title?: string;
  assessment_type?: AssessmentType;
  academic_session?: string;
  country: string;
  question_count: number;
  price: number;
  access_type: AccessType;
  preview_count: number;
  preview_count: number;
  status: BankStatus;
  total_sales: number;
  rating: number;
  rating_count: number;
  thumbnail_url?: string;
  created_at: string;
  vendor?: Profile;
}

export interface Question {
  id: string;
  bank_id: string;
  vendor_id: string;
  question_number: number;
  year?: number;
  question_text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  correct_answer: string;
  explanation?: string;
  topic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_preview: boolean;
}

export interface Purchase {
  id: string;
  user_id: string;
  bank_id: string;
  amount_paid: number;
  paystack_reference: string;
  paystack_status: PurchaseStatus;
  vendor_share?: number;
  platform_share?: number;
  imported_to_akili: boolean;
  akili_project_id?: string;
  purchased_at: string;
  bank?: QuestionBank;
}

export interface PayoutRequest {
  id: string;
  vendor_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'paid' | 'rejected';
  admin_note?: string;
  requested_at: string;
  processed_at?: string;
}


