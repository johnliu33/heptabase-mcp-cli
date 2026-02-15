import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';
import type { SearchableObjectType } from '../../types/official-tools.js';

const VALID_TYPES: SearchableObjectType[] = ['card', 'pdfCard', 'mediaCard', 'highlightElement', 'journal'];

export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('語意搜尋筆記')
    .argument('<query...>', '搜尋關鍵字（1-3 個）')
    .option('--json', '以 JSON 格式輸出', false)
    .option('--type <types...>', `篩選物件類型 (${VALID_TYPES.join(', ')})`)
    .action(async (queries: string[], options: { json: boolean; type?: string[] }) => {
      try {
        if (options.type) {
          const invalid = options.type.filter(t => !VALID_TYPES.includes(t as SearchableObjectType));
          if (invalid.length > 0) {
            console.error(`無效的物件類型：${invalid.join(', ')}`);
            console.error(`可用類型：${VALID_TYPES.join(', ')}`);
            process.exit(1);
          }
        }

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const resultObjectTypes = (options.type ?? []) as SearchableObjectType[];
        const result = await client.semanticSearch(queries, resultObjectTypes);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('搜尋失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return search;
}
