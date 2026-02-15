import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { McpToolResult } from '../types/official-tools.js';

export class WriteClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async saveToNoteCard(content: string): Promise<McpToolResult> {
    const result = await this.mcp.callTool('save_to_note_card', { content });
    const parsed = result as McpToolResult;

    // 寫入後 invalidate 相關讀取快取
    this.cache.invalidate('semantic_search');
    this.cache.invalidate('search_whiteboards');
    this.logger.debug('已 invalidate semantic_search 和 search_whiteboards 快取');

    return parsed;
  }

  async appendToJournal(content: string): Promise<McpToolResult> {
    const result = await this.mcp.callTool('append_to_journal', { content });
    const parsed = result as McpToolResult;

    // 寫入後 invalidate journal 快取
    this.cache.invalidate('get_journal_range');
    this.logger.debug('已 invalidate get_journal_range 快取');

    return parsed;
  }
}
