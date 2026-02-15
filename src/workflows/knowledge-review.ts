import type { HeptabaseClient } from '../client/index.js';
import type { ObjectType } from '../types/official-tools.js';
import type {
  KnowledgeReviewInput,
  KnowledgeReviewOutput,
  RelatedNote,
} from '../types/workflows.js';
import { extractText } from '../utils/mcp-result.js';
import { parseSearchObjects } from './parsers.js';

export async function knowledgeReview(
  client: HeptabaseClient,
  input: KnowledgeReviewInput,
): Promise<KnowledgeReviewOutput> {
  // 1. 取得日誌內容（Layer 2 已處理 >90 天自動分割）
  const journalResult = await client.getJournalRange(input.start_date, input.end_date);
  const journalContent = extractText(journalResult);

  // 計算 journal 數量（從回傳文字中計算 <journal 標籤）
  const journalMatches = journalContent.match(/<journal\b/g);
  const journalCount = journalMatches ? journalMatches.length : (journalContent ? 1 : 0);

  // 2. 有 topic 時搜尋相關筆記（並行取得）
  const relatedNotes: RelatedNote[] = [];
  if (input.topic) {
    const searchResult = await client.semanticSearch([input.topic]);
    const objects = parseSearchObjects(searchResult);

    const results = await Promise.allSettled(
      objects.map(async (obj) => {
        const objResult = await client.getObject(obj.id, obj.type as ObjectType);
        const content = extractText(objResult);
        return {
          id: obj.id,
          type: obj.type as ObjectType,
          title: obj.title,
          content,
        } satisfies RelatedNote;
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        relatedNotes.push(r.value);
      } else {
        client.logger.warn(`knowledge-review: 取得相關筆記失敗 — ${r.reason}`);
      }
    }
  }

  return {
    period: `${input.start_date} ~ ${input.end_date}`,
    journal_count: journalCount,
    related_notes_count: relatedNotes.length,
    journal_content: journalContent,
    related_notes: relatedNotes,
  };
}
