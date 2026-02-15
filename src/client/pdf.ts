import type { McpClient } from '../transport/mcp-client.js';
import type { MemoryCache } from '../cache/memory-cache.js';
import type { Logger } from '../utils/logger.js';
import type { McpToolResult } from '../types/official-tools.js';
import { extractText } from '../utils/mcp-result.js';

const PDF_CACHE_TTL = 300; // 5 minutes — PDF content is static
const MAX_KEYWORDS = 5;
const CHUNK_WARN_THRESHOLD = 80;

export class PdfClient {
  constructor(
    private mcp: McpClient,
    private cache: MemoryCache,
    private logger: Logger,
  ) {}

  async searchPdfContent(pdfCardId: string, keywords: string[]): Promise<McpToolResult> {
    if (keywords.length < 1 || keywords.length > MAX_KEYWORDS) {
      throw new Error(`keywords 數量須為 1-${MAX_KEYWORDS} 個，目前 ${keywords.length} 個`);
    }

    const cacheKey = this.cache.buildKey('search_pdf_content', { pdfCardId, keywords });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('search_pdf_content', { pdfCardId, keywords });
    const parsed = result as McpToolResult;

    // 檢查 chunk 數量是否達到上限
    const text = extractText(parsed);
    const chunkCount = (text.match(/<chunk /g) || []).length;
    if (chunkCount >= CHUNK_WARN_THRESHOLD) {
      this.logger.warn(
        `PDF ${pdfCardId} 搜尋結果達 ${chunkCount} chunks（上限 ${CHUNK_WARN_THRESHOLD}），部分結果可能被截斷`,
      );
    }

    this.cache.set(cacheKey, parsed, PDF_CACHE_TTL);
    return parsed;
  }

  async getPdfPages(
    pdfCardId: string,
    startPage: number,
    endPage: number,
  ): Promise<McpToolResult> {
    if (startPage < 1) {
      throw new Error(`startPage 必須 >= 1，目前為 ${startPage}`);
    }
    if (endPage < startPage) {
      throw new Error(`endPage (${endPage}) 不可小於 startPage (${startPage})`);
    }

    const cacheKey = this.cache.buildKey('get_pdf_pages', { pdfCardId, startPage, endPage });
    const cached = this.cache.get<McpToolResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    const result = await this.mcp.callTool('get_pdf_pages', { pdfCardId, startPage, endPage });
    const parsed = result as McpToolResult;

    this.cache.set(cacheKey, parsed, PDF_CACHE_TTL);
    return parsed;
  }
}
