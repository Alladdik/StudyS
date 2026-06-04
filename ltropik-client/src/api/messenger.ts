import api from './client';

export interface Conversation {
  userId: string;
  name: string;
  role: string;
  unreadCount: number;
  lastMessage?: { content: string; sentAt: string; isMine: boolean };
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface Message {
  id: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  isMine: boolean;
}

export const getConversations = () => api.get<Conversation[]>('/messenger/conversations');
export const getContacts      = () => api.get<Contact[]>('/messenger/contacts');
export const getMessages      = (partnerId: string, skip = 0) =>
  api.get<Message[]>(`/messenger/${partnerId}`, { params: { skip } });
export const sendMessage      = (partnerId: string, content: string) =>
  api.post(`/messenger/${partnerId}`, { content });
export const getCourseChat    = (courseId: string) =>
  api.get<{ roomId: string | null; messages: (Message & { displayName: string })[] }>(
    `/messenger/course/${courseId}`
  );
