import { Command } from 'commander';
import * as readline from 'node:readline';
import { TokenManager } from '../../transport/token-manager.js';
import { createMcpClient } from '../../transport/mcp-client.js';
import { HeptabaseClient } from '../../client/index.js';
import { formatResult } from '../format.js';
import type { ObjectType } from '../../types/official-tools.js';
import { whiteboardDeepDive, pdfResearch, knowledgeReview } from '../../workflows/index.js';

// ── ANSI helpers ──────────────────────────────────────────────

const c = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ── Box drawing ───────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function box(lines: string[], width: number): string {
  const top = `┌${'─'.repeat(width - 2)}┐`;
  const bot = `└${'─'.repeat(width - 2)}┘`;
  const padded = lines.map((l) => {
    const visible = stripAnsi(l);
    const pad = Math.max(0, width - 4 - visible.length);
    return `│ ${l}${' '.repeat(pad)} │`;
  });
  return [top, ...padded, bot].join('\n');
}

// ── ASCII art ─────────────────────────────────────────────────

function printBanner(): void {
  const inner = [
    '',
    c.bold(c.cyan('  ╦ ╦╔═╗╔═╗╔╦╗╔═╗╔╗ ╔═╗╔═╗╔═╗')),
    c.bold(c.cyan('  ╠═╣║╣ ╠═╝ ║ ╠═╣╠╩╗╠═╣╚═╗║╣ ')),
    c.bold(c.cyan('  ╩ ╩╚═╝╩   ╩ ╩ ╩╚═╝╩ ╩╚═╝╚═╝')),
    '',
    `  ${c.dim('Terminal UI · v2.0.0')}`,
    `  ${c.dim('輸入 /help 查看可用指令')}`,
    '',
  ];
  console.log(box(inner, 44));
}

// ── Help text ─────────────────────────────────────────────────

function printHelp(): void {
  const lines = [
    c.bold(c.cyan('可用指令')),
    '',
    `${c.yellow('/search')} ${c.dim('<query>')}          語意搜尋筆記`,
    `${c.yellow('/journal')}                   最近 7 天日誌`,
    `${c.yellow('/journal')} ${c.dim('<from> <to>')}     指定日期範圍日誌`,
    `${c.yellow('/append')} ${c.dim('<content>')}        追加到今天日誌`,
    `${c.yellow('/save')} ${c.dim('<content>')}          建立新卡片（第一行 h1 為標題）`,
    `${c.yellow('/whiteboard')} ${c.dim('<keywords>')}   搜尋白板`,
    `${c.yellow('/get-whiteboard')} ${c.dim('<id>')}     讀取白板`,
    `${c.yellow('/object')} ${c.dim('<id> <type>')}      讀取物件`,
    `${c.yellow('/pdf-search')} ${c.dim('<id> <kw...>')} 搜尋 PDF 內容`,
    `${c.yellow('/pdf-pages')} ${c.dim('<id> <s> <e>')}  取得 PDF 頁面`,
    '',
    c.bold(c.cyan('工作流程')),
    `${c.yellow('/deep-dive')} ${c.dim('<query|id>')}   白板深入探索`,
    `${c.yellow('/pdf-research')} ${c.dim('<topic> [id]')} PDF 研究`,
    `${c.yellow('/review')} ${c.dim('<start> <end> [topic]')} 知識回顧`,
    '',
    `${c.yellow('/clear')}                     清除畫面`,
    `${c.yellow('/exit')}                      退出`,
  ];
  console.log('\n' + box(lines, 56) + '\n');
}

// ── Command execution ─────────────────────────────────────────

async function exec(client: HeptabaseClient, line: string): Promise<boolean> {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Parse slash command
  if (!trimmed.startsWith('/')) {
    console.log(c.yellow('提示：請使用 / 開頭的指令，輸入 /help 查看清單'));
    return true;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      printHelp();
      return true;

    case 'clear':
      console.clear();
      printBanner();
      return true;

    case 'exit':
    case 'quit':
    case 'q':
      return false;

    case 'search': {
      const query = args.join(' ');
      if (!query) {
        console.log(c.red('用法：/search <query>'));
        return true;
      }
      await run('搜尋中…', () => client.semanticSearch([query]));
      return true;
    }

    case 'journal': {
      let startDate: string;
      let endDate: string;
      if (args.length >= 2) {
        startDate = args[0];
        endDate = args[1];
      } else {
        endDate = new Date().toISOString().slice(0, 10);
        startDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      }
      await run('讀取日誌中…', () => client.getJournalRange(startDate, endDate));
      return true;
    }

    case 'append': {
      const content = args.join(' ');
      if (!content) {
        console.log(c.red('用法：/append <content>'));
        return true;
      }
      await run('追加日誌中…', () => client.appendToJournal(content));
      return true;
    }

    case 'save': {
      const content = args.join(' ');
      if (!content) {
        console.log(c.red('用法：/save <content>'));
        return true;
      }
      await run('建立卡片中…', () => client.saveToNoteCard(content));
      return true;
    }

    case 'whiteboard': {
      const keywords = args;
      if (keywords.length === 0) {
        console.log(c.red('用法：/whiteboard <keywords>'));
        return true;
      }
      await run('搜尋白板中…', () => client.searchWhiteboards(keywords));
      return true;
    }

    case 'get-whiteboard': {
      const id = args[0];
      if (!id) {
        console.log(c.red('用法：/get-whiteboard <id>'));
        return true;
      }
      await run('讀取白板中…', () => client.getWhiteboard(id));
      return true;
    }

    case 'object': {
      const id = args[0];
      const type = args[1];
      if (!id || !type) {
        console.log(c.red('用法：/object <id> <type>'));
        console.log(c.dim('  type: card, journal, pdfCard, highlightElement, section …'));
        return true;
      }
      await run('讀取物件中…', () => client.getObject(id, type as ObjectType));
      return true;
    }

    case 'pdf-search': {
      const id = args[0];
      const keywords = args.slice(1);
      if (!id || keywords.length === 0) {
        console.log(c.red('用法：/pdf-search <id> <keyword1> [keyword2] …'));
        return true;
      }
      await run('搜尋 PDF 中…', () => client.searchPdfContent(id, keywords));
      return true;
    }

    case 'pdf-pages': {
      const id = args[0];
      const startPage = parseInt(args[1], 10);
      const endPage = parseInt(args[2], 10);
      if (!id || isNaN(startPage) || isNaN(endPage)) {
        console.log(c.red('用法：/pdf-pages <id> <startPage> <endPage>'));
        return true;
      }
      await run('取得 PDF 頁面中…', () => client.getPdfPages(id, startPage, endPage));
      return true;
    }

    case 'deep-dive': {
      const queryOrId = args.join(' ');
      if (!queryOrId) {
        console.log(c.red('用法：/deep-dive <query 或 whiteboard_id>'));
        return true;
      }
      await runWorkflow('白板深入探索中…', async () => {
        // 如果看起來像 ID（含連字號且無空格），用 whiteboard_id；否則用 query
        const isId = /^[\w-]+$/.test(queryOrId) && queryOrId.includes('-');
        return whiteboardDeepDive(client, isId ? { whiteboard_id: queryOrId } : { query: queryOrId });
      });
      return true;
    }

    case 'pdf-research': {
      const topic = args[0];
      const pdfId = args[1];
      if (!topic) {
        console.log(c.red('用法：/pdf-research <topic> [pdf_id]'));
        return true;
      }
      await runWorkflow('PDF 研究中…', () =>
        pdfResearch(client, { topic, pdf_id: pdfId }),
      );
      return true;
    }

    case 'review': {
      const startDate = args[0];
      const endDate = args[1];
      const topic = args.slice(2).join(' ') || undefined;
      if (!startDate || !endDate) {
        console.log(c.red('用法：/review <start_date> <end_date> [topic]'));
        return true;
      }
      await runWorkflow('知識回顧中…', () =>
        knowledgeReview(client, { start_date: startDate, end_date: endDate, topic }),
      );
      return true;
    }

    default:
      console.log(c.red(`未知指令：/${cmd}`));
      console.log(c.dim('輸入 /help 查看可用指令'));
      return true;
  }
}

// ── Run with spinner ──────────────────────────────────────────

async function run(
  label: string,
  fn: () => Promise<import('../../types/official-tools.js').McpToolResult>,
): Promise<void> {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${c.cyan(frames[i++ % frames.length])} ${label}`);
  }, 80);

  try {
    const result = await fn();
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(label.length + 4) + '\r');
    const output = formatResult(result, false);
    if (result.isError) {
      console.log(c.red(output));
    } else {
      console.log(output);
    }
  } catch (error) {
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(label.length + 4) + '\r');
    console.log(c.red(`錯誤：${error instanceof Error ? error.message : error}`));
  }
}

// ── Run workflow with spinner ─────────────────────────────

async function runWorkflow(
  label: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${c.cyan(frames[i++ % frames.length])} ${label}`);
  }, 80);

  try {
    const result = await fn();
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(label.length + 4) + '\r');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    clearInterval(timer);
    process.stdout.write('\r' + ' '.repeat(label.length + 4) + '\r');
    console.log(c.red(`錯誤：${error instanceof Error ? error.message : error}`));
  }
}

// ── Command factory ───────────────────────────────────────────

export function createTuiCommand(): Command {
  return new Command('tui')
    .alias('t')
    .description('TUI 模式 — REPL 風格的終端介面')
    .action(async () => {
      const tokenManager = new TokenManager();
      if (!tokenManager.isTokenValid()) {
        console.log(c.red('尚未登入或 Token 已過期。請先執行 `heptabase auth login`。'));
        process.exit(1);
      }

      const mcp = createMcpClient(tokenManager);
      const client = new HeptabaseClient(mcp);

      console.clear();
      printBanner();

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: c.cyan('heptabase> '),
      });

      rl.prompt();

      rl.on('line', async (line) => {
        const keepGoing = await exec(client, line);
        if (keepGoing) {
          rl.prompt();
        } else {
          rl.close();
        }
      });

      rl.on('close', () => {
        console.log(c.dim('\n再見！'));
        process.exit(0);
      });
    });
}
