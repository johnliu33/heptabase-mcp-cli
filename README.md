# Heptabase MCP CLI

> **[正體中文版 README](docs/README.zh-TW.md)**

CLI tool for searching, reading, and writing your [Heptabase](https://heptabase.com) knowledge base via the official [MCP](https://modelcontextprotocol.io/) API.

## Features

- **OAuth authentication** — Browser-based login, token auto-refresh
- **9 MCP tools** — Full coverage of Heptabase official MCP API
- **Semantic search** — Hybrid full-text + semantic search across notes, journals, PDFs
- **Whiteboard exploration** — Search and inspect whiteboard structures
- **Object deep read** — Retrieve full content of any card, journal, or media
- **Journal & write** — Read/append journals, create note cards
- **PDF tools** — BM25 search within PDFs, page-range extraction
- **5 workflows** — Multi-step automated pipelines (whiteboard deep-dive, PDF research, knowledge review, topic analysis, orphan detection)
- **TUI mode** — REPL-style terminal with slash commands
- **Interactive mode** — Menu-driven exploration with drill-down
- **In-memory cache** — Avoids redundant API calls (60s for search, 300s for reads)
- **Retry with jitter** — Exponential backoff + random jitter for stability

## Prerequisites

- Node.js >= 18
- A [Heptabase](https://heptabase.com) account
- pnpm (recommended) or npm

## Installation

```bash
git clone https://github.com/johnliu33/heptabase-mcp-cli.git
cd heptabase-mcp-cli
pnpm install
pnpm build
```

## Quick Start

> **[正體中文快速上手指南](docs/quick-start.md)**

```bash
# 1. Login via OAuth (opens browser)
heptabase auth login

# 2. Search your notes
heptabase search "machine learning"

# 3. Launch TUI mode (recommended)
heptabase tui
```

## Commands

### `auth` — Authentication

```bash
heptabase auth login     # OAuth login (opens browser)
heptabase auth status    # Show token status
heptabase auth logout    # Clear local token
```

### `search` — Semantic Search

```bash
# Single query
heptabase search "MCP protocol"

# Multiple queries for broader coverage (max 3)
heptabase search "machine learning" "deep learning"

# Filter by object type
heptabase search "notes" --type card journal

# JSON output
heptabase search "MCP" --json
```

### `whiteboard` — Whiteboard Operations

```bash
# Search whiteboards by keywords (max 5)
heptabase whiteboard search "project" "design"

# Get whiteboard structure by ID
heptabase whiteboard get <whiteboard-id>
```

### `object` — Object Operations

```bash
# Read full content of a card
heptabase object get <object-id>

# Specify object type (default: card)
heptabase object get <id> --type journal
heptabase object get <id> --type pdfCard
```

### `journal` — Journal Operations

```bash
# Read today's journal
heptabase journal today

# Read journals by date range (auto-splits if > 90 days)
heptabase journal get --from 2025-01-01 --to 2025-01-31

# Append content to today's journal
heptabase journal append "Today I learned about MCP"
```

### `save` — Create Note Card

```bash
# Create a new card (first h1 becomes the title)
heptabase save "# My Title\n\nSome content here"
```

### `pdf` — PDF Operations

```bash
# Search within a PDF (BM25)
heptabase pdf search <pdfCardId> "keyword1" "keyword2"

# Get specific pages
heptabase pdf pages <pdfCardId> 1 5
```

### `workflow` — Multi-step Workflows

```bash
# Whiteboard deep dive: search + fetch all objects
heptabase workflow whiteboard-deep-dive --query "project"
heptabase workflow wdd --id <whiteboard-id> --json

# PDF research: find PDF + extract relevant pages
heptabase workflow pdf-research "machine learning"
heptabase workflow pr "topic" --pdf-id <id>

# Knowledge review: journals + related notes
heptabase workflow knowledge-review 2025-01-01 2025-01-31 --topic "AI"

# Topic analysis: semantic search + full content
heptabase workflow topic-analysis "deep learning" --max-notes 5

# Orphan detection: find notes not on any whiteboard
heptabase workflow orphan-detection --query "project"
```

#### Workflow Descriptions

| Workflow | Description |
|----------|-------------|
| `whiteboard-deep-dive` | Search a whiteboard, then fetch full content of every object on it. PDF objects use `search_pdf_content` instead of `get_object`. |
| `pdf-research` | Find a PDF by topic via semantic search, locate relevant chunks with BM25, then extract full page content for matched pages. |
| `knowledge-review` | Retrieve journals for a date range, optionally search related notes by topic. Auto-splits ranges > 90 days. |
| `topic-analysis` | Semantic search for a topic, then fetch full content of each matched note in parallel (up to `max_notes`). |
| `orphan-detection` | Compare objects found via semantic search against objects placed on whiteboards, surfacing notes that aren't on any whiteboard. |

### `tui` — TUI Mode

```bash
heptabase tui
# or
heptabase t
```

REPL-style terminal with slash commands. Supports all search/read/write operations and all 5 workflows:

```
/search <query>              Semantic search
/journal [from] [to]         Read journals
/append <content>            Append to today's journal
/save <content>              Create note card
/whiteboard <keywords>       Search whiteboards
/object <id> <type>          Read object
/deep-dive <query|id>        Whiteboard deep dive workflow
/pdf-research <topic> [id]   PDF research workflow
/review <start> <end> [topic] Knowledge review workflow
/topic <topic> [max]         Topic analysis workflow
/orphans [query]             Orphan detection workflow
/help                        Show all commands
```

### `interactive` — Interactive Mode

```bash
heptabase interactive
# or
heptabase i
```

Menu-driven mode: search notes, browse whiteboards, drill into objects.

### Global Options

```bash
heptabase --verbose ...   # Enable debug logging
heptabase --version       # Show version
```

## Architecture

```
CLI / TUI (commander + readline)
 └─ Workflows (multi-step orchestration)
     └─ HeptabaseClient (Layer 2 — cache + logging)
         └─ McpClient (Layer 1 — StreamableHTTP + OAuth + retry)
             └─ Heptabase Official MCP Server
                https://api.heptabase.com/mcp
```

This project is a **client layer** wrapping the official Heptabase MCP — it does not implement its own MCP server. All data access goes through the 9 official MCP tools:

| Tool | Description |
|------|-------------|
| `semantic_search_objects` | Hybrid full-text + semantic search |
| `search_whiteboards` | Keyword search for whiteboards |
| `get_whiteboard_with_objects` | Read whiteboard structure and objects |
| `get_object` | Read full content of any object |
| `get_journal_range` | Read journals by date range |
| `save_to_note_card` | Create a new note card |
| `append_to_journal` | Append content to today's journal |
| `search_pdf_content` | BM25 search within a PDF |
| `get_pdf_pages` | Read specific pages of a PDF |

## Development

```bash
pnpm dev           # Run with tsx
pnpm build         # Build with tsup
pnpm test          # Run tests (vitest)
pnpm test:e2e      # Run E2E tests
pnpm lint          # Type check (tsc --noEmit)
```

### Project Structure

```
src/
├── index.ts                 # CLI entry point
├── transport/               # Layer 1: MCP connection + OAuth
├── client/                  # Layer 2: typed tool wrappers (search, read, write, pdf)
├── cli/commands/            # CLI subcommands + TUI
├── cache/                   # In-memory TTL cache
├── types/                   # TypeScript type definitions
├── workflows/               # Multi-step workflow orchestrations
└── utils/                   # Logger, retry with backoff + jitter

tests/
├── contract/                # Contract tests (CT-01 ~ CT-12)
├── workflow/                # Workflow tests (WT-01 ~ WT-06)
├── e2e/                     # E2E integration tests (E2E-01 ~ E2E-02)
└── unit/                    # Unit tests (cache, retry, date-range)
```

### Test Coverage

- **Contract tests** (CT-01 ~ CT-12): Verify each MCP tool wrapper behaves correctly against mock responses
- **Workflow tests** (WT-01 ~ WT-06): Verify multi-step workflow orchestration and fault tolerance
- **E2E tests** (E2E-01 ~ E2E-02): End-to-end integration tests with mock MCP client
- **Unit tests**: Cache TTL, retry with jitter, date-range splitting

## Token Storage

OAuth tokens are stored at `~/.heptabase-extension/token.json` with `0600` permissions (owner read/write only).

## Roadmap

- [x] **Phase 1**: Search + read (4 tools) + OAuth + cache + CLI
- [x] **Phase 2**: Journal, write operations, PDF tools (9 tools total)
- [x] **Phase 3**: Workflows (whiteboard deep-dive, PDF research, knowledge review) + TUI
- [x] **Phase 4**: Topic analysis, orphan detection, performance optimization, E2E tests

## License

MIT
