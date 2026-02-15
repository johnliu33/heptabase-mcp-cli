import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';

export function createWhiteboardCommand(): Command {
  const whiteboard = new Command('whiteboard').description('白板相關操作');

  whiteboard
    .command('search')
    .description('搜尋白板')
    .argument('<keywords...>', '搜尋關鍵字（1-5 個）')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (keywords: string[], options: { json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.searchWhiteboards(keywords);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('搜尋失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  whiteboard
    .command('get')
    .description('取得白板結構')
    .argument('<id>', '白板 ID')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (id: string, options: { json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.getWhiteboard(id);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('取得白板失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return whiteboard;
}
