import { Input, List, Button, Space, Tooltip, Spin, message } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useAppStore, type Connection } from '../../stores/appStore';
import { connectionApi } from '../../api';
import './index.css';

const statusColors = {
  connected: '#52c41a',
  connecting: '#faad14',
  disconnected: '#bfbfbf',
  error: '#ff4d4f',
};

const Sidebar = () => {
  const { 
    connections, 
    setConnections, 
    sessions, 
    sidebarCollapsed, 
    toggleSidebar, 
    updateConnectionStatus,
    addSession,
    setActiveSession,
    loading,
    setLoading,
    showAddConnectionModal,
    showEditConnectionModal
  } = useAppStore();
  
  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载连接列表
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await connectionApi.list();
      if (res.data.code === 0) {
        const connectionsWithStatus = res.data.data.map(c => ({
          ...c,
          status: 'disconnected' as const
        }));
        setConnections(connectionsWithStatus);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      message.error('加载连接列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 过滤连接列表
  const filteredConnections = connections.filter(conn => 
    !searchKeyword || 
    conn.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    conn.host.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const handleConnectionClick = (conn: Connection) => {
    // 检查是否已有该连接的终端会话
    const existingSession = sessions.find(s => s.connectionId === conn.id && s.type === 'terminal');
    
    if (existingSession) {
      // 已有会话，直接切换
      setActiveSession(existingSession.id);
    } else {
      // 创建新终端会话
      const newSessionId = `terminal-${Date.now()}`;
      addSession({
        id: newSessionId,
        connectionId: conn.id,
        name: conn.name,
        type: 'terminal',
        active: true,
      });
      setActiveSession(newSessionId);
      
      // 模拟连接过程
      if (conn.status === 'disconnected') {
        updateConnectionStatus(conn.id, 'connecting');
        setTimeout(() => {
          updateConnectionStatus(conn.id, 'connected');
        }, 1500);
      }
    }
  };

  const handleFileManagerClick = (e: React.MouseEvent, conn: Connection) => {
    e.stopPropagation();
    
    // 检查是否已有该连接的文件管理会话
    const existingSession = sessions.find(s => s.connectionId === conn.id && s.type === 'file');
    
    if (existingSession) {
      setActiveSession(existingSession.id);
    } else {
      // 创建文件管理会话
      const newSessionId = `file-${Date.now()}`;
      addSession({
        id: newSessionId,
        connectionId: conn.id,
        name: `${conn.name} - 文件`,
        type: 'file',
        active: true,
      });
      setActiveSession(newSessionId);
      
      // 确保连接
      if (conn.status === 'disconnected') {
        updateConnectionStatus(conn.id, 'connecting');
        setTimeout(() => {
          updateConnectionStatus(conn.id, 'connected');
        }, 1500);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await connectionApi.delete(id);
      useAppStore.getState().removeConnection(id);
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleEdit = (e: React.MouseEvent, conn: Connection) => {
    e.stopPropagation();
    showEditConnectionModal(conn);
  };

  if (sidebarCollapsed) {
    return (
      <div className="sidebar-collapsed">
        <div className="sidebar-icons">
          {connections.map((conn) => (
            <Tooltip key={conn.id} title={conn.name} placement="right">
              <div
                className={`sidebar-icon-item ${conn.status}`}
                onClick={() => handleConnectionClick(conn)}
              >
                <span className="status-dot" style={{ background: statusColors[conn.status] }} />
              </div>
            </Tooltip>
          ))}
        </div>
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={toggleSidebar}
          className="collapse-btn"
        />
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-search">
        <Input 
          placeholder="搜索连接..." 
          prefix={<SearchOutlined />} 
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
        />
      </div>

      <div className="sidebar-title">
        <span>📡 连接列表</span>
      </div>

      {loading ? (
        <div className="sidebar-loading">
          <Spin />
        </div>
      ) : (
        <List
          className="connection-list"
          dataSource={filteredConnections}
          locale={{ emptyText: searchKeyword ? '未找到匹配的连接' : '暂无连接，点击下方添加' }}
          renderItem={(conn) => (
            <List.Item
              className={`connection-item ${sessions.find(s => s.connectionId === conn.id)?.active ? 'active' : ''}`}
              onClick={() => handleConnectionClick(conn)}
            >
              <div className="connection-info">
                <span className="status-dot" style={{ background: statusColors[conn.status] }} />
                <div className="connection-details">
                  <div className="connection-name">{conn.name}</div>
                  <div className="connection-host">{conn.host}</div>
                </div>
              </div>
              <Space className="connection-actions" size={4}>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<FolderOutlined />}
                  onClick={(e) => handleFileManagerClick(e, conn)}
                  title="文件管理"
                />
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EditOutlined />}
                  onClick={(e) => handleEdit(e, conn)}
                  title="编辑"
                />
                <Button 
                  type="text" 
                  size="small" 
                  icon={<DeleteOutlined />} 
                  danger
                  onClick={(e) => handleDelete(e, conn.id)}
                  title="删除"
                />
              </Space>
            </List.Item>
          )}
        />
      )}

      <div className="sidebar-footer">
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          block
          onClick={showAddConnectionModal}
        >
          新增连接
        </Button>
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          onClick={toggleSidebar}
          block
        >
          收起
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;