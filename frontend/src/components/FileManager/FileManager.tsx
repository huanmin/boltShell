import { useState, useEffect, useCallback } from 'react';
import { Tree, Button, Breadcrumb, Input, Dropdown, Modal, message, Spin, Upload, Empty } from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DownloadOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  FolderAddOutlined,
  UploadOutlined,
  HomeOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import type { MenuProps, TreeDataNode, TreeProps } from 'antd';
import { fileApi, type FileInfo } from '../../api';
import './FileManager.css';

interface FileManagerProps {
  connectionId: string;
}

interface FileTreeNode extends TreeDataNode {
  key: string;
  title: React.ReactNode;
  isLeaf?: boolean;
  children?: FileTreeNode[];
  fileInfo?: FileInfo;
}

const FileManager: React.FC<FileManagerProps> = ({ connectionId }) => {
  const [treeData, setTreeData] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mkdirModalOpen, setMkdirModalOpen] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [mkdirParentPath, setMkdirParentPath] = useState('/');
  const [currentPath, setCurrentPath] = useState('/');

  // 加载目录内容
  const loadDirectory = useCallback(async (path: string): Promise<FileTreeNode[]> => {
    try {
      const res = await fileApi.list(connectionId, path);
      if (res.data.code === 0) {
        return res.data.data
          .filter(item => item.isDirectory)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(item => ({
            key: item.path,
            title: (
              <span 
                className="tree-node-title"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(item);
                }}
              >
                <FolderOutlined className="folder-icon" />
                <span className="file-name-text">{item.name}</span>
              </span>
            ),
            isLeaf: false,
            children: [],
            fileInfo: item,
          }));
      }
      return [];
    } catch (error) {
      console.error('加载目录失败:', error);
      return [];
    }
  }, [connectionId]);

  // 初始加载
  useEffect(() => {
    loadRootDirectory();
  }, [connectionId]);

  const loadRootDirectory = async () => {
    setLoading(true);
    try {
      const res = await fileApi.list(connectionId, '/');
      if (res.data.code === 0) {
        const nodes: FileTreeNode[] = res.data.data
          .filter(item => item.isDirectory)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(item => ({
            key: item.path,
            title: (
              <span 
                className="tree-node-title"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(item);
                }}
              >
                <FolderOutlined className="folder-icon" />
                <span className="file-name-text">{item.name}</span>
              </span>
            ),
            isLeaf: false,
            children: [],
            fileInfo: item,
          }));
        setTreeData(nodes);
      }
    } catch (error) {
      message.error('加载文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 动态加载子节点
  const onLoadData: TreeProps['loadData'] = async ({ key, children }) => {
    if (children && children.length > 0) return;
    const childNodes = await loadDirectory(key as string);
    setTreeData(prev => updateTreeData(prev, key as string, childNodes));
  };

  // 更新树数据
  const updateTreeData = (
    list: FileTreeNode[],
    key: string,
    children: FileTreeNode[]
  ): FileTreeNode[] => {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  };

  // 点击节点
  const handleNodeClick = (fileInfo: FileInfo) => {
    const path = fileInfo.path.startsWith('//') ? fileInfo.path.substring(1) : fileInfo.path;
    setSelectedKey(path);
    setCurrentPath(path);
  };

  // 下载
  const handleDownload = useCallback((file: FileInfo) => {
    const url = fileApi.downloadUrl(connectionId, file.path, file.isDirectory);
    window.open(url, '_blank');
    message.success('开始下载...');
  }, [connectionId]);

  // 删除
  const handleDelete = useCallback((file: FileInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${file.name}" 吗？${file.isDirectory ? '文件夹内所有内容都将被删除！' : ''}此操作不可恢复！`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const res = await fileApi.delete(connectionId, file.path, true);
          if (res.data.code === 0) {
            message.success('删除成功');
            loadRootDirectory();
            loadCurrentFiles(currentPath);
          } else {
            message.error(res.data.message || '删除失败');
          }
        } catch (error: any) {
          message.error(error?.response?.data?.message || '删除失败');
        }
      },
    });
  }, [connectionId, currentPath]);

  // 新建文件夹
  const handleMkdir = async () => {
    if (!newDirName.trim()) {
      message.warning('请输入文件夹名称');
      return;
    }

    try {
      const path = mkdirParentPath === '/' 
        ? `/${newDirName}` 
        : `${mkdirParentPath}/${newDirName}`;
      
      const res = await fileApi.mkdir(connectionId, path);
      if (res.data.code === 0) {
        message.success('创建成功');
        setMkdirModalOpen(false);
        setNewDirName('');
        loadRootDirectory();
        loadCurrentFiles(mkdirParentPath);
      } else {
        message.error(res.data.message || '创建失败');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建失败');
    }
  };

  // 上传文件
  const handleUpload = useCallback(async (file: File) => {
    try {
      const res = await fileApi.upload(connectionId, currentPath, file);
      if (res.data.code === 0) {
        message.success('上传成功');
        loadCurrentFiles(currentPath);
      } else {
        message.error(res.data.message || '上传失败');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '上传失败');
    }
    return false;
  }, [connectionId, currentPath]);

  // 展开/收缩全部
  const handleExpandAll = async () => {
    if (expandedKeys.length > 0) {
      setExpandedKeys([]);
    } else {
      const allKeys = getAllKeys(treeData);
      setExpandedKeys(allKeys);
    }
  };

  const getAllKeys = (nodes: FileTreeNode[]): string[] => {
    const keys: string[] = [];
    const traverse = (items: FileTreeNode[]) => {
      items.forEach(item => {
        keys.push(item.key as string);
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      });
    };
    traverse(nodes);
    return keys;
  };

  // 当前目录文件列表
  const [currentFiles, setCurrentFiles] = useState<FileInfo[]>([]);
  const [fileLoading, setFileLoading] = useState(false);

  const loadCurrentFiles = useCallback(async (path: string) => {
    setFileLoading(true);
    try {
      const res = await fileApi.list(connectionId, path);
      if (res.data.code === 0) {
        setCurrentFiles(res.data.data.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        }));
      }
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setFileLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (currentPath) {
      loadCurrentFiles(currentPath);
    }
  }, [currentPath, connectionId, loadCurrentFiles]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 文件项右键菜单
  const getFileItemContextMenu = (file: FileInfo): MenuProps['items'] => [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: '下载',
      onClick: () => handleDownload(file),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => handleDelete(file),
    },
  ];

  // 空白区域右键菜单
  const getEmptyContextMenu = useCallback((): MenuProps['items'] => [
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: '上传文件',
      onClick: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files) {
            for (let i = 0; i < files.length; i++) {
              await handleUpload(files[i]);
            }
          }
        };
        input.click();
      },
    },
    {
      key: 'newFolder',
      icon: <FolderAddOutlined />,
      label: '创建文件夹',
      onClick: () => {
        setMkdirParentPath(currentPath);
        setNewDirName('');
        setMkdirModalOpen(true);
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新',
      onClick: () => {
        loadCurrentFiles(currentPath);
        loadRootDirectory();
      },
    },
  ], [currentPath, handleUpload]);

  // 文件项组件
  const FileItem: React.FC<{ file: FileInfo }> = ({ file }) => {
    return (
      <Dropdown 
        menu={{ items: getFileItemContextMenu(file) }} 
        trigger={['contextMenu']}
      >
        <div 
          className={`file-item ${file.isDirectory ? 'folder' : 'file'}`}
          onDoubleClick={() => {
            if (file.isDirectory) {
              const path = file.path.startsWith('//') ? file.path.substring(1) : file.path;
              setCurrentPath(path);
              setSelectedKey(path);
              setExpandedKeys(prev => 
                prev.includes(path) ? prev : [...prev, path]
              );
            }
          }}
        >
          <div className="file-icon">
            {file.isDirectory ? (
              <FolderOpenOutlined style={{ fontSize: 32, color: '#f0883e' }} />
            ) : (
              <FileOutlined style={{ fontSize: 32, color: '#8b949e' }} />
            )}
          </div>
          <div className="file-name">{file.name}</div>
          <div className="file-info">
            {file.isDirectory ? '' : formatSize(file.size)}
          </div>
        </div>
      </Dropdown>
    );
  };

  // 空白区域包装器 - 带右键菜单
  const ContextMenuWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <Dropdown 
        menu={{ items: getEmptyContextMenu() }} 
        trigger={['contextMenu']}
      >
        <div style={{ width: '100%', height: '100%' }}>
          {children}
        </div>
      </Dropdown>
    );
  };

  return (
    <div className="file-manager">
      {/* 工具栏 */}
      <div className="toolbar">
        <div className="toolbar-left">
          <Button 
            icon={<HomeOutlined />} 
            onClick={() => {
              setCurrentPath('/');
              setSelectedKey(null);
            }}
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              loadRootDirectory();
              loadCurrentFiles(currentPath);
            }}
          />
          <Button 
            icon={expandedKeys.length > 0 ? <MinusOutlined /> : <PlusOutlined />}
            onClick={handleExpandAll}
            title={expandedKeys.length > 0 ? '收缩全部' : '展开全部'}
          />
        </div>
        
        <Breadcrumb className="path-breadcrumb">
          <Breadcrumb.Item 
            onClick={() => {
              setCurrentPath('/');
              setSelectedKey(null);
            }} 
            className="breadcrumb-item"
          >
            <HomeOutlined />
          </Breadcrumb.Item>
          {currentPath.split('/').filter(Boolean).map((part, index, arr) => (
            <Breadcrumb.Item 
              key={part}
              onClick={() => setCurrentPath('/' + arr.slice(0, index + 1).join('/'))}
              className="breadcrumb-item"
            >
              {part}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
        
        <div className="toolbar-right">
          <Button 
            icon={<FolderAddOutlined />}
            onClick={() => {
              setMkdirParentPath(currentPath);
              setNewDirName('');
              setMkdirModalOpen(true);
            }}
          >
            新建文件夹
          </Button>
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            multiple
          >
            <Button icon={<UploadOutlined />}>
              上传
            </Button>
          </Upload>
        </div>
      </div>

      {/* 主体区域 */}
      <div className="file-manager-body">
        {/* 左侧：文件夹树 */}
        <div className="folder-tree">
          <div className="folder-tree-header">
            <FolderOutlined /> 文件夹
          </div>
          <Spin spinning={loading}>
            {treeData.length === 0 && !loading ? (
              <Empty description="无文件夹" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Tree
                showLine={{ showLeafIcon: false }}
                showIcon={false}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                loadData={onLoadData}
                treeData={treeData}
                selectedKeys={selectedKey ? [selectedKey] : []}
                blockNode
              />
            )}
          </Spin>
        </div>

        {/* 右侧：文件列表 */}
        <div className="file-content">
          <div className="file-content-header">
            <span className="current-path">📁 {currentPath}</span>
            <span className="file-count">{currentFiles.length} 项</span>
          </div>
          <Spin spinning={fileLoading}>
            <ContextMenuWrapper>
              {currentFiles.length === 0 && !fileLoading ? (
                <div className="empty-area">
                  <Empty description="空目录，右键上传文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : (
                <div className="file-grid-wrapper">
                  <div className="file-grid">
                    {/* 返回上级 */}
                    {currentPath !== '/' && (
                      <div 
                        className="file-item folder"
                        onDoubleClick={() => {
                          const parts = currentPath.split('/').filter(Boolean);
                          const parentPath = '/' + parts.slice(0, -1).join('/');
                          setCurrentPath(parentPath || '/');
                          setSelectedKey(parentPath || null);
                        }}
                      >
                        <div className="file-icon">
                          <FolderOpenOutlined style={{ fontSize: 32, color: '#f0883e' }} />
                        </div>
                        <div className="file-name">..</div>
                        <div className="file-info"></div>
                      </div>
                    )}
                    {/* 文件列表 */}
                    {currentFiles.map(file => (
                      <FileItem key={file.path} file={file} />
                    ))}
                  </div>
                </div>
              )}
            </ContextMenuWrapper>
          </Spin>
        </div>
      </div>

      {/* 新建文件夹弹窗 */}
      <Modal
        title="新建文件夹"
        open={mkdirModalOpen}
        onOk={handleMkdir}
        onCancel={() => {
          setMkdirModalOpen(false);
          setNewDirName('');
        }}
        okText="创建"
        cancelText="取消"
        centered
      >
        <Input
          placeholder="请输入文件夹名称"
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          onPressEnter={handleMkdir}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default FileManager;