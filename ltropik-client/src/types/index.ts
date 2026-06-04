export type UserRole = 'Admin' | 'Teacher' | 'Student' | 'Parent' | 'Manager';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthState {
  token: string | null;
  user: User | null;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  gradeScaleId?: string;
  gradeScaleName?: string;
  status: string;
  createdAt: string;
}

export interface ContentBlock {
  type: 'TextBlock' | 'VideoBlock' | 'AudioBlock' | 'CodeSandboxBlock' | 'FileBlock';
  data: Record<string, unknown>;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  sortOrder: number;
  contentBlocks: ContentBlock[];
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
  lessons: Lesson[];
}

export type HomeworkStatus = 'NotStarted' | 'InProgress' | 'OnReview' | 'RequiresChanges' | 'Passed';

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  status: HomeworkStatus;
  submissionData?: string;
  aiFeedbackDraft?: string;
  teacherFeedback?: string;
  gradeValue?: string;
  updatedAt: string;
}

export type AttendanceStatus = 'Present' | 'AbsentWithReason' | 'AbsentWithoutReason' | 'Late';

export interface JournalEntry {
  studentId: string;
  studentName: string;
  attendance: AttendanceStatus;
  gradeValue?: string;
  lessonDate: string;
}

export interface GradeScaleValue {
  id: string;
  valueString: string;
  isPassing: boolean;
}

export interface GradeScale {
  id: string;
  name: string;
  values: GradeScaleValue[];
}

export interface Homework {
  id: string;
  lessonId: string;
  instruction: string;
}

export interface TestAttemptResult {
  scorePercentage: number;
  passed: boolean;
  attemptId: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface ScheduleEntry {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  startsAt: string;
  durationMinutes: number;
  notes?: string;
  courseId: string;
}

export interface CourseProgressInfo {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
}

export interface SearchResult {
  category: string;
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

export interface StudentGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  studentId: string;
  studentName: string;
  email: string;
}

export interface LessonComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  parentCommentId?: string;
  createdAt: string;
  replies: LessonComment[];
}

export interface QuestionBankItem {
  id: string;
  text: string;
  type: 'Single' | 'Multi' | 'Text';
  options: { text: string; isCorrect: boolean }[];
  tags?: string;
  category?: string;
  createdAt: string;
}
