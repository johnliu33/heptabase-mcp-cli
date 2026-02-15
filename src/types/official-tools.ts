// Phase 1: 4 read tools 的型別定義
// 根據 Heptabase MCP 官方 API 實際 schema（2026-02-15 取得）

export type ObjectType =
  | 'card'
  | 'journal'
  | 'pdfCard'
  | 'videoCard'
  | 'audioCard'
  | 'imageCard'
  | 'mediaCard'
  | 'highlightElement'
  | 'textElement'
  | 'videoElement'
  | 'imageElement'
  | 'chat'
  | 'chatMessage'
  | 'chatMessagesElement'
  | 'section';

export type SearchableObjectType = 'card' | 'pdfCard' | 'mediaCard' | 'highlightElement' | 'journal';

// ─── semantic_search_objects ───

export interface SemanticSearchInput {
  queries: string[];              // 1-3 natural language queries
  resultObjectTypes: SearchableObjectType[]; // empty array = search all types
}

// MCP tool 回傳的是 content array，文字結果需要解析
export interface SemanticSearchOutput {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── search_whiteboards ───

export interface SearchWhiteboardsInput {
  keywords: string[];             // 1-5 keywords
}

export interface SearchWhiteboardsOutput {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── get_whiteboard_with_objects ───

export interface GetWhiteboardInput {
  whiteboardId: string;           // camelCase
}

export interface GetWhiteboardOutput {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── get_object ───

export interface GetObjectInput {
  objectId: string;
  objectType: ObjectType;
}

export interface GetObjectOutput {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ─── MCP Tool 通用回傳格式 ───
// 所有 MCP tool 回傳的都是 { content: [{type:'text', text:'...'}] }
// 實際資料結構在 text 欄位裡面（通常是 JSON 或純文字）

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}
