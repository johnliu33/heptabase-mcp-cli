# Heptabase MCP CLI

透過官方 [MCP](https://modelcontextprotocol.io/) API 搜尋、讀取和寫入你的 [Heptabase](https://heptabase.com) 知識庫的 CLI 工具。

## 功能特色

- **OAuth 認證** — 瀏覽器登入，token 自動刷新
- **9 個 MCP 工具** — 完整涵蓋 Heptabase 官方 MCP API
- **語意搜尋** — 混合全文 + 語意搜尋，涵蓋筆記、日誌、PDF
- **白板探索** — 搜尋與檢視白板結構
- **物件深度讀取** — 取得任何卡片、日誌或媒體的完整內容
- **日誌與寫入** — 讀取/追加日誌、建立筆記卡片
- **PDF 工具** — PDF 內 BM25 搜尋、頁面範圍擷取
- **5 個工作流程** — 多步驟自動化管線（白板深入探索、PDF 研究、知識回顧、主題分析、孤立筆記偵測）
- **TUI 模式** — REPL 風格終端，支援 slash commands
- **互動模式** — 選單導向的探索與深入查看
- **記憶體快取** — 避免重複 API 呼叫（搜尋 60 秒、讀取 300 秒）
- **Retry with jitter** — 指數退避 + 隨機 jitter，提升穩定性

## 前置需求

- Node.js >= 18
- [Heptabase](https://heptabase.com) 帳號
- pnpm（推薦）或 npm

## 安裝

```bash
git clone https://github.com/johnliu33/heptabase-mcp-cli.git
cd heptabase-mcp-cli
pnpm install
pnpm build
```

## 快速開始

> **[正體中文快速上手指南](quick-start.md)**

```bash
# 1. 透過 OAuth 登入（開啟瀏覽器）
heptabase auth login

# 2. 搜尋你的筆記
heptabase search "machine learning"

# 3. 啟動 TUI 模式（推薦）
heptabase tui
```

## 指令

### `auth` — 認證管理

```bash
heptabase auth login     # OAuth 登入（開啟瀏覽器）
heptabase auth status    # 查看 token 狀態
heptabase auth logout    # 清除本機 token
```

### `search` — 語意搜尋

```bash
# 單一查詢
heptabase search "MCP protocol"

# 多個查詢以擴大搜尋範圍（最多 3 個）
heptabase search "machine learning" "deep learning"

# 依物件類型篩選
heptabase search "筆記" --type card journal

# JSON 輸出
heptabase search "MCP" --json
```

### `whiteboard` — 白板操作

```bash
# 以關鍵字搜尋白板（最多 5 個）
heptabase whiteboard search "專案" "設計"

# 以 ID 取得白板結構
heptabase whiteboard get <白板ID>
```

### `object` — 物件操作

```bash
# 讀取卡片完整內容
heptabase object get <物件ID>

# 指定物件類型（預設：card）
heptabase object get <ID> --type journal
heptabase object get <ID> --type pdfCard
```

### `journal` — 日誌操作

```bash
# 讀取今天的日誌
heptabase journal today

# 依日期範圍讀取日誌（超過 90 天自動分割）
heptabase journal get --from 2025-01-01 --to 2025-01-31

# 追加內容到今天的日誌
heptabase journal append "今天學到了 MCP 的用法"
```

### `save` — 建立筆記卡片

```bash
# 建立新卡片（第一個 h1 會成為標題）
heptabase save "# 我的標題\n\n內容寫在這裡"
```

### `pdf` — PDF 操作

```bash
# 在 PDF 內搜尋（BM25）
heptabase pdf search <pdfCardId> "關鍵字1" "關鍵字2"

# 取得指定頁面
heptabase pdf pages <pdfCardId> 1 5
```

### `workflow` — 多步驟工作流程

```bash
# 白板深入探索：搜尋白板 + 取得所有物件
heptabase workflow whiteboard-deep-dive --query "專案"
heptabase workflow wdd --id <白板ID> --json

# PDF 研究：找 PDF + 擷取相關頁面
heptabase workflow pdf-research "機器學習"
heptabase workflow pr "主題" --pdf-id <id>

# 知識回顧：日誌 + 相關筆記
heptabase workflow knowledge-review 2025-01-01 2025-01-31 --topic "AI"

# 主題分析：語意搜尋 + 完整內容
heptabase workflow topic-analysis "深度學習" --max-notes 5

# 孤立筆記偵測：找出不在任何白板上的筆記
heptabase workflow orphan-detection --query "專案"
```

#### 工作流程說明

| 工作流程 | 說明 |
|----------|------|
| `whiteboard-deep-dive` | 搜尋白板，然後取得白板上每個物件的完整內容。PDF 物件使用 `search_pdf_content` 而非 `get_object`。 |
| `pdf-research` | 透過語意搜尋找到 PDF，用 BM25 定位相關段落，再擷取匹配頁面的完整內容。 |
| `knowledge-review` | 取得指定期間的日誌，可選擇依主題搜尋相關筆記。超過 90 天自動分割。 |
| `topic-analysis` | 語意搜尋某主題，然後並行取得每篇匹配筆記的完整內容（上限 `max_notes`）。 |
| `orphan-detection` | 比對語意搜尋結果與白板上的物件，找出不在任何白板上的孤立筆記。 |

### `tui` — TUI 模式

```bash
heptabase tui
# 或
heptabase t
```

REPL 風格終端，支援 slash commands。涵蓋所有搜尋/讀取/寫入操作及 5 個工作流程：

```
/search <query>              語意搜尋
/journal [from] [to]         讀取日誌
/append <content>            追加到今天日誌
/save <content>              建立新卡片
/whiteboard <keywords>       搜尋白板
/object <id> <type>          讀取物件
/deep-dive <query|id>        白板深入探索工作流程
/pdf-research <topic> [id]   PDF 研究工作流程
/review <start> <end> [topic] 知識回顧工作流程
/topic <topic> [max]         主題分析工作流程
/orphans [query]             孤立筆記偵測工作流程
/help                        顯示所有指令
```

### `interactive` — 互動模式

```bash
heptabase interactive
# 或
heptabase i
```

選單導向模式：搜尋筆記、瀏覽白板、深入查看物件。

### 全域選項

```bash
heptabase --verbose ...   # 開啟詳細日誌
heptabase --version       # 顯示版本
```

## 架構

```
CLI / TUI (commander + readline)
 └─ Workflows（多步驟編排）
     └─ HeptabaseClient (Layer 2 — 快取 + 日誌)
         └─ McpClient (Layer 1 — StreamableHTTP + OAuth + 重試)
             └─ Heptabase 官方 MCP Server
                https://api.heptabase.com/mcp
```

本專案是包裝官方 Heptabase MCP 的 **client 層**，不實作自己的 MCP server。所有資料存取透過 9 個官方 MCP 工具：

| 工具 | 說明 |
|------|------|
| `semantic_search_objects` | 混合全文 + 語意搜尋 |
| `search_whiteboards` | 關鍵字搜尋白板 |
| `get_whiteboard_with_objects` | 讀取白板結構與物件 |
| `get_object` | 讀取任何物件的完整內容 |
| `get_journal_range` | 依日期範圍讀取日誌 |
| `save_to_note_card` | 建立新的筆記卡片 |
| `append_to_journal` | 追加內容到今天的日誌 |
| `search_pdf_content` | 在 PDF 內 BM25 搜尋 |
| `get_pdf_pages` | 讀取 PDF 指定頁面 |

## 開發

```bash
pnpm dev           # 以 tsx 執行
pnpm build         # 以 tsup 建置
pnpm test          # 執行測試（vitest）
pnpm test:e2e      # 執行 E2E 測試
pnpm lint          # 型別檢查（tsc --noEmit）
```

### 專案結構

```
src/
├── index.ts                 # CLI 進入點
├── transport/               # Layer 1：MCP 連線 + OAuth
├── client/                  # Layer 2：型別化工具封裝（search, read, write, pdf）
├── cli/commands/            # CLI 子指令 + TUI
├── cache/                   # 記憶體 TTL 快取
├── types/                   # TypeScript 型別定義
├── workflows/               # 多步驟工作流程編排
└── utils/                   # Logger、指數退避重試 + jitter

tests/
├── contract/                # Contract 測試 (CT-01 ~ CT-12)
├── workflow/                # Workflow 測試 (WT-01 ~ WT-06)
├── e2e/                     # E2E 整合測試 (E2E-01 ~ E2E-02)
└── unit/                    # 單元測試（cache、retry、date-range）
```

### 測試涵蓋範圍

- **Contract 測試** (CT-01 ~ CT-12)：驗證每個 MCP 工具封裝對 mock 回應的行為正確性
- **Workflow 測試** (WT-01 ~ WT-06)：驗證多步驟工作流程編排與容錯能力
- **E2E 測試** (E2E-01 ~ E2E-02)：使用 mock MCP client 的端到端整合測試
- **單元測試**：快取 TTL、retry with jitter、日期範圍分割

## Token 儲存

OAuth token 儲存在 `~/.heptabase-extension/token.json`，檔案權限 `0600`（僅擁有者可讀寫）。

## 開發路線

- [x] **Phase 1**：搜尋 + 讀取（4 個工具）+ OAuth + 快取 + CLI
- [x] **Phase 2**：日誌、寫入操作、PDF 工具（共 9 個工具）
- [x] **Phase 3**：工作流程（白板深入探索、PDF 研究、知識回顧）+ TUI
- [x] **Phase 4**：主題分析、孤立筆記偵測、效能優化、E2E 測試

## 授權

MIT
