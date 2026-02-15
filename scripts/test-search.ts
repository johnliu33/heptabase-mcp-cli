/**
 * 測試實際搜尋回傳格式
 * Usage: npx tsx scripts/test-search.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { TokenManager } from '../src/transport/token-manager.js';
import { HeptabaseOAuthProvider } from '../src/transport/oauth.js';

const MCP_URL = 'https://api.heptabase.com/mcp';

async function main() {
  const tokenManager = new TokenManager();
  const authProvider = new HeptabaseOAuthProvider(tokenManager);
  const client = new Client({ name: 'test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider });
  await client.connect(transport);

  // Test 1: semantic_search_objects
  console.log('=== semantic_search_objects ===');
  const search = await client.callTool({
    name: 'semantic_search_objects',
    arguments: { queries: ['test'], resultObjectTypes: [] },
  });
  console.log(JSON.stringify(search, null, 2).slice(0, 2000));

  // Test 2: search_whiteboards
  console.log('\n=== search_whiteboards ===');
  const boards = await client.callTool({
    name: 'search_whiteboards',
    arguments: { keywords: ['test'] },
  });
  console.log(JSON.stringify(boards, null, 2).slice(0, 2000));

  await client.close();
}

main().catch(console.error);
