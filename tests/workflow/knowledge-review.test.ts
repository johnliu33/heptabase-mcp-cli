import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { Logger } from '../../src/utils/logger.js';
import { knowledgeReview } from '../../src/workflows/knowledge-review.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('knowledgeReview', () => {
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

  it('WT-04: 2025-06-01 ~ 2025-12-31（~7 個月）→ get_journal_range 被呼叫多次', async () => {
    mockMcp.onTool('get_journal_range', (args) => ({
      content: [{
        type: 'text',
        text: `<journal range="${args.startDate}~${args.endDate}">日誌內容 ${args.startDate}</journal>`,
      }],
    }));

    const result = await knowledgeReview(client, {
      start_date: '2025-06-01',
      end_date: '2025-12-31',
    });

    // ~214 天，應分割為多段（每段 ≤90 天）
    const journalCalls = mockMcp.callLog.filter(c => c.name === 'get_journal_range');
    expect(journalCalls.length).toBeGreaterThan(1);

    // 每段 ≤90 天
    for (const call of journalCalls) {
      const start = new Date(call.args.startDate as string);
      const end = new Date(call.args.endDate as string);
      const days = Math.round((end.getTime() - start.getTime()) / 86400000);
      expect(days).toBeLessThanOrEqual(90);
    }

    // 回傳的 period 正確
    expect(result.period).toBe('2025-06-01 ~ 2025-12-31');
    expect(result.journal_content).toContain('日誌內容');
  });

  it('WT-04 supplement: 帶 topic 時應呼叫 semantic_search_objects + get_object', async () => {
    mockMcp.onTool('get_journal_range', () => ({
      content: [{
        type: 'text',
        text: '<journal>七月日誌</journal>',
      }],
    }));

    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{
        type: 'text',
        text: [
          '<searchResult query="React" totalResults=2 >',
          '<card id="card-r1" title="React Hooks 筆記" totalChunks=1 >',
          '<chunk index=0 >Hooks 入門</chunk>',
          '</card>',
          '<card id="card-r2" title="React 效能優化" totalChunks=1 >',
          '<chunk index=0 >效能優化技巧</chunk>',
          '</card>',
          '</searchResult>',
        ].join('\n'),
      }],
    }));

    mockMcp.onTool('get_object', (args) => ({
      content: [{
        type: 'text',
        text: `<card id="${args.objectId}" title="筆記">完整內容 ${args.objectId}</card>`,
      }],
    }));

    const result = await knowledgeReview(client, {
      start_date: '2025-07-01',
      end_date: '2025-07-31',
      topic: 'React',
    });

    // 應呼叫 semantic_search_objects
    const searchCalls = mockMcp.callLog.filter(c => c.name === 'semantic_search_objects');
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].args).toEqual({
      queries: ['React'],
      resultObjectTypes: [],
    });

    // 應呼叫 get_object 取回相關筆記
    const objectCalls = mockMcp.callLog.filter(c => c.name === 'get_object');
    expect(objectCalls).toHaveLength(2);

    // 結果驗證
    expect(result.related_notes_count).toBe(2);
    expect(result.related_notes).toHaveLength(2);
    expect(result.related_notes[0].title).toBe('React Hooks 筆記');
    expect(result.related_notes[1].title).toBe('React 效能優化');
  });

  it('WT-04 supplement: 不帶 topic 時不應呼叫 semantic_search', async () => {
    mockMcp.onTool('get_journal_range', () => ({
      content: [{
        type: 'text',
        text: '<journal>日誌</journal>',
      }],
    }));

    const result = await knowledgeReview(client, {
      start_date: '2025-07-01',
      end_date: '2025-07-15',
    });

    const searchCalls = mockMcp.callLog.filter(c => c.name === 'semantic_search_objects');
    expect(searchCalls).toHaveLength(0);
    expect(result.related_notes).toHaveLength(0);
    expect(result.related_notes_count).toBe(0);
  });

  it('WT-04 supplement: ≤90 天應只呼叫一次 get_journal_range', async () => {
    mockMcp.onTool('get_journal_range', () => ({
      content: [{
        type: 'text',
        text: '<journal>短期日誌</journal>',
      }],
    }));

    await knowledgeReview(client, {
      start_date: '2025-07-01',
      end_date: '2025-07-31',
    });

    const journalCalls = mockMcp.callLog.filter(c => c.name === 'get_journal_range');
    expect(journalCalls).toHaveLength(1);
  });
});
