import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { Logger } from '../../src/utils/logger.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('search_pdf_content', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    client = new HeptabaseClient(mockMcp as unknown as McpClient, new MemoryCache(), testLogger);
  });

  it('CT-09: 80 chunks 上限 — 達 80 時應 warn', async () => {
    // 產生包含 80 個 chunk 的回應
    const chunks = Array.from({ length: 80 }, (_, i) => `<chunk index=${i}>內容${i}</chunk>`).join('\n');
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{ type: 'text', text: chunks }],
    }));

    await client.searchPdfContent('pdf-1', ['關鍵字']);

    expect(testLogger.warnings).toContainEqual(
      expect.stringContaining('80 chunks'),
    );
  });

  it('CT-09 supplement: 低於 80 chunks 不應 warn', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => `<chunk index=${i}>內容${i}</chunk>`).join('\n');
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{ type: 'text', text: chunks }],
    }));

    await client.searchPdfContent('pdf-1', ['關鍵字']);

    const chunkWarnings = testLogger.warnings.filter(w => w.includes('chunks'));
    expect(chunkWarnings).toHaveLength(0);
  });

  it('CT-09 supplement: keywords 數量驗證 — 0 個應拋錯', async () => {
    await expect(client.searchPdfContent('pdf-1', [])).rejects.toThrow('1-5');
  });

  it('CT-09 supplement: keywords 數量驗證 — 6 個應拋錯', async () => {
    await expect(
      client.searchPdfContent('pdf-1', ['a', 'b', 'c', 'd', 'e', 'f']),
    ).rejects.toThrow('1-5');
  });

  it('CT-09 supplement: 應正確傳遞參數', async () => {
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{ type: 'text', text: '<chunk index=0>結果</chunk>' }],
    }));

    await client.searchPdfContent('pdf-abc', ['key1', 'key2']);

    expect(mockMcp.callLog[0].name).toBe('search_pdf_content');
    expect(mockMcp.callLog[0].args).toEqual({
      pdfCardId: 'pdf-abc',
      keywords: ['key1', 'key2'],
    });
  });

  it('CT-09 supplement: 結果應被快取', async () => {
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{ type: 'text', text: '<chunk index=0>結果</chunk>' }],
    }));

    await client.searchPdfContent('pdf-1', ['key']);
    await client.searchPdfContent('pdf-1', ['key']);

    expect(mockMcp.callLog).toHaveLength(1);
  });
});

describe('get_pdf_pages', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    client = new HeptabaseClient(mockMcp as unknown as McpClient, new MemoryCache(), testLogger);
  });

  it('CT-10: 頁碼 0 應被拒絕', async () => {
    await expect(client.getPdfPages('pdf-1', 0, 5)).rejects.toThrow('startPage 必須 >= 1');
  });

  it('CT-10 supplement: 合法頁碼應通過', async () => {
    mockMcp.onTool('get_pdf_pages', () => ({
      content: [{ type: 'text', text: '<page number=1>第一頁內容</page>' }],
    }));

    const result = await client.getPdfPages('pdf-1', 1, 3);
    expect(result.content[0].text).toContain('第一頁內容');
  });

  it('CT-10 supplement: endPage < startPage 應被拒絕', async () => {
    await expect(client.getPdfPages('pdf-1', 5, 3)).rejects.toThrow('不可小於 startPage');
  });

  it('CT-10 supplement: 應正確傳遞參數', async () => {
    mockMcp.onTool('get_pdf_pages', () => ({
      content: [{ type: 'text', text: '<page>content</page>' }],
    }));

    await client.getPdfPages('pdf-abc', 2, 5);

    expect(mockMcp.callLog[0].name).toBe('get_pdf_pages');
    expect(mockMcp.callLog[0].args).toEqual({
      pdfCardId: 'pdf-abc',
      startPage: 2,
      endPage: 5,
    });
  });

  it('CT-10 supplement: 結果應被快取', async () => {
    mockMcp.onTool('get_pdf_pages', () => ({
      content: [{ type: 'text', text: '<page>content</page>' }],
    }));

    await client.getPdfPages('pdf-1', 1, 3);
    await client.getPdfPages('pdf-1', 1, 3);

    expect(mockMcp.callLog).toHaveLength(1);
  });
});
