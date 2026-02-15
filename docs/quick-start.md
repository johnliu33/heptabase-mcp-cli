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

## 互動模式

不想記指令？用互動模式：

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
