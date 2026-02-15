import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatObject } from '../format.js';

export function createObjectCommand(): Command {
  const object = new Command('object').description('物件相關操作');

  object
    .command('get')
    .description('深度讀取物件完整內容')
    .argument('<id>', '物件 ID')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (id: string, options: { json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.getObject(id);
        console.log(formatObject(result, options.json));
      } catch (error) {
        console.error('讀取物件失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return object;
}
