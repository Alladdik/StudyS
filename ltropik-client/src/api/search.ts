import api from './client';
import type { SearchResult } from '../types';

export const search = (q: string) =>
  api.get<{ results: SearchResult[]; total: number }>('/search', { params: { q } });
