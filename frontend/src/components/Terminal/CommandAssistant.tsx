import { useState, useRef, useEffect } from 'react';
import { Button, Input, Spin } from 'antd';
import { CloseOutlined, CopyOutlined, ImportOutlined, DragOutlined } from '@ant-design/icons';
import './CommandAssistant.css';

interface CommandAssistantProps {
  onClose: () => void;
}

const CommandAssistant = ({ onClose }: CommandAssistantProps) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedCommand, setSuggestedCommand] = useState('');
  const [explanation, setExplanation] = useState('');
  const [position, setPosition] = useState({ x: 100, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // 处理拖动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (headerRef.current && headerRef.current.contains(e.target as Node)) {
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
        setIsDragging(true);
      }
    }
  };

  // 发送查询
  const handleQuery = () => {
    if (!query.trim()) return;

    setLoading(true);
    setSuggestedCommand('');
    setExplanation('');

    window.dispatchEvent(new CustomEvent('ai-command-assistant-query', {
      detail: { query: query.trim() }
    }));
  };

  // 监听 AI 响应
  useEffect(() => {
    const handleResponse = (e: CustomEvent) => {
      setLoading(false);
      setSuggestedCommand(e.detail.command);
      setExplanation(e.detail.explanation);
    };

    window.addEventListener('ai-command-assistant-response', handleResponse as EventListener);
    return () => {
      window.removeEventListener('ai-command-assistant-response', handleResponse as EventListener);
    };
  }, []);

  // 复制命令
  const handleCopy = () => {
    if (suggestedCommand) {
      navigator.clipboard.writeText(suggestedCommand);
    }
  };

  // 插入命令到终端
  const handleInsert = () => {
    if (suggestedCommand) {
      window.dispatchEvent(new CustomEvent('insert-command-to-terminal', {
        detail: { command: suggestedCommand }
      }));
      onClose();
    }
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  return (
    <div
      ref={panelRef}
      className="command-assistant-panel"
      style={{
        left: position.x,
        top: position.y
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 可拖动的头部 */}
      <div ref={headerRef} className="command-assistant-header">
        <span className="drag-handle">
          <DragOutlined />
        </span>
        <span className="command-assistant-title">💡 AI 命令建议</span>
        <Button
          type="text"
          icon={<CloseOutlined />}
          className="close-btn"
          onClick={onClose}
          size="small"
        />
      </div>

      <div className="command-assistant-body">
        {/* 查询输入区域 */}
        <div className="query-input-area">
          <Input
            placeholder="输入中文描述，如：查看当前目录下最大的文件"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="query-input"
          />
          <div className="query-actions">
            <Button onClick={() => setQuery('')}>清空</Button>
            <Button type="primary" onClick={handleQuery} loading={loading}>
              按Enter查询
            </Button>
            <span className="hint-text">按ESC关闭</span>
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="loading-container">
            <Spin size="small" />
            <span>正在生成命令...</span>
          </div>
        )}

        {/* 命令显示区域 */}
        {suggestedCommand && !loading && (
          <>
            <div className="command-display-area">
              <div className="command-box">
                <button className="copy-btn" onClick={handleCopy} title="复制命令">
                  <CopyOutlined />
                </button>
                <code className="command-text">{suggestedCommand}</code>
                <span className="shell-tag">shell</span>
              </div>
              <div className="insert-action">
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  onClick={handleInsert}
                >
                  插入 <span className="shortcut">Ctrl+Enter</span>
                </Button>
              </div>
            </div>

            {/* 解释区域 */}
            {explanation && (
              <div className="explanation-area">
                <div className="explanation-header">内容解释：</div>
                <div className="explanation-content">{explanation}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommandAssistant;