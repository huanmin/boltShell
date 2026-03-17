import { Button, Input, Spin } from 'antd';
import { PlayCircleOutlined, EditOutlined, CloseCircleOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useAppStore, type AiHistoryItem } from '../../stores/appStore';

interface AiResponsePanelProps {
  onExecuteCommand: (command: string, historyId?: string) => void;
  onRejectCommand?: (query: string, reason: string) => void;
}

const AiResponsePanel = ({ onExecuteCommand, onRejectCommand }: AiResponsePanelProps) => {
  const { aiResponse, clearAiResponse, aiHistory, addAiHistoryItem } = useAppStore();
  const [editedCommand, setEditedCommand] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!aiResponse) return null;

  // 执行命令
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

  // 拒绝命令 - 发送拒绝原因给 AI 重新生成
  const handleReject = () => {
    if (onRejectCommand && aiResponse.query) {
      // 发送拒绝原因和原查询给 AI
      const reason = rejectReason || '用户拒绝执行此命令';
      onRejectCommand(aiResponse.query, reason);
    }
    clearAiResponse();
    setRejectReason('');
  };

  // 开始编辑
  const startEditing = () => {
    setEditedCommand(aiResponse.command);
    setIsEditing(true);
  };

  // 保存编辑
  const saveEditing = () => {
    setIsEditing(false);
    // 保持编辑后的命令，等待用户执行
  };

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false);
    setEditedCommand('');
  };

  // 状态图标
  const getStatusIcon = (status: AiHistoryItem['status']) => {
    switch (status) {
      case 'executed':
        return <span style={{ color: '#52c41a' }}>✓</span>;
      case 'cancelled':
        return <span style={{ color: '#f85149' }}>✗</span>;
      default:
        return <span style={{ color: '#8b949e' }}>○</span>;
    }
  };

  // 状态文本
  const getStatusText = (status: AiHistoryItem['status']) => {
    switch (status) {
      case 'executed':
        return '已同意';
      case 'cancelled':
        return '已拒绝';
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
      </div>
      <div className="ai-suggestion-body">
        {/* 用户问题 */}
        <div style={{ marginBottom: 12, fontSize: 13, color: '#8b949e' }}>
          <span style={{ color: '#58a6ff' }}>❓ {aiResponse.query}</span>
        </div>

        {/* 流式输出显示 */}
        {aiResponse.loading && aiResponse.streamingText && (
          <div className="streaming-output">
            {aiResponse.streamingText}
            <span className="cursor-blink">▊</span>
          </div>
        )}

        {/* 命令显示/编辑 */}
        {!aiResponse.loading && aiResponse.command && (
          <>
            {/* 风险等级标题 */}
            <div className="risk-header">
              <span className={`risk-badge ${aiResponse.riskLevel}`}>
                {aiResponse.riskLevel === 'high' || aiResponse.riskLevel === 'critical'
                  ? '⚠️ 高危命令'
                  : '命令'}
              </span>
            </div>

            {isEditing ? (
              <div className="command-edit-container">
                <Input
                  className="command-input"
                  value={editedCommand}
                  onChange={(e) => setEditedCommand(e.target.value)}
                  onPressEnter={handleExecute}
                  autoFocus
                />
                <div className="edit-actions">
                  <Button size="small" icon={<CloseOutlined />} onClick={cancelEditing}>取消</Button>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={saveEditing}>保存</Button>
                </div>
              </div>
            ) : (
              <div className="command-display-container">
                <div className="command-box">
                  <code className="command-text">{aiResponse.command}</code>
                </div>

                {/* 三按钮操作区 */}
                <div className="action-buttons">
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleExecute}
                  >
                    执行
                  </Button>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={startEditing}
                  >
                    修改
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleReject}
                  >
                    拒绝
                  </Button>
                </div>
              </div>
            )}

            {/* 说明 */}
            {aiResponse.explanation && (
              <div className="explanation-row">
                <span className="explanation-label">说明: </span>
                <span className="explanation-text">{aiResponse.explanation}</span>
              </div>
            )}

            {/* 警告 */}
            {aiResponse.warnings && aiResponse.warnings.length > 0 && (
              <div className="warnings-row">
                {aiResponse.warnings.map((w, i) => (
                  <div key={i} className="warning-item">⚠️ {w}</div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 历史记录 */}
        {aiHistory.length > 0 && !isEditing && (
          <div className="ai-history-section">
            <div
              className="ai-history-header"
              onClick={() => setHistoryExpanded(!historyExpanded)}
            >
              <span>📜 历史记录 ({aiHistory.length})</span>
              <span className={`expand-icon ${historyExpanded ? 'expanded' : ''}`}>▶</span>
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
                              onExecuteCommand(item.followUpCommand || '', newHistoryId);
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