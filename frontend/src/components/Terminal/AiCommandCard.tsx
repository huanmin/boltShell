import { Card, Button, Space, Input, Typography } from 'antd';
import { BulbOutlined, WarningOutlined, CloseOutlined, EditOutlined, PlayCircleOutlined, CheckOutlined } from '@ant-design/icons';
import './AiCommandCard.css';

const { Text } = Typography;

interface AiCommandCardProps {
  command: string;
  explanation: string;
  riskLevel: string;
  warnings: string[];
  editing: boolean;
  editedCommand: string;
  onExecute: (command: string) => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancel: () => void;
  onEditChange: (value: string) => void;
}

const AiCommandCard: React.FC<AiCommandCardProps> = ({
  command,
  explanation,
  riskLevel,
  warnings,
  editing,
  editedCommand,
  onExecute,
  onEdit,
  onSaveEdit,
  onCancel,
  onEditChange,
}) => {
  const isDanger = riskLevel === 'high' || riskLevel === 'critical';

  return (
    <Card
      className={`ai-command-card ${isDanger ? 'danger' : ''}`}
      size="small"
      title={
        <Space>
          {isDanger ? (
            <WarningOutlined style={{ color: '#ff4d4f' }} />
          ) : (
            <BulbOutlined style={{ color: '#1677ff' }} />
          )}
          <span>{isDanger ? '⚠️ 危险命令警告' : '💡 AI 建议'}</span>
        </Space>
      }
      extra={
        <Button 
          type="text" 
          icon={<CloseOutlined />} 
          size="small" 
          onClick={onCancel}
        />
      }
    >
      {/* 命令区域 */}
      <div className="command-section">
        {editing ? (
          <div className="command-edit">
            <Input
              value={editedCommand}
              onChange={(e) => onEditChange(e.target.value)}
              onPressEnter={onSaveEdit}
              className="command-input"
              autoFocus
            />
            <Button 
              type="primary" 
              size="small" 
              icon={<CheckOutlined />}
              onClick={onSaveEdit}
            >
              确定
            </Button>
          </div>
        ) : (
          <div className="command-display">
            <Text code className="command-text">
              $ {command}
            </Text>
          </div>
        )}
      </div>

      {/* 说明区域 */}
      <div className="explanation-section">
        <Text type="secondary">📝 {explanation}</Text>
      </div>

      {/* 警告区域 */}
      {warnings && warnings.length > 0 && (
        <div className="warnings-section">
          {warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="actions-section">
        <Space>
          {!editing && (
            <>
              <Button 
                icon={<EditOutlined />} 
                onClick={onEdit}
              >
                修改命令
              </Button>
              <Button onClick={onCancel}>
                取消
              </Button>
              <Button
                type="primary"
                danger={isDanger}
                icon={<PlayCircleOutlined />}
                onClick={() => onExecute(editing ? editedCommand : command)}
              >
                {isDanger ? '⚠️ 我已了解风险，执行' : '▶ 执行'}
              </Button>
            </>
          )}
        </Space>
      </div>
    </Card>
  );
};

export default AiCommandCard;