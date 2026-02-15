import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { orphanDetection } from '../../src/workflows/orphan-detection.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('orphanDetection', () => {
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

  it('WT-06: search_whiteboards → get_whiteboard × N → semantic_search_objects，驗證差集', async () => {
    // search_whiteboards 回傳 2 個白板
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: [
          '<whiteboard id="wb-1" title="白板A">',
          '</whiteboard>',
          '<whiteboard id="wb-2" title="白板B">',
          '</whiteboard>',
        ].join('\n'),
      }],
    }));

    // get_whiteboard_with_objects 回傳各白板的物件
    mockMcp.onTool('get_whiteboard_with_objects', (args) => {
      if (args.whiteboardId === 'wb-1') {
        return {
          content: [{
            type: 'text',
            text: [
              '<whiteboard id="wb-1" title="白板A">',
              '<card id="c-1" type="card" title="卡片1"></card>',
              '<card id="c-2" type="card" title="卡片2"></card>',
              '</whiteboard>',
            ].join('\n'),
          }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: [
            '<whiteboard id="wb-2" title="白板B">',
            '<card id="c-3" type="card" title="卡片3"></card>',
            '</whiteboard>',
          ].join('\n'),
        }],
      };
    });

    // semantic_search_objects 回傳 4 個物件（c-1, c-2, c-3 在白板上，c-4 不在）
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<card id="c-1" title="卡片1"></card>',
          '<card id="c-2" title="卡片2"></card>',
          '<card id="c-3" title="卡片3"></card>',
          '<card id="c-4" title="孤立卡片"></card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    const result = await orphanDetection(client, { query: 'test' });

    // 驗證呼叫鏈
    expect(mockMcp.callLog[0].name).toBe('search_whiteboards');
    const wbCalls = mockMcp.callLog.filter(c => c.name === 'get_whiteboard_with_objects');
    expect(wbCalls).toHaveLength(2);
    const searchCalls = mockMcp.callLog.filter(c => c.name === 'semantic_search_objects');
    expect(searchCalls).toHaveLength(1);

    // 驗證結果
    expect(result.total_whiteboards).toBe(2);
    expect(result.total_whiteboard_objects).toBe(3); // c-1, c-2, c-3
    expect(result.orphan_candidates).toHaveLength(1);
    expect(result.orphan_candidates[0].id).toBe('c-4');
    expect(result.orphan_candidates[0].title).toBe('孤立卡片');
  });

  it('WT-06: 無白板時所有搜尋結果都是孤立候選', async () => {
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: '<searchResult totalResults=0></searchResult>',
      }],
    }));

    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<card id="c-1" title="筆記1"></card>',
          '<card id="c-2" title="筆記2"></card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    const result = await orphanDetection(client, {});

    expect(result.total_whiteboards).toBe(0);
    expect(result.total_whiteboard_objects).toBe(0);
    expect(result.orphan_candidates).toHaveLength(2);
  });

  it('WT-06: 白板取得失敗應容錯跳過', async () => {
    mockMcp.onTool('search_whiteboards', () => ({
      content: [{
        type: 'text',
        text: '<whiteboard id="wb-fail" title="失敗白板"></whiteboard>',
      }],
    }));

    mockMcp.onTool('get_whiteboard_with_objects', () => {
      throw new Error('模擬白板取得失敗');
    });

    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: '<searchResult><card id="c-1" title="筆記"></card></searchResult>',
      }],
    }));

    const result = await orphanDetection(client, {});

    expect(result.total_whiteboards).toBe(1);
    expect(result.total_whiteboard_objects).toBe(0);
    // 白板取得失敗，所以所有搜尋結果都是孤立候選
    expect(result.orphan_candidates).toHaveLength(1);
  });
});
