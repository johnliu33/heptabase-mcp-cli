import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';

export function createSaveCommand(): Command {
  return new Command('save')
    .description('建立新的卡片（Markdown 內容，第一個 h1 為標題）')
    .argument('<content>', 'Markdown 內容')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (content: string, options: { json: boolean }) => {
      try {
        console.log('建立新卡片...');

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.saveToNoteCard(content);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('建立卡片失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
