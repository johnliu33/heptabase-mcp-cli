import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import type { McpClient } from '../../src/transport/mcp-client.js';
import searchFixture from '../fixtures/search-results.json';

describe('semantic_search_objects', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    client = new HeptabaseClient(mockMcp as unknown as McpClient);
  });

  it('CT-01: 應回傳匹配的物件列表', async () => {
    mockMcp.onTool('semantic_search_objects', () => searchFixture);

    const result = await client.semanticSearch('MCP');

    expect(result.objects).toHaveLength(2);
    expect(result.objects[0]).toHaveProperty('id');
    expect(result.objects[0]).toHaveProperty('type');
    expect(result.objects[0]).toHaveProperty('title');
    expect(result.objects[0]).toHaveProperty('snippet');
    expect(result.objects[0]).toHaveProperty('score');
    expect(result.objects[0].score).toBeGreaterThan(0);
  });

  it('CT-02: 空結果應回傳空陣列', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({ objects: [] }));

    const result = await client.semanticSearch('不存在的關鍵字xyz');

    expect(result.objects).toEqual([]);
  });

  it('CT-01 supplement: 應正確傳遞 query 參數', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({ objects: [] }));

    await client.semanticSearch('MCP');

    expect(mockMcp.callLog).toHaveLength(1);
    expect(mockMcp.callLog[0].name).toBe('semantic_search_objects');
    expect(mockMcp.callLog[0].args).toEqual({ query: 'MCP' });
  });

  it('CT-01 supplement: 相同 query 應命中快取', async () => {
    mockMcp.onTool('semantic_search_objects', () => searchFixture);

    await client.semanticSearch('MCP');
    await client.semanticSearch('MCP');

    // 只應呼叫一次（第二次命中快取）
    expect(mockMcp.callLog).toHaveLength(1);
  });
});
