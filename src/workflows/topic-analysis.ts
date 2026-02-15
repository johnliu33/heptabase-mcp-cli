import type { HeptabaseClient } from '../client/index.js';
import type { ObjectType } from '../types/official-tools.js';
import type {
  TopicAnalysisInput,
  TopicAnalysisOutput,
  RelatedNote,
} from '../types/workflows.js';
import { extractText } from '../utils/mcp-result.js';
import { parseSearchObjects } from './parsers.js';

export async function topicAnalysis(
  client: HeptabaseClient,
  input: TopicAnalysisInput,
): Promise<TopicAnalysisOutput> {
  const maxNotes = input.max_notes ?? 10;

  // 1. 語意搜尋找出相關筆記
  const searchResult = await client.semanticSearch([input.topic]);
  const objects = parseSearchObjects(searchResult).slice(0, maxNotes);

  // 2. 並行取得每個筆記的完整內容
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

  // 3. 容錯：只收集成功的結果
  const notes: RelatedNote[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      notes.push(r.value);
    } else {
      client.logger.warn(`topic-analysis: 取得物件失敗 — ${r.reason}`);
    }
  }

  return {
    topic: input.topic,
    total_notes: notes.length,
    notes,
  };
}
