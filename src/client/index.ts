import type { McpClient } from '../transport/mcp-client.js';
import { MemoryCache } from '../cache/memory-cache.js';
import { Logger } from '../utils/logger.js';
import { SearchClient } from './search.js';
import { ReadClient } from './read.js';
import { WriteClient } from './write.js';
import { PdfClient } from './pdf.js';
import type { McpToolResult, ObjectType, SearchableObjectType } from '../types/official-tools.js';

export class HeptabaseClient {
  private searchClient: SearchClient;
  private readClient: ReadClient;
  private writeClient: WriteClient;
  private pdfClient: PdfClient;
  public readonly cache: MemoryCache;
  public readonly logger: Logger;

  constructor(mcp: McpClient, cache?: MemoryCache, clientLogger?: Logger) {
    this.cache = cache ?? new MemoryCache();
    this.logger = clientLogger ?? new Logger();
    this.searchClient = new SearchClient(mcp, this.cache, this.logger);
    this.readClient = new ReadClient(mcp, this.cache, this.logger);
    this.writeClient = new WriteClient(mcp, this.cache, this.logger);
    this.pdfClient = new PdfClient(mcp, this.cache, this.logger);
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

  async getJournalRange(startDate: string, endDate: string): Promise<McpToolResult> {
    return this.readClient.getJournalRange(startDate, endDate);
  }

  async saveToNoteCard(content: string): Promise<McpToolResult> {
    return this.writeClient.saveToNoteCard(content);
  }

  async appendToJournal(content: string): Promise<McpToolResult> {
    return this.writeClient.appendToJournal(content);
  }

  async searchPdfContent(pdfCardId: string, keywords: string[]): Promise<McpToolResult> {
    return this.pdfClient.searchPdfContent(pdfCardId, keywords);
  }

  async getPdfPages(pdfCardId: string, startPage: number, endPage: number): Promise<McpToolResult> {
    return this.pdfClient.getPdfPages(pdfCardId, startPage, endPage);
  }
}
