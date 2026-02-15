/**
 * 測試實際連線到 Heptabase MCP Server
 * 完整 OAuth 流程：connect → UnauthorizedError → 瀏覽器授權 → finishAuth → reconnect
 *
 * Usage: npx tsx scripts/test-connection.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { TokenManager } from '../src/transport/token-manager.js';
import { HeptabaseOAuthProvider, waitForAuthCallback } from '../src/transport/oauth.js';

const MCP_URL = 'https://api.heptabase.com/mcp';
const CALLBACK_PORT = 8371;

async function connectWithAuth(
  authProvider: HeptabaseOAuthProvider,
): Promise<Client> {
  const client = new Client({ name: 'heptabase-extension-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider });

  try {
    console.log('正在連線...');
    await client.connect(transport);
    console.log('連線成功！');
    return client;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.log('需要 OAuth 授權 — 瀏覽器已開啟，等待授權回調...');
      const code = await waitForAuthCallback(CALLBACK_PORT);
      console.log(`取得授權碼: ${code.slice(0, 10)}...`);
      await transport.finishAuth(code);
      // 重新連線
      return connectWithAuth(authProvider);
    }
    throw error;
  }
}

async function main() {
  const tokenManager = new TokenManager();
  const authProvider = new HeptabaseOAuthProvider(tokenManager, CALLBACK_PORT);

  console.log('=== Heptabase MCP 連線測試 ===\n');

  const status = tokenManager.getStatus();
  console.log(`Token 狀態: hasToken=${status.hasToken}, isValid=${status.isValid}`);

  // 1. Connect
  console.log('\n--- 連線 ---');
  let client: Client;
  try {
    client = await connectWithAuth(authProvider);
  } catch (err: any) {
    console.error('連線失敗:', err.message);
    process.exit(1);
  }

  // 2. List tools
  console.log('\n--- 列出 Tools ---');
  const tools = await client.listTools();
  console.log(`找到 ${tools.tools.length} 個 tools`);

  // 3. Semantic search
  console.log('\n--- 語意搜尋 ---');
  const search = await client.callTool({
    name: 'semantic_search_objects',
    arguments: { queries: ['MCP'], resultObjectTypes: [] },
  });
  if (search.content && Array.isArray(search.content)) {
    for (const c of search.content) {
      if (c.type === 'text') {
        const text = typeof c.text === 'string' ? c.text : '';
        console.log(text.slice(0, 800));
        if (text.length > 800) console.log('... (truncated)');
      }
    }
  }

  // 4. Search whiteboards
  console.log('\n--- 搜尋白板 ---');
  const boards = await client.callTool({
    name: 'search_whiteboards',
    arguments: { keywords: ['project', '專案'] },
  });
  if (boards.content && Array.isArray(boards.content)) {
    for (const c of boards.content) {
      if (c.type === 'text') {
        const text = typeof c.text === 'string' ? c.text : '';
        console.log(text.slice(0, 800));
      }
    }
  }

  await client.close();
  console.log('\n=== 測試完成 ===');
}

main().catch(err => {
  console.error('錯誤:', err);
  process.exit(1);
});
