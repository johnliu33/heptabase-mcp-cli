import type { HeptabaseClient } from '../client/index.js';
import type { PdfResearchInput, PdfResearchOutput } from '../types/workflows.js';
import { extractText } from '../utils/mcp-result.js';
import {
  parseSearchObjects,
  parseChunkPageNumbers,
  countChunks,
} from './parsers.js';

/**
 * 將連續頁碼合併為 [start, end] 區間
 * 例如 [1, 2, 3, 7, 8] → [[1, 3], [7, 8]]
 */
function mergePageRanges(pages: number[]): Array<[number, number]> {
  if (pages.length === 0) return [];
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [[sorted[0], sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const last = ranges[ranges.length - 1];
    if (sorted[i] === last[1] + 1) {
      last[1] = sorted[i];
    } else {
      ranges.push([sorted[i], sorted[i]]);
    }
  }
  return ranges;
}

export async function pdfResearch(
  client: HeptabaseClient,
  input: PdfResearchInput,
): Promise<PdfResearchOutput> {
  let pdfId: string;
  let pdfTitle: string;

  // 1. 取得 PDF ID
  if (input.pdf_id) {
    pdfId = input.pdf_id;
    pdfTitle = input.pdf_id; // 預設名稱
  } else {
    // 語意搜尋找 PDF
    const searchResult = await client.semanticSearch([input.topic], ['pdfCard']);
    const objects = parseSearchObjects(searchResult);
    const pdfObj = objects.find(o => o.type === 'pdfCard' || o.type === 'pdf');
    if (!pdfObj) {
      return {
        pdf_title: '',
        relevant_pages: [],
        page_contents: '',
        source_chunks_count: 0,
      };
    }
    pdfId = pdfObj.id;
    pdfTitle = pdfObj.title;
  }

  // 2. 搜尋 PDF 內容取得相關 chunks
  const topicKeywords = input.topic.split(/\s+/).slice(0, 5); // 最多 5 個關鍵字
  const chunkResult = await client.searchPdfContent(pdfId, topicKeywords);
  const relevantPages = parseChunkPageNumbers(chunkResult);
  const sourceChunksCount = countChunks(chunkResult);

  // 3. 取得頁面全文
  let pageContents = '';
  if (relevantPages.length > 0) {
    const ranges = mergePageRanges(relevantPages);
    const parts: string[] = [];
    for (const [start, end] of ranges) {
      const pageResult = await client.getPdfPages(pdfId, start, end);
      parts.push(extractText(pageResult));
    }
    pageContents = parts.join('\n\n');
  }

  return {
    pdf_title: pdfTitle,
    relevant_pages: relevantPages,
    page_contents: pageContents,
    source_chunks_count: sourceChunksCount,
  };
}
