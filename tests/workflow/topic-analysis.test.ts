import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { topicAnalysis } from '../../src/workflows/topic-analysis.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('topicAnalysis', () => {
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

  it('WT-05: semantic_search_objects → get_object × N（並行化）', async () => {
    // semantic_search_objects 回傳 3 個筆記
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<card id="n-1" title="機器學習基礎">',
          '</card>',
          '<card id="n-2" title="深度學習筆記">',
          '</card>',
          '<card id="n-3" title="強化學習概念">',
          '</card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    // get_object 回傳完整內容
    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}" title="內容">完整內容 for ${args.objectId}</card>`,
      }],
    }));

    const result = await topicAnalysis(client, { topic: 'machine learning' });

    // 驗證呼叫鏈
    expect(mockMcp.callLog[0].name).toBe('semantic_search_objects');
    const getObjectCalls = mockMcp.callLog.filter(c => c.name === 'get_object');
    expect(getObjectCalls).toHaveLength(3);

    // 驗證結果
    expect(result.topic).toBe('machine learning');
    expect(result.total_notes).toBe(3);
    expect(result.notes).toHaveLength(3);
    expect(result.notes[0].id).toBe('n-1');
    expect(result.notes[1].id).toBe('n-2');
    expect(result.notes[2].id).toBe('n-3');
  });

  it('WT-05: max_notes 限制結果數量', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<card id="n-1" title="筆記1"></card>',
          '<card id="n-2" title="筆記2"></card>',
          '<card id="n-3" title="筆記3"></card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}">內容</card>`,
      }],
    }));

    const result = await topicAnalysis(client, { topic: 'test', max_notes: 2 });

    // 只取 2 個
    const getObjectCalls = mockMcp.callLog.filter(c => c.name === 'get_object');
    expect(getObjectCalls).toHaveLength(2);
    expect(result.total_notes).toBe(2);
  });

  it('WT-05: 個別物件失敗應容錯跳過', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult>',
          '<card id="n-ok" title="正常"></card>',
          '<card id="n-fail" title="失敗"></card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    let callCount = 0;
    mockMcp.onTool('get_object', () => {
      callCount++;
      if (callCount === 2) throw new Error('模擬失敗');
      return {
        content: [{ type: 'text', text: '<card id="n-ok">完整內容</card>' }],
      };
    });

    const result = await topicAnalysis(client, { topic: 'test' });

    // 只回傳成功的那筆
    expect(result.total_notes).toBe(1);
    expect(result.notes[0].id).toBe('n-ok');
  });
});
