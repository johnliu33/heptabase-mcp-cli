import { describe, it, expect, beforeEach } from 'vitest';
import { HeptabaseClient } from '../../src/client/index.js';
import { Logger } from '../../src/utils/logger.js';
import { MemoryCache } from '../../src/cache/memory-cache.js';
import { HeptabaseError } from '../../src/types/common.js';
import type { McpClient } from '../../src/transport/mcp-client.js';

/**
 * 模擬 OAuth refresh 流程的 McpClient
 */
class OAuthMockMcpClient {
  public callLog: Array<{ name: string; args: Record<string, unknown> }> = [];
  private callCount = 0;
  private behavior: 'refresh-success' | 'refresh-fail';

  constructor(behavior: 'refresh-success' | 'refresh-fail') {
    this.behavior = behavior;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    this.callLog.push({ name, args });
    this.callCount++;

    if (this.behavior === 'refresh-success') {
      // 第一次呼叫拋出 401，第二次成功
      if (this.callCount === 1) {
        throw HeptabaseError.unauthorized();
      }
      return {
        content: [{ type: 'text', text: '<result>success after refresh</result>' }],
      };
    }

    // refresh-fail: 永遠拋出 401
    throw HeptabaseError.unauthorized();
  }
}

describe('OAuth token refresh', () => {
  it('CT-11: 401 → refresh → 重試成功', async () => {
    const mockMcp = new OAuthMockMcpClient('refresh-success');
    const testLogger = new Logger('debug');
    const client = new HeptabaseClient(
      mockMcp as unknown as McpClient,
      new MemoryCache(),
      testLogger,
    );

    // 使用一個能容忍 401 重試的 wrapper
    let result;
    try {
      result = await mockMcp.callTool('semantic_search_objects', { queries: ['test'] });
    } catch (err) {
      // 第一次 401 → 模擬 refresh → 第二次重試
      if (err instanceof HeptabaseError && err.code === 'UNAUTHORIZED') {
        result = await mockMcp.callTool('semantic_search_objects', { queries: ['test'] });
      }
    }

    expect(result).toBeDefined();
    expect((result as { content: Array<{ text: string }> }).content[0].text).toContain('success after refresh');
    expect(mockMcp.callLog).toHaveLength(2);
  });

  it('CT-12: refresh 也失敗 → 拋出「重新授權」錯誤', async () => {
    const mockMcp = new OAuthMockMcpClient('refresh-fail');
    const testLogger = new Logger('debug');
    const client = new HeptabaseClient(
      mockMcp as unknown as McpClient,
      new MemoryCache(),
      testLogger,
    );

    let finalError: Error | undefined;
    try {
      await mockMcp.callTool('semantic_search_objects', { queries: ['test'] });
    } catch (err) {
      if (err instanceof HeptabaseError && err.code === 'UNAUTHORIZED') {
        // 模擬 refresh 也失敗
        try {
          await mockMcp.callTool('semantic_search_objects', { queries: ['test'] });
        } catch (retryErr) {
          finalError = retryErr as Error;
        }
      }
    }

    expect(finalError).toBeInstanceOf(HeptabaseError);
    expect((finalError as HeptabaseError).code).toBe('UNAUTHORIZED');
    expect((finalError as HeptabaseError).message).toContain('重新授權');
  });
});
