import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { pdfResearch } from '../../src/workflows/pdf-research.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('pdfResearch', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    client = new HeptabaseClient(
      mockMcp as unknown as McpClient,
      new MemoryCache(),
      new Logger('debug'),
    );
  });

  it('WT-03: chunks 頁碼 [3, 3, 7] → relevant_pages = [3, 7]（去重驗證）', async () => {
    // semantic_search_objects 回傳 PDF
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult query="機器學習" totalResults=1 >',
          '<pdfCard id="pdf-ml" title="機器學習論文.pdf" totalChunks=1 >',
          '<chunk index=0 >ML 概述</chunk>',
          '</pdfCard>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    // search_pdf_content 回傳含重複頁碼的 chunks
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{
        type: 'text',
        text: [
          '<chunk index=0>This is on page 3 about neural networks</chunk>',
          '<chunk index=1>More content on page 3 about deep learning</chunk>',
          '<chunk index=2>Discussion on page 7 about training</chunk>',
        ].join('\n'),
      }],
    }));

    // get_pdf_pages 回傳頁面內容
    mockMcp.onTool('get_pdf_pages', (args) => ({
      content: [{
        type: 'text',
        text: `<page range="${args.startPage}-${args.endPage}">頁面內容</page>`,
      }],
    }));

    const result = await pdfResearch(client, { topic: '機器學習' });

    // 去重驗證：[3, 3, 7] → [3, 7]
    expect(result.relevant_pages).toEqual([3, 7]);
    expect(result.source_chunks_count).toBe(3);
    expect(result.pdf_title).toBe('機器學習論文.pdf');

    // 驗證 get_pdf_pages 被呼叫（page 3 和 page 7 是不連續的，應分開呼叫）
    const pageCalls = mockMcp.callLog.filter(c => c.name === 'get_pdf_pages');
    expect(pageCalls).toHaveLength(2);
    expect(pageCalls[0].args).toEqual({ pdfCardId: 'pdf-ml', startPage: 3, endPage: 3 });
    expect(pageCalls[1].args).toEqual({ pdfCardId: 'pdf-ml', startPage: 7, endPage: 7 });
  });

  it('WT-03 supplement: 連續頁碼應合併為 range', async () => {
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{
        type: 'text',
        text: [
          '<chunk index=0>Content on page 1</chunk>',
          '<chunk index=1>Content on page 2</chunk>',
          '<chunk index=2>Content on page 3</chunk>',
          '<chunk index=3>Content on page 5</chunk>',
        ].join('\n'),
      }],
    }));

    mockMcp.onTool('get_pdf_pages', () => ({
      content: [{ type: 'text', text: '頁面內容' }],
    }));

    const result = await pdfResearch(client, { topic: 'test', pdf_id: 'pdf-1' });

    // [1, 2, 3, 5] → ranges: [1,3] and [5,5]
    expect(result.relevant_pages).toEqual([1, 2, 3, 5]);

    const pageCalls = mockMcp.callLog.filter(c => c.name === 'get_pdf_pages');
    expect(pageCalls).toHaveLength(2);
    expect(pageCalls[0].args).toEqual({ pdfCardId: 'pdf-1', startPage: 1, endPage: 3 });
    expect(pageCalls[1].args).toEqual({ pdfCardId: 'pdf-1', startPage: 5, endPage: 5 });
  });

  it('WT-03 supplement: 搜尋無 PDF 結果應回傳空', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: '<searchResult query="不存在" totalResults=0 >\n</searchResult>',
      }],
    }));

    const result = await pdfResearch(client, { topic: '不存在的主題' });

    expect(result.pdf_title).toBe('');
    expect(result.relevant_pages).toEqual([]);
    expect(result.source_chunks_count).toBe(0);
  });

  it('WT-03 supplement: 使用 pdf_id 時不應呼叫 semantic_search', async () => {
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{
        type: 'text',
        text: '<chunk index=0>Content page 5</chunk>',
      }],
    }));

    mockMcp.onTool('get_pdf_pages', () => ({
      content: [{ type: 'text', text: '頁面' }],
    }));

    await pdfResearch(client, { topic: 'AI', pdf_id: 'pdf-known' });

    const searchCalls = mockMcp.callLog.filter(c => c.name === 'semantic_search_objects');
    expect(searchCalls).toHaveLength(0);
  });
});
