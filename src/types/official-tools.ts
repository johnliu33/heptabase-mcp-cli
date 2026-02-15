// Phase 1: 4 read tools 的型別定義
// 來源：heptabase-extension-spec.md 第 8.1 節

export type ObjectType = 'card' | 'journal' | 'pdf' | 'media' | 'text';

// ─── semantic_search_objects ───

export interface SemanticSearchInput {
  query: string;
}

export interface SemanticSearchOutput {
  objects: Array<{
    id: string;
    type: ObjectType;
    title: string;
    snippet: string;
    score: number;
  }>;
}

// ─── search_whiteboards ───

export interface SearchWhiteboardsInput {
  query: string;
}

export interface SearchWhiteboardsOutput {
  whiteboards: Array<{
    id: string;
    name: string;
    object_count: number;
  }>;
}

// ─── get_whiteboard_with_objects ───

export interface GetWhiteboardInput {
  whiteboard_id: string;
}

export interface GetWhiteboardOutput {
  whiteboard: {
    id: string;
    name: string;
    objects: Array<{
      id: string;
      type: ObjectType;
      title: string;
      partial_content: string;
      position: { x: number; y: number };
    }>;
  };
}

// ─── get_object ───

export interface GetObjectInput {
  object_id: string;
}

export interface GetObjectOutput {
  object: {
    id: string;
    type: ObjectType;
    title: string;
    content: string;
    hasMore: boolean;
  };
}
