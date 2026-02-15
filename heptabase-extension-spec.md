# Heptabase MCP Extension 設計規格書

> **版本**: 2.0.0
> **日期**: 2026-02-15
> **作者**: Bincentive
> **狀態**: 設計階段
> **定位**: 包裝官方 Heptabase MCP 的 Client / Workflow 層

---

## 目錄

1. [概覽](#1-概覽)
2. [架構設計](#2-架構設計)
3. [官方 MCP Tools 對接層](#3-官方-mcp-tools-對接層)
4. [高階 Workflow 設計](#4-高階-workflow-設計)
5. [認證與設定](#5-認證與設定)
6. [資料流設計](#6-資料流設計)
7. [專案結構](#7-專案結構)
8. [核心型別定義](#8-核心型別定義)
9. [使用情境範例](#9-使用情境範例)
10. [測試策略與案例](#10-測試策略與案例)
11. [實作優先順序](#11-實作優先順序)

---

## 1. 概覽

### 1.1 基本資訊

| 項目 | 說明 |
|------|------|
| **名稱** | `heptabase-extension` |
| **定位** | 包裝官方 Heptabase MCP 的 Client / Workflow 層 |
| **目的** | 在官方 9 個 MCP tools 之上，提供高階分析與自動化 workflow |
| **官方 MCP Endpoint** | `https://api.heptabase.com/mcp` |
| **認證方式** | OAuth（瀏覽器授權流程） |
| **目標使用者** | 個人使用 |

### 1.2 與官方 MCP 的關係

本專案**不是**獨立的 MCP Server，而是一個 **Client 層**，負責：

1. **對接官方 MCP**：直接呼叫官方提供的 9 個 tools，不自行實作資料存取
2. **編排 Workflow**：將多個官方 tools 串接成高階自動化流程
3. **補充能力**：在官方 tools 的回傳結果上，疊加分析、摘要、洞察等功能

```
┌─────────────────────────────────────────────────────────┐
│                    本專案的責任邊界                        │
│                                                         │
│  使用者 / Claude                                         │
│      │                                                   │
│      ▼                                                   │
│  ┌──────────────────────────────┐                       │
│  │   高階 Workflows             │ ← 本專案實作           │
│  │   (分析、摘要、洞察、匯出)     │                       │
│  └──────────────┬───────────────┘                       │
│                 ▼                                        │
│  ┌──────────────────────────────┐                       │
│  │   官方 MCP Tools 對接層       │ ← 本專案實作 (薄封裝)  │
│  │   (型別安全、錯誤處理、快取)   │                       │
│  └──────────────┬───────────────┘                       │
└─────────────────┼───────────────────────────────────────┘
                  ▼
  ┌──────────────────────────────┐
  │   Heptabase 官方 MCP Server   │ ← 由 Heptabase 維運
  │   https://api.heptabase.com   │
  │   /mcp                        │
  └──────────────────────────────┘
```

### 1.3 設計原則

1. **官方優先**：所有資料存取一律透過官方 MCP，不自建資料源
2. **薄封裝**：對接層只做型別安全、錯誤處理、快取，不改變官方 tool 語意
3. **Workflow 分離**：高階能力（分析、摘要）實作為 workflow，不宣告成 MCP tool
4. **可測試**：每一層都有獨立的測試策略

---

## 2. 架構設計

### 2.1 三層架構

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3: Workflow 層                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │  Whiteboard  │ │    PDF       │ │  Knowledge   │              │
│ │  Deep-Dive   │ │  Research    │ │  Analysis    │   ...更多     │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘              │
│        │                │                │                       │
├────────┴────────────────┴────────────────┴───────────────────────┤
│ Layer 2: 官方 Tool 對接層 (HeptabaseClient)                       │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  semantic_search_objects | search_whiteboards | get_object │   │
│ │  get_whiteboard_with_objects | get_journal_range           │   │
│ │  save_to_note_card | append_to_journal                     │   │
│ │  search_pdf_content | get_pdf_pages                        │   │
│ ├────────────────────────────────────────────────────────────┤   │
│ │  + 型別安全  + 錯誤處理  + 重試  + 快取  + 日誌            │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Layer 1: 傳輸層                                                   │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  MCP Client (JSON-RPC over stdio/SSE)                      │   │
│ │  OAuth Token 管理  |  連線狀態監控                           │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 各層職責

| 層級 | 職責 | 測試方式 |
|------|------|---------|
| **Layer 1: 傳輸層** | OAuth 認證、MCP 連線管理、JSON-RPC 通訊 | 整合測試 |
| **Layer 2: 對接層** | 官方 tool 的型別封裝、錯誤處理、快取、重試 | 契約測試 |
| **Layer 3: Workflow 層** | 多 tool 編排、分析邏輯、摘要生成 | 流程測試 |

---

## 3. 官方 MCP Tools 對接層

### 3.1 官方 Tools 總覽

官方目前提供 **9 個 MCP Tools**，本專案的對接層一對一封裝：

| # | 官方 Tool 名稱 | 類型 | 說明 | 已知限制 |
|---|---------------|------|------|---------|
| 1 | `semantic_search_objects` | 讀取 | 全文 + 語意混合搜尋 | — |
| 2 | `search_whiteboards` | 讀取 | 搜尋白板 | — |
| 3 | `get_whiteboard_with_objects` | 讀取 | 取得白板結構與物件（partial content） | 物件內容為部分摘要 |
| 4 | `get_object` | 讀取 | 深度讀取單一物件完整內容 | 大型 PDF 不適合直接讀取；回傳含 `hasMore` 指示 |
| 5 | `get_journal_range` | 讀取 | 取得日期區間的 Journal | 單次約 3 個月上限 |
| 6 | `save_to_note_card` | 寫入 | 建立新 Card（進入 Inbox） | — |
| 7 | `append_to_journal` | 寫入 | 追加到今日 Journal（不覆蓋，不存在時自動建立） | 只能追加，不能覆蓋 |
| 8 | `search_pdf_content` | PDF | 搜尋 PDF 內文 | 最多回傳約 80 chunks |
| 9 | `get_pdf_pages` | PDF | 取得 PDF 指定頁面 | 頁碼從 1 開始 |

### 3.2 各 Tool 詳細對接規格

#### 3.2.1 `semantic_search_objects` — 語意搜尋

```typescript
/**
 * 全文 + 語意混合搜尋，可搜尋 notes、journals、PDFs 等
 */
interface SemanticSearchInput {
  query: string;          // 搜尋語句（支援自然語言）
}

interface SemanticSearchResult {
  objects: SearchHit[];   // 匹配的物件列表
}

interface SearchHit {
  id: string;
  type: 'card' | 'journal' | 'pdf' | 'media';
  title: string;
  snippet: string;        // 匹配的文字片段
  score: number;          // 相關度
}
```

**對接層行為**：
- 直接轉發查詢到官方 tool
- 快取搜尋結果（TTL: 60 秒，相同 query 不重複搜尋）
- 回傳結果附帶物件 ID，供後續 `get_object` 使用

---

#### 3.2.2 `search_whiteboards` — 搜尋白板

```typescript
interface SearchWhiteboardsInput {
  query: string;          // 搜尋白板名稱或內容
}

interface SearchWhiteboardsResult {
  whiteboards: WhiteboardSummary[];
}

interface WhiteboardSummary {
  id: string;
  name: string;
  object_count: number;   // 白板上的物件數量
}
```

**對接層行為**：
- 直接轉發查詢
- 回傳 whiteboard ID 列表，供 `get_whiteboard_with_objects` 使用

---

#### 3.2.3 `get_whiteboard_with_objects` — 取得白板結構

```typescript
interface GetWhiteboardInput {
  whiteboard_id: string;
}

interface GetWhiteboardResult {
  whiteboard: {
    id: string;
    name: string;
    objects: WhiteboardObject[];
  };
}

interface WhiteboardObject {
  id: string;
  type: 'card' | 'journal' | 'pdf' | 'media' | 'text';
  title: string;
  partial_content: string;  // ⚠️ 部分內容摘要，非完整內容
  position: { x: number; y: number };
}
```

**對接層行為**：
- **重要**：回傳的 `partial_content` 是摘要，不是完整內容
- 如需完整內容，需要再對個別物件呼叫 `get_object`
- 對接層提供 helper：`getWhiteboardDeep(id)` 自動對每個物件做 `get_object`

---

#### 3.2.4 `get_object` — 深度讀取物件

```typescript
interface GetObjectInput {
  object_id: string;
}

interface GetObjectResult {
  object: {
    id: string;
    type: string;
    title: string;
    content: string;        // 完整 Markdown 內容
    hasMore: boolean;       // ⚠️ 是否還有更多內容未回傳
  };
}
```

**對接層行為**：
- 若 `hasMore === true`，記錄日誌並通知 workflow 層內容不完整
- 大型 PDF 物件：**不應**使用此 tool 讀取，改用 `search_pdf_content` + `get_pdf_pages`
- 對接層增加防護：偵測到 type 為 PDF 且檔案較大時，自動提示改用 PDF 流程

---

#### 3.2.5 `get_journal_range` — 取得 Journal 區間

```typescript
interface GetJournalRangeInput {
  start_date: string;     // YYYY-MM-DD（inclusive）
  end_date: string;       // YYYY-MM-DD（inclusive）
}

interface GetJournalRangeResult {
  journals: JournalEntry[];
}

interface JournalEntry {
  date: string;           // YYYY-MM-DD
  content: string;        // 完整 Markdown 內容
}
```

**對接層行為**：
- **限制**：單次請求最多約 3 個月
- 若請求超過 3 個月，對接層**自動拆分**成多次請求並合併結果
- 拆分邏輯：以 90 天為單位切分，依序呼叫，合併後排序

```typescript
// 自動拆分範例
async function getJournalRangeSafe(
  startDate: string,
  endDate: string
): Promise<JournalEntry[]> {
  const chunks = splitDateRange(startDate, endDate, 90); // 每 90 天一段
  const results = [];
  for (const chunk of chunks) {
    const res = await mcpClient.callTool('get_journal_range', {
      start_date: chunk.start,
      end_date: chunk.end,
    });
    results.push(...res.journals);
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}
```

---

#### 3.2.6 `save_to_note_card` — 建立卡片

```typescript
interface SaveToNoteCardInput {
  title: string;
  content: string;        // Markdown 格式
}

interface SaveToNoteCardResult {
  card_id: string;        // 新建 Card 的 ID
  status: 'success';
}
```

**對接層行為**：
- 新卡片會出現在 Heptabase **Inbox**
- 寫入後清除相關搜尋快取
- 回傳 `card_id` 可用於後續追蹤

---

#### 3.2.7 `append_to_journal` — 追加 Journal

```typescript
interface AppendToJournalInput {
  content: string;        // 要追加的內容（Markdown）
}

interface AppendToJournalResult {
  date: string;           // 追加到的日期
  status: 'success';
}
```

**對接層行為**：
- **追加**到今日 Journal，不會覆蓋既有內容
- 若今日 Journal 不存在，會**自動建立**
- 寫入後清除當日 journal 快取

---

#### 3.2.8 `search_pdf_content` — 搜尋 PDF 內容

```typescript
interface SearchPdfContentInput {
  object_id: string;      // PDF 物件的 ID
  query: string;          // 搜尋關鍵字
}

interface SearchPdfContentResult {
  chunks: PdfChunk[];     // ⚠️ 最多約 80 chunks
}

interface PdfChunk {
  page_number: number;    // 所在頁碼
  content: string;        // 匹配的文字片段
  score: number;          // 相關度
}
```

**對接層行為**：
- 最多回傳約 **80 chunks**
- 回傳的 `page_number` 可用於 `get_pdf_pages` 精確取頁

---

#### 3.2.9 `get_pdf_pages` — 取得 PDF 頁面

```typescript
interface GetPdfPagesInput {
  object_id: string;      // PDF 物件的 ID
  page_numbers: number[]; // 頁碼列表（⚠️ 從 1 開始）
}

interface GetPdfPagesResult {
  pages: PdfPage[];
}

interface PdfPage {
  page_number: number;
  content: string;        // 該頁完整文字
}
```

**對接層行為**：
- 頁碼**從 1 開始**（不是 0）
- 建議搭配 `search_pdf_content` 先定位再取頁，避免盲目拉全文

---

## 4. 高階 Workflow 設計

Workflow 是本專案的核心價值——在官方 tools 之上編排多步驟自動化流程。

### 4.1 Workflow 總覽

| Workflow 名稱 | 說明 | 串接的官方 Tools |
|--------------|------|-----------------|
| `whiteboard_deep_dive` | 深度閱讀白板，產出結構化摘要 | `search_whiteboards` → `get_whiteboard_with_objects` → `get_object` |
| `pdf_research` | 搜尋 PDF 內容並產出主題報告 | `semantic_search_objects` → `search_pdf_content` → `get_pdf_pages` |
| `knowledge_review` | 回顧指定時段的知識累積 | `get_journal_range` → `semantic_search_objects` → `get_object` |
| `save_and_link` | 儲存 AI 產出並關聯到相關筆記 | `save_to_note_card` → `semantic_search_objects` |
| `daily_digest` | 產出今日工作摘要並寫入 Journal | `get_journal_range` → `semantic_search_objects` → `append_to_journal` |
| `topic_analysis` | 分析特定主題的所有相關筆記 | `semantic_search_objects` → `get_object` (multiple) |
| `orphan_detection` | 找出可能被遺忘的孤立筆記 | `search_whiteboards` → `get_whiteboard_with_objects` → `semantic_search_objects` |

### 4.2 各 Workflow 詳細設計

#### 4.2.1 `whiteboard_deep_dive` — 白板深度閱讀

**目的**：完整讀取一個白板的所有內容，產出結構化摘要。

```
輸入: whiteboard 名稱或 ID
  │
  ▼
search_whiteboards(query)         ← 若輸入是名稱，先搜尋
  │
  ▼
get_whiteboard_with_objects(id)   ← 取得白板結構 (partial content)
  │
  ├─ 對每個 object:
  │   ├─ type == 'pdf' ? → 走 PDF 流程 (search_pdf_content)
  │   └─ 其他 → get_object(object_id)
  │             └─ 檢查 hasMore → 記錄不完整物件
  │
  ▼
組合所有內容 → 產出結構化摘要
  │
  ▼
輸出: {
  whiteboard_name,
  total_objects,
  summary,                       ← AI 生成的摘要
  objects: [{ id, title, type, content_status }],
  incomplete_objects: [...]       ← hasMore=true 的物件清單
}
```

---

#### 4.2.2 `pdf_research` — PDF 研究流程

**目的**：在大型 PDF 中搜尋特定主題，取出相關頁面並產出報告。

```
輸入: { topic, pdf_id? }
  │
  ▼
(若無 pdf_id)
semantic_search_objects(topic)    ← 找到相關 PDF
  │
  ▼
search_pdf_content(pdf_id, topic) ← 搜尋 PDF 內容（≤80 chunks）
  │
  ▼
從 chunks 中提取不重複的 page_numbers
  │
  ▼
get_pdf_pages(pdf_id, pages)      ← 取得完整頁面內容
  │
  ▼
組合頁面內容 → 產出研究報告
  │
  ▼
輸出: {
  pdf_title,
  relevant_pages: [...],
  report,                        ← AI 生成的主題報告
  source_chunks_count
}
```

---

#### 4.2.3 `knowledge_review` — 知識回顧

**目的**：回顧指定時間段的 Journal 和相關筆記，產出知識累積報告。

```
輸入: { start_date, end_date, topic? }
  │
  ▼
get_journal_range(start, end)     ← 自動拆分（若 >3 個月）
  │
  ▼
(若指定 topic)
semantic_search_objects(topic)    ← 找出同主題的筆記
  │
  ▼
get_object(各相關物件)             ← 深讀相關筆記
  │
  ▼
交叉比對 Journal 與筆記 → 產出知識回顧
  │
  ▼
輸出: {
  period,
  journal_count,
  related_notes_count,
  themes: [...],                 ← 自動萃取的主題
  timeline: [...],               ← 按日期排列的重點
  insights                       ← AI 生成的洞察
}
```

---

#### 4.2.4 `save_and_link` — 儲存並關聯

**目的**：將 AI 產出存為卡片，並找出知識庫中相關的既有筆記。

```
輸入: { title, content }
  │
  ▼
save_to_note_card(title, content)  ← 存入 Inbox
  │
  ▼
semantic_search_objects(title)     ← 搜尋相關筆記
  │
  ▼
輸出: {
  new_card_id,
  related_notes: [...],            ← 建議使用者在 Heptabase 中連結
  suggestion                       ← "建議將此卡片放到 XX 白板"
}
```

---

#### 4.2.5 `daily_digest` — 每日摘要

**目的**：彙總今日的工作紀錄，產出摘要並自動寫入 Journal。

```
輸入: { additional_notes? }
  │
  ▼
get_journal_range(today, today)    ← 取得今日已有的 Journal
  │
  ▼
semantic_search_objects("today's work") ← 搜尋今日相關筆記
  │
  ▼
AI 產出每日摘要
  │
  ▼
append_to_journal(summary)         ← 追加到今日 Journal
  │
  ▼
輸出: {
  date,
  summary,
  appended: true
}
```

---

## 5. 認證與設定

### 5.1 認證流程（OAuth）

```
使用者                    Extension                   Heptabase
  │                          │                           │
  │  啟動 Extension          │                           │
  ├─────────────────────────>│                           │
  │                          │                           │
  │  開啟瀏覽器授權頁面       │  OAuth 授權請求            │
  │<─────────────────────────├──────────────────────────>│
  │                          │                           │
  │  使用者登入並按 Allow     │                           │
  ├──────────────────────────┼──────────────────────────>│
  │                          │                           │
  │                          │  回傳 access_token         │
  │                          │<──────────────────────────┤
  │                          │                           │
  │  授權完成，可以開始使用   │                           │
  │<─────────────────────────┤                           │
```

### 5.2 Token 管理

```typescript
interface TokenManager {
  getToken(): Promise<string>;         // 取得有效 token
  refreshToken(): Promise<string>;     // 刷新 token
  isTokenValid(): boolean;             // 檢查 token 是否有效
  clearToken(): void;                  // 清除 token（登出）
}
```

**行為規則**：
- Token 過期前自動 refresh
- Refresh 失敗時引導使用者重新授權
- Token 安全儲存在本地（不進版本控制）

### 5.3 Claude Desktop 設定

設定檔位置：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "heptabase": {
      "url": "https://api.heptabase.com/mcp",
      "transport": "sse",
      "auth": {
        "type": "oauth"
      }
    }
  }
}
```

> **注意**：不再使用 API Key，不再需要 `HEPTABASE_BACKUP_PATH` 或 `HEPTABASE_DATA_SOURCE` 等環境變數。

### 5.4 Extension 自身設定（可選）

```json
{
  "heptabase_extension": {
    "cache_ttl": 300,
    "journal_range_max_days": 90,
    "pdf_max_chunks": 80,
    "log_level": "info",
    "workflows": {
      "whiteboard_deep_dive": { "enabled": true },
      "pdf_research": { "enabled": true },
      "knowledge_review": { "enabled": true },
      "save_and_link": { "enabled": true },
      "daily_digest": { "enabled": true },
      "topic_analysis": { "enabled": true },
      "orphan_detection": { "enabled": true }
    }
  }
}
```

---

## 6. 資料流設計

### 6.1 搜尋 → 深讀流程（最常見模式）

```
使用者                    Extension                  官方 MCP Server
  │                          │                           │
  │ "找我關於 MCP 的筆記"    │                           │
  ├─────────────────────────>│                           │
  │                          │                           │
  │                          │ semantic_search_objects    │
  │                          │ { query: "MCP" }          │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [partial results]         │
  │                          │                           │
  │                          │ get_object (for top 3)    │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [full content]            │
  │                          │                           │
  │ 搜尋結果 + 完整內容      │                           │
  │<─────────────────────────┤                           │
```

### 6.2 白板深度閱讀流程

```
使用者                    Extension                  官方 MCP Server
  │                          │                           │
  │ "閱讀我的專案白板"       │                           │
  ├─────────────────────────>│                           │
  │                          │                           │
  │                          │ search_whiteboards        │
  │                          │ { query: "專案" }         │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [whiteboard_id: "wb-123"] │
  │                          │                           │
  │                          │ get_whiteboard_with_objects│
  │                          │ { id: "wb-123" }          │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [structure + partial]     │
  │                          │                           │
  │                          │ get_object("card-1")      │
  │                          │ get_object("card-2")      │
  │                          │ ...                       │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [full content per card]   │
  │                          │                           │
  │ 白板結構 + 所有卡片全文   │                           │
  │<─────────────────────────┤                           │
```

### 6.3 PDF 研究流程

```
使用者                    Extension                  官方 MCP Server
  │                          │                           │
  │ "這份 PDF 裡關於         │                           │
  │  pricing 的部分"         │                           │
  ├─────────────────────────>│                           │
  │                          │                           │
  │                          │ search_pdf_content        │
  │                          │ { id: "pdf-1",            │
  │                          │   query: "pricing" }      │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [chunks, ≤80]             │
  │                          │ pages: [3, 7, 12]         │
  │                          │                           │
  │                          │ get_pdf_pages             │
  │                          │ { id: "pdf-1",            │
  │                          │   pages: [3, 7, 12] }     │
  │                          ├──────────────────────────>│
  │                          │<──────────────────────────┤
  │                          │ [full page text]          │
  │                          │                           │
  │ 完整頁面內容 + 摘要      │                           │
  │<─────────────────────────┤                           │
```

### 6.4 錯誤處理流程

```
所有 Tool 呼叫
  │
  ├─ 成功 → 回傳結果 → 更新快取
  │
  ├─ 401 Unauthorized
  │    └→ 嘗試 refreshToken()
  │         ├─ 成功 → 重試原請求
  │         └─ 失敗 → 引導使用者重新 OAuth 授權
  │
  ├─ 429 Rate Limited
  │    └→ 指數退避重試（最多 3 次）
  │
  ├─ 5xx Server Error
  │    └→ 重試（最多 3 次）→ 仍失敗則回傳錯誤
  │
  └─ Network Error
       └→ 檢查連線 → 重試 → 回傳離線錯誤
```

---

## 7. 專案結構

```
heptabase-extension/
├── src/
│   ├── index.ts                  # 進入點
│   │
│   ├── transport/                # Layer 1: 傳輸層
│   │   ├── mcp-client.ts         # MCP Client 連線管理
│   │   ├── oauth.ts              # OAuth 認證流程
│   │   └── token-manager.ts      # Token 儲存與刷新
│   │
│   ├── client/                   # Layer 2: 官方 Tool 對接層
│   │   ├── index.ts              # HeptabaseClient 主類別
│   │   ├── search.ts             # semantic_search_objects, search_whiteboards
│   │   ├── read.ts               # get_whiteboard_with_objects, get_object, get_journal_range
│   │   ├── write.ts              # save_to_note_card, append_to_journal
│   │   ├── pdf.ts                # search_pdf_content, get_pdf_pages
│   │   └── helpers.ts            # getJournalRangeSafe, getWhiteboardDeep 等
│   │
│   ├── workflows/                # Layer 3: Workflow 層
│   │   ├── index.ts              # Workflow 註冊與執行
│   │   ├── whiteboard-deep-dive.ts
│   │   ├── pdf-research.ts
│   │   ├── knowledge-review.ts
│   │   ├── save-and-link.ts
│   │   ├── daily-digest.ts
│   │   ├── topic-analysis.ts
│   │   └── orphan-detection.ts
│   │
│   ├── cache/                    # 快取
│   │   └── memory-cache.ts
│   │
│   ├── types/                    # 型別定義
│   │   ├── official-tools.ts     # 官方 9 個 tool 的 input/output 型別
│   │   ├── workflows.ts          # Workflow 的 input/output 型別
│   │   └── common.ts             # 共用型別
│   │
│   └── utils/
│       ├── date-range.ts         # 日期區間拆分
│       ├── retry.ts              # 重試邏輯
│       └── logger.ts             # 日誌
│
├── tests/
│   ├── contract/                 # 契約測試（Layer 2）
│   │   ├── search.contract.test.ts
│   │   ├── read.contract.test.ts
│   │   ├── write.contract.test.ts
│   │   └── pdf.contract.test.ts
│   │
│   ├── workflow/                 # 流程測試（Layer 3）
│   │   ├── whiteboard-deep-dive.test.ts
│   │   ├── pdf-research.test.ts
│   │   └── knowledge-review.test.ts
│   │
│   ├── integration/              # 整合測試
│   │   ├── oauth.test.ts
│   │   └── e2e-flow.test.ts
│   │
│   └── fixtures/                 # 測試用假資料
│       ├── search-results.json
│       ├── whiteboard.json
│       ├── journal-entries.json
│       └── pdf-chunks.json
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 8. 核心型別定義

### 8.1 官方 Tool 型別（完整定義）

```typescript
// types/official-tools.ts

// ─── 共用 ───
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

// ─── get_journal_range ───
export interface GetJournalRangeInput {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}
export interface GetJournalRangeOutput {
  journals: Array<{
    date: string;
    content: string;
  }>;
}

// ─── save_to_note_card ───
export interface SaveToNoteCardInput {
  title: string;
  content: string;
}
export interface SaveToNoteCardOutput {
  card_id: string;
  status: 'success';
}

// ─── append_to_journal ───
export interface AppendToJournalInput {
  content: string;
}
export interface AppendToJournalOutput {
  date: string;
  status: 'success';
}

// ─── search_pdf_content ───
export interface SearchPdfContentInput {
  object_id: string;
  query: string;
}
export interface SearchPdfContentOutput {
  chunks: Array<{
    page_number: number;
    content: string;
    score: number;
  }>;
}

// ─── get_pdf_pages ───
export interface GetPdfPagesInput {
  object_id: string;
  page_numbers: number[]; // 1-based
}
export interface GetPdfPagesOutput {
  pages: Array<{
    page_number: number;
    content: string;
  }>;
}
```

### 8.2 HeptabaseClient 介面

```typescript
// client/index.ts

export interface HeptabaseClient {
  // ─── 搜尋 ───
  semanticSearch(query: string): Promise<SemanticSearchOutput>;
  searchWhiteboards(query: string): Promise<SearchWhiteboardsOutput>;

  // ─── 讀取 ───
  getWhiteboard(whiteboardId: string): Promise<GetWhiteboardOutput>;
  getObject(objectId: string): Promise<GetObjectOutput>;
  getJournalRange(startDate: string, endDate: string): Promise<GetJournalRangeOutput>;

  // ─── 寫入 ───
  saveToNoteCard(title: string, content: string): Promise<SaveToNoteCardOutput>;
  appendToJournal(content: string): Promise<AppendToJournalOutput>;

  // ─── PDF ───
  searchPdfContent(objectId: string, query: string): Promise<SearchPdfContentOutput>;
  getPdfPages(objectId: string, pageNumbers: number[]): Promise<GetPdfPagesOutput>;

  // ─── Helpers (對接層加值) ───
  getJournalRangeSafe(startDate: string, endDate: string): Promise<GetJournalRangeOutput>;
  getWhiteboardDeep(whiteboardId: string): Promise<DeepWhiteboardResult>;
  searchAndRead(query: string, topN?: number): Promise<FullSearchResult[]>;
}
```

### 8.3 Workflow 型別

```typescript
// types/workflows.ts

export interface WhiteboardDeepDiveInput {
  query?: string;           // 白板名稱關鍵字
  whiteboard_id?: string;   // 或直接給 ID
}
export interface WhiteboardDeepDiveOutput {
  whiteboard_name: string;
  total_objects: number;
  summary: string;
  objects: Array<{
    id: string;
    title: string;
    type: ObjectType;
    content_status: 'full' | 'partial' | 'skipped';
  }>;
  incomplete_objects: string[];
}

export interface PdfResearchInput {
  topic: string;
  pdf_id?: string;
}
export interface PdfResearchOutput {
  pdf_title: string;
  relevant_pages: number[];
  report: string;
  source_chunks_count: number;
}

export interface KnowledgeReviewInput {
  start_date: string;
  end_date: string;
  topic?: string;
}
export interface KnowledgeReviewOutput {
  period: string;
  journal_count: number;
  related_notes_count: number;
  themes: string[];
  timeline: Array<{ date: string; highlights: string }>;
  insights: string;
}
```

---

## 9. 使用情境範例

### 9.1 基礎操作（直接呼叫官方 Tools）

| 使用者說 | 觸發的官方 Tool | 說明 |
|----------|----------------|------|
| 「找我關於 MCP 的筆記」 | `semantic_search_objects` | 語意搜尋 |
| 「找我的專案白板」 | `search_whiteboards` | 搜尋白板 |
| 「讀取這張卡片的全文」 | `get_object` | 深度讀取 |
| 「看我這週的 Journal」 | `get_journal_range` | 取得區間 Journal |
| 「把這段整理存成新卡片」 | `save_to_note_card` | 存入 Inbox |
| 「把這段加到今天的 Journal」 | `append_to_journal` | 追加 Journal |
| 「這份 PDF 裡講 pricing 的部分」 | `search_pdf_content` → `get_pdf_pages` | PDF 搜尋 |

### 9.2 高階 Workflow

| 使用者說 | 觸發的 Workflow | 串接的 Tools |
|----------|----------------|-------------|
| 「幫我深度閱讀專案白板，產出摘要」 | `whiteboard_deep_dive` | search → get_whiteboard → get_object × N |
| 「分析這份 PDF 裡關於定價的內容」 | `pdf_research` | search → search_pdf → get_pages |
| 「回顧我過去三個月學了什麼」 | `knowledge_review` | get_journal_range → search → get_object |
| 「把這個想法存起來，看看跟什麼相關」 | `save_and_link` | save_to_note_card → search |
| 「幫我寫今天的工作摘要」 | `daily_digest` | get_journal_range → search → append_to_journal |

---

## 10. 測試策略與案例

### 10.1 測試金字塔

```
            ╱╲
           ╱  ╲          E2E 整合測試（2 條主要流程）
          ╱    ╲         需要真實 OAuth + 官方 MCP
         ╱──────╲
        ╱        ╲       Workflow 流程測試（7 個 workflow）
       ╱          ╲      Mock Layer 2，驗證編排邏輯
      ╱────────────╲
     ╱              ╲    契約測試（9 個官方 tools）
    ╱                ╲   Mock HTTP，驗證 input/output schema
   ╱──────────────────╲
  ╱                    ╲  單元測試（工具函式）
 ╱                      ╲ 純邏輯，無外部依賴
╱────────────────────────╲
```

### 10.2 契約測試（Contract Tests）— Layer 2

驗證對接層對官方 tool 的 input/output 處理是否正確。

#### CT-01: `semantic_search_objects` 基本搜尋

```typescript
describe('semantic_search_objects', () => {
  it('CT-01: 應回傳匹配的物件列表', async () => {
    // Arrange
    mockMcpServer.on('semantic_search_objects', () => ({
      objects: [
        { id: 'card-1', type: 'card', title: 'MCP 入門', snippet: '...MCP 是...', score: 0.95 },
        { id: 'card-2', type: 'card', title: 'MCP 實作', snippet: '...實作步驟...', score: 0.87 },
      ]
    }));

    // Act
    const result = await client.semanticSearch('MCP');

    // Assert
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0]).toHaveProperty('id');
    expect(result.objects[0]).toHaveProperty('type');
    expect(result.objects[0]).toHaveProperty('snippet');
    expect(result.objects[0].score).toBeGreaterThan(0);
  });

  it('CT-02: 空結果應回傳空陣列', async () => {
    mockMcpServer.on('semantic_search_objects', () => ({ objects: [] }));

    const result = await client.semanticSearch('不存在的關鍵字xyz');
    expect(result.objects).toEqual([]);
  });
});
```

#### CT-03: `get_whiteboard_with_objects` Partial Content

```typescript
describe('get_whiteboard_with_objects', () => {
  it('CT-03: 回傳的物件應包含 partial_content 而非完整內容', async () => {
    mockMcpServer.on('get_whiteboard_with_objects', () => ({
      whiteboard: {
        id: 'wb-1',
        name: '專案白板',
        objects: [
          {
            id: 'card-1',
            type: 'card',
            title: '需求分析',
            partial_content: '這張卡片討論了...',  // 截斷的內容
            position: { x: 100, y: 200 },
          }
        ]
      }
    }));

    const result = await client.getWhiteboard('wb-1');

    // partial_content 存在但不保證是完整內容
    expect(result.whiteboard.objects[0]).toHaveProperty('partial_content');
    expect(result.whiteboard.objects[0]).not.toHaveProperty('content');
  });
});
```

#### CT-04: `get_object` hasMore 處理

```typescript
describe('get_object', () => {
  it('CT-04: hasMore=true 時應標記內容不完整', async () => {
    mockMcpServer.on('get_object', () => ({
      object: {
        id: 'card-big',
        type: 'card',
        title: '大型筆記',
        content: '前半段內容...',
        hasMore: true,
      }
    }));

    const result = await client.getObject('card-big');

    expect(result.object.hasMore).toBe(true);
    // 對接層應記錄 warning
    expect(logger.warnings).toContainEqual(
      expect.stringContaining('card-big')
    );
  });

  it('CT-05: PDF 物件應觸發警告，建議改用 PDF 流程', async () => {
    mockMcpServer.on('get_object', () => ({
      object: {
        id: 'pdf-1',
        type: 'pdf',
        title: '大型報告.pdf',
        content: '',
        hasMore: true,
      }
    }));

    const result = await client.getObject('pdf-1');

    expect(logger.warnings).toContainEqual(
      expect.stringContaining('建議使用 search_pdf_content')
    );
  });
});
```

#### CT-06: `get_journal_range` 自動拆分

```typescript
describe('get_journal_range', () => {
  it('CT-06: 超過 90 天應自動拆分成多次請求', async () => {
    const callLog: any[] = [];
    mockMcpServer.on('get_journal_range', (input) => {
      callLog.push(input);
      return { journals: [{ date: input.start_date, content: 'test' }] };
    });

    // 請求 6 個月的 Journal（約 180 天）
    await client.getJournalRangeSafe('2025-07-01', '2025-12-31');

    // 應拆分成 2-3 次請求
    expect(callLog.length).toBeGreaterThanOrEqual(2);

    // 每次請求的範圍不超過 90 天
    for (const call of callLog) {
      const days = daysBetween(call.start_date, call.end_date);
      expect(days).toBeLessThanOrEqual(90);
    }
  });

  it('CT-07: 90 天以內不應拆分', async () => {
    const callLog: any[] = [];
    mockMcpServer.on('get_journal_range', (input) => {
      callLog.push(input);
      return { journals: [] };
    });

    await client.getJournalRangeSafe('2025-10-01', '2025-12-15');

    expect(callLog).toHaveLength(1);
  });
});
```

#### CT-08: `append_to_journal` 不覆蓋行為

```typescript
describe('append_to_journal', () => {
  it('CT-08: 應追加而非覆蓋既有 Journal', async () => {
    let appendedContent = '';
    mockMcpServer.on('append_to_journal', (input) => {
      appendedContent = input.content;
      return { date: '2026-02-15', status: 'success' };
    });

    await client.appendToJournal('今天學到了 MCP');

    // 確認送出的是追加內容，不是整份 Journal
    expect(appendedContent).toBe('今天學到了 MCP');
  });
});
```

#### CT-09: `search_pdf_content` 上限

```typescript
describe('search_pdf_content', () => {
  it('CT-09: 回傳 chunks 不超過 80 個', async () => {
    mockMcpServer.on('search_pdf_content', () => ({
      chunks: Array(80).fill(null).map((_, i) => ({
        page_number: i + 1,
        content: `chunk ${i}`,
        score: 0.5,
      }))
    }));

    const result = await client.searchPdfContent('pdf-1', 'test');

    expect(result.chunks.length).toBeLessThanOrEqual(80);
  });
});
```

#### CT-10: `get_pdf_pages` 頁碼從 1 開始

```typescript
describe('get_pdf_pages', () => {
  it('CT-10: 頁碼應從 1 開始，0 應被拒絕或轉換', async () => {
    // 對接層應防止傳入 0
    await expect(
      client.getPdfPages('pdf-1', [0, 1, 2])
    ).rejects.toThrow(/頁碼必須從 1 開始/);
  });
});
```

#### CT-11: OAuth Token 過期

```typescript
describe('OAuth 錯誤處理', () => {
  it('CT-11: 401 時應嘗試 refresh token 並重試', async () => {
    let callCount = 0;
    mockMcpServer.on('semantic_search_objects', () => {
      callCount++;
      if (callCount === 1) throw { status: 401 };
      return { objects: [{ id: '1', type: 'card', title: 'test', snippet: '', score: 1 }] };
    });
    mockOAuth.onRefresh(() => 'new-token');

    const result = await client.semanticSearch('test');

    expect(callCount).toBe(2);
    expect(result.objects).toHaveLength(1);
  });

  it('CT-12: refresh 也失敗時應引導重新授權', async () => {
    mockMcpServer.on('semantic_search_objects', () => { throw { status: 401 }; });
    mockOAuth.onRefresh(() => { throw new Error('refresh failed'); });

    await expect(client.semanticSearch('test'))
      .rejects.toThrow(/重新授權/);
  });
});
```

### 10.3 Workflow 流程測試 — Layer 3

Mock Layer 2（HeptabaseClient），驗證 workflow 的編排邏輯。

#### WT-01: Whiteboard Deep-Dive 完整流程

```typescript
describe('whiteboard_deep_dive workflow', () => {
  it('WT-01: 應依序呼叫 search → get_whiteboard → get_object', async () => {
    const callOrder: string[] = [];

    const mockClient = {
      searchWhiteboards: async () => {
        callOrder.push('search_whiteboards');
        return { whiteboards: [{ id: 'wb-1', name: '專案', object_count: 2 }] };
      },
      getWhiteboard: async () => {
        callOrder.push('get_whiteboard');
        return {
          whiteboard: {
            id: 'wb-1', name: '專案',
            objects: [
              { id: 'c-1', type: 'card', title: 'Card A', partial_content: '...', position: { x: 0, y: 0 } },
              { id: 'c-2', type: 'card', title: 'Card B', partial_content: '...', position: { x: 100, y: 0 } },
            ]
          }
        };
      },
      getObject: async (id: string) => {
        callOrder.push(`get_object:${id}`);
        return {
          object: { id, type: 'card', title: `Card ${id}`, content: `Full content of ${id}`, hasMore: false }
        };
      },
    };

    const result = await whiteboardDeepDive(mockClient, { query: '專案' });

    // 驗證呼叫順序
    expect(callOrder).toEqual([
      'search_whiteboards',
      'get_whiteboard',
      'get_object:c-1',
      'get_object:c-2',
    ]);

    // 驗證結果
    expect(result.total_objects).toBe(2);
    expect(result.incomplete_objects).toEqual([]);
  });

  it('WT-02: PDF 物件應走 PDF 流程而非 get_object', async () => {
    const callOrder: string[] = [];

    const mockClient = {
      searchWhiteboards: async () => ({
        whiteboards: [{ id: 'wb-1', name: 'Research', object_count: 1 }]
      }),
      getWhiteboard: async () => ({
        whiteboard: {
          id: 'wb-1', name: 'Research',
          objects: [
            { id: 'pdf-1', type: 'pdf', title: 'Report.pdf', partial_content: '...', position: { x: 0, y: 0 } },
          ]
        }
      }),
      getObject: async () => { callOrder.push('get_object'); return null; },
      searchPdfContent: async () => {
        callOrder.push('search_pdf_content');
        return { chunks: [{ page_number: 1, content: 'test', score: 0.9 }] };
      },
      getPdfPages: async () => {
        callOrder.push('get_pdf_pages');
        return { pages: [{ page_number: 1, content: 'full page' }] };
      },
    };

    await whiteboardDeepDive(mockClient, { whiteboard_id: 'wb-1' });

    // PDF 不應呼叫 get_object
    expect(callOrder).not.toContain('get_object');
    expect(callOrder).toContain('search_pdf_content');
  });
});
```

#### WT-03: PDF Research 流程

```typescript
describe('pdf_research workflow', () => {
  it('WT-03: 應從 chunks 提取頁碼再取完整頁面', async () => {
    const mockClient = {
      semanticSearch: async () => ({
        objects: [{ id: 'pdf-1', type: 'pdf', title: 'Report.pdf', snippet: '', score: 0.95 }]
      }),
      searchPdfContent: async () => ({
        chunks: [
          { page_number: 3, content: 'pricing model...', score: 0.9 },
          { page_number: 3, content: 'another chunk on page 3', score: 0.8 },
          { page_number: 7, content: 'pricing strategy...', score: 0.85 },
        ]
      }),
      getPdfPages: async (_id: string, pages: number[]) => ({
        pages: pages.map(p => ({ page_number: p, content: `Page ${p} full text` }))
      }),
    };

    const result = await pdfResearch(mockClient, { topic: 'pricing' });

    // 頁碼應去重
    expect(result.relevant_pages).toEqual([3, 7]);
    expect(result.source_chunks_count).toBe(3);
  });
});
```

#### WT-04: Knowledge Review 跨 3 個月

```typescript
describe('knowledge_review workflow', () => {
  it('WT-04: 超過 3 個月的 Journal 應被正確拆分並合併', async () => {
    const journalCalls: any[] = [];

    const mockClient = {
      getJournalRangeSafe: async (start: string, end: string) => {
        journalCalls.push({ start, end });
        return {
          journals: [
            { date: start, content: `Journal on ${start}` },
          ]
        };
      },
      semanticSearch: async () => ({ objects: [] }),
    };

    const result = await knowledgeReview(mockClient, {
      start_date: '2025-06-01',
      end_date: '2025-12-31',
    });

    expect(result.journal_count).toBeGreaterThanOrEqual(1);
  });
});
```

### 10.4 E2E 整合測試

需要真實的 OAuth Token 和官方 MCP 連線，**只在 CI 或手動觸發時執行**。

#### E2E-01: Whiteboard 完整流程

```typescript
describe('E2E: Whiteboard Flow', () => {
  // 需要環境變數: HEPTABASE_TEST_TOKEN
  const client = createRealClient(process.env.HEPTABASE_TEST_TOKEN);

  it('E2E-01: search → get_whiteboard → get_object → save_to_note_card', async () => {
    // 1. 搜尋白板
    const boards = await client.searchWhiteboards('test');
    expect(boards.whiteboards.length).toBeGreaterThan(0);

    // 2. 取得白板結構
    const wb = await client.getWhiteboard(boards.whiteboards[0].id);
    expect(wb.whiteboard.objects.length).toBeGreaterThan(0);

    // 3. 深讀第一個物件
    const obj = await client.getObject(wb.whiteboard.objects[0].id);
    expect(obj.object.content).toBeTruthy();

    // 4. 產出摘要並存為新卡片
    const summary = `摘要：${obj.object.title}`;
    const saved = await client.saveToNoteCard('E2E 測試摘要', summary);
    expect(saved.card_id).toBeTruthy();
  });
});
```

#### E2E-02: PDF 完整流程

```typescript
describe('E2E: PDF Flow', () => {
  it('E2E-02: search → search_pdf_content → get_pdf_pages', async () => {
    // 1. 找到 PDF
    const results = await client.semanticSearch('PDF');
    const pdf = results.objects.find(o => o.type === 'pdf');
    if (!pdf) return; // skip if no PDF in test workspace

    // 2. 搜尋 PDF 內容
    const chunks = await client.searchPdfContent(pdf.id, 'test');
    expect(chunks.chunks.length).toBeLessThanOrEqual(80);

    // 3. 取得相關頁面
    if (chunks.chunks.length > 0) {
      const pages = [...new Set(chunks.chunks.map(c => c.page_number))];
      const fullPages = await client.getPdfPages(pdf.id, pages.slice(0, 3));

      expect(fullPages.pages.length).toBeGreaterThan(0);
      expect(fullPages.pages[0].page_number).toBeGreaterThanOrEqual(1);
    }
  });
});
```

### 10.5 測試案例清單總覽

| 測試 ID | 類型 | 測試標的 | 驗證重點 |
|---------|------|---------|---------|
| CT-01 | 契約 | `semantic_search_objects` | 基本搜尋回傳結構 |
| CT-02 | 契約 | `semantic_search_objects` | 空結果處理 |
| CT-03 | 契約 | `get_whiteboard_with_objects` | partial_content 而非完整 |
| CT-04 | 契約 | `get_object` | hasMore=true 標記 |
| CT-05 | 契約 | `get_object` | PDF 物件警告 |
| CT-06 | 契約 | `get_journal_range` | >90 天自動拆分 |
| CT-07 | 契約 | `get_journal_range` | ≤90 天不拆分 |
| CT-08 | 契約 | `append_to_journal` | 追加不覆蓋 |
| CT-09 | 契約 | `search_pdf_content` | ≤80 chunks |
| CT-10 | 契約 | `get_pdf_pages` | 頁碼從 1 開始 |
| CT-11 | 契約 | OAuth | 401 自動 refresh |
| CT-12 | 契約 | OAuth | refresh 失敗引導重授權 |
| WT-01 | 流程 | `whiteboard_deep_dive` | 完整呼叫鏈 |
| WT-02 | 流程 | `whiteboard_deep_dive` | PDF 走專用流程 |
| WT-03 | 流程 | `pdf_research` | chunks → 去重頁碼 → 取頁 |
| WT-04 | 流程 | `knowledge_review` | 跨 3 個月拆分 |
| E2E-01 | 整合 | Whiteboard Flow | 搜尋→讀取→存卡片 |
| E2E-02 | 整合 | PDF Flow | 搜尋→PDF 搜尋→取頁 |

---

## 11. 實作優先順序

### Phase 1: 基礎對接（MVP）

**目標**：能透過官方 MCP 搜尋和讀取內容

- [ ] 專案初始化（TypeScript + MCP Client SDK）
- [ ] OAuth 認證流程
- [ ] Layer 2 對接：`semantic_search_objects`, `get_object`, `search_whiteboards`, `get_whiteboard_with_objects`
- [ ] 基礎快取（記憶體快取 + TTL）
- [ ] 契約測試：CT-01 ~ CT-05

### Phase 2: 完整讀寫

**目標**：支援 Journal、寫入、PDF

- [ ] Layer 2 對接：`get_journal_range`（含自動拆分）, `save_to_note_card`, `append_to_journal`
- [ ] Layer 2 對接：`search_pdf_content`, `get_pdf_pages`
- [ ] 契約測試：CT-06 ~ CT-12

### Phase 3: Workflow

**目標**：高階自動化流程

- [ ] Workflow: `whiteboard_deep_dive`
- [ ] Workflow: `pdf_research`
- [ ] Workflow: `knowledge_review`
- [ ] Workflow: `save_and_link`, `daily_digest`
- [ ] 流程測試：WT-01 ~ WT-04

### Phase 4: 完善

**目標**：穩定性與體驗

- [ ] E2E 整合測試
- [ ] Workflow: `topic_analysis`, `orphan_detection`
- [ ] 錯誤處理完善
- [ ] 效能優化
- [ ] README 與使用文件

---

## 附錄

### A. v1.0 → v2.0 主要變更

| 項目 | v1.0 | v2.0 |
|------|------|------|
| **定位** | 自建 MCP Server | 包裝官方 MCP 的 Client 層 |
| **認證** | API Key | OAuth |
| **資料來源** | API + 本地備份 fallback | 僅官方 MCP Server |
| **Tools** | 18 個自定義 tools | 9 個官方 tools（薄封裝） |
| **分析功能** | 宣告為 MCP tools | 實作為內部 Workflows |
| **測試** | 未設計 | 契約測試 + 流程測試 + E2E |

### B. 相關資源

- [Heptabase MCP 官方文件](https://support.heptabase.com/en/articles/12679581-how-to-use-heptabase-mcp)
- [Model Context Protocol 官方文件](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### C. 變更紀錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0.0 | 2026-02-15 | 初始設計版本 |
| 2.0.0 | 2026-02-15 | 重構：對齊官方 MCP，改為 Client/Workflow 架構，新增測試策略 |
