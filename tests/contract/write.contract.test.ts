import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpClient, type MockMcpClient } from '../helpers/mock-mcp-client.js';
import { HeptabaseClient } from '../../src/client/index.js';
import { Logger } from '../../src/utils/logger.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

describe('append_to_journal', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let cache: MemoryCache;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    cache = new MemoryCache();
    client = new HeptabaseClient(mockMcp as unknown as McpClient, cache, testLogger);
  });

  it('CT-08: append-only — 應將完整內容傳給 MCP', async () => {
    mockMcp.onTool('append_to_journal', () => ({
      content: [{ type: 'text', text: '已追加到今天的日誌' }],
    }));

    const content = '## 今天的進度\n- 完成 Phase 2 實作';
    await client.appendToJournal(content);

    expect(mockMcp.callLog).toHaveLength(1);
    expect(mockMcp.callLog[0].name).toBe('append_to_journal');
    expect(mockMcp.callLog[0].args).toEqual({ content });
  });

  it('CT-08 supplement: append 後 journal 快取應被 invalidate', async () => {
    // 先填入 journal 快取
    mockMcp.onTool('get_journal_range', () => ({
      content: [{ type: 'text', text: '<journal>舊內容</journal>' }],
    }));
    mockMcp.onTool('append_to_journal', () => ({
      content: [{ type: 'text', text: '已追加' }],
    }));

    // 讀取 journal（填入快取）
    await client.getJournalRange('2024-01-01', '2024-01-07');
    expect(cache.size).toBeGreaterThan(0);

    // 追加日誌
    await client.appendToJournal('新增內容');

    // 快取應被 invalidate，再次讀取會重新呼叫 MCP
    const journalCalls = mockMcp.callLog.filter(c => c.name === 'get_journal_range');
    expect(journalCalls).toHaveLength(1); // 第一次的呼叫

    // 再次讀取
    await client.getJournalRange('2024-01-01', '2024-01-07');
    const journalCalls2 = mockMcp.callLog.filter(c => c.name === 'get_journal_range');
    expect(journalCalls2).toHaveLength(2); // 快取已失效，需要重新呼叫
  });

  it('CT-08 supplement: 寫入結果不應被快取', async () => {
    mockMcp.onTool('append_to_journal', () => ({
      content: [{ type: 'text', text: '已追加' }],
    }));

    await client.appendToJournal('內容一');
    await client.appendToJournal('內容二');

    // 兩次寫入都應該呼叫 MCP（不快取）
    const appendCalls = mockMcp.callLog.filter(c => c.name === 'append_to_journal');
    expect(appendCalls).toHaveLength(2);
  });
});

describe('save_to_note_card', () => {
  let mockMcp: MockMcpClient;
  let client: HeptabaseClient;
  let cache: MemoryCache;
  let testLogger: Logger;

  beforeEach(() => {
    mockMcp = createMockMcpClient();
    testLogger = new Logger('debug');
    cache = new MemoryCache();
    client = new HeptabaseClient(mockMcp as unknown as McpClient, cache, testLogger);
  });

  it('應將 content 完整傳給 MCP', async () => {
    mockMcp.onTool('save_to_note_card', () => ({
      content: [{ type: 'text', text: '已建立卡片' }],
    }));

    const content = '# 新卡片標題\n這是內容';
    await client.saveToNoteCard(content);

    expect(mockMcp.callLog[0].name).toBe('save_to_note_card');
    expect(mockMcp.callLog[0].args).toEqual({ content });
  });

  it('save 後應 invalidate search 快取', async () => {
    mockMcp.onTool('semantic_search_objects', () => ({
      content: [{ type: 'text', text: '<searchResult totalResults=1></searchResult>' }],
    }));
    mockMcp.onTool('save_to_note_card', () => ({
      content: [{ type: 'text', text: '已建立' }],
    }));

    // 先搜尋（填入快取）
    await client.semanticSearch(['test']);
    expect(mockMcp.callLog.filter(c => c.name === 'semantic_search_objects')).toHaveLength(1);

    // 儲存新卡片
    await client.saveToNoteCard('# 新卡片\n內容');

    // 再次搜尋應重新呼叫 MCP（快取已失效）
    await client.semanticSearch(['test']);
    expect(mockMcp.callLog.filter(c => c.name === 'semantic_search_objects')).toHaveLength(2);
  });
});
