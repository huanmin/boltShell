import { Tabs, Button } from 'antd';
import { PlusOutlined, CloseOutlined, FolderOutlined, CodeOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../stores/appStore';
import AiCommandCard from './AiCommandCard';
import FileManager from '../FileManager/FileManager';
import './index.css';

const WS_BASE = 'ws://localhost:18080';

const TerminalArea = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const aiCardRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // 用 ref 追踪当前输入行（避免 state 异步问题）
  const currentLineRef = useRef('');
  
  // AI 建议卡片
  const [aiCard, setAiCard] = useState<{
    visible: boolean;
    command: string;
    explanation: string;
    riskLevel: string;
    warnings: string[];
  } | null>(null);
  // 编辑模式
  const [editingCommand, setEditingCommand] = useState(false);
  const [editedCommand, setEditedCommand] = useState('');

  const { 
    sessions, 
    activeSessionId, 
    pendingCommand, 
    setPendingCommand,
    connections,
    removeSession,
    setActiveSession
  } = useAppStore();

  // 获取当前会话的连接信息
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeConnection = connections.find(c => c.id === activeSession?.connectionId);
  const isFileManager = activeSession?.type === 'file';

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      fontFamily: 'Monaco, Menlo, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.5,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    // 欢迎信息
    xterm.writeln('\x1b[1;36m╔════════════════════════════════════════════════════╗\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m  \x1b[1;32m🚀 AI SSH Tool v1.0.0\x1b[0m                              \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m                                                    \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m  \x1b[33m• 点击左侧连接开始 SSH 会话\x1b[0m                      \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m  \x1b[33m• 直接输入命令执行，Tab 键补全\x1b[0m                     \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m  \x1b[33m• 输入中文描述，AI 生成命令建议\x1b[0m                    \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m║\x1b[0m                                                    \x1b[1;36m║\x1b[0m');
    xterm.writeln('\x1b[1;36m╚════════════════════════════════════════════════════╝\x1b[0m');
    xterm.writeln('');

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // 监听终端输入
    xterm.onData((data) => {
      handleTerminalInput(data);
    });

    // 自适应大小
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 连接 WebSocket (仅终端会话)
  useEffect(() => {
    if (!activeSession || !activeConnection || !xtermRef.current) return;
    
    // 文件管理器不需要 WebSocket
    if (activeSession.type === 'file') return;

    const xterm = xtermRef.current;

    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    // 清空终端
    xterm.clear();
    xterm.writeln(`\x1b[33m正在连接 ${activeConnection.name} (${activeConnection.host})...\x1b[0m`);

    const ws = new WebSocket(`${WS_BASE}/ws?connectionId=${activeConnection.id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      xterm.writeln('\x1b[32m✓ WebSocket 连接已建立\x1b[0m');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'connection.status':
            if (msg.payload.status === 'connected') {
              xterm.writeln('\x1b[32m✓ SSH 连接成功\x1b[0m');
              xterm.writeln('');
            } else if (msg.payload.status === 'connecting') {
              xterm.write('\x1b[33m正在建立 SSH 连接...\x1b[0m');
            }
            break;
          
          case 'terminal.output':
            // 真实 SSH 输出
            xterm.write(msg.payload.data);
            break;
          
          case 'ai.response':
            // AI 建议响应 - 显示卡片
            setAiCard({
              visible: true,
              command: msg.payload.command,
              explanation: msg.payload.explanation,
              riskLevel: msg.payload.riskLevel,
              warnings: msg.payload.warnings || [],
            });
            break;
          
          case 'error':
            xterm.writeln(`\x1b[31m✗ 错误: ${msg.payload.message}\x1b[0m`);
            break;
        }
      } catch (e) {
        // 非 JSON 消息，直接输出
        xterm.write(event.data);
      }
    };

    ws.onerror = () => {
      xterm.writeln('\x1b[31m✗ WebSocket 连接失败\x1b[0m');
    };

    ws.onclose = () => {
      xterm.writeln('\x1b[33m连接已关闭\x1b[0m');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [activeSessionId, activeConnection]);

  // 监听待执行的命令
  useEffect(() => {
    if (pendingCommand && wsRef.current && xtermRef.current) {
      const ws = wsRef.current;
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ai.confirm',
          payload: {
            action: 'execute',
            command: pendingCommand,
            commandId: 'cmd-' + Date.now(),
          }
        }));
      }
      setPendingCommand(null);
      setAiCard(null);
    }
  }, [pendingCommand, setPendingCommand]);

  // 处理终端输入
  const handleTerminalInput = (data: string) => {
    const ws = wsRef.current;
    const xterm = xtermRef.current;
    
    if (!ws || ws.readyState !== WebSocket.OPEN || !xterm) return;

    // 回车键 - 判断是命令还是中文描述
    if (data === '\r' || data === '\n') {
      const line = currentLineRef.current;
      
      if (containsChinese(line)) {
        // 中文描述 - 发送给 AI
        xterm.writeln(''); // 换行
        xterm.writeln(`\x1b[33m🔍 正在分析: ${line}\x1b[0m`);
        
        ws.send(JSON.stringify({
          type: 'ai.chat',
          payload: { message: line }
        }));
      } else {
        // 英文命令 - 发送回车到终端执行
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
      }
      
      currentLineRef.current = '';
      return;
    }

    // Backspace / Delete
    if (data === '\x7f' || data === '\b') {
      if (currentLineRef.current.length > 0) {
        currentLineRef.current = currentLineRef.current.slice(0, -1);
        // 发送到终端删除字符
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
      }
      return;
    }

    // Ctrl+C - 中断当前输入
    if (data === '\x03') {
      currentLineRef.current = '';
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // Tab 键 - 补全
    if (data === '\t') {
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // 普通字符 - 追加到当前行
    const newLine = currentLineRef.current + data;
    currentLineRef.current = newLine;
    
    // 判断是否包含中文
    if (containsChinese(newLine)) {
      // 中文模式：在本地终端显示，但不发送到 SSH
      // 使用 xterm.write 显示字符
      xterm.write(data);
    } else {
      // 英文模式：发送到 SSH 终端
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
    }
  };

  // 检测中文输入
  const containsChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

  // 执行 AI 建议的命令
  const handleExecuteCommand = (command: string) => {
    setPendingCommand(command);
  };

  // 修改命令
  const handleEditCommand = () => {
    if (aiCard) {
      setEditedCommand(aiCard.command);
      setEditingCommand(true);
    }
  };

  // 保存修改后的命令
  const handleSaveEdit = () => {
    if (aiCard && editedCommand) {
      setAiCard({
        ...aiCard,
        command: editedCommand,
      });
    }
    setEditingCommand(false);
  };

  // 取消 AI 卡片
  const handleCancelCard = () => {
    setAiCard(null);
    setEditingCommand(false);
  };

  // 关闭会话
  const handleCloseTab = (sessionId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    removeSession(sessionId);
    
    const remainingSessions = sessions.filter(s => s.id !== sessionId);
    if (remainingSessions.length > 0) {
      setActiveSession(remainingSessions[0].id);
    } else {
      setActiveSession(null);
    }
  };

  return (
    <div className="terminal-area">
      {/* Tab Bar */}
      <div className="tab-bar">
        <Tabs
          activeKey={activeSessionId || undefined}
          items={sessions.map((s) => ({
            key: s.id,
            label: (
              <span className="tab-label">
                {s.type === 'file' ? <FolderOutlined /> : <CodeOutlined />}
                <span className="tab-name">{s.name}</span>
                <CloseOutlined 
                  className="tab-close" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(s.id);
                  }} 
                />
              </span>
            ),
          }))}
          tabBarExtraContent={
            <Button type="text" icon={<PlusOutlined />} size="small" disabled>
              新建
            </Button>
          }
          onChange={(key) => setActiveSession(key)}
        />
      </div>

      {/* 内容区域 */}
      <div className="terminal-wrapper">
        {isFileManager && activeConnection ? (
          /* 文件管理器 */
          <FileManager connectionId={activeConnection.id} />
        ) : (
          /* 终端 */
          <>
            <div className="terminal-container" ref={terminalRef} />

            {/* AI 命令卡片 - 覆盖在终端底部 */}
            {aiCard && aiCard.visible && (
              <div className="ai-card-overlay" ref={aiCardRef}>
                <AiCommandCard
                  command={aiCard.command}
                  explanation={aiCard.explanation}
                  riskLevel={aiCard.riskLevel}
                  warnings={aiCard.warnings}
                  editing={editingCommand}
                  editedCommand={editedCommand}
                  onExecute={handleExecuteCommand}
                  onEdit={handleEditCommand}
                  onSaveEdit={handleSaveEdit}
                  onCancel={handleCancelCard}
                  onEditChange={setEditedCommand}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TerminalArea;