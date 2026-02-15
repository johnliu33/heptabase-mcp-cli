import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { whiteboardDeepDive } from '../../src/workflows/whiteboard-deep-dive.js';
import { pdfResearch } from '../../src/workflows/pdf-research.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('E2E Mock Integration', () => {
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

  it('E2E-01: searchWhiteboards → getWhiteboard → getObject → saveToNoteCard 完整串接', async () => {
    // 1. search_whiteboards
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: '<whiteboard id="wb-e2e" title="E2E 白板"></whiteboard>',
      }],
    }));

    // 2. get_whiteboard_with_objects
    mockMcp.onTool('get_whiteboard_with_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-e2e" title="E2E 白板">',
          '<card id="c-e2e-1" type="card" title="E2E 卡片1">',
          '<partial_content>部分內容</partial_content>',
          '</card>',
          '<card id="c-e2e-2" type="card" title="E2E 卡片2">',
          '<partial_content>部分內容2</partial_content>',
          '</card>',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    // 3. get_object
    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}" title="完整">E2E 完整內容 ${args.objectId}</card>`,
      }],
    }));

    // 4. save_to_note_card
    mockMcp.onTool('save_to_note_card', () => ({
      content: [{
        type: 'text',
        text: '<card id="new-card-1">已儲存</card>',
      }],
    }));

    // 執行 workflow
    const wbResult = await whiteboardDeepDive(client, { query: 'E2E' });

    // 驗證 workflow 結果
    expect(wbResult.whiteboard_name).toBe('E2E 白板');
    expect(wbResult.total_objects).toBe(2);
    expect(wbResult.objects).toHaveLength(2);
    expect(wbResult.objects[0].content_status).toBe('ok');
    expect(wbResult.objects[1].content_status).toBe('ok');

    // 繼續串接：將結果存回
    const summary = `# E2E Summary\n\n白板 ${wbResult.whiteboard_name} 共 ${wbResult.total_objects} 個物件`;
    const saveResult = await client.saveToNoteCard(summary);

    // 驗證完整呼叫鏈
    const callNames = mockMcp.callLog.map(c => c.name);
    expect(callNames).toContain('search_whiteboards');
    expect(callNames).toContain('get_whiteboard_with_objects');
    expect(callNames).toContain('get_object');
    expect(callNames).toContain('save_to_note_card');

    // 驗證 save 結果
    expect(saveResult.content[0].text).toContain('已儲存');
  });

  it('E2E-02: semanticSearch → searchPdfContent → getPdfPages 完整串接', async () => {
    // 1. semantic_search_objects
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<pdfCard id="pdf-e2e" title="E2E 論文.pdf"></pdfCard>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    // 2. search_pdf_content
    mockMcp.onTool('search_pdf_content', () => ({
      content: [{
        type: 'text',
        text: [
          '<chunk index=0>page 1 相關內容</chunk>',
          '<chunk index=1>page 3 相關內容</chunk>',
        ].join('\n'),
      }],
    }));

    // 3. get_pdf_pages
    mockMcp.onTool('get_pdf_pages', (args) => ({
      content: [{
        type: 'text',
        text: `<page start=${args.startPage} end=${args.endPage}>PDF 全文 p${args.startPage}-${args.endPage}</page>`,
      }],
    }));

    // 執行 workflow
    const result = await pdfResearch(client, { topic: 'E2E test topic' });

    // 驗證結果
    expect(result.pdf_title).toBe('E2E 論文.pdf');
    expect(result.source_chunks_count).toBe(2);
    expect(result.relevant_pages).toContain(1);
    expect(result.relevant_pages).toContain(3);

    // 驗證呼叫鏈
    const callNames = mockMcp.callLog.map(c => c.name);
    expect(callNames[0]).toBe('semantic_search_objects');
    expect(callNames[1]).toBe('search_pdf_content');
    expect(callNames).toContain('get_pdf_pages');
  });
});

// 真實 E2E 測試（需要 HEPTABASE_TEST_TOKEN）
describe.skipIf(!process.env.HEPTABASE_TEST_TOKEN)('E2E Real Integration', () => {
  it('should connect and search with real token', async () => {
    // 預留：使用真實 token 測試
    // const tokenManager = new TokenManager();
    // const mcp = createMcpClient(tokenManager);
    // const client = new HeptabaseClient(mcp);
    // const result = await client.semanticSearch(['test']);
    // expect(result.content).toBeDefined();
  });
});
