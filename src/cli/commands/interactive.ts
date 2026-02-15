import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';
import type { ObjectType, SearchableObjectType } from '../../types/official-tools.js';

const SEARCHABLE_TYPES: { value: SearchableObjectType | 'all'; name: string }[] = [
  { value: 'all', name: '全部' },
  { value: 'card', name: 'card（卡片）' },
  { value: 'journal', name: 'journal（日誌）' },
  { value: 'pdfCard', name: 'pdfCard（PDF）' },
  { value: 'mediaCard', name: 'mediaCard（媒體）' },
  { value: 'highlightElement', name: 'highlightElement（摘要）' },
];

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
            { value: 'journal', name: '讀取日誌（依日期）' },
            { value: 'journal-append', name: '追加到今天的日誌' },
            { value: 'save', name: '建立新卡片' },
            { value: 'whiteboard-search', name: '搜尋白板' },
            { value: 'whiteboard-get', name: '讀取白板（需要 ID）' },
            { value: 'object-get', name: '讀取物件（需要 ID）' },
            { value: 'pdf-search', name: '搜尋 PDF 內容' },
            { value: 'pdf-pages', name: '取得 PDF 頁面' },
            { value: 'exit', name: '退出' },
          ],
        });

        switch (action) {
          case 'search': {
            const query = await input({ message: '搜尋關鍵字：' });
            if (!query) break;
            const searchType = await select({
              message: '篩選物件類型：',
              choices: SEARCHABLE_TYPES,
            });
            const resultObjectTypes = searchType === 'all'
              ? []
              : [searchType] as SearchableObjectType[];
            try {
              const result = await client.semanticSearch([query], resultObjectTypes);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('搜尋失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'journal': {
            const startDate = await input({
              message: '起始日期 (YYYY-MM-DD)：',
              default: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
            });
            const endDate = await input({
              message: '結束日期 (YYYY-MM-DD)：',
              default: new Date().toISOString().slice(0, 10),
            });
            try {
              const result = await client.getJournalRange(startDate, endDate);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('讀取日誌失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'whiteboard-search': {
            const query = await input({ message: '白板搜尋關鍵字：' });
            if (!query) break;
            try {
              const result = await client.searchWhiteboards([query]);
              console.log(formatResult(result, false));
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
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('讀取失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'object-get': {
            const id = await input({ message: '物件 ID：' });
            if (!id) break;
            const objType = await select({
              message: '物件類型：',
              choices: [
                { value: 'card', name: 'card（卡片）' },
                { value: 'journal', name: 'journal（日誌）' },
                { value: 'pdfCard', name: 'pdfCard（PDF）' },
                { value: 'highlightElement', name: 'highlightElement（摘要）' },
                { value: 'section', name: 'section（區段）' },
              ],
            });
            try {
              const result = await client.getObject(id, objType as ObjectType);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('讀取失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'journal-append': {
            const content = await input({ message: '要追加的內容（Markdown）：' });
            if (!content) break;
            try {
              const result = await client.appendToJournal(content);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('追加日誌失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'save': {
            const content = await input({ message: 'Markdown 內容（第一個 h1 為標題）：' });
            if (!content) break;
            try {
              const result = await client.saveToNoteCard(content);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('建立卡片失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'pdf-search': {
            const pdfId = await input({ message: 'PDF 卡片 ID：' });
            if (!pdfId) break;
            const keywordsStr = await input({ message: '搜尋關鍵字（逗號分隔，1-5 個）：' });
            if (!keywordsStr) break;
            const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
            try {
              const result = await client.searchPdfContent(pdfId, keywords);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('搜尋 PDF 失敗：', error instanceof Error ? error.message : error);
            }
            break;
          }

          case 'pdf-pages': {
            const pdfId = await input({ message: 'PDF 卡片 ID：' });
            if (!pdfId) break;
            const startStr = await input({ message: '起始頁碼（≥ 1）：' });
            const endStr = await input({ message: '結束頁碼：' });
            const startPage = parseInt(startStr, 10);
            const endPage = parseInt(endStr, 10);
            if (isNaN(startPage) || isNaN(endPage)) {
              console.error('頁碼必須是數字');
              break;
            }
            try {
              const result = await client.getPdfPages(pdfId, startPage, endPage);
              console.log(formatResult(result, false));
            } catch (error) {
              console.error('取得 PDF 頁面失敗：', error instanceof Error ? error.message : error);
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
