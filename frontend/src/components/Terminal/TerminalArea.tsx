import { Tabs } from 'antd';
import { CloseOutlined, FolderOutlined, CodeOutlined } from '@ant-design/icons';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../stores/appStore';
import FileManager from '../FileManager/FileManager';
import TerminalSession from './TerminalSession';
import './index.css';

const TerminalArea = () => {
  const {
    sessions,
    activeSessionId,
    connections,
    removeSession,
    setActiveSession
  } = useAppStore();

  // 获取当前会话的连接信息
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeConnection = connections.find(c => c.id === activeSession?.connectionId);
  const isFileManager = activeSession?.type === 'file';

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
      </div>
    </div>
  );
};

export default TerminalArea;