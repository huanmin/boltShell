import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { Connection } from '../../stores/appStore';

interface TerminalSessionProps {
  connection: Connection;
  isActive: boolean;
}

const WS_BASE = 'ws://127.0.0.1:18080';

const TerminalSession = ({ connection, isActive }: TerminalSessionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  // AI建议的命令
  const suggestedCommandRef = useRef<string | null>(null);
  // 是否已连接
  const connectedRef = useRef(false);
  // 是否已初始化
  const initializedRef = useRef(false);

  // 检测中文
  const containsChinese = useCallback((text: string) => /[\u4e00-\u9fa5]/.test(text), []);

  // 初始化终端和连接（只执行一次）
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

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
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // 显示连接信息
    xterm.writeln(`\x1b[33m正在连接 ${connection.name} (${connection.host})...\x1b[0m`);

    // 建立 WebSocket 连接
    const ws = new WebSocket(`${WS_BASE}/ws?connectionId=${connection.id}`);
    wsRef.current = ws;

    // 显示 AI 响应
    const displayAiResponse = (payload: any) => {
      const { command, explanation, riskLevel, warnings } = payload;

      xterm.writeln('');
      xterm.writeln('\x1b[1;34m┌─────────────────────────────────────────────────\x1b[0m');
      xterm.writeln('\x1b[1;34m│ 💡 AI 命令建议\x1b[0m');
      xterm.writeln('\x1b[1;34m├─────────────────────────────────────────────────\x1b[0m');

      const cmdColor = riskLevel === 'high' || riskLevel === 'critical' ? '\x1b[1;31m' : '\x1b[1;36m';
      xterm.writeln(`\x1b[1;34m│\x1b[0m  命令: ${cmdColor}$ ${command}\x1b[0m`);
      xterm.writeln(`\x1b[1;34m│\x1b[0m  说明: \x1b[90m${explanation}\x1b[0m`);

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

      suggestedCommandRef.current = command;

      setTimeout(() => {
        xterm.scrollToBottom();
        fitAddon.fit();
      }, 50);
    };

    // 处理终端输入
    const handleTerminalInput = (data: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      if (suggestedCommandRef.current) {
        if (data === '\r' || data === '\n') {
          const cmd = suggestedCommandRef.current;
          suggestedCommandRef.current = null;
          ws.send(JSON.stringify({
            type: 'terminal.input',
            payload: { data: cmd + '\r' }
          }));
          return;
        } else if (data === '\x03') {
          suggestedCommandRef.current = null;
          xterm.writeln('\x1b[33m已取消\x1b[0m');
          return;
        } else if (data === '\x7f' || data === '\b') {
          if (suggestedCommandRef.current.length > 0) {
            suggestedCommandRef.current = suggestedCommandRef.current.slice(0, -1);
            xterm.write('\b \b');
          }
          return;
        } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
          suggestedCommandRef.current += data;
          xterm.write(data);
          return;
        }
        return;
      }

      if (data === '\r' || data === '\n') {
        const line = currentLineRef.current;

        if (containsChinese(line)) {
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
          ws.send(JSON.stringify({
            type: 'terminal.input',
            payload: { data: data }
          }));
        }

        currentLineRef.current = '';
        historyIndexRef.current = chineseHistoryRef.current.length;
        return;
      }

      if (data === '\x7f' || data === '\b') {
        if (currentLineRef.current.length > 0) {
          const isChineseMode = containsChinese(currentLineRef.current);
          const oldLength = currentLineRef.current.length;
          currentLineRef.current = currentLineRef.current.slice(0, -1);

          if (isChineseMode) {
            for (let i = 0; i < oldLength * 2; i++) xterm.write('\b');
            for (let i = 0; i < oldLength * 2; i++) xterm.write(' ');
            for (let i = 0; i < oldLength * 2; i++) xterm.write('\b');
            xterm.write(currentLineRef.current);
          } else {
            ws.send(JSON.stringify({
              type: 'terminal.input',
              payload: { data: data }
            }));
          }
        }
        return;
      }

      if (data === '\x03') {
        currentLineRef.current = '';
        historyIndexRef.current = chineseHistoryRef.current.length;
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
        return;
      }

      if (data === '\t') {
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
        return;
      }

      if (data === '\x1b[A') {
        if (containsChinese(currentLineRef.current) || chineseHistoryRef.current.length > 0) {
          if (historyIndexRef.current > 0) {
            const oldLen = currentLineRef.current.length;
            for (let i = 0; i < oldLen * 2; i++) xterm.write('\b');
            for (let i = 0; i < oldLen * 2; i++) xterm.write(' ');
            for (let i = 0; i < oldLen * 2; i++) xterm.write('\b');

            historyIndexRef.current--;
            const historyItem = chineseHistoryRef.current[historyIndexRef.current];
            currentLineRef.current = historyItem;
            xterm.write(historyItem);
          }
          return;
        }
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
        return;
      }

      if (data === '\x1b[B') {
        if (containsChinese(currentLineRef.current) || historyIndexRef.current < chineseHistoryRef.current.length) {
          const oldLen = currentLineRef.current.length;
          for (let i = 0; i < oldLen * 2; i++) xterm.write('\b');
          for (let i = 0; i < oldLen * 2; i++) xterm.write(' ');
          for (let i = 0; i < oldLen * 2; i++) xterm.write('\b');

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

      const newLine = currentLineRef.current + data;
      currentLineRef.current = newLine;

      if (containsChinese(newLine)) {
        xterm.write(data);
      } else {
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
      }
    };

    // 监听终端输入
    xterm.onData((data) => {
      handleTerminalInput(data);
    });

    ws.onopen = () => {
      xterm.writeln('\x1b[32m✓ WebSocket 连接已建立\x1b[0m');
      connectedRef.current = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connection.status':
            if (msg.payload.status === 'connected') {
              xterm.writeln('\x1b[32m✓ SSH 连接成功\x1b[0m');
              xterm.writeln('');
              setTimeout(() => {
                fitAddon.fit();
                xterm.scrollToBottom();
              }, 100);
            } else if (msg.payload.status === 'connecting') {
              xterm.write('\x1b[33m正在建立 SSH 连接...\x1b[0m');
            }
            break;

          case 'terminal.output':
            xterm.write(msg.payload.data);
            break;

          case 'ai.response':
            waitingForAiRef.current = false;
            displayAiResponse(msg.payload);
            break;

          case 'error':
            xterm.writeln(`\x1b[31m✗ 错误: ${msg.payload.message}\x1b[0m`);
            waitingForAiRef.current = false;
            break;
        }
      } catch (e) {
        xterm.write(event.data);
      }
    };

    ws.onerror = () => {
      xterm.writeln('\x1b[31m✗ WebSocket 连接失败\x1b[0m');
    };

    ws.onclose = () => {
      if (connectedRef.current) {
        xterm.writeln('\x1b[33m连接已关闭\x1b[0m');
      }
      connectedRef.current = false;
    };

    // 清理函数 - 组件卸载时关闭连接
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  // 当 isActive 变化时适配终端大小
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.scrollToBottom();
      }, 100);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{
        display: isActive ? 'block' : 'none',
        flex: 1,
        minHeight: 0,
        background: '#0d1117',
        padding: '12px',
        overflow: 'auto'
      }}
    />
  );
};

export default TerminalSession;