import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { McpToolResult, ObjectType } from '../types/official-tools.js';

export class ReadClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async getWhiteboard(whiteboardId: string): Promise<McpToolResult> {
    const cacheKey = this.cache.buildKey('get_whiteboard', { whiteboardId });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_whiteboard_with_objects', {
      whiteboardId,
    });
    const parsed = result as McpToolResult;

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }

  async getObject(objectId: string, objectType: ObjectType): Promise<McpToolResult> {
    const cacheKey = this.cache.buildKey('get_object', { objectId, objectType });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_object', { objectId, objectType });
    const parsed = result as McpToolResult;

    // 檢查回傳文字中是否含有 hasMore 標記
    const text = this.extractText(parsed);
    if (text.includes('hasMore')) {
      this.logger.warn(`物件 ${objectId} 內容不完整，hasMore=true`);

      if (objectType === 'pdfCard') {
        this.logger.warn(
          `物件 ${objectId} 是 PDF 且內容不完整，建議使用 search_pdf_content + get_pdf_pages 讀取 PDF`,
        );
      }
    }

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }

  async getJournalRange(startDate: string, endDate: string): Promise<McpToolResult> {
    const cacheKey = this.cache.buildKey('get_journal_range', { startDate, endDate });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_journal_range', { startDate, endDate });
    const parsed = result as McpToolResult;

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }

  private extractText(result: McpToolResult): string {
    if (!result.content) return '';
    return result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
}
