import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';

export function createPdfCommand(): Command {
  const pdf = new Command('pdf')
    .description('PDF 相關操作');

  pdf
    .command('search')
    .description('以 BM25 搜尋 PDF 內容')
    .argument('<pdfCardId>', 'PDF 卡片 ID')
    .argument('<keywords...>', '搜尋關鍵字（1-5 個）')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (pdfCardId: string, keywords: string[], options: { json: boolean }) => {
      try {
        if (keywords.length > 5) {
          console.error('關鍵字最多 5 個');
          process.exit(1);
        }

        console.log(`搜尋 PDF ${pdfCardId}，關鍵字：${keywords.join(', ')}`);

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.searchPdfContent(pdfCardId, keywords);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('搜尋 PDF 失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  pdf
    .command('pages')
    .description('取得 PDF 指定頁面')
    .argument('<pdfCardId>', 'PDF 卡片 ID')
    .argument('<startPage>', '起始頁碼（≥ 1）')
    .argument('<endPage>', '結束頁碼')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (pdfCardId: string, startPageStr: string, endPageStr: string, options: { json: boolean }) => {
      try {
        const startPage = parseInt(startPageStr, 10);
        const endPage = parseInt(endPageStr, 10);

        if (isNaN(startPage) || isNaN(endPage)) {
          console.error('頁碼必須是數字');
          process.exit(1);
        }

        console.log(`取得 PDF ${pdfCardId} 第 ${startPage}-${endPage} 頁`);

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await client.getPdfPages(pdfCardId, startPage, endPage);
        console.log(formatResult(result, options.json));
      } catch (error) {
        console.error('取得 PDF 頁面失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return pdf;
}
