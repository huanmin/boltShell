import { useEffect } from 'react';
import { Tabs } from 'antd';
import { CloseOutlined, FolderOutlined, CodeOutlined } from '@ant-design/icons';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../stores/appStore';
import FileManager from '../FileManager/FileManager';
import TerminalSession from './TerminalSession';
import AiResponsePanel from './AiResponsePanel';
import CommandHintPanel from './CommandHintPanel';
import './index.css';

const TerminalArea = () => {
  const {
    sessions,
    activeSessionId,
    connections,
    removeSession,
    setActiveSession,
    aiResponse,
    commandHints,
    clearAiResponse,
    clearCommandHints
  } = useAppStore();

  // 获取当前会话的连接信息
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeConnection = connections.find(c => c.id === activeSession?.connectionId);
  const isFileManager = activeSession?.type === 'file';

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 关闭 AI 面板或命令提示
      if (e.key === 'Escape') {
        if (commandHints.length > 0) {
          clearCommandHints();
        } else if (aiResponse) {
          clearAiResponse();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [aiResponse, commandHints, clearAiResponse, clearCommandHints]);

  // 执行 AI 建议的命令
  const handleExecuteCommand = (command: string, historyId?: string) => {
    // 通过自定义事件发送命令到所有终端（只有活跃的会响应）
    window.dispatchEvent(new CustomEvent('execute-ai-command', {
      detail: { command, historyId }
    }));
  };

  // 关闭会话
  const handleCloseTab = (sessionId: string) => {
    removeSession(sessionId);

    const remainingSessions = sessions.filter(s => s.id !== sessionId);
    if (remainingSessions.length > 0) {
      setActiveSession(remainingSessions[0].id);
    } else {
      setActiveSession(null);
    }
  };

  return (
    <div className="terminal-area">
      {/* Tab Bar */}
      <div className="tab-bar">
        <Tabs
          activeKey={activeSessionId || undefined}
          items={sessions.map((s) => ({
            key: s.id,
            label: (
              <span className="tab-label">
                {s.type === 'file' ? <FolderOutlined /> : <CodeOutlined />}
                <span className="tab-name">{s.name}</span>
                <CloseOutlined
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(s.id);
                  }}
                />
              </span>
            ),
          }))}
          onChange={(key) => setActiveSession(key)}
        />
      </div>

      {/* 内容区域 */}
      <div className="terminal-wrapper">
        {/* 文件管理器 */}
        {isFileManager && activeConnection && (
          <FileManager connectionId={activeConnection.id} />
        )}

        {/* 终端会话 - 每个会话独立渲染，切换时保持连接 */}
        {sessions
          .filter(s => s.type !== 'file')
          .map(session => {
            const conn = connections.find(c => c.id === session.connectionId);
            if (!conn) return null;
            return (
              <TerminalSession
                key={session.id}
                connection={conn}
                isActive={session.id === activeSessionId && !isFileManager}
              />
            );
          })}

        {/* AI 响应面板 - 浮动卡片 */}
        {aiResponse && !isFileManager && (
          <AiResponsePanel onExecuteCommand={handleExecuteCommand} />
        )}

        {/* 命令提示面板 */}
        {commandHints.length > 0 && !isFileManager && (
          <CommandHintPanel
            onSelectHint={(command) => {
              // 通过自定义事件发送命令到终端
              window.dispatchEvent(new CustomEvent('execute-ai-command', {
                detail: { command, historyId: `hint-${Date.now()}` }
              }));
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TerminalArea;