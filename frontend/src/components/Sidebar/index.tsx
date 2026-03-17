import { Input, List, Button, Space, Tooltip, Spin, message, Dropdown } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined, FolderOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useEffect, useState } from 'react';
import { useAppStore, type Connection } from '../../stores/appStore';
import { connectionApi } from '../../api';
import { useConfirmModal } from '../common/ConfirmModal';
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

  // 使用 hook 获取确认弹框方法
  const { confirmDelete } = useConfirmModal();

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

  // 单击：切换到已有会话或创建新会话
  const handleConnectionClick = (conn: Connection) => {
    // 检查是否已有该连接的终端会话
    const existingSession = sessions.find(s => s.connectionId === conn.id && s.type === 'terminal');
    
    if (existingSession) {
      // 已有会话，直接切换
      setActiveSession(existingSession.id);
    } else {
      // 创建新终端会话
      createNewTerminalSession(conn);
    }
  };

  // 双击：始终创建新会话
  const handleConnectionDoubleClick = (conn: Connection) => {
    createNewTerminalSession(conn);
  };

  // 创建新终端会话
  const createNewTerminalSession = (conn: Connection) => {
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
  };

  // 打开文件管理
  const openFileManager = (conn: Connection) => {
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

  const handleFileManagerClick = (e: React.MouseEvent, conn: Connection) => {
    e.stopPropagation();
    openFileManager(conn);
  };

  const handleDelete = (conn: Connection) => {
    confirmDelete({
      title: '确认删除',
      content: `确定要删除连接 "${conn.name}" 吗？此操作不可恢复。`,
      onOk: async () => {
        try {
          await connectionApi.delete(conn.id);
          useAppStore.getState().removeConnection(conn.id);
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleEdit = (conn: Connection) => {
    showEditConnectionModal(conn);
  };

  // 连接项右键菜单
  const getConnectionContextMenu = (conn: Connection): MenuProps['items'] => [
    {
      key: 'fileManager',
      icon: <FolderOutlined />,
      label: '文件管理',
      onClick: () => openFileManager(conn),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '修改连接',
      onClick: () => showEditConnectionModal(conn),
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除连接',
      danger: true,
      onClick: () => handleDelete(conn),
    },
    {
      type: 'divider',
    },
    {
      key: 'newConnection',
      icon: <PlusOutlined />,
      label: '新建连接',
      onClick: () => showAddConnectionModal(),
    },
  ];

  // 空白区域右键菜单
  const getEmptyContextMenu = (): MenuProps['items'] => [
    {
      key: 'newConnection',
      icon: <PlusOutlined />,
      label: '新建连接',
      onClick: () => showAddConnectionModal(),
    },
  ];

  if (sidebarCollapsed) {
    return (
      <div className="sidebar-collapsed" onContextMenu={(e) => e.preventDefault()}>
        <div className="sidebar-icons">
          {connections.map((conn) => (
            <Dropdown
              key={conn.id}
              menu={{ items: getConnectionContextMenu(conn) }}
              trigger={['contextMenu']}
            >
              <Tooltip title={conn.name} placement="right">
                <div
                  className={`sidebar-icon-item ${conn.status}`}
                  onClick={() => handleConnectionClick(conn)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="status-dot" style={{ background: statusColors[conn.status] }} />
                </div>
              </Tooltip>
            </Dropdown>
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
    <Dropdown
      menu={{ items: getEmptyContextMenu() }}
      trigger={['contextMenu']}
    >
      <div className="sidebar" onContextMenu={(e) => e.preventDefault()}>
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
              <Dropdown
                menu={{ items: getConnectionContextMenu(conn) }}
                trigger={['contextMenu']}
              >
                <List.Item
                  className={`connection-item ${sessions.find(s => s.connectionId === conn.id)?.active ? 'active' : ''}`}
                  onClick={() => handleConnectionClick(conn)}
                  onDoubleClick={() => handleConnectionDoubleClick(conn)}
                  onContextMenu={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileManagerClick(e, conn);
                      }}
                      title="文件管理"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(conn);
                      }}
                      title="编辑"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conn);
                      }}
                      title="删除"
                    />
                  </Space>
                </List.Item>
              </Dropdown>
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
    </Dropdown>
  );
};

export default Sidebar;