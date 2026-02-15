import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { Logger } from '../../src/utils/logger.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

const whiteboardResult = {
  content: [
    {
      type: 'text',
      text: '<whiteboard id="wb-1" title="專案白板">\n<card id="card-1" type="card" title="需求分析">\n<partial_content>這張卡片討論了...</partial_content>\n</card>\n</whiteboard>',
    },
  ],
};

describe('get_whiteboard_with_objects', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    client = new HeptabaseClient(mockMcp as unknown as McpClient, new MemoryCache(), testLogger);
  });

  it('CT-03: 回傳的內容應包含 partial_content 而非完整內容', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => whiteboardResult);

    const result = await client.getWhiteboard('wb-1');

    expect(result.content[0].text).toContain('partial_content');
    expect(result.content[0].text).toContain('專案白板');
  });

  it('CT-03 supplement: 應正確傳遞 whiteboardId（camelCase）', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => whiteboardResult);

    await client.getWhiteboard('wb-1');

    expect(mockMcp.callLog[0].args).toEqual({ whiteboardId: 'wb-1' });
  });
});

describe('get_object', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    client = new HeptabaseClient(mockMcp as unknown as McpClient, new MemoryCache(), testLogger);
  });

  it('CT-04: hasMore 標記時應記錄 warning', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [
        {
          type: 'text',
          text: '<card id="card-big" title="大型筆記" hasMore>\n前半段內容...\n</card>',
        },
      ],
    }));

    await client.getObject('card-big', 'card');

    expect(testLogger.warnings).toContainEqual(
      expect.stringContaining('card-big'),
    );
  });

  it('CT-04 supplement: 無 hasMore 時不應記錄 warning', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [
        {
          type: 'text',
          text: '<card id="card-normal" title="普通筆記">\n完整內容\n</card>',
        },
      ],
    }));

    await client.getObject('card-normal', 'card');

    expect(testLogger.warnings).toHaveLength(0);
  });

  it('CT-05: pdfCard 且 hasMore 應觸發 PDF 流程建議', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [
        {
          type: 'text',
          text: '<pdfCard id="pdf-1" title="大型報告.pdf" hasMore>\n</pdfCard>',
        },
      ],
    }));

    await client.getObject('pdf-1', 'pdfCard');

    expect(testLogger.warnings).toContainEqual(
      expect.stringContaining('建議使用 search_pdf_content'),
    );
  });

  it('CT-05 supplement: pdfCard 無 hasMore 不應觸發 PDF 警告', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [
        {
          type: 'text',
          text: '<pdfCard id="pdf-small" title="小型PDF.pdf">\nSmall content\n</pdfCard>',
        },
      ],
    }));

    await client.getObject('pdf-small', 'pdfCard');

    const pdfWarnings = testLogger.warnings.filter(w => w.includes('search_pdf_content'));
    expect(pdfWarnings).toHaveLength(0);
  });

  it('CT-04/05 supplement: 應正確傳遞 objectId 和 objectType', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [{ type: 'text', text: '<card id="c-1">content</card>' }],
    }));

    await client.getObject('c-1', 'card');

    expect(mockMcp.callLog[0].args).toEqual({ objectId: 'c-1', objectType: 'card' });
  });

  it('CT-04/05 supplement: 結果應被快取', async () => {
    mockMcp.onTool('get_object', () => ({
      content: [{ type: 'text', text: '<card id="c-1">content</card>' }],
    }));

    await client.getObject('c-1', 'card');
    await client.getObject('c-1', 'card');

    expect(mockMcp.callLog).toHaveLength(1);
  });
});
