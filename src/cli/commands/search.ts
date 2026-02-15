import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';

export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('語意搜尋筆記')
    .argument('<query...>', '搜尋關鍵字（1-3 個）')
    .option('--json', '以 JSON 格式輸出', false)
    .option('--type <types...>', '篩選物件類型 (card, pdfCard, mediaCard, highlightElement, journal)')
    .action(async (queries: string[], options: { json: boolean; type?: string[] }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const resultObjectTypes = (options.type ?? []) as any[];
        const result = await client.semanticSearch(queries, resultObjectTypes);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('搜尋失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return search;
}
