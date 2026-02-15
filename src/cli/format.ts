import type { SemanticSearchOutput, SearchWhiteboardsOutput, GetWhiteboardOutput, GetObjectOutput } from '../types/official-tools.js';

export function formatSearchResults(result: SemanticSearchOutput, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);

  if (result.objects.length === 0) return '找不到相關結果。';

  const lines = ['', `找到 ${result.objects.length} 筆結果：`, ''];
  const header = padColumns(['#', 'Type', 'Title', 'Score', 'ID']);
  lines.push(header);
  lines.push('─'.repeat(80));

  result.objects.forEach((obj, i) => {
    lines.push(padColumns([
      String(i + 1),
      obj.type,
      truncate(obj.title, 30),
      obj.score.toFixed(2),
      obj.id,
    ]));
  });

  return lines.join('\n');
}

export function formatWhiteboardList(result: SearchWhiteboardsOutput, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);

  if (result.whiteboards.length === 0) return '找不到相關白板。';

  const lines = ['', `找到 ${result.whiteboards.length} 個白板：`, ''];
  const header = padColumns(['#', 'Name', 'Objects', 'ID']);
  lines.push(header);
  lines.push('─'.repeat(70));

  result.whiteboards.forEach((wb, i) => {
    lines.push(padColumns([
      String(i + 1),
      truncate(wb.name, 35),
      String(wb.object_count),
      wb.id,
    ]));
  });

  return lines.join('\n');
}

export function formatWhiteboard(result: GetWhiteboardOutput, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);

  const wb = result.whiteboard;
  const lines = [
    '',
    `白板：${wb.name}`,
    `物件數：${wb.objects.length}`,
    '',
  ];

  wb.objects.forEach((obj, i) => {
    lines.push(`  ${i + 1}. [${obj.type}] ${obj.title} (${obj.id})`);
    if (obj.partial_content) {
      lines.push(`     ${truncate(obj.partial_content, 60)}`);
    }
  });

  return lines.join('\n');
}

export function formatObject(result: GetObjectOutput, json: boolean): string {
  if (json) return JSON.stringify(result, null, 2);

  const obj = result.object;
  const lines = [
    '',
    `標題：${obj.title}`,
    `類型：${obj.type}`,
    `ID：${obj.id}`,
    `內容完整：${obj.hasMore ? '否（hasMore=true）' : '是'}`,
    '',
    '─'.repeat(60),
    obj.content || '（無內容）',
  ];

  return lines.join('\n');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function padColumns(cols: string[]): string {
  const widths = [4, 8, 36, 8, 20];
  return cols.map((col, i) => col.padEnd(widths[i] ?? 20)).join('');
}
