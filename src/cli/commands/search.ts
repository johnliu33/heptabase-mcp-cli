import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatSearchResults } from '../format.js';

export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('語意搜尋筆記')
    .argument('<query>', '搜尋關鍵字')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (query: string, options: { json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.semanticSearch(query);
        console.log(formatSearchResults(result, options.json));
      } catch (error) {
        console.error('搜尋失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return search;
}
