import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';
import { diffDays } from '../../utils/date-range.js';

function parseDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`日期格式錯誤：${value}（需要 YYYY-MM-DD）`);
  }
  return value;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function createJournalCommand(): Command {
  const journal = new Command('journal')
    .description('讀取與追加日誌');

  journal
    .command('get')
    .description('依日期範圍讀取日誌（超過 90 天將自動分割查詢）')
    .option('--from <date>', '起始日期 YYYY-MM-DD（預設：7 天前）')
    .option('--to <date>', '結束日期 YYYY-MM-DD（預設：今天）')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (options: { from?: string; to?: string; json: boolean }) => {
      try {
        const endDate = options.to ? parseDate(options.to) : todayStr();
        const startDate = options.from ? parseDate(options.from) : daysAgoStr(7);

        const days = diffDays(startDate, endDate);
        if (days < 0) {
          console.error(`起始日期 (${startDate}) 不能晚於結束日期 (${endDate})`);
          process.exit(1);
        }

        if (days > 90) {
          console.log(`日期範圍 ${days} 天，將自動分割為多段查詢`);
        }

        console.log(`查詢日誌：${startDate} ~ ${endDate}（${days + 1} 天）`);

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.getJournalRange(startDate, endDate);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('讀取日誌失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  journal
    .command('today')
    .description('讀取今天的日誌')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (options: { json: boolean }) => {
      try {
        const today = todayStr();
        console.log(`查詢日誌：${today}`);

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.getJournalRange(today, today);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('讀取日誌失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  journal
    .command('append')
    .description('追加內容到今天的日誌')
    .argument('<content>', '要追加的 Markdown 內容')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (content: string, options: { json: boolean }) => {
      try {
        console.log('追加內容到今天的日誌...');

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.appendToJournal(content);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('追加日誌失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return journal;
}
