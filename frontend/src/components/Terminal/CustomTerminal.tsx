import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore, type Connection, type TerminalMode } from '../../stores/appStore';
import { parseAnsi, renderAnsiText, cleanTerminalOutput, extractPrompt, removeTrailingPrompt, type TextSegment } from '../../utils/ansiParser';
import './CustomTerminal.css';

interface CustomTerminalProps {
  connection: Connection;
  isActive: boolean;
}

// 终端模式提示信息
const SHELL_PLACEHOLDER = 'Ctrl+Shift+I 切换AI终端模式，Ctrl+Shift+Y 唤出命令助手';
const AGENT_PLACEHOLDER = '输入自然语言或命令，AI将智能响应，试试打个招呼吧';

// 输出行类型
interface OutputLine {
  id: string;
  segments: TextSegment[];
  timestamp: number;
}

// AI 响应卡片类型
interface AiResponseCard {
  id: string;
  query: string;
  aiReply: string;
  command: string;
  explanation: string;
  riskLevel: string;
  warnings: string[];
  status: 'pending' | 'executed' | 'cancelled' | 'editing';
  output?: string;
  followUp?: string;
  followUpCommand?: string;
}

// 命令提示类型
interface CommandHint {
  command: string;
  description: string;
}

function defaultWsBase() {
  if (typeof window === 'undefined') return 'ws://localhost:18080';
  const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${wsProto}://${host}`;
}

const WS_BASE = import.meta.env.VITE_WS_BASE || defaultWsBase();

const CustomTerminal = ({ connection, isActive }: CustomTerminalProps) => {
  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);

  // 终端状态
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [prompt, setPrompt] = useState('$ ');
  const [isConnected, setIsConnected] = useState(false);

  // 命令历史
  const [, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<string[]>([]);

  // AI 状态
  const [aiCards, setAiCards] = useState<AiResponseCard[]>([]);
  const [waitingForAi, setWaitingForAi] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // 命令提示状态
  const [commandHints, setCommandHints] = useState<CommandHint[]>([]);
  const [selectedHintIndex, setSelectedHintIndex] = useState(0);

  // Store
  const terminalMode = useAppStore((state) => state.terminalMode);
  const currentModeRef = useRef<TerminalMode>(terminalMode);
  const setAiResponse = useAppStore((state) => state.setAiResponse);
  const clearAiResponse = useAppStore((state) => state.clearAiResponse);

  // 保持模式引用最新
  useEffect(() => {
    currentModeRef.current = terminalMode;
  }, [terminalMode]);

  // 检测中文
  const containsChinese = useCallback((text: string) => /[\u4e00-\u9fa5]/.test(text), []);

  // 添加输出行
  const addOutputLine = useCallback((text: string) => {
    const cleanedText = cleanTerminalOutput(text);
    if (!cleanedText) return;

    const segments = parseAnsi(text);
    const newLine: OutputLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      segments,
      timestamp: Date.now(),
    };
    setOutputLines(prev => [...prev, newLine]);
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, []);

  // 建立 WebSocket 连接
  useEffect(() => {
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (connectionIdRef.current === connection.id && wsRef.current) {
      return;
    }

    isConnectingRef.current = true;
    connectionIdRef.current = connection.id;

    addOutputLine(`\x1b[33m正在连接 ${connection.name} (${connection.host})...\x1b[0m`);

    const ws = new WebSocket(`${WS_BASE}/ws?connectionId=${connection.id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'connection.status':
            if (msg.payload.status === 'connected') {
              addOutputLine('\x1b[32m✓ SSH 连接成功\x1b[0m');
              setIsConnected(true);
              setTimeout(scrollToBottom, 100);
            } else if (msg.payload.status === 'connecting') {
              addOutputLine('\x1b[33m正在建立 SSH 连接...\x1b[0m');
            }
            break;

          case 'terminal.output':
            const data = msg.payload.data;

            // 提取提示符
            const newPrompt = extractPrompt(data);
            if (newPrompt) {
              setPrompt(newPrompt);
            }

            // 移除输出末尾的提示符（因为我们会单独显示输入行）
            let cleanedOutput = removeTrailingPrompt(data);

            // 检查是否只是单独的 conda 环境前缀（如 "(base)"），如果是则不显示
            const cleanedText = cleanTerminalOutput(cleanedOutput).trim();
            const isOnlyCondaPrefix = /^\([^)]+\)$/.test(cleanedText);
            if (isOnlyCondaPrefix) {
              cleanedOutput = '';
            }

            // 只有清理后还有内容才添加到输出
            if (cleanedOutput.trim()) {
              addOutputLine(cleanedOutput);
            }

            setTimeout(scrollToBottom, 10);
            break;

          case 'ai.progress':
            setStreamingText(prev => prev + msg.payload.content);
            break;

          case 'ai.response':
            setWaitingForAi(false);
            const card: AiResponseCard = {
              id: `ai-${Date.now()}`,
              query: msg.payload.query || '',
              aiReply: `好的，我来为您处理：${msg.payload.query || ''}`,
              command: msg.payload.command,
              explanation: msg.payload.explanation,
              riskLevel: msg.payload.riskLevel,
              warnings: msg.payload.warnings || [],
              status: 'pending',
            };
            setAiCards(prev => [...prev, card]);
            setStreamingText('');
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

          case 'ai.command.complete':
            const { commandId, output } = msg.payload;
            setAiCards(prev => prev.map(card =>
              card.id === commandId ? { ...card, output } : card
            ));
            break;

          case 'ai.followup':
            const { commandId: cmdId, suggestion, followUpCommand } = msg.payload;
            setAiCards(prev => prev.map(card =>
              card.id === cmdId ? { ...card, followUp: suggestion, followUpCommand } : card
            ));
            break;

          case 'ai.command.hints':
            // 命令提示响应
            if (msg.payload.hints && Array.isArray(msg.payload.hints)) {
              setCommandHints(msg.payload.hints);
              setSelectedHintIndex(0);
            }
            break;

          case 'error':
            setWaitingForAi(false);
            addOutputLine(`\x1b[31m✗ 错误: ${msg.payload.message}\x1b[0m`);
            break;
        }
      } catch (e) {
        addOutputLine(event.data);
      }
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
      addOutputLine('\x1b[31m✗ WebSocket 连接失败\x1b[0m');
    };

    ws.onclose = () => {
      isConnectingRef.current = false;
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
      connectionIdRef.current = null;
      isConnectingRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  // 请求命令提示
  const requestCommandHints = useCallback((partialCommand: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'ai.command.hint',
      payload: { partialCommand }
    }));
  }, []);

  // 清除命令提示
  const clearCommandHints = useCallback(() => {
    setCommandHints([]);
    setSelectedHintIndex(0);
  }, []);

  // 执行命令
  const executeCommand = useCallback((command: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (command.trim()) {
      setCommandHistory(prev => [...prev, command]);
      historyRef.current = [...historyRef.current, command];
    }

    // 清除命令提示
    clearCommandHints();

    // 显示用户输入
    setOutputLines(prev => [...prev, {
      id: `input-${Date.now()}`,
      segments: [{ text: `${prompt}${command}` }],
      timestamp: Date.now(),
    }]);

    if (currentModeRef.current === 'agent' && containsChinese(command)) {
      setWaitingForAi(true);
      setStreamingText('');
      ws.send(JSON.stringify({
        type: 'ai.chat',
        payload: { message: command, query: command }
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'terminal.input',
        payload: { data: command + '\n' }
      }));
    }
  }, [prompt, containsChinese, clearCommandHints]);

  // 执行 AI 命令
  const executeAiCommand = useCallback((cardId: string, command: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setAiCards(prev => prev.map(card =>
      card.id === cardId ? { ...card, status: 'executed' } : card
    ));

    setOutputLines(prev => [...prev, {
      id: `exec-${Date.now()}`,
      segments: [{ text: `$ ${command}`, style: { color: '#22c55e' } }],
      timestamp: Date.now(),
    }]);

    ws.send(JSON.stringify({
      type: 'ai.command.execute',
      payload: { command, historyId: cardId }
    }));

    clearAiResponse();
    setTimeout(scrollToBottom, 100);
  }, [clearAiResponse, scrollToBottom]);

  // 修改 AI 命令
  const editAiCommand = useCallback((cardId: string) => {
    setAiCards(prev => prev.map(card =>
      card.id === cardId ? { ...card, status: 'editing' } : card
    ));
  }, []);

  // 保存修改的命令
  const saveEditedCommand = useCallback((cardId: string, newCommand: string) => {
    setAiCards(prev => prev.map(card =>
      card.id === cardId ? { ...card, command: newCommand, status: 'pending' } : card
    ));
  }, []);

  // 取消编辑
  const cancelEditing = useCallback((cardId: string) => {
    setAiCards(prev => prev.map(card =>
      card.id === cardId ? { ...card, status: 'pending' } : card
    ));
  }, []);

  // 拒绝 AI 命令
  const rejectAiCommand = useCallback((card: AiResponseCard) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setAiCards(prev => prev.filter(c => c.id !== card.id));

    setWaitingForAi(true);
    setStreamingText('');
    ws.send(JSON.stringify({
      type: 'ai.chat',
      payload: {
        message: `用户拒绝了命令"${card.command}"，请换一个命令。原始需求：${card.query}`,
        query: card.query
      }
    }));

    clearAiResponse();
  }, [clearAiResponse]);

  // 开启新会话
  const startNewSession = useCallback(() => {
    setAiCards([]);
    clearAiResponse();
  }, [clearAiResponse]);

  // 执行后续建议命令
  const executeFollowUpCommand = useCallback((cardId: string, command: string) => {
    executeAiCommand(cardId, command);
  }, [executeAiCommand]);

  // 接受命令提示
  const acceptHint = useCallback((hint: CommandHint) => {
    // 清理命令中的占位符
    const cleanCommand = hint.command.replace(/\s*<[^>]+>/g, '');
    setInputValue(cleanCommand);
    clearCommandHints();
    inputRef.current?.focus();
  }, [clearCommandHints]);

  // 处理键盘输入
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 如果有命令提示，Tab 和方向键用于选择提示
    if (commandHints.length > 0) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const selectedHint = commandHints[selectedHintIndex];
        if (selectedHint) {
          acceptHint(selectedHint);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedHintIndex(prev =>
          prev > 0 ? prev - 1 : commandHints.length - 1
        );
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedHintIndex(prev =>
          prev < commandHints.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        clearCommandHints();
        return;
      }
    }

    // 正常按键处理
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        executeCommand(inputValue);
        setInputValue('');
        setHistoryIndex(-1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (historyRef.current.length > 0) {
          const newIndex = historyIndex < historyRef.current.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(newIndex);
          setInputValue(historyRef.current[historyRef.current.length - 1 - newIndex] || '');
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(historyRef.current[historyRef.current.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue('');
        }
        break;

      case 'Tab':
        e.preventDefault();
        // Tab 键请求 AI 命令补全
        if (inputValue.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          requestCommandHints(inputValue);
        }
        break;

      case 'Escape':
        e.preventDefault();
        break;

      default:
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setInputValue('');
          clearCommandHints();
        }
        break;
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // 清除命令提示（用户继续输入时）
    if (commandHints.length > 0) {
      clearCommandHints();
    }
  };

  // 聚焦输入框
  const focusInput = () => {
    inputRef.current?.focus();
  };

  // 获取风险标签文本
  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'critical':
        return '⚠️ 极高危命令';
      case 'high':
        return '⚠️ 高危命令';
      case 'medium':
        return '⚡ 中等风险命令';
      default:
        return '✓ 安全命令';
    }
  };

  return (
    <div
      ref={containerRef}
      className="custom-terminal"
      style={{ display: isActive ? 'flex' : 'none' }}
      onClick={focusInput}
    >
      {/* 输出区域 */}
      <div ref={outputRef} className="terminal-output" onClick={() => focusInput()}>
        {outputLines.map(line => (
          <div key={line.id} className="output-line">
            {renderAnsiText(line.segments, line.id)}
          </div>
        ))}

        {/* AI 流式输出 */}
        {waitingForAi && streamingText && (
          <div className="ai-streaming">
            <span className="ai-streaming-text">{streamingText}</span>
            <span className="cursor-blink">▊</span>
          </div>
        )}

        {/* AI 响应卡片 */}
        {aiCards.map(card => (
          <div key={card.id} className={`ai-card-wrapper ai-card-${card.status}`}>
            <div className="ai-reply">
              <span className="ai-reply-text">{card.aiReply}</span>
            </div>

            <div className="ai-command-box">
              <div className="ai-command-header">
                <span className={`risk-label risk-${card.riskLevel}`}>
                  {getRiskLabel(card.riskLevel)}
                </span>
                {card.status === 'pending' && (
                  <div className="ai-command-actions">
                    <button
                      className="btn-execute"
                      onClick={(e) => { e.stopPropagation(); executeAiCommand(card.id, card.command); }}
                    >
                      执行
                    </button>
                    <button
                      className="btn-edit"
                      onClick={(e) => { e.stopPropagation(); editAiCommand(card.id); }}
                    >
                      修改
                    </button>
                    <button
                      className="btn-reject"
                      onClick={(e) => { e.stopPropagation(); rejectAiCommand(card); }}
                    >
                      拒绝
                    </button>
                  </div>
                )}
                {card.status === 'executed' && (
                  <span className="status-badge status-executed">✓ 已同意</span>
                )}
                {card.status === 'cancelled' && (
                  <span className="status-badge status-cancelled">✗ 已拒绝</span>
                )}
              </div>

              {card.status === 'editing' ? (
                <div className="ai-command-edit">
                  <input
                    type="text"
                    className="command-edit-input"
                    value={card.command}
                    onChange={(e) => saveEditedCommand(card.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button className="btn-cancel" onClick={() => cancelEditing(card.id)}>取消</button>
                    <button className="btn-save" onClick={() => saveEditedCommand(card.id, card.command)}>保存</button>
                  </div>
                </div>
              ) : (
                <div className="ai-command-content">
                  <code>{card.command}</code>
                </div>
              )}

              {card.output && (
                <div className="ai-command-output">
                  <pre>{card.output}</pre>
                </div>
              )}

              {card.followUp && card.status === 'executed' && (
                <div className="ai-followup">
                  <span className="followup-icon">💡</span>
                  <span className="followup-text">{card.followUp}</span>
                  {card.followUpCommand && (
                    <button
                      className="btn-followup"
                      onClick={(e) => { e.stopPropagation(); executeFollowUpCommand(card.id, card.followUpCommand || ''); }}
                    >
                      执行建议命令
                    </button>
                  )}
                </div>
              )}
            </div>

            {card.status === 'executed' && (
              <div className="ai-new-session">
                <button onClick={(e) => { e.stopPropagation(); startNewSession(); }}>
                  开启新会话
                </button>
              </div>
            )}
          </div>
        ))}

        {/* 输入行 - 放在输出区域内 */}
        <div className="input-line">
          <span className="terminal-prompt">{cleanTerminalOutput(prompt)}</span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isConnected || waitingForAi}
            autoFocus
            placeholder={terminalMode === 'shell' ? SHELL_PLACEHOLDER : AGENT_PLACEHOLDER}
          />
          <span className="input-cursor" />
        </div>

        {/* 命令提示列表 */}
        {commandHints.length > 0 && (
          <div className="command-hints-panel">
            {commandHints.map((hint, index) => (
              <div
                key={index}
                className={`hint-item ${index === selectedHintIndex ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); acceptHint(hint); }}
              >
                <span className="hint-command">{hint.command}</span>
                <span className="hint-description">{hint.description}</span>
              </div>
            ))}
            <div className="hint-hint">
              <span>↑↓ 选择</span>
              <span>Tab/Enter 接受</span>
              <span>Esc 关闭</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomTerminal;