import { create } from 'zustand';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'PASSWORD' | 'KEY';
  rememberCredential?: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  createdAt: string;
  lastConnectedAt?: string;
}

export interface Session {
  id: string;
  connectionId: string;
  name: string;
  type: 'terminal' | 'file';  // 新增：会话类型
  active: boolean;
}

interface AppState {
  // 连接列表
  connections: Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnection: (conn: Connection) => void;
  updateConnection: (id: string, conn: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  updateConnectionStatus: (id: string, status: Connection['status']) => void;
  
  // 编辑连接
  editingConnection: Connection | null;
  setEditingConnection: (conn: Connection | null) => void;

  // 当前会话
  sessions: Session[];
  activeSessionId: string | null;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  
  // 文件管理器状态
  fileManagerPath: string;
  setFileManagerPath: (path: string) => void;

  // UI 状态
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // 待执行的命令
  pendingCommand: string | null;
  setPendingCommand: (command: string | null) => void;
  
  // 加载状态
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  // 添加连接弹窗
  addConnectionModalOpen: boolean;
  showAddConnectionModal: () => void;
  hideAddConnectionModal: () => void;
  
  // 编辑连接弹窗
  editConnectionModalOpen: boolean;
  showEditConnectionModal: (conn: Connection) => void;
  hideEditConnectionModal: () => void;
}

export interface AiSuggestion {
  command: string;
  explanation: string;
  warning?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const useAppStore = create<AppState>((set) => ({
  // 连接列表 - 初始化为空，从 API 加载
  connections: [],
  setConnections: (connections) => set({ connections }),
  addConnection: (conn) => set((state) => ({ connections: [...state.connections, conn] })),
  updateConnection: (id, data) => set((state) => ({
    connections: state.connections.map(c => c.id === id ? { ...c, ...data } : c)
  })),
  removeConnection: (id) => set((state) => ({ connections: state.connections.filter((c) => c.id !== id) })),
  updateConnectionStatus: (id, status) =>
    set((state) => ({
      connections: state.connections.map((c) => (c.id === id ? { ...c, status } : c)),
    })),
  
  // 编辑连接
  editingConnection: null,
  setEditingConnection: (conn) => set({ editingConnection: conn }),

  // 会话
  sessions: [],
  activeSessionId: null,
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
  removeSession: (id) => set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
  setActiveSession: (id) => set({ activeSessionId: id }),
  
  // 文件管理器
  fileManagerPath: '/',
  setFileManagerPath: (path: string) => set({ fileManagerPath: path }),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // 待执行命令
  pendingCommand: null,
  setPendingCommand: (command) => set({ pendingCommand: command }),
  
  // 加载状态
  loading: false,
  setLoading: (loading) => set({ loading }),
  
  // 添加连接弹窗
  addConnectionModalOpen: false,
  showAddConnectionModal: () => set({ addConnectionModalOpen: true, editingConnection: null }),
  hideAddConnectionModal: () => set({ addConnectionModalOpen: false, editingConnection: null }),
  
  // 编辑连接弹窗
  editConnectionModalOpen: false,
  showEditConnectionModal: (conn) => set({ editConnectionModalOpen: true, editingConnection: conn }),
  hideEditConnectionModal: () => set({ editConnectionModalOpen: false, editingConnection: null }),
}));