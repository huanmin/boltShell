import { Tabs } from 'antd';
import { CloseOutlined, FolderOutlined, CodeOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppStore } from '../../stores/appStore';
import FileManager from '../FileManager/FileManager';
import './index.css';

const WS_BASE = 'ws://localhost:18080';

const TerminalArea = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 当前输入行
  const currentLineRef = useRef('');
  // 中文输入历史
  const chineseHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  // 是否在等待AI响应
  const waitingForAiRef = useRef(false);
  // AI建议的命令（用于执行）
  const suggestedCommandRef = useRef<string | null>(null);

  const {
    sessions,
    activeSessionId,
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
      xterm.scrollToBottom();
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 当切换 tab 时重新适配终端大小
  useEffect(() => {
    if (!isFileManager && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.scrollToBottom();
      }, 100);
    }
  }, [isFileManager]);

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
      // 适配终端大小
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connection.status':
            if (msg.payload.status === 'connected') {
              xterm.writeln('\x1b[32m✓ SSH 连接成功\x1b[0m');
              xterm.writeln('');
              // 连接成功后适配并滚动到底部
              setTimeout(() => {
                fitAddonRef.current?.fit();
                xterm.scrollToBottom();
              }, 100);
            } else if (msg.payload.status === 'connecting') {
              xterm.write('\x1b[33m正在建立 SSH 连接...\x1b[0m');
            }
            break;

          case 'terminal.output':
            // 真实 SSH 输出
            xterm.write(msg.payload.data);
            break;

          case 'ai.response':
            // AI 响应 - 直接在终端显示
            waitingForAiRef.current = false;
            displayAiResponse(xterm, msg.payload);
            break;

          case 'error':
            xterm.writeln(`\x1b[31m✗ 错误: ${msg.payload.message}\x1b[0m`);
            waitingForAiRef.current = false;
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

  // 显示 AI 响应
  const displayAiResponse = (xterm: XTerm, payload: any) => {
    const { command, explanation, riskLevel, warnings } = payload;

    xterm.writeln('');
    xterm.writeln('\x1b[1;34m┌─────────────────────────────────────────────────\x1b[0m');
    xterm.writeln('\x1b[1;34m│ 💡 AI 命令建议\x1b[0m');
    xterm.writeln('\x1b[1;34m├─────────────────────────────────────────────────\x1b[0m');

    // 命令
    const cmdColor = riskLevel === 'high' || riskLevel === 'critical' ? '\x1b[1;31m' : '\x1b[1;36m';
    xterm.writeln(`\x1b[1;34m│\x1b[0m  命令: ${cmdColor}$ ${command}\x1b[0m`);

    // 说明
    xterm.writeln(`\x1b[1;34m│\x1b[0m  说明: \x1b[90m${explanation}\x1b[0m`);

    // 警告
    if (warnings && warnings.length > 0) {
      xterm.writeln('\x1b[1;34m│\x1b[0m');
      warnings.forEach((w: string) => {
        xterm.writeln(`\x1b[1;34m│\x1b[0m  \x1b[1;33m⚠️ ${w}\x1b[0m`);
      });
    }

    xterm.writeln('\x1b[1;34m├─────────────────────────────────────────────────\x1b[0m');
    xterm.writeln('\x1b[1;34m│\x1b[0m  \x1b[90m提示: 按 Enter 执行命令，或修改后按 Enter 执行\x1b[0m');
    xterm.writeln('\x1b[1;34m└─────────────────────────────────────────────────\x1b[0m');
    xterm.writeln('');

    // 保存建议的命令
    suggestedCommandRef.current = command;

    // 滚动到底部并重新适配终端大小
    setTimeout(() => {
      xterm.scrollToBottom();
      fitAddonRef.current?.fit();
    }, 50);
  };

  // 处理终端输入
  const handleTerminalInput = (data: string) => {
    const ws = wsRef.current;
    const xterm = xtermRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN || !xterm) return;

    // 如果有待执行的AI建议命令
    if (suggestedCommandRef.current) {
      if (data === '\r' || data === '\n') {
        // 执行命令
        const cmd = suggestedCommandRef.current;
        suggestedCommandRef.current = null;
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: cmd + '\r' }
        }));
        return;
      } else if (data === '\x03') {
        // Ctrl+C 取消
        suggestedCommandRef.current = null;
        xterm.writeln('\x1b[33m已取消\x1b[0m');
        return;
      } else if (data === '\x7f' || data === '\b') {
        // Backspace - 删除命令的最后一个字符
        if (suggestedCommandRef.current.length > 0) {
          suggestedCommandRef.current = suggestedCommandRef.current.slice(0, -1);
          // 回退光标并清除字符
          xterm.write('\b \b');
        }
        return;
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // 普通字符 - 追加到命令
        suggestedCommandRef.current += data;
        xterm.write(data);
        return;
      }
      return;
    }

    // 回车键
    if (data === '\r' || data === '\n') {
      const line = currentLineRef.current;

      if (containsChinese(line)) {
        // 中文描述 - 发送给 AI，保存历史
        if (line.trim()) {
          chineseHistoryRef.current.push(line);
          historyIndexRef.current = chineseHistoryRef.current.length;
        }
        xterm.writeln('');
        ws.send(JSON.stringify({
          type: 'ai.chat',
          payload: { message: line, query: line }
        }));
        waitingForAiRef.current = true;
      } else {
        // 英文命令 - 发送到 SSH
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
      }

      currentLineRef.current = '';
      historyIndexRef.current = chineseHistoryRef.current.length;
      return;
    }

    // Backspace / Delete
    if (data === '\x7f' || data === '\b') {
      if (currentLineRef.current.length > 0) {
        // 先判断当前是否为中文模式
        const isChineseMode = containsChinese(currentLineRef.current);
        const oldLength = currentLineRef.current.length;
        currentLineRef.current = currentLineRef.current.slice(0, -1);

        if (isChineseMode) {
          // 中文模式 - 清除整行并重写
          // 先清除之前的输入
          for (let i = 0; i < oldLength * 2; i++) {
            xterm.write('\b');
          }
          for (let i = 0; i < oldLength * 2; i++) {
            xterm.write(' ');
          }
          for (let i = 0; i < oldLength * 2; i++) {
            xterm.write('\b');
          }
          // 写回新的内容
          xterm.write(currentLineRef.current);
        } else {
          // 英文模式 - 发送到 SSH
          ws.send(JSON.stringify({
            type: 'terminal.input',
            payload: { data: data }
          }));
        }
      }
      return;
    }

    // Ctrl+C - 中断
    if (data === '\x03') {
      currentLineRef.current = '';
      historyIndexRef.current = chineseHistoryRef.current.length;
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // Tab 键
    if (data === '\t') {
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // 上箭头 - 历史记录
    if (data === '\x1b[A') {
      if (containsChinese(currentLineRef.current) || chineseHistoryRef.current.length > 0) {
        if (historyIndexRef.current > 0) {
          // 清除当前行
          const oldLen = currentLineRef.current.length;
          for (let i = 0; i < oldLen * 2; i++) {
            xterm.write('\b');
          }
          for (let i = 0; i < oldLen * 2; i++) {
            xterm.write(' ');
          }
          for (let i = 0; i < oldLen * 2; i++) {
            xterm.write('\b');
          }

          historyIndexRef.current--;
          const historyItem = chineseHistoryRef.current[historyIndexRef.current];
          currentLineRef.current = historyItem;
          xterm.write(historyItem);
        }
        return;
      }
      // 非中文模式，发送到SSH
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // 下箭头 - 历史记录
    if (data === '\x1b[B') {
      if (containsChinese(currentLineRef.current) || historyIndexRef.current < chineseHistoryRef.current.length) {
        // 清除当前行
        const oldLen = currentLineRef.current.length;
        for (let i = 0; i < oldLen * 2; i++) {
          xterm.write('\b');
        }
        for (let i = 0; i < oldLen * 2; i++) {
          xterm.write(' ');
        }
        for (let i = 0; i < oldLen * 2; i++) {
          xterm.write('\b');
        }

        if (historyIndexRef.current < chineseHistoryRef.current.length - 1) {
          historyIndexRef.current++;
          const historyItem = chineseHistoryRef.current[historyIndexRef.current];
          currentLineRef.current = historyItem;
          xterm.write(historyItem);
        } else {
          historyIndexRef.current = chineseHistoryRef.current.length;
          currentLineRef.current = '';
        }
        return;
      }
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
      return;
    }

    // 普通字符
    const newLine = currentLineRef.current + data;
    currentLineRef.current = newLine;

    if (containsChinese(newLine)) {
      // 中文模式 - 在本地终端显示
      xterm.write(data);
    } else {
      // 英文模式 - 发送到 SSH
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));
    }
  };

  // 检测中文
  const containsChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

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
          onChange={(key) => setActiveSession(key)}
        />
      </div>

      {/* 内容区域 */}
      <div className="terminal-wrapper">
        {/* 文件管理器 */}
        {isFileManager && activeConnection && (
          <FileManager connectionId={activeConnection.id} />
        )}

        {/* 终端 */}
        <div
          className="terminal-container"
          ref={terminalRef}
          style={{ display: isFileManager ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
};

export default TerminalArea;