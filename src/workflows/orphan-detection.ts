import type { HeptabaseClient } from '../client/index.js';
import type {
  OrphanDetectionInput,
  OrphanDetectionOutput,
  OrphanObject,
} from '../types/workflows.js';
import {
  parseWhiteboardSearchResult,
  parseWhiteboardObjects,
  parseSearchObjects,
} from './parsers.js';

export async function orphanDetection(
  client: HeptabaseClient,
  input: OrphanDetectionInput,
): Promise<OrphanDetectionOutput> {
  const query = input.query ?? '';

  // 1. 搜尋白板列表
  const wbSearchResult = await client.searchWhiteboards([query || '']);
  const whiteboards = parseWhiteboardSearchResult(wbSearchResult);

  // 2. 並行取得每個白板的物件，收集所有白板內物件 ID（集合 A）
  const whiteboardObjectIds = new Set<string>();

  const wbResults = await Promise.allSettled(
    whiteboards.map(async (wb) => {
      const wbResult = await client.getWhiteboard(wb.id);
      return parseWhiteboardObjects(wbResult);
    }),
  );

  for (const r of wbResults) {
    if (r.status === 'fulfilled') {
      for (const obj of r.value) {
        whiteboardObjectIds.add(obj.id);
      }
    } else {
      client.logger.warn(`orphan-detection: 取得白板失敗 — ${r.reason}`);
    }
  }

  // 3. 語意搜尋取得物件 ID（集合 B）
  const searchResult = await client.semanticSearch([query || 'all notes']);
  const searchObjects = parseSearchObjects(searchResult);

  // 4. orphan_candidates = B - A（在搜尋結果中出現但不在任何白板上的物件）
  const orphanCandidates: OrphanObject[] = [];
  for (const obj of searchObjects) {
    if (!whiteboardObjectIds.has(obj.id)) {
      orphanCandidates.push({
        id: obj.id,
        title: obj.title,
        type: obj.type,
      });
    }
  }

  return {
    total_whiteboards: whiteboards.length,
    total_whiteboard_objects: whiteboardObjectIds.size,
    orphan_candidates: orphanCandidates,
  };
}
