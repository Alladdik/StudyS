import api from './client';

export interface TestQuestion {
  id: string;
  type: 'single' | 'multiple' | 'text';
  text: string;
  options?: { id: string; text: string }[];
}

export interface TestInfo {
  id: string;
  title: string;
  timeLimitMinutes: number;
  maxAttempts: number;
  passingPercentage: number;
  questions: TestQuestion[];
}

export interface StartTestResponse {
  attemptId: string;
  serverStartTime: string;
  timeLimitMinutes: number;
}

export interface TestResult {
  scorePercentage: number;
  passed: boolean;
  attemptId: string;
}

export const getTest = (id: string) => api.get<TestInfo>(`/tests/${id}`);
export const startTest = (id: string) => api.post<StartTestResponse>(`/tests/${id}/start`);
export const submitTest = (attemptId: string, answers: Record<string, unknown>, questionTimes?: Record<string, number>) =>
  api.post<TestResult>('/tests/submit', { attemptId, answers, questionTimes });
export const getRemainingAttempts = (testId: string) =>
  api.get<number>(`/tests/${testId}/remaining-attempts`);
