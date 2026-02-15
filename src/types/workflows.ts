import type { ObjectType } from './official-tools.js';

// ─── Whiteboard Deep Dive ───

export interface WhiteboardDeepDiveInput {
  query?: string;
  whiteboard_id?: string;
}

export interface WhiteboardObject {
  id: string;
  type: string;
  title: string;
  content: string;
  content_status: 'ok' | 'skipped';
}

export interface WhiteboardDeepDiveOutput {
  whiteboard_name: string;
  total_objects: number;
  objects: WhiteboardObject[];
  incomplete_objects: string[];
}

// ─── PDF Research ───

export interface PdfResearchInput {
  topic: string;
  pdf_id?: string;
}

export interface PdfResearchOutput {
  pdf_title: string;
  relevant_pages: number[];
  page_contents: string;
  source_chunks_count: number;
}

// ─── Knowledge Review ───

export interface KnowledgeReviewInput {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  topic?: string;
}

export interface RelatedNote {
  id: string;
  type: ObjectType;
  title: string;
  content: string;
}

export interface KnowledgeReviewOutput {
  period: string;
  journal_count: number;
  related_notes_count: number;
  journal_content: string;
  related_notes: RelatedNote[];
}
