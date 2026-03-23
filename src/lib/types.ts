export type UserRole = 'admin' | 'teacher' | 'student';

export type StreamName = 'Blue' | 'Green' | 'Magenta' | 'Red' | 'White' | 'Yellow';

export interface Profile {
  id: string;
  full_name: string;
  admission_number: string;
  role: UserRole;
  stream: StreamName | null;
  grade: number | null;
  academic_year: number;
  must_change_pin: boolean;
  created_at: string;
}

export interface Stream {
  id: string;
  name: StreamName;
  academic_year: number;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  stream_id: string;
  teacher_id: string | null;
  academic_year: number;
  created_at: string;
  stream?: Stream;
  teacher?: Profile;
}

export type AssignmentMode = 'mcq' | 'theory' | 'mixed' | 'practical' | 'exam' | 'file_upload';
export type AssignmentStatus = 'draft' | 'published' | 'active' | 'closed';
export type QuestionType = 'mcq' | 'short_answer' | 'structured';
export type ExamSessionStatus = 'in_progress' | 'submitted' | 'timed_out' | 'left';

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  subject_id: string;
  stream_id: string;
  due_date: string;
  created_by: string;
  created_at: string;
  mode: AssignmentMode;
  time_limit: number | null;
  is_exam: boolean;
  shuffle_questions: boolean;
  total_points: number;
  status: AssignmentStatus;
  subject?: Subject;
  stream?: Stream;
  creator?: Profile;
  questions?: Question[];
}

export interface Question {
  id: string;
  assignment_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index: number;
  marking_scheme: string | null;
  instructions: string | null;
  created_at: string;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  created_at: string;
}

export interface ExamSession {
  id: string;
  assignment_id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
  status: ExamSessionStatus;
  last_activity: string;
  time_remaining: number | null;
  score: number | null;
  total_points: number | null;
  created_at: string;
  student?: Profile;
  assignment?: Assignment;
}

export interface StudentAnswer {
  id: string;
  exam_session_id: string;
  question_id: string;
  answer_text: string | null;
  selected_option_id: string | null;
  is_correct: boolean | null;
  points_earned: number;
  answered_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  answer_text: string | null;
  file_url: string | null;
  submitted_at: string;
  grade: string | null;
  feedback: string | null;
  graded_at: string | null;
  assignment?: Assignment;
  student?: Profile;
}

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  stream_id: string;
  created_by: string;
  created_at: string;
  stream?: Stream;
  creator?: Profile;
}

export interface AcademicYear {
  id: string;
  year: number;
  is_active: boolean;
}

export interface GradeChatMessage {
  id: string;
  grade: number;
  sender_id?: string;
  message: string;
  reply_to_id?: string | null;
  updated_at?: string;
  created_at: string;
  canEdit?: boolean;
  canDelete?: boolean;
  replyTo?: {
    id: string;
    message: string;
    sender_name: string;
    sender_role?: UserRole;
  } | null;
  sender?: (Pick<Profile, 'id' | 'full_name' | 'role'> & { display_name?: string }) | null;
}

// Stream colour mapping for UI badges
export const STREAM_COLORS: Record<StreamName, string> = {
  Blue: '#185FA5',
  Green: '#1A6B45',
  Magenta: '#99355A',
  Red: '#A32D2D',
  White: '#888780',
  Yellow: '#BA7517',
};

export const STREAM_NAMES: StreamName[] = ['Blue', 'Green', 'Magenta', 'Red', 'White', 'Yellow'];

// Weak PINs that should be blocked
export const WEAK_PINS = [
  '123456', '000000', '111111', '222222', '333333',
  '444444', '555555', '666666', '777777', '888888',
  '999999', '123123', '654321',
];
