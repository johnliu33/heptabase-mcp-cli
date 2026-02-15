import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { SemanticSearchOutput, SearchWhiteboardsOutput } from '../types/official-tools.js';

export class SearchClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async semanticSearch(query: string): Promise<SemanticSearchOutput> {
    const cacheKey = this.cache.buildKey('semantic_search', { query });
    const cached = this.cache.get<SemanticSearchOutput>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('semantic_search_objects', { query });
    const parsed = result as SemanticSearchOutput;

    this.cache.set(cacheKey, parsed, 60); // 60 秒 TTL
    return parsed;
  }

  async searchWhiteboards(query: string): Promise<SearchWhiteboardsOutput> {
    const cacheKey = this.cache.buildKey('search_whiteboards', { query });
    const cached = this.cache.get<SearchWhiteboardsOutput>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('search_whiteboards', { query });
    const parsed = result as SearchWhiteboardsOutput;

    this.cache.set(cacheKey, parsed, 300);
    return parsed;
  }
}
