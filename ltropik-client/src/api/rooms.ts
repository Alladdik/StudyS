import api from './client';

export interface RoomInfo {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  courseName?: string;
  createdAt: string;
  participantCount: number;
}

export interface RoomDetail extends RoomInfo {
  isActive: boolean;
  participants: { userId: string; displayName: string; connectionId: string }[];
  messages: RoomChatMessage[];
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  sentAt: string;
}

export const getRooms = () => api.get<RoomInfo[]>('/rooms');
export const getRoom = (id: string) => api.get<RoomDetail>(`/rooms/${id}`);
export const createRoom = (data: { title: string; courseId?: string }) =>
  api.post<{ id: string; title: string; courseId?: string; createdAt: string }>('/rooms', data);
export const endRoom = (id: string) => api.post(`/rooms/${id}/end`);
export const deleteRoom = (id: string) => api.delete(`/rooms/${id}`);
export const getRoomParticipants = (id: string) =>
  api.get<{ count: number; participants: { userId: string; displayName: string }[] }>(`/rooms/${id}/participants`);
