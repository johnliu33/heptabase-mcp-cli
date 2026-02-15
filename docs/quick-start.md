# 快速上手指南

## 安裝

```bash
git clone https://github.com/johnliu33/heptabase-mcp-cli.git
cd heptabase-mcp-cli
pnpm install
pnpm build
```

建置完成後，CLI 執行檔位於 `./dist/index.js`。你可以用 `node ./dist/index.js` 執行，或透過 `pnpm link --global` 將 `heptabase` 指令安裝到全域。

## 第一步：登入

```bash
heptabase auth login
```

執行後會自動開啟瀏覽器，導向 Heptabase OAuth 授權頁面。登入你的 Heptabase 帳號並按「Allow」即可。

授權成功後，token 會儲存在 `~/.heptabase-extension/token.json`，後續操作不需要重新登入。

確認登入狀態：

```bash
heptabase auth status
```

## 搜尋筆記

用自然語言搜尋你的知識庫：

```bash
heptabase search "MCP protocol"
```

可以同時傳入多個關鍵字（最多 3 個），從不同角度搜尋：

```bash
heptabase search "機器學習" "深度學習"
```

只搜尋特定類型的物件：

```bash
heptabase search "報告" --type card journal
```

輸出 JSON 格式（方便程式處理）：

```bash
heptabase search "MCP" --json
```

## 搜尋白板

```bash
heptabase whiteboard search "專案" "設計"
```

找到白板後，用 ID 查看白板結構：

```bash
heptabase whiteboard get <白板ID>
```

## 讀取物件完整內容

從搜尋結果中取得物件 ID 後，可以深度讀取完整內容：

```bash
heptabase object get <物件ID>
```

如果物件不是 card 類型，需要指定類型：

```bash
heptabase object get <ID> --type journal
heptabase object get <ID> --type pdfCard
```

## 日誌操作

讀取今天的日誌：

```bash
heptabase journal today
```

讀取指定日期範圍的日誌（超過 90 天會自動分割查詢）：

```bash
heptabase journal get --from 2025-01-01 --to 2025-01-31
```

追加內容到今天的日誌：

```bash
heptabase journal append "今天學到了 MCP 的用法"
```

## 建立卡片

用 Markdown 建立新的卡片，第一個 `# 標題` 會成為卡片標題：

```bash
heptabase save "# 學習筆記\n\n今天學到的重點..."
```

## PDF 操作

在 PDF 中搜尋關鍵字（BM25 搜尋）：

```bash
heptabase pdf search <pdfCardId> "關鍵字1" "關鍵字2"
```

取得 PDF 指定頁面：

```bash
heptabase pdf pages <pdfCardId> 1 5
```

## 工作流程

工作流程是多步驟的自動化管線，一個指令完成複雜任務：

### 白板深入探索

搜尋白板，然後自動取得白板上所有物件的完整內容：

```bash
heptabase workflow whiteboard-deep-dive --query "專案"
heptabase workflow wdd --id <白板ID> --json
```

### PDF 研究

依主題找出相關 PDF，搜尋相關段落，再取得完整頁面：

```bash
heptabase workflow pdf-research "機器學習"
heptabase workflow pr "主題" --pdf-id <pdfId>
```

### 知識回顧

取得指定期間的日誌，可搭配主題搜尋相關筆記：

```bash
heptabase workflow knowledge-review 2025-01-01 2025-01-31
heptabase workflow kr 2025-01-01 2025-03-31 --topic "AI"
```

### 主題分析

語意搜尋某主題的所有相關筆記，並行取得完整內容：

```bash
heptabase workflow topic-analysis "深度學習"
heptabase workflow ta "設計模式" --max-notes 5
```

### 孤立筆記偵測

找出存在於搜尋結果中但不在任何白板上的筆記：

```bash
heptabase workflow orphan-detection
heptabase workflow od --query "專案"
```

## TUI 模式（推薦）

TUI 模式提供 REPL 風格的互動終端，用 slash commands 操作，不需要記完整的 CLI 語法：

```bash
heptabase tui
```

進入後輸入 `/help` 查看所有可用指令：

```
/search <query>              語意搜尋
/journal [from] [to]         讀取日誌
/append <content>            追加到今天日誌
/save <content>              建立新卡片
/whiteboard <keywords>       搜尋白板
/get-whiteboard <id>         讀取白板
/object <id> <type>          讀取物件
/pdf-search <id> <kw...>     搜尋 PDF 內容
/pdf-pages <id> <s> <e>      取得 PDF 頁面
/deep-dive <query|id>        白板深入探索
/pdf-research <topic> [id]   PDF 研究
/review <start> <end> [topic] 知識回顧
/topic <topic> [max]         主題分析
/orphans [query]             孤立筆記偵測
/clear                       清除畫面
/exit                        退出
```

## 互動模式

選單導向的探索模式，適合不熟悉指令的使用者：

```bash
heptabase interactive
# 或簡寫
heptabase i
```

互動模式提供選單介面，可以：
1. 搜尋筆記 → 選擇結果 → 深度讀取
2. 搜尋白板 → 選擇白板 → 查看結構
3. 直接用 ID 讀取白板或物件

## 常見問題

### Token 過期怎麼辦？

重新登入即可：

```bash
heptabase auth logout
heptabase auth login
```

### 如何開啟詳細日誌？

加上 `--verbose` flag：

```bash
heptabase --verbose search "MCP"
```

### 搜尋結果格式看起來有 XML 標記？

這是 Heptabase MCP 官方的回傳格式，包含物件 ID、類型、標題等 metadata。你可以從中取得物件 ID 來做進一步的深度讀取。

### 日誌查詢超過 90 天怎麼辦？

不需要手動分割，CLI 會自動將超過 90 天的查詢分割為多段，結果會合併回傳。

### 工作流程跟直接呼叫有什麼差異？

工作流程會自動串接多個 MCP 工具，例如「白板深入探索」會自動：搜尋白板 → 取得白板結構 → 並行取得每個物件完整內容。手動操作需要一步步執行，工作流程一個指令就完成。
