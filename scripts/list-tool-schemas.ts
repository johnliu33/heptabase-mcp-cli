/**
 * 列出所有 Heptabase MCP tool 的完整 schema
 * Usage: npx tsx scripts/list-tool-schemas.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { TokenManager } from '../src/transport/token-manager.js';
import { HeptabaseOAuthProvider, waitForAuthCallback } from '../src/transport/oauth.js';

const MCP_URL = 'https://api.heptabase.com/mcp';
const CALLBACK_PORT = 8371;

async function main() {
  const tokenManager = new TokenManager();
  const authProvider = new HeptabaseOAuthProvider(tokenManager, CALLBACK_PORT);
  const client = new Client({ name: 'heptabase-extension-test', version: '1.0.0' });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    authProvider,
  });

  try {
    await client.connect(transport);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.log('等待 OAuth 授權...');
      const code = await waitForAuthCallback(CALLBACK_PORT);
      await transport.finishAuth(code);
      const newClient = new Client({ name: 'heptabase-extension-test', version: '1.0.0' });
      const newTransport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider });
      await newClient.connect(newTransport);
      const tools = await newClient.listTools();
      printTools(tools.tools);
      await newClient.close();
      return;
    }
    throw error;
  }

  const tools = await client.listTools();
  printTools(tools.tools);
  await client.close();
}

function printTools(tools: any[]) {
  for (const tool of tools) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Tool: ${tool.name}`);
    console.log(`Description: ${tool.description}`);
    console.log(`Input Schema:`);
    console.log(JSON.stringify(tool.inputSchema, null, 2));
  }
}

main().catch(console.error);
