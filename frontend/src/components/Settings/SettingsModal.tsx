import { Modal } from 'antd';
import { SunOutlined, MoonOutlined, ApiOutlined } from '@ant-design/icons';
import { useAppStore, type Theme } from '../../stores/appStore';
import { useState } from 'react';
import ModelConfigModal from './ModelConfigModal';
import './SettingsModal.css';

const SettingsModal = () => {
  const { settingsModalOpen, hideSettingsModal, theme, setTheme } = useAppStore();
  const [modelConfigOpen, setModelConfigOpen] = useState(false);

  const handleThemeChange = (value: Theme) => {
    setTheme(value);
    document.body.setAttribute('data-theme', value);
  };

  return (
    <>
      <Modal
        title="设置"
        open={settingsModalOpen}
        onCancel={hideSettingsModal}
        footer={null}
        centered
        width={400}
      >
        {/* 模型配置入口 */}
        <div className="settings-section">
          <div className="settings-label">AI 模型</div>
          <div className="model-config-entry" onClick={() => setModelConfigOpen(true)}>
            <div className="model-config-icon">
              <ApiOutlined />
            </div>
            <div className="model-config-info">
              <div className="model-config-name">模型配置</div>
              <div className="model-config-desc">配置 GPT、Claude、Gemini 等 AI 模型</div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-label">主题样式</div>
          <div className="theme-options">
            <div
              className={`theme-option ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              <div className="theme-option-icon light-icon">
                <SunOutlined />
              </div>
              <div className="theme-option-info">
                <div className="theme-option-name">浅色模式</div>
                <div className="theme-option-desc">明亮清新的界面风格</div>
              </div>
            </div>
            <div
              className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              <div className="theme-option-icon dark-icon">
                <MoonOutlined />
              </div>
              <div className="theme-option-info">
                <div className="theme-option-name">深色模式</div>
                <div className="theme-option-desc">科技感暗色主题</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 模型配置弹窗 */}
      <ModelConfigModal open={modelConfigOpen} onClose={() => setModelConfigOpen(false)} />
    </>
  );
};

export default SettingsModal;