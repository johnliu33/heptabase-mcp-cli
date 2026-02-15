import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { whiteboardDeepDive } from '../../src/workflows/whiteboard-deep-dive.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('whiteboardDeepDive', () => {
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

  it('WT-01: 呼叫順序 search_whiteboards → get_whiteboard_with_objects → get_object × N', async () => {
    // search_whiteboards 回傳白板
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: '<whiteboard id="wb-1" title="專案白板">\n</whiteboard>',
      }],
    }));

    // get_whiteboard_with_objects 回傳含 2 個 card 的白板
    mockMcp.onTool('get_whiteboard_with_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-1" title="專案白板">',
          '<card id="c-1" type="card" title="需求分析">',
          '<partial_content>部分內容1</partial_content>',
          '</card>',
          '<card id="c-2" type="card" title="設計文件">',
          '<partial_content>部分內容2</partial_content>',
          '</card>',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    // get_object 回傳各自內容
    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}" title="物件內容">完整內容 for ${args.objectId}</card>`,
      }],
    }));

    const result = await whiteboardDeepDive(client, { query: '專案' });

    // 驗證呼叫順序
    expect(mockMcp.callLog[0].name).toBe('search_whiteboards');
    expect(mockMcp.callLog[1].name).toBe('get_whiteboard_with_objects');
    expect(mockMcp.callLog[2].name).toBe('get_object');
    expect(mockMcp.callLog[3].name).toBe('get_object');

    // 驗證結果
    expect(result.whiteboard_name).toBe('專案白板');
    expect(result.total_objects).toBe(2);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].content_status).toBe('ok');
    expect(result.objects[1].content_status).toBe('ok');
  });

  it('WT-02: 白板含 pdfCard 時，不應呼叫 get_object，改用 search_pdf_content', async () => {
    // get_whiteboard_with_objects 回傳含 1 card + 1 pdfCard
    mockMcp.onTool('get_whiteboard_with_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-2" title="研究白板">',
          '<card id="c-1" type="card" title="筆記">',
          '<partial_content>筆記內容</partial_content>',
          '</card>',
          '<card id="pdf-1" type="pdfCard" title="論文.pdf">',
          '<partial_content>PDF 摘要</partial_content>',
          '</card>',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}" title="筆記">完整筆記內容</card>`,
      }],
    }));

    mockMcp.onTool('search_pdf_content', () => ({
      content: [{
        type: 'text',
        text: '<chunk index=0>PDF 搜尋結果 page 1</chunk>',
      }],
    }));

    const result = await whiteboardDeepDive(client, { whiteboard_id: 'wb-2' });

    // 驗證 get_object 只被呼叫 1 次（card），不包含 pdfCard
    const getObjectCalls = mockMcp.callLog.filter(c => c.name === 'get_object');
    expect(getObjectCalls).toHaveLength(1);
    expect(getObjectCalls[0].args.objectId).toBe('c-1');

    // 驗證 search_pdf_content 被呼叫（處理 pdfCard）
    const pdfCalls = mockMcp.callLog.filter(c => c.name === 'search_pdf_content');
    expect(pdfCalls).toHaveLength(1);
    expect(pdfCalls[0].args.pdfCardId).toBe('pdf-1');

    // 結果應包含兩個物件
    expect(result.total_objects).toBe(2);
    expect(result.objects).toHaveLength(2);
  });

  it('WT-01 supplement: 個別物件取得失敗應標記 skipped', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-3" title="測試白板">',
          '<card id="c-ok" type="card" title="正常卡片">',
          '<partial_content>正常</partial_content>',
          '</card>',
          '<card id="c-fail" type="card" title="失敗卡片">',
          '<partial_content>失敗</partial_content>',
          '</card>',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    let callCount = 0;
    mockMcp.onTool('get_object', () => {
      callCount++;
      if (callCount === 2) throw new Error('模擬失敗');
      return {
        content: [{ type: 'text', text: '<card id="c-ok">完整內容</card>' }],
      };
    });

    const result = await whiteboardDeepDive(client, { whiteboard_id: 'wb-3' });

    expect(result.objects[0].content_status).toBe('ok');
    expect(result.objects[1].content_status).toBe('skipped');
  });

  it('WT-01 supplement: 搜尋無結果應回傳空', async () => {
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: '<searchResult totalResults=0></searchResult>',
      }],
    }));

    const result = await whiteboardDeepDive(client, { query: '不存在' });

    expect(result.whiteboard_name).toBe('');
    expect(result.total_objects).toBe(0);
    expect(result.objects).toHaveLength(0);
  });

  it('WT-01 supplement: hasMore 的物件應記錄在 incomplete_objects', async () => {
    mockMcp.onTool('get_whiteboard_with_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-4" title="大型白板">',
          '<card id="c-big" type="card" title="大型筆記">',
          '<partial_content>部分</partial_content>',
          '</card>',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    mockMcp.onTool('get_object', () => ({
      content: [{
        type: 'text',
        text: '<card id="c-big" title="大型筆記" hasMore>部分內容...</card>',
      }],
    }));

    const result = await whiteboardDeepDive(client, { whiteboard_id: 'wb-4' });

    expect(result.incomplete_objects).toContain('c-big');
  });
});
