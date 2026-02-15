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

  // 3. 逐一取得物件內容
  const objects: WhiteboardObject[] = [];
  const incompleteObjects: string[] = [];

  for (const obj of parsedObjects) {
    try {
      if (isPdfType(obj.type)) {
        // PDF 類型：使用 search_pdf_content，不呼叫 get_object (WT-02)
        const query = input.query ?? obj.title;
        const pdfResult = await client.searchPdfContent(obj.id, [query]);
        const content = extractText(pdfResult);
        objects.push({
          id: obj.id,
          type: obj.type,
          title: obj.title,
          content,
          content_status: 'ok',
        });
      } else {
        // 其他類型：使用 get_object
        const objResult = await client.getObject(obj.id, obj.type as ObjectType);
        const content = extractText(objResult);
        const incomplete = hasMoreContent(objResult);
        objects.push({
          id: obj.id,
          type: obj.type,
          title: obj.title,
          content,
          content_status: 'ok',
        });
        if (incomplete) {
          incompleteObjects.push(obj.id);
        }
      }
    } catch {
      // 容錯：個別物件失敗不中斷
      objects.push({
        id: obj.id,
        type: obj.type,
        title: obj.title,
        content: '',
        content_status: 'skipped',
      });
    }
  }

  return {
    whiteboard_name: whiteboardName,
    total_objects: parsedObjects.length,
    objects,
    incomplete_objects: incompleteObjects,
  };
}
