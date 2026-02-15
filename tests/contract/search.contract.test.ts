import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

const searchResultContent = {
  content: [
    {
      type: 'text',
      text: '<searchResult query="MCP" totalResults=2 >\n<card id="card-1" title="MCP 入門" totalChunks=1 >\n<chunk index=0 >MCP 是 Model Context Protocol</chunk>\n</card>\n<card id="card-2" title="MCP 實作" totalChunks=1 >\n<chunk index=0 >實作步驟包括...</chunk>\n</card>\n</searchResult>',
    },
  ],
};

const emptySearchResult = {
  content: [
    {
      type: 'text',
      text: '<searchResult query="不存在的關鍵字" totalResults=0 >\n</searchResult>',
    },
  ],
};

describe('semantic_search_objects', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    client = new HeptabaseClient(mockMcp as unknown as McpClient);
  });

  it('CT-01: 應回傳搜尋結果 content', async () => {
    mockMcp.onTool('semantic_search_objects', () => searchResultContent);

    const result = await client.semanticSearch(['MCP']);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('card-1');
    expect(result.content[0].text).toContain('MCP 入門');
  });

  it('CT-02: 空結果應回傳 totalResults=0', async () => {
    mockMcp.onTool('semantic_search_objects', () => emptySearchResult);

    const result = await client.semanticSearch(['不存在的關鍵字xyz']);

    expect(result.content[0].text).toContain('totalResults=0');
  });

  it('CT-01 supplement: 應正確傳遞 queries 和 resultObjectTypes 參數', async () => {
    mockMcp.onTool('semantic_search_objects', () => emptySearchResult);

    await client.semanticSearch(['MCP', 'protocol'], ['card', 'journal']);

    expect(mockMcp.callLog).toHaveLength(1);
    expect(mockMcp.callLog[0].name).toBe('semantic_search_objects');
    expect(mockMcp.callLog[0].args).toEqual({
      queries: ['MCP', 'protocol'],
      resultObjectTypes: ['card', 'journal'],
    });
  });

  it('CT-01 supplement: 相同 queries 應命中快取', async () => {
    mockMcp.onTool('semantic_search_objects', () => searchResultContent);

    await client.semanticSearch(['MCP']);
    await client.semanticSearch(['MCP']);

    expect(mockMcp.callLog).toHaveLength(1);
  });
});
