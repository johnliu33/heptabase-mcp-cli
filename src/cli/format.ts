import type { McpToolResult } from '../types/official-tools.js';

/**
 * 從 MCP tool result 提取文字內容
 */
export function extractText(result: McpToolResult): string {
  if (!result.content) return '（無內容）';
  return result.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}

/**
 * 格式化 MCP tool result 供 CLI 顯示
 */
export function formatResult(result: McpToolResult, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);

  if (result.isError) {
    return `錯誤：${extractText(result)}`;
  }

  return extractText(result);
}
