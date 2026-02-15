import { Command } from 'commander';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { whiteboardDeepDive, pdfResearch, knowledgeReview } from '../../workflows/index.js';

export function createWorkflowCommand(): Command {
  const workflow = new Command('workflow')
    .alias('wf')
    .description('多步驟自動化工作流程');

  // ── whiteboard-deep-dive ──
  workflow
    .command('whiteboard-deep-dive')
    .alias('wdd')
    .description('深入探索白板：搜尋白板 → 取得所有物件完整內容')
    .option('--query <query>', '搜尋白板的關鍵字')
    .option('--id <id>', '直接指定白板 ID')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (options: { query?: string; id?: string; json: boolean }) => {
      try {
        if (!options.query && !options.id) {
          console.error('必須提供 --query 或 --id');
          process.exit(1);
        }

        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await whiteboardDeepDive(client, {
          query: options.query,
          whiteboard_id: options.id,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`白板：${result.whiteboard_name}`);
          console.log(`物件數量：${result.total_objects}`);
          for (const obj of result.objects) {
            const status = obj.content_status === 'skipped' ? ' [skipped]' : '';
            console.log(`\n── ${obj.title} (${obj.type})${status} ──`);
            if (obj.content) console.log(obj.content);
          }
          if (result.incomplete_objects.length > 0) {
            console.log(`\n⚠ 不完整物件：${result.incomplete_objects.join(', ')}`);
          }
        }
      } catch (error) {
        console.error('Workflow 失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // ── pdf-research ──
  workflow
    .command('pdf-research')
    .alias('pr')
    .description('PDF 研究：搜尋 PDF → 取得相關頁面全文')
    .argument('<topic>', '研究主題')
    .option('--pdf-id <id>', '直接指定 PDF ID')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (topic: string, options: { pdfId?: string; json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await pdfResearch(client, {
          topic,
          pdf_id: options.pdfId,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`PDF：${result.pdf_title}`);
          console.log(`相關頁面：${result.relevant_pages.join(', ') || '無'}`);
          console.log(`來源 chunks：${result.source_chunks_count}`);
          if (result.page_contents) {
            console.log(`\n── 頁面內容 ──`);
            console.log(result.page_contents);
          }
        }
      } catch (error) {
        console.error('Workflow 失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // ── knowledge-review ──
  workflow
    .command('knowledge-review')
    .alias('kr')
    .description('知識回顧：取得日誌 + 相關筆記')
    .argument('<start>', '開始日期 (YYYY-MM-DD)')
    .argument('<end>', '結束日期 (YYYY-MM-DD)')
    .option('--topic <topic>', '搜尋相關主題的筆記')
    .option('--json', '以 JSON 格式輸出', false)
    .action(async (start: string, end: string, options: { topic?: string; json: boolean }) => {
      try {
        const tokenManager = new TokenManager();
        const mcp = createMcpClient(tokenManager);
        const client = new HeptabaseClient(mcp);

        const result = await knowledgeReview(client, {
          start_date: start,
          end_date: end,
          topic: options.topic,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`期間：${result.period}`);
          console.log(`日誌數量：${result.journal_count}`);
          console.log(`相關筆記：${result.related_notes_count}`);
          if (result.journal_content) {
            console.log(`\n── 日誌內容 ──`);
            console.log(result.journal_content);
          }
          for (const note of result.related_notes) {
            console.log(`\n── ${note.title} (${note.type}) ──`);
            console.log(note.content);
          }
        }
      } catch (error) {
        console.error('Workflow 失敗：', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return workflow;
}
