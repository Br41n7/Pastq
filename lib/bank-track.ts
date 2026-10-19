/** Question banks come in two tracks. The DB keeps one `exam_type` column; the track is derived from it. */
export const SSCE_EXAMS = ['WAEC', 'NECO', 'WASSCE', 'JAMB', 'UTME', 'BECE', 'KCSE'] as const;
export const UNI_CATEGORIES = [
  { value: 'OTHER', label: 'Course test / exam', hint: 'Tests, quizzes and exams for a specific course (e.g. ANA 201).' },
  { value: 'POST-UTME', label: 'Post-UTME screening', hint: "A university's post-UTME screening questions." },
] as const;

export type BankTrack = 'university' | 'ssce';

export const trackOf = (examType?: string | null): BankTrack =>
  (SSCE_EXAMS as readonly string[]).includes(examType || '') ? 'ssce' : 'university';

export const TRACK_LABEL: Record<BankTrack, string> = { university: 'University', ssce: 'SSCE' };
export const TRACK_BADGE: Record<BankTrack, string> = {
  university: 'bg-indigo-50 text-indigo-700',
  ssce: 'bg-amber-50 text-amber-700',
};
