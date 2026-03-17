import { useEffect } from 'react';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import AppLayout from './components/Layout';
import { useAppStore } from './stores/appStore';

// 深色主题配置
const darkTheme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorBgBase: '#161b22',
    colorBgContainer: '#1a1f2e',
    colorBgElevated: '#1a1f2e',
    colorBorder: '#30363d',
    colorBorderSecondary: '#21262d',
    colorText: '#c9d1d9',
    colorTextSecondary: '#8b949e',
    colorPrimary: '#38bdf8',
    colorInfo: '#38bdf8',
    colorSuccess: '#238636',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 8,
  },
  components: {
    Modal: {
      contentBg: '#1a1f2e',
      headerBg: '#1a1f2e',
      footerBg: '#1a1f2e',
      titleColor: '#e0f2fe',
    },
    Input: {
      colorBgContainer: '#0d1117',
      colorBorder: '#30363d',
      colorText: '#e0f2fe',
    },
    Select: {
      colorBgContainer: '#0d1117',
      colorBorder: '#30363d',
      colorText: '#e0f2fe',
      optionSelectedBg: 'rgba(56, 189, 248, 0.2)',
    },
    Dropdown: {
      colorBgElevated: '#1a1f2e',
      colorText: '#cbd5e1',
    },
    Checkbox: {
      colorBgContainer: '#0d1117',
      colorBorder: '#30363d',
    },
  },
};

// 浅色主题配置
const lightTheme = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorPrimary: '#3b82f6',
    colorInfo: '#3b82f6',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 8,
  },
  components: {
    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
      footerBg: '#ffffff',
      titleColor: '#1e293b',
    },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#e2e8f0',
      colorText: '#1e293b',
    },
    Select: {
      colorBgContainer: '#ffffff',
      colorBorder: '#e2e8f0',
      colorText: '#1e293b',
      optionSelectedBg: '#eff6ff',
    },
    Dropdown: {
      colorBgElevated: '#ffffff',
      colorText: '#475569',
    },
    Checkbox: {
      colorBgContainer: '#ffffff',
      colorBorder: '#d1d5db',
    },
  },
};

function App() {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
      <AntdApp>
        <AppLayout />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;