import { Button, Input, Space, Spin, Collapse } from 'antd';
import { CloseOutlined, PlayCircleOutlined, CopyOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useAppStore, type AiResponse, type AiHistoryItem } from '../../stores/appStore';

interface AiResponsePanelProps {
  onExecuteCommand: (command: string, historyId?: string) => void;
}

const AiResponsePanel = ({ onExecuteCommand }: AiResponsePanelProps) => {
  const { aiResponse, clearAiResponse, aiHistory, addAiHistoryItem, updateAiHistoryStatus } = useAppStore();
  const [editedCommand, setEditedCommand] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  if (!aiResponse) return null;

  const handleExecute = () => {
    const cmd = isEditing ? editedCommand : aiResponse.command;
    const historyId = `cmd-${Date.now()}`;

    // Add to history
    addAiHistoryItem({
      id: historyId,
      timestamp: Date.now(),
      sessionId: aiResponse.sessionId,
      query: aiResponse.query,
      command: cmd,
      explanation: aiResponse.explanation,
      riskLevel: aiResponse.riskLevel,
      warnings: aiResponse.warnings,
      status: 'pending',
    });

    onExecuteCommand(cmd, historyId);
    clearAiResponse();
    setIsEditing(false);
    setEditedCommand('');
  };

  const handleCancel = () => {
    clearAiResponse();
  };

  const handleCopy = () => {
    const cmd = isEditing ? editedCommand : aiResponse.command;
    navigator.clipboard.writeText(cmd);
  };

  const startEditing = () => {
    setEditedCommand(aiResponse.command);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedCommand('');
  };

  // 风险等级颜色
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
      case 'high':
        return '#f85149';
      case 'medium':
        return '#f59e0b';
      default:
        return '#52c41a';
    }
  };

  // 状态图标
  const getStatusIcon = (status: AiHistoryItem['status']) => {
    switch (status) {
      case 'executed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'cancelled':
        return <CloseCircleOutlined style={{ color: '#f85149' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#8b949e' }} />;
    }
  };

  // 状态文本
  const getStatusText = (status: AiHistoryItem['status']) => {
    switch (status) {
      case 'executed':
        return '已执行';
      case 'cancelled':
        return '已取消';
      default:
        return '待执行';
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ai-suggestion-panel">
      <div className="ai-suggestion-header">
        <span className="ai-suggestion-title">
          💡 AI 命令建议
          {aiResponse.loading && <Spin size="small" style={{ marginLeft: 8 }} />}
        </span>
        <Button
          type="text"
          icon={<CloseOutlined />}
          className="close-btn"
          onClick={handleCancel}
          size="small"
        />
      </div>
      <div className="ai-suggestion-body">
        {/* 用户问题 */}
        <div style={{ marginBottom: 12, fontSize: 13, color: '#8b949e' }}>
          <span style={{ color: '#58a6ff' }}>❓ {aiResponse.query}</span>
        </div>

        {/* 流式输出显示 */}
        {aiResponse.loading && aiResponse.streamingText && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            background: '#0d1117',
            borderRadius: 8,
            border: '1px solid #21262d',
            fontFamily: 'Monaco, Menlo, "Courier New", monospace',
            fontSize: 13,
            color: '#8b949e',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 150,
            overflow: 'auto'
          }}>
            {aiResponse.streamingText}
            <span style={{ color: '#58a6ff', animation: 'blink 1s infinite' }}>▊</span>
          </div>
        )}

        {/* 命令显示/编辑 */}
        {!aiResponse.loading && aiResponse.command && (
          <>
            {isEditing ? (
              <div className="command-edit-row">
                <Input
                  className="command-input"
                  value={editedCommand}
                  onChange={(e) => setEditedCommand(e.target.value)}
                  onPressEnter={handleExecute}
                  autoFocus
                />
                <Button size="small" onClick={cancelEditing}>取消</Button>
                <Button type="primary" size="small" onClick={handleExecute}>执行</Button>
              </div>
            ) : (
              <div className="command-display-row">
                <span className="command-prefix">$</span>
                <code className="command-text">{aiResponse.command}</code>
                <Space size={4}>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={startEditing}
                    title="编辑命令"
                  />
                  <Button
                    type="text"
                    icon={<CopyOutlined />}
                    size="small"
                    onClick={handleCopy}
                    title="复制命令"
                  />
                </Space>
              </div>
            )}
          </>
        )}

        {/* 说明 */}
        {!aiResponse.loading && aiResponse.explanation && (
          <div className="explanation-row">
            <span className="explanation-label">说明: </span>
            <span className="explanation-text">{aiResponse.explanation}</span>
          </div>
        )}

        {/* 风险等级 */}
        {!aiResponse.loading && aiResponse.command && (
          <div style={{ marginTop: 10, marginBottom: 10 }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              background: `${getRiskColor(aiResponse.riskLevel)}22`,
              color: getRiskColor(aiResponse.riskLevel),
              border: `1px solid ${getRiskColor(aiResponse.riskLevel)}44`
            }}>
              风险等级: {aiResponse.riskLevel.toUpperCase()}
            </span>
          </div>
        )}

        {/* 警告 */}
        {!aiResponse.loading && aiResponse.warnings && aiResponse.warnings.length > 0 && (
          <div className="warnings-row">
            {aiResponse.warnings.map((w, i) => (
              <div key={i} className="warning-item">⚠️ {w}</div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        {!aiResponse.loading && aiResponse.command && !isEditing && (
          <div className="actions-row">
            <Button size="small" onClick={handleCancel}>取消</Button>
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
            >
              执行
            </Button>
          </div>
        )}

        {/* 历史记录 */}
        {aiHistory.length > 0 && (
          <div className="ai-history-section">
            <div
              className="ai-history-header"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              <span>📜 历史记录 ({aiHistory.length})</span>
              <RightOutlined
                style={{
                  transition: 'transform 0.2s',
                  transform: historyExpanded ? 'rotate(90deg)' : 'none'
                }}
              />
            </div>
            {historyExpanded && (
              <div className="ai-history-list">
                {aiHistory.map((item) => (
                  <div key={item.id} className="ai-history-item">
                    <div className="ai-history-item-header">
                      <span className="ai-history-time">{formatTime(item.timestamp)}</span>
                      {getStatusIcon(item.status)}
                      <span className="ai-history-status">{getStatusText(item.status)}</span>
                    </div>
                    <div className="ai-history-query">{item.query}</div>
                    <code className="ai-history-command">$ {item.command}</code>
                    {item.output && (
                      <div className="ai-history-output">
                        <div className="ai-history-output-label">输出:</div>
                        <pre>{item.output.slice(0, 200)}{item.output.length > 200 ? '...' : ''}</pre>
                      </div>
                    )}
                    {item.followUp && (
                      <div className="ai-history-followup">
                        💡 {item.followUp}
                        {item.followUpCommand && (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => {
                              const newHistoryId = `cmd-${Date.now()}`;
                              addAiHistoryItem({
                                id: newHistoryId,
                                timestamp: Date.now(),
                                sessionId: item.sessionId,
                                query: item.followUp || '',
                                command: item.followUpCommand || '',
                                explanation: '',
                                riskLevel: 'low',
                                warnings: [],
                                status: 'pending',
                              });
                              onExecuteCommand(item.followUpCommand, newHistoryId);
                            }}
                          >
                            执行建议命令
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiResponsePanel;