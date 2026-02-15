import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatSearchResults, formatWhiteboardList, formatWhiteboard, formatObject } from '../format.js';

export function createInteractiveCommand(): Command {
  return new Command('interactive')
    .alias('i')
    .description('互動模式')
    .action(async () => {
      const tokenManager = new TokenManager();
      if (!tokenManager.isTokenValid()) {
        console.log('尚未登入或 Token 已過期。請先執行 `heptabase auth login`。');
        process.exit(1);
      }

      const mcp = createMcpClient(tokenManager);
      const client = new HeptabaseClient(mcp);

      console.log('Heptabase Extension 互動模式');
      console.log('─'.repeat(40));

      let running = true;
      while (running) {
        const action = await select({
          message: '請選擇操作：',
          choices: [
            { value: 'search', name: '搜尋筆記' },
            { value: 'whiteboard-search', name: '搜尋白板' },
            { value: 'whiteboard-get', name: '讀取白板（需要 ID）' },
            { value: 'object-get', name: '讀取物件（需要 ID）' },
            { value: 'exit', name: '退出' },
          ],
        });

        switch (action) {
          case 'search': {
            const query = await input({ message: '搜尋關鍵字：' });
            if (!query) break;
            try {
              const result = await client.semanticSearch(query);
              console.log(formatSearchResults(result, false));

              if (result.objects.length > 0) {
                const readMore = await select({
                  message: '要深度讀取哪個物件？',
                  choices: [
                    ...result.objects.map((obj, i) => ({
                      value: obj.id,
                      name: `${i + 1}. [${obj.type}] ${obj.title}`,
                    })),
                    { value: 'skip', name: '返回主選單' },
                  ],
                });

                if (readMore !== 'skip') {
                  const objResult = await client.getObject(readMore);
                  console.log(formatObject(objResult, false));
                }
              }
            } catch (error) {
              console.error('搜尋失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'whiteboard-search': {
            const query = await input({ message: '白板搜尋關鍵字：' });
            if (!query) break;
            try {
              const result = await client.searchWhiteboards(query);
              console.log(formatWhiteboardList(result, false));

              if (result.whiteboards.length > 0) {
                const viewBoard = await select({
                  message: '要查看哪個白板？',
                  choices: [
                    ...result.whiteboards.map((wb, i) => ({
                      value: wb.id,
                      name: `${i + 1}. ${wb.name} (${wb.object_count} objects)`,
                    })),
                    { value: 'skip', name: '返回主選單' },
                  ],
                });

                if (viewBoard !== 'skip') {
                  const wbResult = await client.getWhiteboard(viewBoard);
                  console.log(formatWhiteboard(wbResult, false));
                }
              }
            } catch (error) {
              console.error('搜尋失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'whiteboard-get': {
            const id = await input({ message: '白板 ID：' });
            if (!id) break;
            try {
              const result = await client.getWhiteboard(id);
              console.log(formatWhiteboard(result, false));
            } catch (error) {
              console.error('讀取失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'object-get': {
            const id = await input({ message: '物件 ID：' });
            if (!id) break;
            try {
              const result = await client.getObject(id);
              console.log(formatObject(result, false));
            } catch (error) {
              console.error('讀取失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'exit':
            running = false;
            break;
        }
      }

      console.log('再見！');
    });
}
