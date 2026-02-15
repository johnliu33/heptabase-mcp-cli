import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { McpToolResult, SearchableObjectType } from '../types/official-tools.js';

export class SearchClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async semanticSearch(
    queries: string[],
    resultObjectTypes: SearchableObjectType[] = [],
  ): Promise<McpToolResult> {
    const cacheKey = this.cache.buildKey('semantic_search', { queries, resultObjectTypes });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('semantic_search_objects', {
      queries,
      resultObjectTypes,
    });
    const parsed = result as McpToolResult;

    this.cache.set(cacheKey, parsed, 60); // 60 秒 TTL
    return parsed;
  }

  async searchWhiteboards(keywords: string[]): Promise<McpToolResult> {
    const cacheKey = this.cache.buildKey('search_whiteboards', { keywords });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('search_whiteboards', { keywords });
    const parsed = result as McpToolResult;

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }
}
