import type { McpToolResult } from '../types/official-tools.js';

export function extractText(result: McpToolResult): string {
  if (!result.content) return '';
  return result.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}
