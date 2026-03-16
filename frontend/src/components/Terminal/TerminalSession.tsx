import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppStore, type Connection, type AiResponse, type AiHistoryItem } from '../../stores/appStore';

interface TerminalSessionProps {
  connection: Connection;
  isActive: boolean;
}

function defaultWsBase() {
  if (typeof window === 'undefined') return 'ws://localhost:18080';
  const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${wsProto}://${host}`;
}

const WS_BASE = import.meta.env.VITE_WS_BASE || defaultWsBase();

const TerminalSession = ({ connection, isActive }: TerminalSessionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 是否已连接
  const connectedRef = useRef(false);
  // 是否已初始化
  const initializedRef = useRef(false);
  // 组件是否仍然挂载
  const isMountedRef = useRef(true);
  // 是否正在等待 AI 响应
  const waitingForAiRef = useRef(false);
  // 当前正在追踪的命令 ID
  const currentCommandIdRef = useRef<string | null>(null);
  // 命令输出缓冲区
  const commandOutputBufferRef = useRef<string>('');
  // 是否正在收集命令输出
  const collectingOutputRef = useRef(false);
  // 输入防抖定时器
  const inputDebounceRef = useRef<NodeJS.Timeout>();
  // 上次输入的命令（用于命令提示）
  const lastInputRef = useRef<string>('');

  // Store
  const setAiResponse = useAppStore((state) => state.setAiResponse);
  const updateAiStreamingText = useAppStore((state) => state.updateAiStreamingText);
  const clearAiResponse = useAppStore((state) => state.clearAiResponse);
  const updateAiHistoryStatus = useAppStore((state) => state.updateAiHistoryStatus);
  const updateAiHistoryFollowUp = useAppStore((state) => state.updateAiHistoryFollowUp);
  const setCommandHints = useAppStore((state) => state.setCommandHints);
  const clearCommandHints = useAppStore((state) => state.clearCommandHints);

  // 检测中文
  const containsChinese = useCallback((text: string) => /[\u4e00-\u9fa5]/.test(text), []);

  // 初始化终端和连接
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    isMountedRef.current = true;
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

    xterm.writeln(`\x1b[33m正在连接 ${connection.name} (${connection.host})...\x1b[0m`);

    const ws = new WebSocket(`${WS_BASE}/ws?connectionId=${connection.id}`);
    wsRef.current = ws;

    // 当前输入缓冲区（用于检测中文输入）
    let inputBuffer = '';

    // 处理终端输入
    const handleTerminalInput = (data: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      // 如果正在等待 AI 响应，忽略输入
      if (waitingForAiRef.current) return;

      // 回车键
      if (data === '\r' || data === '\n') {
        const buffer = inputBuffer.trim();
        inputBuffer = '';

        // 清除命令提示
        clearCommandHints();

        // 检测是否是中文问题
        if (containsChinese(buffer)) {
          // 发送给 AI
          setAiResponse({
            sessionId: connection.id,
            query: buffer,
            command: '',
            explanation: '',
            riskLevel: 'low',
            warnings: [],
            loading: true,
            streamingText: '',
          });
          waitingForAiRef.current = true;

          ws.send(JSON.stringify({
            type: 'ai.chat',
            payload: { message: buffer, query: buffer }
          }));
        } else {
          // 正常发送给 shell
          ws.send(JSON.stringify({
            type: 'terminal.input',
            payload: { data: data }
          }));
        }
        return;
      }

      // Ctrl+C 中断
      if (data === '\x03') {
        inputBuffer = '';
        clearCommandHints();
        ws.send(JSON.stringify({
          type: 'terminal.input',
          payload: { data: data }
        }));
        return;
      }

      // Tab 键 - 接受命令提示
      if (data === '\t' && useAppStore.getState().commandHints.length > 0) {
        const hints = useAppStore.getState().commandHints;
        const selectedIndex = useAppStore.getState().selectedHintIndex;
        const selectedHint = hints[selectedIndex];
        if (selectedHint) {
          // 替换当前输入为选中的提示
          inputBuffer = selectedHint.command;
          clearCommandHints();
          // 发送清屏和重新输入
          // 这里简化处理，直接发送命令
          return;
        }
      }

      // 上下箭头 - 在提示列表中导航
      if (data === '\x1b[A' || data === '\x1b[B') {
        const hints = useAppStore.getState().commandHints;
        if (hints.length > 0) {
          const currentIndex = useAppStore.getState().selectedHintIndex;
          let newIndex = currentIndex;
          if (data === '\x1b[A') { // 上箭头
            newIndex = Math.max(0, currentIndex - 1);
          } else { // 下箭头
            newIndex = Math.min(hints.length - 1, currentIndex + 1);
          }
          useAppStore.getState().setSelectedHintIndex(newIndex);
          return;
        }
      }

      // 退格键
      if (data === '\x7f' || data === '\b') {
        inputBuffer = inputBuffer.slice(0, -1);
      } else {
        // 累积输入到缓冲区
        inputBuffer += data;
      }

      // 始终发送给 shell（让 shell 处理显示）
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: data }
      }));

      // 命令提示：非中文输入且长度大于2时，请求提示
      if (!containsChinese(inputBuffer) && inputBuffer.length > 2 && inputBuffer !== lastInputRef.current) {
        lastInputRef.current = inputBuffer;
        clearTimeout(inputDebounceRef.current);
        inputDebounceRef.current = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ai.command.hint',
              payload: { partialCommand: inputBuffer }
            }));
          }
        }, 300);
      } else if (inputBuffer.length <= 2) {
        clearCommandHints();
      }
    };

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
            // 收集命令输出
            if (collectingOutputRef.current && currentCommandIdRef.current) {
              commandOutputBufferRef.current += msg.payload.data;
            }
            break;

          case 'ai.progress':
            // 流式输出进度
            updateAiStreamingText(msg.payload.content);
            break;

          case 'ai.response':
            waitingForAiRef.current = false;
            // 更新 AI 响应状态（显示在独立面板）
            setAiResponse({
              sessionId: connection.id,
              query: msg.payload.query || '',
              command: msg.payload.command,
              explanation: msg.payload.explanation,
              riskLevel: msg.payload.riskLevel,
              warnings: msg.payload.warnings || [],
              loading: false,
              streamingText: '',
            });
            break;

          case 'ai.command.tracking':
            // 开始追踪命令输出
            currentCommandIdRef.current = msg.payload.commandId;
            collectingOutputRef.current = true;
            commandOutputBufferRef.current = '';
            break;

          case 'ai.command.complete':
            // 命令执行完成
            collectingOutputRef.current = false;
            if (currentCommandIdRef.current) {
              const output = commandOutputBufferRef.current;
              updateAiHistoryStatus(currentCommandIdRef.current, 'executed', output);
              currentCommandIdRef.current = null;
              commandOutputBufferRef.current = '';
            }
            break;

          case 'ai.followup':
            // AI 后续建议
            if (msg.payload.commandId) {
              updateAiHistoryFollowUp(
                msg.payload.commandId,
                msg.payload.suggestion,
                msg.payload.followUpCommand
              );
            }
            break;

          case 'ai.command.hints':
            // 命令提示
            if (msg.payload.hints && Array.isArray(msg.payload.hints)) {
              setCommandHints(msg.payload.hints);
            }
            break;

          case 'error':
            waitingForAiRef.current = false;
            // 在终端显示错误
            xterm.writeln(`\x1b[31m✗ 错误: ${msg.payload.message}\x1b[0m`);
            // 只有 AI 相关错误才显示在面板中
            if (msg.payload.code === 'AI_CONFIG_ERROR') {
              setAiResponse({
                sessionId: connection.id,
                query: '',
                command: '',
                explanation: msg.payload.message,
                riskLevel: 'high',
                warnings: [],
                loading: false,
              });
            }
            break;
        }
      } catch (e) {
        xterm.write(event.data);
      }
    };

    ws.onerror = () => {
      if (isMountedRef.current) {
        xterm.writeln('\x1b[31m✗ WebSocket 连接失败\x1b[0m');
      }
    };

    ws.onclose = () => {
      if (connectedRef.current && isMountedRef.current) {
        xterm.writeln('\x1b[33m连接已关闭\x1b[0m');
      }
      connectedRef.current = false;
    };

    return () => {
      isMountedRef.current = false;

      if (inputDebounceRef.current) {
        clearTimeout(inputDebounceRef.current);
      }

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }

      if (xtermRef.current) {
        try {
          xtermRef.current.dispose();
        } catch (e) {}
        xtermRef.current = null;
        fitAddonRef.current = null;
      }

      initializedRef.current = false;
      connectedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  // 监听执行 AI 命令事件
  useEffect(() => {
    const handleExecuteCommand = (e: CustomEvent) => {
      // 只有活跃的终端才响应
      if (!isActive) return;

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const { command, historyId } = e.detail;

        // 发送命令执行消息（带历史 ID）
        ws.send(JSON.stringify({
          type: 'ai.command.execute',
          payload: {
            command: command,
            historyId: historyId
          }
        }));

        // 清除 AI 面板
        clearAiResponse();
        waitingForAiRef.current = false;
      }
    };

    window.addEventListener('execute-ai-command', handleExecuteCommand as EventListener);
    return () => {
      window.removeEventListener('execute-ai-command', handleExecuteCommand as EventListener);
    };
  }, [isActive, clearAiResponse]);

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
        display: isActive ? 'flex' : 'none',
      }}
    />
  );
};

export default TerminalSession;