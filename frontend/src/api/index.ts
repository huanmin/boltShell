import axios from 'axios';

const API_BASE = 'http://localhost:18080/api/v1';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'PASSWORD' | 'KEY';
  rememberCredential?: boolean;
  createdAt: string;
  lastConnectedAt?: string;
}

export interface ApiResult<T> {
  code: number;
  message?: string;
  data: T;
}

// 连接管理 API
export const connectionApi = {
  list: () => 
    axios.get<ApiResult<Connection[]>>(`${API_BASE}/connections`),
  
  get: (id: string) => 
    axios.get<ApiResult<Connection>>(`${API_BASE}/connections/${id}`),
  
  create: (data: Partial<Connection> & { password?: string; privateKey?: string; rememberCredential?: boolean }) => 
    axios.post<ApiResult<Connection>>(`${API_BASE}/connections`, data),
  
  update: (id: string, data: Partial<Connection>) => 
    axios.put<ApiResult<Connection>>(`${API_BASE}/connections/${id}`, data),
  
  delete: (id: string) => 
    axios.delete<ApiResult<void>>(`${API_BASE}/connections/${id}`),
  
  test: (id: string) => 
    axios.post<ApiResult<{ success: boolean; message: string }>>(`${API_BASE}/connections/${id}/test`),
  
  // 直接测试连接（不保存）
  testDirect: (data: Partial<Connection> & { password?: string; privateKey?: string }) => 
    axios.post<ApiResult<{ success: boolean; message: string; serverInfo?: { os: string; host: string; username: string } }>>(`${API_BASE}/connections/test`, data),
};

// AI 配置 API
export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

export const aiConfigApi = {
  get: () => 
    axios.get<ApiResult<AiConfig | null>>(`${API_BASE}/ai-config`),
  
  update: (data: Partial<AiConfig> & { apiKey?: string }) => 
    axios.put<ApiResult<AiConfig>>(`${API_BASE}/ai-config`, data),
  
  test: () => 
    axios.post<ApiResult<{ success: boolean; message: string }>>(`${API_BASE}/ai-config/test`),
};

// 文件管理 API
export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;  // 修改：与后端字段名一致
  size: number;
  modifiedTime: number;
  permissions: string;
}

export const fileApi = {
  list: (connectionId: string, path: string = '/') => 
    axios.get<ApiResult<FileInfo[]>>(`${API_BASE}/connections/${connectionId}/files`, {
      params: { path }
    }),
  
  downloadUrl: (connectionId: string, path: string, isDirectory: boolean = false) => {
    // 确保路径不会出现双斜杠
    const normalizedPath = path.startsWith('//') ? path.substring(1) : path;
    return `${API_BASE}/connections/${connectionId}/files/download?path=${encodeURIComponent(normalizedPath)}&isDirectory=${isDirectory}`;
  },
  
  upload: (connectionId: string, path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    return axios.post<ApiResult<void>>(
      `${API_BASE}/connections/${connectionId}/files/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  
  delete: (connectionId: string, path: string, isDirectory: boolean) => 
    axios.delete<ApiResult<void>>(`${API_BASE}/connections/${connectionId}/files`, {
      params: { path, isDirectory }
    }),
  
  mkdir: (connectionId: string, path: string) => 
    axios.post<ApiResult<void>>(`${API_BASE}/connections/${connectionId}/files/mkdir`, null, {
      params: { path }
    }),
};

// 健康检查
export const healthApi = {
  check: () => 
    axios.get<ApiResult<{ status: string; version: string }>>(`${API_BASE}/health`),
};