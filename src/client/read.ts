import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { GetWhiteboardOutput, GetObjectOutput } from '../types/official-tools.js';

export class ReadClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async getWhiteboard(whiteboardId: string): Promise<GetWhiteboardOutput> {
    const cacheKey = this.cache.buildKey('get_whiteboard', { whiteboard_id: whiteboardId });
    const cached = this.cache.get<GetWhiteboardOutput>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_whiteboard_with_objects', {
      whiteboard_id: whiteboardId,
    });
    const parsed = result as GetWhiteboardOutput;

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }

  async getObject(objectId: string): Promise<GetObjectOutput> {
    const cacheKey = this.cache.buildKey('get_object', { object_id: objectId });
    const cached = this.cache.get<GetObjectOutput>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_object', { object_id: objectId });
    const parsed = result as GetObjectOutput;

    if (parsed.object.hasMore) {
      this.logger.warn(`物件 ${objectId} 內容不完整，hasMore=true`);
    }

    if (parsed.object.type === 'pdf' && parsed.object.hasMore) {
      this.logger.warn(
        `物件 ${objectId} 是 PDF 且內容不完整，建議使用 search_pdf_content + get_pdf_pages 讀取 PDF`,
      );
    }

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }
}
