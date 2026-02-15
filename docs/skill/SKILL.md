---
name: heptabase
description: Use when the user wants to search, read, write, or analyze their Heptabase knowledge base. Triggers on mentions of Heptabase, notes, whiteboards, journals, knowledge review, or when the user references their personal knowledge management system.
---

# Heptabase CLI 操作指南

透過 `heptabase` CLI 搜尋、讀取和寫入使用者的 Heptabase 知識庫。

## 前置條件

操作前先確認認證狀態：

```bash
heptabase auth status
```

若未登入，執行 `heptabase auth login` 引導使用者完成認證。

## 指令速查表

| 目的 | 指令 |
|------|------|
| 語意搜尋 | `heptabase search "query"` |
| 按類型搜尋 | `heptabase search "query" --type card journal` |
| 搜尋白板 | `heptabase whiteboard search "keyword"` |
| 取得白板結構 | `heptabase whiteboard get <id>` |
| 讀取物件全文 | `heptabase object get <id>` |
| 今日日誌 | `heptabase journal today` |
| 日期範圍日誌 | `heptabase journal get --start YYYY-MM-DD --end YYYY-MM-DD` |
| 追加日誌 | `heptabase journal append "content"` |
| 建立卡片 | `heptabase save "# Title\n\nContent"` |
| PDF 搜尋 | `heptabase pdf search <pdfCardId> "keyword"` |
| PDF 頁面 | `heptabase pdf pages <pdfCardId> <start> <end>` |

所有指令加 `--json` 可取得結構化輸出，方便程式處理。

## Workflow 選擇指南

當需要多步驟操作時，優先使用 workflow：

| 場景 | 指令 |
|------|------|
| 看白板上所有筆記的完整內容 | `heptabase wf wdd --query "q"` |
| 研究某個 PDF 的內容 | `heptabase wf pr "topic"` |
| 回顧某段時間的日誌+相關筆記 | `heptabase wf kr <start> <end>` |
| 深入了解某主題的所有相關筆記 | `heptabase wf ta "topic"` |
| 找出不在任何白板上的孤立筆記 | `heptabase wf od` |

## 注意事項

- 物件類型：`card`、`pdfCard`、`mediaCard`、`highlightElement`、`journal`
- 日期格式 `YYYY-MM-DD`，超過 90 天的日誌查詢會自動分割
- 搜尋結果快取 60 秒，物件讀取快取 300 秒
- 搜尋關鍵字建議 1-3 個，過多會降低語意搜尋精準度
