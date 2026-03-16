import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

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

  // 主题
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // 设置弹窗
  settingsModalOpen: boolean;
  showSettingsModal: () => void;
  hideSettingsModal: () => void;

  // AI 响应面板
  aiResponse: AiResponse | null;
  setAiResponse: (response: AiResponse | null) => void;
  updateAiStreamingText: (text: string) => void;
  clearAiResponse: () => void;

  // AI 历史记录
  aiHistory: AiHistoryItem[];
  addAiHistoryItem: (item: AiHistoryItem) => void;
  updateAiHistoryStatus: (id: string, status: string, output?: string) => void;
  updateAiHistoryFollowUp: (id: string, followUp: string, followUpCommand?: string) => void;
  clearAiHistory: () => void;

  // 命令提示
  commandHints: CommandHint[];
  setCommandHints: (hints: CommandHint[]) => void;
  clearCommandHints: () => void;
  selectedHintIndex: number;
  setSelectedHintIndex: (index: number) => void;
}

export interface AiSuggestion {
  command: string;
  explanation: string;
  warning?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// AI 响应状态
export interface AiResponse {
  sessionId: string;
  query: string;
  command: string;
  explanation: string;
  riskLevel: string;
  warnings: string[];
  loading: boolean;
  streamingText: string;  // 流式输出的文本
}

// AI 对话历史项
export interface AiHistoryItem {
  id: string;
  timestamp: number;
  sessionId: string;
  query: string;           // 用户问题
  command: string;         // AI 生成的命令
  explanation: string;     // 命令说明
  riskLevel: string;       // 风险等级
  warnings: string[];
  status: 'pending' | 'executed' | 'cancelled';  // 状态
  output?: string;         // 命令执行输出（可选）
  followUp?: string;       // AI 后续建议（可选）
  followUpCommand?: string; // 后续建议命令（可选）
}

// 命令提示项
export interface CommandHint {
  command: string;
  description: string;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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

      // 主题
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // 设置弹窗
      settingsModalOpen: false,
      showSettingsModal: () => set({ settingsModalOpen: true }),
      hideSettingsModal: () => set({ settingsModalOpen: false }),

      // AI 响应面板
      aiResponse: null,
      setAiResponse: (response) => set({ aiResponse: response }),
      updateAiStreamingText: (text) => set((state) => ({
        aiResponse: state.aiResponse ? { ...state.aiResponse, streamingText: text } : null
      })),
      clearAiResponse: () => set({ aiResponse: null }),

      // AI 历史记录
      aiHistory: [],
      addAiHistoryItem: (item) => set((state) => ({
        aiHistory: [item, ...state.aiHistory].slice(0, 50) // Keep last 50 items
      })),
      updateAiHistoryStatus: (id, status, output) => set((state) => ({
        aiHistory: state.aiHistory.map(item =>
          item.id === id ? { ...item, status: status as AiHistoryItem['status'], output } : item
        )
      })),
      updateAiHistoryFollowUp: (id, followUp, followUpCommand) => set((state) => ({
        aiHistory: state.aiHistory.map(item =>
          item.id === id ? { ...item, followUp, followUpCommand } : item
        )
      })),
      clearAiHistory: () => set({ aiHistory: [] }),

      // 命令提示
      commandHints: [],
      setCommandHints: (hints) => set({ commandHints: hints, selectedHintIndex: 0 }),
      clearCommandHints: () => set({ commandHints: [], selectedHintIndex: 0 }),
      selectedHintIndex: 0,
      setSelectedHintIndex: (index) => set({ selectedHintIndex: index }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);