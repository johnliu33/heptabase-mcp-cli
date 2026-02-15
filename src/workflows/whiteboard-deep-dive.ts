import type { HeptabaseClient } from '../client/index.js';
import type { ObjectType } from '../types/official-tools.js';
import type {
  WhiteboardDeepDiveInput,
  WhiteboardDeepDiveOutput,
  WhiteboardObject,
} from '../types/workflows.js';
import { extractText } from '../utils/mcp-result.js';
import {
  parseWhiteboardSearchResult,
  parseWhiteboardObjects,
  isPdfType,
  hasMoreContent,
} from './parsers.js';

export async function whiteboardDeepDive(
  client: HeptabaseClient,
  input: WhiteboardDeepDiveInput,
): Promise<WhiteboardDeepDiveOutput> {
  // 1. 取得白板 ID
  let whiteboardId: string;
  let whiteboardName: string;

  if (input.whiteboard_id) {
    whiteboardId = input.whiteboard_id;
    // 直接取得白板
    const wbResult = await client.getWhiteboard(whiteboardId);
    const text = extractText(wbResult);
    const nameMatch = text.match(/title="([^"]+)"/);
    whiteboardName = nameMatch ? nameMatch[1] : whiteboardId;
  } else if (input.query) {
    // 搜尋白板
    const searchResult = await client.searchWhiteboards([input.query]);
    const whiteboards = parseWhiteboardSearchResult(searchResult);
    if (whiteboards.length === 0) {
      return {
        whiteboard_name: '',
        total_objects: 0,
        objects: [],
        incomplete_objects: [],
      };
    }
    whiteboardId = whiteboards[0].id;
    whiteboardName = whiteboards[0].name;
  } else {
    throw new Error('必須提供 query 或 whiteboard_id');
  }

  // 2. 取得白板物件清單
  const wbResult = input.whiteboard_id
    ? await client.getWhiteboard(whiteboardId)  // 已取過，會命中快取
    : await client.getWhiteboard(whiteboardId);
  const parsedObjects = parseWhiteboardObjects(wbResult);

  // 3. 並行取得物件內容
  const incompleteObjects: string[] = [];

  const results = await Promise.allSettled(
    parsedObjects.map(async (obj) => {
      if (isPdfType(obj.type)) {
        // PDF 類型：使用 search_pdf_content，不呼叫 get_object (WT-02)
        const query = input.query ?? obj.title;
        const pdfResult = await client.searchPdfContent(obj.id, [query]);
        const content = extractText(pdfResult);
        return { obj, content, incomplete: false };
      } else {
        // 其他類型：使用 get_object
        const objResult = await client.getObject(obj.id, obj.type as ObjectType);
        const content = extractText(objResult);
        const incomplete = hasMoreContent(objResult);
        return { obj, content, incomplete };
      }
    }),
  );

  const objects: WhiteboardObject[] = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      if (r.value.incomplete) {
        incompleteObjects.push(r.value.obj.id);
      }
      return {
        id: r.value.obj.id,
        type: r.value.obj.type,
        title: r.value.obj.title,
        content: r.value.content,
        content_status: 'ok' as const,
      };
    }
    // 容錯：個別物件失敗不中斷
    const obj = parsedObjects[i];
    client.logger.warn(`whiteboard-deep-dive: 取得物件 ${obj.id} 失敗 — ${r.reason}`);
    return {
      id: obj.id,
      type: obj.type,
      title: obj.title,
      content: '',
      content_status: 'skipped' as const,
    };
  });

  return {
    whiteboard_name: whiteboardName,
    total_objects: parsedObjects.length,
    objects,
    incomplete_objects: incompleteObjects,
  };
}
