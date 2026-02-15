import type { McpToolResult } from '../types/official-tools.js';
import { extractText } from '../utils/mcp-result.js';

export interface ParsedWhiteboard {
  id: string;
  name: string;
}

export interface ParsedObject {
  id: string;
  type: string;
  title: string;
}

export interface ParsedSearchObject {
  id: string;
  title: string;
  type: string;
}

/**
 * 從 search_whiteboards 結果解析白板 id/name
 * 格式: <whiteboard id="wb-1" title="...">
 */
export function parseWhiteboardSearchResult(result: McpToolResult): ParsedWhiteboard[] {
  const text = extractText(result);
  const whiteboards: ParsedWhiteboard[] = [];
  const regex = /<whiteboard\s+id="([^"]+)"\s+title="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    whiteboards.push({ id: match[1], name: match[2] });
  }
  return whiteboards;
}

/**
 * 從 get_whiteboard_with_objects 結果解析物件清單
 * 格式: <card id="c-1" type="card" title="...">
 */
export function parseWhiteboardObjects(result: McpToolResult): ParsedObject[] {
  const text = extractText(result);
  const objects: ParsedObject[] = [];
  const regex = /<(\w+)\s+id="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    objects.push({ id: match[2], type: match[3], title: match[4] });
  }
  return objects;
}

/**
 * 從 semantic_search_objects 結果解析物件清單
 * 格式: <card id="card-1" title="...">（在 <searchResult> 內）
 */
export function parseSearchObjects(result: McpToolResult): ParsedSearchObject[] {
  const text = extractText(result);
  const objects: ParsedSearchObject[] = [];
  // Match tags like <card id="card-1" title="..."> or <pdfCard id="pdf-1" title="...">
  const regex = /<(\w+)\s+id="([^"]+)"\s+title="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1];
    // Skip container tags like searchResult
    if (tag === 'searchResult') continue;
    objects.push({ id: match[2], title: match[3], type: tag });
  }
  return objects;
}

/**
 * 從 search_pdf_content 結果提取去重頁碼
 * chunk 文字中可能包含 page 資訊，格式如 "page 3" 或 "(p.7)"
 */
export function parseChunkPageNumbers(result: McpToolResult): number[] {
  const text = extractText(result);
  const pages = new Set<number>();

  // Match page references in various formats: page 3, p.3, Page 3, p3
  const regex = /(?:page|p\.?)\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    pages.add(parseInt(match[1], 10));
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * 計算 chunk 數量
 * 計算 <chunk 出現次數
 */
export function countChunks(result: McpToolResult): number {
  const text = extractText(result);
  const matches = text.match(/<chunk\b/g);
  return matches ? matches.length : 0;
}

/**
 * 檢查結果是否包含 hasMore 標記
 */
export function hasMoreContent(result: McpToolResult): boolean {
  const text = extractText(result);
  return text.includes('hasMore');
}

/**
 * 判斷是否為 PDF 類型
 */
export function isPdfType(type: string): boolean {
  return type === 'pdfCard' || type === 'pdf';
}
