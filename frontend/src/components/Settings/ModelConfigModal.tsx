import { Modal, Input, Select, Divider, Button, message } from 'antd';
import {
  ApiOutlined,
  GlobalOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { aiConfigApi, type AiConfig } from '../../api';
import './ModelConfigModal.css';

// 测试状态类型
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// 预设的模型提供商配置
const MODEL_PROVIDERS: Array<{
  id: string;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
}> = [
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    icon: '🤖',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    icon: '🧠',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    icon: '💎',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    icon: '🌟',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'],
  },
  {
    id: 'kimi',
    name: 'Moonshot (Kimi)',
    icon: '🌙',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: '🚀',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    models: ['abab6.5s-chat', 'abab6.5-chat', 'abab5.5-chat'],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    icon: '🔮',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-0520', 'glm-4-air', 'glm-4-flash'],
  },
  {
    id: 'custom',
    name: '其他提供商',
    icon: '⚙️',
    defaultBaseUrl: '',
    defaultModel: '',
    models: [],
  },
];

interface ModelConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const ModelConfigModal = ({ open, onClose }: ModelConfigModalProps) => {
  const [savedConfigs, setSavedConfigs] = useState<AiConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempBaseUrl, setTempBaseUrl] = useState('');
  const [tempModel, setTempModel] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 加载配置
  const loadConfigs = useCallback(async () => {
    try {
      const [configsRes, activeRes] = await Promise.all([
        aiConfigApi.list(),
        aiConfigApi.getActive(),
      ]);
      setSavedConfigs(configsRes.data.data || []);
      setActiveProvider(activeRes.data.data?.provider || null);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadConfigs();
    }
  }, [open, loadConfigs]);

  // 获取提供商信息
  const getProviderInfo = (providerId: string) => {
    return MODEL_PROVIDERS.find((p) => p.id === providerId);
  };

  // 获取已保存的配置
  const getSavedConfig = (providerId: string) => {
    return savedConfigs.find((c) => c.id === providerId);
  };

  // 开始编辑
  const startEdit = (providerId: string) => {
    const config = getSavedConfig(providerId);
    const provider = getProviderInfo(providerId);
    if (config) {
      setTempBaseUrl(config.baseUrl || provider?.defaultBaseUrl || '');
      setTempModel(config.model || provider?.defaultModel || '');
    } else {
      setTempBaseUrl(provider?.defaultBaseUrl || '');
      setTempModel(provider?.defaultModel || '');
    }
    setTempApiKey('');
    setActiveProvider(providerId);
    setTestStatus('idle');
    setTestMessage('');
  };

  // 测试配置
  const handleTest = async () => {
    if (!activeProvider) return;
    if (!tempApiKey && !getSavedConfig(activeProvider)?.enabled) {
      message.warning('请先填写 API 密钥');
      return;
    }

    const provider = getProviderInfo(activeProvider);
    const baseUrl = activeProvider === 'custom' ? tempBaseUrl : provider?.defaultBaseUrl;
    const model = tempModel || provider?.defaultModel;

    if (!model) {
      message.warning('请选择或输入模型名称');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await aiConfigApi.test({
        providerId: activeProvider,
        baseUrl: baseUrl || '',
        model,
        apiKey: tempApiKey || undefined, // 如果为空，后端会尝试使用已保存的
      });

      const result = response.data.data;
      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message);
        message.success('测试成功');
      } else {
        setTestStatus('error');
        setTestMessage(result.message);
        message.error('测试失败');
      }
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(error.response?.data?.message || '连接失败');
      message.error('测试失败');
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (!activeProvider) return;
    if (!tempApiKey) {
      message.warning('请填写 API 密钥');
      return;
    }

    const provider = getProviderInfo(activeProvider);
    const isCustomProvider = activeProvider === 'custom';

    if (isCustomProvider && !tempBaseUrl) {
      message.warning('请填写 API 地址');
      return;
    }

    setLoading(true);
    try {
      await aiConfigApi.save({
        id: activeProvider,
        name: provider?.name || activeProvider,
        baseUrl: isCustomProvider ? tempBaseUrl : provider?.defaultBaseUrl || '',
        model: tempModel || provider?.defaultModel || '',
        enabled: true,
        apiKey: tempApiKey,
      });

      message.success('配置已保存');
      await loadConfigs();
      setActiveProvider(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除配置
  const handleDelete = async () => {
    if (!activeProvider) return;

    setLoading(true);
    try {
      await aiConfigApi.delete(activeProvider);
      message.success('配置已删除');
      await loadConfigs();
      setActiveProvider(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setActiveProvider(null);
    setTestStatus('idle');
    setTestMessage('');
  };

  const currentProvider = activeProvider ? getProviderInfo(activeProvider) : null;
  const isCustomProvider = activeProvider === 'custom';
  const savedConfig = activeProvider ? getSavedConfig(activeProvider) : null;

  return (
    <Modal
      title={
        <div className="modal-title">
          <ApiOutlined /> AI 模型配置
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={640}
      className="model-config-modal"
    >
      <div className="model-config-content">
        {/* 左侧提供商列表 */}
        <div className="provider-list">
          <div className="provider-list-header">选择提供商</div>
          {MODEL_PROVIDERS.map((provider) => {
            const config = getSavedConfig(provider.id);
            const isActive = activeProvider === provider.id;
            const isConfigured = config?.enabled;

            return (
              <div
                key={provider.id}
                className={`provider-item ${isActive ? 'active' : ''} ${isConfigured ? 'configured' : ''}`}
                onClick={() => startEdit(provider.id)}
              >
                <span className="provider-icon">{provider.icon}</span>
                <span className="provider-name">{provider.name}</span>
                <span className="provider-status">
                  {isConfigured ? (
                    <CheckCircleFilled className="status-configured" />
                  ) : (
                    <CloseCircleFilled className="status-not-configured" />
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 右侧配置表单 */}
        <div className="config-form">
          {currentProvider ? (
            <>
              <div className="config-header">
                <span className="config-icon">{currentProvider.icon}</span>
                <span className="config-title">{currentProvider.name}</span>
                {savedConfig?.enabled && (
                  <span className="configured-badge">已配置</span>
                )}
              </div>

              <Divider />

              {/* 自定义提供商需要输入 URL */}
              {isCustomProvider && (
                <div className="form-item">
                  <label className="form-label">
                    <GlobalOutlined /> API 地址
                  </label>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={tempBaseUrl}
                    onChange={(e) => setTempBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="form-item">
                <label className="form-label">
                  <ApiOutlined /> API 密钥 {savedConfig?.enabled && <span className="hint">(留空保持原密钥)</span>}
                </label>
                <Input.Password
                  placeholder={savedConfig?.enabled ? "留空保持原密钥不变" : "请输入 API Key"}
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
              </div>

              {/* 模型选择 */}
              {!isCustomProvider && currentProvider.models.length > 0 && (
                <div className="form-item">
                  <label className="form-label">默认模型</label>
                  <Select
                    value={tempModel}
                    onChange={setTempModel}
                    options={currentProvider.models.map((m) => ({ label: m, value: m }))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* 自定义提供商模型输入 */}
              {isCustomProvider && (
                <div className="form-item">
                  <label className="form-label">模型名称</label>
                  <Input
                    placeholder="gpt-4, claude-3-opus, ..."
                    value={tempModel}
                    onChange={(e) => setTempModel(e.target.value)}
                  />
                </div>
              )}

              {/* 测试结果 */}
              {testStatus !== 'idle' && (
                <div className={`test-result ${testStatus}`}>
                  {testStatus === 'testing' && (
                    <span><SyncOutlined spin /> 正在测试连接...</span>
                  )}
                  {testStatus === 'success' && (
                    <span><CheckCircleOutlined /> {testMessage}</span>
                  )}
                  {testStatus === 'error' && (
                    <span><ExclamationCircleOutlined /> {testMessage}</span>
                  )}
                </div>
              )}

              <div className="form-actions">
                <Button onClick={cancelEdit}>取消</Button>
                <Button
                  onClick={handleTest}
                  disabled={testStatus === 'testing'}
                  icon={testStatus === 'testing' ? <SyncOutlined spin /> : undefined}
                >
                  测试连接
                </Button>
                <Button
                  type="primary"
                  onClick={handleSave}
                  loading={loading}
                  disabled={isCustomProvider && !tempBaseUrl}
                >
                  保存配置
                </Button>
                {savedConfig?.enabled && (
                  <Button danger onClick={handleDelete} loading={loading}>
                    删除配置
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="config-placeholder">
              <span className="placeholder-icon">👈</span>
              <span>请从左侧选择一个提供商进行配置</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ModelConfigModal;