import type { McpClient } from '../transport/mcp-client.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { Logger } from '../utils/logger.js';
import { SearchClient } from './search.js';
import { ReadClient } from './read.js';
import type { SemanticSearchOutput, SearchWhiteboardsOutput, GetWhiteboardOutput, GetObjectOutput } from '../types/official-tools.js';

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

  async semanticSearch(query: string): Promise<SemanticSearchOutput> {
    return this.searchClient.semanticSearch(query);
  }

  async searchWhiteboards(query: string): Promise<SearchWhiteboardsOutput> {
    return this.searchClient.searchWhiteboards(query);
  }

  async getWhiteboard(whiteboardId: string): Promise<GetWhiteboardOutput> {
    return this.readClient.getWhiteboard(whiteboardId);
  }

  async getObject(objectId: string): Promise<GetObjectOutput> {
    return this.readClient.getObject(objectId);
  }
}
