# Heptabase Extension — Phase 1 MVP 設計文件

> **版本**: 1.0.0
> **日期**: 2026-02-15
> **狀態**: 已實作

## 概覽

Phase 1 MVP 實作了 Heptabase Extension 的基礎對接能力，能透過官方 Heptabase MCP 搜尋和讀取內容，並以 CLI 工具形式提供。

## 架構

```
使用者 CLI
    │
    ▼
┌──────────────────────────────┐
│  CLI Layer (commander)       │
│  auth / search / whiteboard  │
│  object / interactive        │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Layer 2: HeptabaseClient    │
│  semanticSearch              │
│  searchWhiteboards           │
│  getWhiteboard               │
│  getObject                   │
│  + MemoryCache + Logger      │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Layer 1: Transport          │
│  McpClient (StreamableHTTP)  │
│  OAuth (OAuthClientProvider) │
│  TokenManager                │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Heptabase 官方 MCP Server   │
│  https://api.heptabase.com   │
└──────────────────────────────┘
```

## 實作範圍

### 包含（Phase 1）

- 4 個讀取 tool 對接：semantic_search_objects, search_whiteboards, get_whiteboard_with_objects, get_object
- OAuth 認證流程（MCP SDK OAuthClientProvider 實作）
- Token 管理（本地安全儲存）
- 記憶體快取（TTL-based）
- CLI 子命令（auth, search, whiteboard, object, interactive）
- 契約測試 CT-01 ~ CT-05
- 單元測試（retry, memory-cache）

### 不包含（後續 Phase）

- Journal 操作（get_journal_range）
- 寫入操作（save_to_note_card, append_to_journal）
- PDF 操作（search_pdf_content, get_pdf_pages）
- 高階 Workflow（whiteboard_deep_dive, pdf_research 等）

## 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| SDK | @modelcontextprotocol/sdk | 官方 MCP TypeScript SDK |
| CLI | commander | 輕量、廣泛使用 |
| 互動 | @inquirer/prompts | 現代化的 CLI 互動套件 |
| 建置 | tsup | 快速 ESM bundler |
| 測試 | vitest | 快速、ESM 原生支援 |
| 套件管理 | pnpm | 高效磁碟使用 |

## 測試覆蓋

| 測試 ID | 類型 | 驗證重點 |
|---------|------|---------|
| CT-01 | 契約 | semantic_search_objects 基本搜尋回傳結構 |
| CT-02 | 契約 | semantic_search_objects 空結果處理 |
| CT-03 | 契約 | get_whiteboard_with_objects partial_content |
| CT-04 | 契約 | get_object hasMore=true 標記 |
| CT-05 | 契約 | get_object PDF 物件警告 |

## 檔案結構

```
src/
├── index.ts                    # CLI 進入點
├── transport/
│   ├── mcp-client.ts          # MCP Client 連線
│   ├── oauth.ts               # OAuth 授權
│   └── token-manager.ts       # Token 管理
├── client/
│   ├── index.ts               # HeptabaseClient
│   ├── search.ts              # 搜尋 tools
│   └── read.ts                # 讀取 tools
├── cli/
│   ├── commands/
│   │   ├── auth.ts
│   │   ├── search.ts
│   │   ├── whiteboard.ts
│   │   ├── object.ts
│   │   └── interactive.ts
│   └── format.ts
├── cache/
│   └── memory-cache.ts
├── types/
│   ├── official-tools.ts
│   └── common.ts
└── utils/
    ├── logger.ts
    └── retry.ts

tests/
├── contract/
│   ├── search.contract.test.ts
│   └── read.contract.test.ts
├── unit/
│   ├── memory-cache.test.ts
│   └── retry.test.ts
├── helpers/
│   └── mock-mcp-client.ts
└── fixtures/
    ├── search-results.json
    └── whiteboard.json
```
