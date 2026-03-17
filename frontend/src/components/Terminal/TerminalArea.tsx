import { useEffect } from 'react';
import { Tabs, Switch, Tooltip } from 'antd';
import { CloseOutlined, FolderOutlined, CodeOutlined, RobotOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import { useAppStore } from '../../stores/appStore';
import FileManager from '../FileManager/FileManager';
import CustomTerminal from './CustomTerminal';
import CommandAssistant from './CommandAssistant';
import './index.css';

const TerminalArea = () => {
  const {
    sessions,
    activeSessionId,
    connections,
    removeSession,
    setActiveSession,
    terminalMode,
    toggleTerminalMode,
    commandAssistantVisible,
    showCommandAssistant,
    hideCommandAssistant
  } = useAppStore();

  // 获取当前会话的连接信息
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeConnection = connections.find(c => c.id === activeSession?.connectionId);
  const isFileManager = activeSession?.type === 'file';

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+I 切换终端模式
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        toggleTerminalMode();
        return;
      }

      // Ctrl+Shift+Y 唤出命令助手 (仅 Shell 模式)
      if (e.ctrlKey && e.shiftKey && e.key === 'Y' && terminalMode === 'shell') {
        e.preventDefault();
        showCommandAssistant();
        return;
      }

      // Escape 关闭命令助手
      if (e.key === 'Escape' && commandAssistantVisible) {
        hideCommandAssistant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleTerminalMode, showCommandAssistant, hideCommandAssistant, commandAssistantVisible, terminalMode]);

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
        {/* 模式切换控件 */}
        <div className="mode-switch-container">
          <Tooltip title="Ctrl+Shift+I 切换模式">
            <div className="mode-switch">
              <span className={`mode-label ${terminalMode === 'shell' ? 'active' : ''}`}>
                <CodeSandboxOutlined /> Shell
              </span>
              <Switch
                checked={terminalMode === 'agent'}
                onChange={toggleTerminalMode}
                size="small"
              />
              <span className={`mode-label ${terminalMode === 'agent' ? 'active' : ''}`}>
                <RobotOutlined /> Agent
              </span>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="terminal-wrapper">
        {/* 文件管理器 */}
        {isFileManager && activeConnection && (
          <FileManager connectionId={activeConnection.id} />
        )}

        {/* 自定义终端会话 - 每个会话独立渲染，切换时保持连接 */}
        {sessions
          .filter(s => s.type !== 'file')
          .map(session => {
            const conn = connections.find(c => c.id === session.connectionId);
            if (!conn) return null;
            return (
              <CustomTerminal
                key={session.id}
                connection={conn}
                isActive={session.id === activeSessionId && !isFileManager}
              />
            );
          })}

        {/* 命令助手面板 - Shell 模式下可用 */}
        {commandAssistantVisible && !isFileManager && terminalMode === 'shell' && (
          <CommandAssistant onClose={hideCommandAssistant} />
        )}
      </div>
    </div>
  );
};

export default TerminalArea;