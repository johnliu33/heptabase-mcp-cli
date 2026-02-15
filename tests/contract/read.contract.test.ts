import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { Logger } from '../../src/utils/logger.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import type { McpClient } from '../../src/transport/mcp-client.js';
import whiteboardFixture from '../fixtures/whiteboard.json';

describe('get_whiteboard_with_objects', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    client = new HeptabaseClient(mockMcp as unknown as McpClient, new MemoryCache(), testLogger);
  });

  it('CT-03: 回傳的物件應包含 partial_content 而非完整內容', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => whiteboardFixture);

    const result = await client.getWhiteboard('wb-1');

    expect(result.whiteboard.objects[0]).toHaveProperty('partial_content');
    expect(result.whiteboard.objects[0]).not.toHaveProperty('content');
    expect(result.whiteboard.name).toBe('專案白板');
    expect(result.whiteboard.objects).toHaveLength(2);
  });

  it('CT-03 supplement: 應正確傳遞 whiteboard_id', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => whiteboardFixture);

    await client.getWhiteboard('wb-1');

    expect(mockMcp.callLog[0].args).toEqual({ whiteboard_id: 'wb-1' });
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

  it('CT-04: hasMore=true 時應標記內容不完整並記錄 warning', async () => {
    mockMcp.onTool('get_object', () => ({
      object: {
        id: 'card-big',
        type: 'card',
        title: '大型筆記',
        content: '前半段內容...',
        hasMore: true,
      },
    }));

    const result = await client.getObject('card-big');

    expect(result.object.hasMore).toBe(true);
    expect(testLogger.warnings).toContainEqual(
      expect.stringContaining('card-big'),
    );
  });

  it('CT-04 supplement: hasMore=false 時不應記錄 warning', async () => {
    mockMcp.onTool('get_object', () => ({
      object: {
        id: 'card-normal',
        type: 'card',
        title: '普通筆記',
        content: '完整內容',
        hasMore: false,
      },
    }));

    await client.getObject('card-normal');

    expect(testLogger.warnings).toHaveLength(0);
  });

  it('CT-05: PDF 物件且 hasMore=true 應觸發 PDF 流程建議', async () => {
    mockMcp.onTool('get_object', () => ({
      object: {
        id: 'pdf-1',
        type: 'pdf',
        title: '大型報告.pdf',
        content: '',
        hasMore: true,
      },
    }));

    await client.getObject('pdf-1');

    expect(testLogger.warnings).toContainEqual(
      expect.stringContaining('建議使用 search_pdf_content'),
    );
  });

  it('CT-05 supplement: PDF 且 hasMore=false 不應觸發 PDF 警告', async () => {
    mockMcp.onTool('get_object', () => ({
      object: {
        id: 'pdf-small',
        type: 'pdf',
        title: '小型PDF.pdf',
        content: 'Small PDF content',
        hasMore: false,
      },
    }));

    await client.getObject('pdf-small');

    const pdfWarnings = testLogger.warnings.filter(w => w.includes('search_pdf_content'));
    expect(pdfWarnings).toHaveLength(0);
  });

  it('CT-04/05 supplement: 結果應被快取', async () => {
    mockMcp.onTool('get_object', () => ({
      object: {
        id: 'card-1',
        type: 'card',
        title: 'Test',
        content: 'Content',
        hasMore: false,
      },
    }));

    await client.getObject('card-1');
    await client.getObject('card-1');

    expect(mockMcp.callLog).toHaveLength(1);
  });
});
