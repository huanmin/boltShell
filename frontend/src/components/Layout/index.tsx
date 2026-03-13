import { Layout, Button, Space } from 'antd';
import { SettingOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import Sidebar from '../Sidebar';
import TerminalArea from '../Terminal/TerminalArea';
import ConnectionModal from '../Connection/ConnectionModal';
import { useAppStore } from '../../stores/appStore';
import './index.css';

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const { 
    sidebarCollapsed, 
    addConnectionModalOpen, 
    editConnectionModalOpen,
    editingConnection,
    hideAddConnectionModal, 
    hideEditConnectionModal 
  } = useAppStore();

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="header-left">
          <span className="logo">🚀</span>
          <span className="title">AI SSH Tool</span>
        </div>
        <Space>
          <Button icon={<SettingOutlined />} />
          <Button icon={<QuestionCircleOutlined />} />
        </Space>
      </Header>

      <Layout>
        <Sider
          width={260}
          collapsedWidth={48}
          collapsed={sidebarCollapsed}
          className="app-sider"
          trigger={null}
        >
          <Sidebar />
        </Sider>

        <Layout className="main-layout">
          <Content className="main-content">
            <TerminalArea />
          </Content>
        </Layout>
      </Layout>
      
      {/* 新增连接弹窗 */}
      <ConnectionModal 
        open={addConnectionModalOpen} 
        onClose={hideAddConnectionModal}
        mode="add"
      />
      
      {/* 编辑连接弹窗 */}
      <ConnectionModal 
        open={editConnectionModalOpen} 
        onClose={hideEditConnectionModal}
        connection={editingConnection}
        mode="edit"
      />
    </Layout>
  );
};

export default AppLayout;