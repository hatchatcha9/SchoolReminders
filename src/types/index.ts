// Canvas API Types
export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  lock_at: string | null;
  unlock_at: string | null;
  points_possible: number;
  course_id: number;
  submission_types: string[];
  has_submitted_submissions: boolean;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  late: boolean;
  missing: boolean;
  workflow_state: string;
}

// Skyward Types (based on skyward-rest)
export interface SkywardCourse {
  name: string;
  instructor: string;
  grades: SkywardGrade[];
}

export interface SkywardGrade {
  period: string;
  score: number | null;
  letter: string | null;
}

export interface SkywardAssignment {
  name: string;
  date: string;
  pointsEarned: number | null;
  pointsTotal: number;
  category: string;
}

// Unified App Types
export interface UnifiedAssignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  lockDate: Date | null;
  course: string;
  source: 'canvas' | 'skyward';
  pointsPossible: number | null;
  submitted: boolean;
  score: number | null;
  isTest: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface Reminder {
  id: string;
  assignmentId: string;
  type: 'due_soon' | 'locking_soon' | 'test_prep' | 'custom';
  message: string;
  triggerAt: Date;
  dismissed: boolean;
}

export interface StudyStrategy {
  assignmentId: string;
  strategies: string[];
  estimatedStudyTime: string;
  resources: string[];
}
