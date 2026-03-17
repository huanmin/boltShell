import React from 'react';

/**
 * ANSI 转义序列解析器
 * 用于解析终端输出中的颜色、样式等控制序列
 */

export interface TextSegment {
  text: string;
  style?: React.CSSProperties;
}

interface ParseState {
  segments: TextSegment[];
  currentStyle: React.CSSProperties;
  currentText: string;
}

// ANSI 颜色映射
const ANSI_COLORS: Record<number, string> = {
  // 标准颜色
  30: '#2e3436',  // 黑
  31: '#ef4444',  // 红
  32: '#22c55e',  // 绿
  33: '#eab308',  // 黄
  34: '#3b82f6',  // 蓝
  35: '#a855f7',  // 品红
  36: '#06b6d4',  // 青
  37: '#d1d5db',  // 白
  // 亮色
  90: '#6b7280',  // 亮黑
  91: '#f87171',  // 亮红
  92: '#4ade80',  // 亮绿
  93: '#facc15',  // 亮黄
  94: '#60a5fa',  // 亮蓝
  95: '#c084fc',  // 亮品红
  96: '#22d3ee',  // 亮青
  97: '#f9fafb',  // 亮白
};

/**
 * 解析 ANSI SGR (Select Graphic Rendition) 序列
 */
function parseSGR(params: number[], style: React.CSSProperties): React.CSSProperties {
  const newStyle = { ...style };

  for (let i = 0; i < params.length; i++) {
    const code = params[i];

    if (code === 0) {
      return {};
    } else if (code === 1) {
      newStyle.fontWeight = 'bold';
    } else if (code === 2) {
      newStyle.opacity = 0.7;
    } else if (code === 3) {
      newStyle.fontStyle = 'italic';
    } else if (code === 4) {
      newStyle.textDecoration = 'underline';
    } else if (code === 7) {
      const color = newStyle.color as string;
      const bg = newStyle.background as string;
      if (color) newStyle.background = color;
      if (bg) newStyle.color = bg;
    } else if (code === 22) {
      delete newStyle.fontWeight;
      delete newStyle.opacity;
    } else if (code === 23) {
      delete newStyle.fontStyle;
    } else if (code === 24) {
      delete newStyle.textDecoration;
    } else if (code >= 30 && code <= 37) {
      newStyle.color = ANSI_COLORS[code];
    } else if (code >= 90 && code <= 97) {
      newStyle.color = ANSI_COLORS[code];
    } else if (code === 38 || code === 48) {
      const isForeground = code === 38;
      const nextCode = params[i + 1];

      if (nextCode === 5) {
        const colorIndex = params[i + 2];
        if (colorIndex !== undefined) {
          const color = get256Color(colorIndex);
          if (isForeground) {
            newStyle.color = color;
          } else {
            newStyle.background = color;
          }
        }
        i += 2;
      } else if (nextCode === 2) {
        const r = params[i + 2];
        const g = params[i + 3];
        const b = params[i + 4];
        if (r !== undefined && g !== undefined && b !== undefined) {
          const color = `rgb(${r}, ${g}, ${b})`;
          if (isForeground) {
            newStyle.color = color;
          } else {
            newStyle.background = color;
          }
        }
        i += 4;
      }
    }
  }

  return newStyle;
}

/**
 * 获取 256 色调色板颜色
 */
function get256Color(index: number): string {
  if (index < 16) {
    return ANSI_COLORS[30 + index] || '#ffffff';
  } else if (index >= 16 && index < 232) {
    const n = index - 16;
    const r = Math.floor(n / 36) * 51;
    const g = Math.floor((n % 36) / 6) * 51;
    const b = (n % 6) * 51;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const gray = (index - 232) * 10 + 8;
    return `rgb(${gray}, ${gray}, ${gray})`;
  }
}

/**
 * 清理终端控制序列，只保留可显示文本
 */
export function cleanTerminalOutput(text: string): string {
  let result = text;

  // 移除 OSC 序列 (设置标题等):
  // \x1b]...BEL 或 \x1b]...ST(\x1b\\)
  result = result.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');

  // 移除可能残留的 OSC 片段（如 ]0; 或 ]1; 等）
  result = result.replace(/\][0-9];[^\x07\x1b]*/g, '');

  // 移除 DCS 序列: \x1bP... ST
  result = result.replace(/\x1bP[^\x1b]*\x1b\\/g, '');

  // 移除 CSI 私有模式序列 (如 ?2004h 括号粘贴模式)
  result = result.replace(/\x1b\[\?[0-9;]*[A-Za-z]/g, '');

  // 移除其他 CSI 序列但保留 SGR (颜色)
  result = result.replace(/\x1b\[[0-9;]*[A-Za-df-zA-Z]/g, '');

  // 移除单个控制字符
  result = result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  // 处理回车符 - 只保留最后的回车效果
  result = result.replace(/\r+(?=[^\r\n])/g, '');

  // 移除单独的 BEL 字符
  result = result.replace(/\x07/g, '');

  return result;
}

/**
 * 解析 ANSI 转义序列，返回带样式的文本段
 */
export function parseAnsi(text: string): TextSegment[] {
  // 先清理不需要的控制序列
  const cleanedText = cleanTerminalOutput(text);

  const state: ParseState = {
    segments: [],
    currentStyle: {},
    currentText: '',
  };

  // ANSI 转义序列正则 - 只匹配 SGR 序列
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let match;

  while ((match = ansiRegex.exec(cleanedText)) !== null) {
    // 添加转义序列前的普通文本
    if (match.index > lastIndex) {
      state.currentText += cleanedText.slice(lastIndex, match.index);
    }

    const params = match[1] ? match[1].split(';').map(Number).filter(n => !isNaN(n)) : [];

    // SGR - 样式控制
    if (state.currentText) {
      state.segments.push({
        text: state.currentText,
        style: Object.keys(state.currentStyle).length > 0 ? state.currentStyle : undefined,
      });
      state.currentText = '';
    }
    state.currentStyle = parseSGR(params, state.currentStyle);

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < cleanedText.length) {
    state.currentText += cleanedText.slice(lastIndex);
  }

  // 添加最后的文本段
  if (state.currentText) {
    state.segments.push({
      text: state.currentText,
      style: Object.keys(state.currentStyle).length > 0 ? state.currentStyle : undefined,
    });
  }

  return state.segments.length > 0 ? state.segments : [{ text: '' }];
}

/**
 * 渲染带 ANSI 样式的文本
 */
export function renderAnsiText(segments: TextSegment[], keyPrefix: string = ''): React.ReactNode {
  return segments.map((segment, index) => {
    if (segment.style) {
      return React.createElement('span', {
        key: `${keyPrefix}-${index}`,
        style: segment.style
      }, segment.text);
    }
    return React.createElement('span', { key: `${keyPrefix}-${index}` }, segment.text);
  });
}

/**
 * 从终端输出中提取提示符
 */
export function extractPrompt(text: string): string | null {
  // 先清理控制序列
  const cleaned = cleanTerminalOutput(text);

  // 匹配常见的提示符格式
  // 格式: (conda_env) user@host:path#$ 或 user@host:path#$
  // 注意：(conda_env) 和用户名之间可能有换行
  const promptPatterns = [
    // conda 环境提示符: (base)[可能换行]user@host:path#$
    /[\r\n]*\([^)]+\)[\s\r\n]*[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^#$\n]*[#$]\s*$/,
    // 普通提示符: user@host:path#$
    /[\r\n]*[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^#$\n]*[#$]\s*$/,
    // 带括号的提示符: [xxx]#$
    /[\r\n]*\[[^\]]+\][#$]\s*$/,
    // 简单提示符: #$
    /[\r\n]*[#$]\s*$/,
  ];

  for (const pattern of promptPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      // 返回清理后的提示符，将多个空白/换行合并为单个空格
      return match[0].trim().replace(/[\s\r\n]+/g, ' ');
    }
  }

  return null;
}

/**
 * 从终端输出中移除末尾的提示符
 */
export function removeTrailingPrompt(text: string): string {
  // 先清理控制序列
  let cleaned = cleanTerminalOutput(text);

  // 匹配末尾的提示符并移除（包括 conda 环境前缀）
  // 注意：(conda_env) 和用户名之间可能有换行
  const promptPatterns = [
    // conda 环境提示符: (base)[可能换行]user@host:path#$
    /\([^)]+\)[\s\r\n]*[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^#$\n]*[#$]\s*$/,
    // 单独的 conda 环境前缀行: (base)
    /^\([^)]+\)[\s\r\n]*$/,
    // 普通提示符: user@host:path#$
    /[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+:[^#$\n]*[#$]\s*$/,
    // 带括号的提示符: [xxx]#$
    /\[[^\]]+\][#$]\s*$/,
    // 简单提示符: #$
    /[#$]\s*$/,
  ];

  for (const pattern of promptPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * 检查文本是否只包含控制序列（无可显示内容）
 */
export function isOnlyControlSequences(text: string): boolean {
  const cleaned = cleanTerminalOutput(text);
  return cleaned.trim().length === 0;
}