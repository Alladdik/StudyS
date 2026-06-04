import api from './client';

export interface BadgeDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  conditionValue: number;
  coinsReward: number;
  isEarned: boolean;
  earnedAt?: string;
}

export interface StudentProgress {
  currentStreak: number;
  maxStreak: number;
  totalCoins: number;
  lastActivityDate: string;
  earnedBadges: BadgeDto[];
  allBadges: BadgeDto[];
}

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  coins: number;
  streak: number;
  maxStreak: number;
}

export const getProgress = () => api.get<StudentProgress>('/gamification/progress');
export const getLeaderboard = () => api.get<LeaderboardEntry[]>('/gamification/leaderboard');
export const spendCoins = (amount: number) => api.post('/gamification/spend-coins', amount);
