import api from './client';

export interface DailyQuestStatus {
  id: string;
  completedAt: string | null;
  isCompleted: boolean;
  quest: {
    id: string;
    type: string;
    title: string;
    description: string;
    icon: string;
    coinsReward: number;
  };
}

export const getTodayQuests    = () => api.get<DailyQuestStatus[]>('/dailyquests/today');
export const completeQuestType = (type: string) =>
  api.post<{ coins: number; allDone: boolean; bonusCoins: number }>(`/dailyquests/complete/${type}`);
export const seedQuests        = () => api.post('/dailyquests/seed');
