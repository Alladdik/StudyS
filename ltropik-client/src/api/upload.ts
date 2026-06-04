import api from './client';

export interface UploadResult {
  url: string;
  fileName: string;
  size: number;
  contentType: string;
}

export const uploadFile = (file: File, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<UploadResult>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
};
