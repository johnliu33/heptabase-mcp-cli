import type { McpClient } from '../transport/mcp-client.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { Logger } from '../utils/logger.js';
import { SearchClient } from './search.js';
import { ReadClient } from './read.js';
import type { McpToolResult, ObjectType, SearchableObjectType } from '../types/official-tools.js';

export class HeptabaseClient {
  private searchClient: SearchClient;
  private readClient: ReadClient;
  public readonly cache: MemoryCache;
  public readonly logger: Logger;

  constructor(mcp: McpClient, cache?: MemoryCache, clientLogger?: Logger) {
    this.cache = cache ?? new MemoryCache();
    this.logger = clientLogger ?? new Logger();
    this.searchClient = new SearchClient(mcp, this.cache, this.logger);
    this.readClient = new ReadClient(mcp, this.cache, this.logger);
  }

  async semanticSearch(
    queries: string[],
    resultObjectTypes: SearchableObjectType[] = [],
  ): Promise<McpToolResult> {
    return this.searchClient.semanticSearch(queries, resultObjectTypes);
  }

  async searchWhiteboards(keywords: string[]): Promise<McpToolResult> {
    return this.searchClient.searchWhiteboards(keywords);
  }

  async getWhiteboard(whiteboardId: string): Promise<McpToolResult> {
    return this.readClient.getWhiteboard(whiteboardId);
  }

  async getObject(objectId: string, objectType: ObjectType): Promise<McpToolResult> {
    return this.readClient.getObject(objectId, objectType);
  }
}
