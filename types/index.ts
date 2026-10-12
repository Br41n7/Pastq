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
  bio?: string;
  vendor_status?: 'active' | 'suspended';
  vendor_terms_version?: string | null;
  vendor_terms_accepted_at?: string | null;
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
  status: BankStatus;
  total_sales: number;
  rating: number;
  rating_count: number;
  thumbnail_url?: string;
  moderation_note?: string | null;
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



export type ReportReason = 'wrong_answer' | 'typo' | 'duplicate' | 'wrong_course' | 'wrong_year' | 'copyright' | 'misleading' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportResolution = 'fixed' | 'removed' | 'bank_taken_down' | 'no_action';

export interface ContentReport {
  id: string;
  reporter_id: string;
  bank_id: string;
  question_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution?: ReportResolution | null;
  admin_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface PayoutAccount {
  vendor_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}
