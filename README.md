# Heptabase MCP CLI

CLI tool for searching and reading your [Heptabase](https://heptabase.com) knowledge base via the official [MCP](https://modelcontextprotocol.io/) API.

## Features

- **OAuth authentication** — Browser-based login, token auto-refresh
- **Semantic search** — Hybrid full-text + semantic search across notes, journals, PDFs
- **Whiteboard exploration** — Search and inspect whiteboard structures
- **Object deep read** — Retrieve full content of any card, journal, or media
- **Interactive mode** — Menu-driven exploration with drill-down
- **In-memory cache** — Avoids redundant API calls (60s for search, 300s for reads)
- **Workflows** — Multi-step automated workflows (whiteboard deep-dive, PDF research, knowledge review, topic analysis, orphan detection)

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

# 3. Launch interactive mode
heptabase interactive
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

### `interactive` — Interactive Mode

```bash
heptabase interactive
# or
heptabase i
```

Menu-driven mode: search notes, browse whiteboards, drill into objects.

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

### Global Options

```bash
heptabase --verbose ...   # Enable debug logging
heptabase --version       # Show version
```

## Architecture

```
CLI (commander)
 └─ HeptabaseClient (Layer 2 — cache + logging)
     └─ McpClient (Layer 1 — StreamableHTTP + OAuth)
         └─ Heptabase Official MCP Server
            https://api.heptabase.com/mcp
```

This project is a **client layer** wrapping the official Heptabase MCP — it does not implement its own MCP server. All data access goes through the 9 official MCP tools.

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
├── client/                  # Layer 2: typed tool wrappers
├── cli/commands/            # CLI subcommands
├── cache/                   # In-memory TTL cache
├── types/                   # TypeScript type definitions
├── workflows/               # Multi-step workflow orchestrations
└── utils/                   # Logger, retry with backoff + jitter

tests/
├── contract/                # Contract tests (CT-01 ~ CT-12)
├── workflow/                # Workflow tests (WT-01 ~ WT-06)
├── e2e/                     # E2E integration tests (E2E-01 ~ E2E-02)
└── unit/                    # Unit tests (cache, retry)
```

## Token Storage

OAuth tokens are stored at `~/.heptabase-extension/token.json` with `0600` permissions (owner read/write only).

## Roadmap

- **Phase 1**: Search + read (4 tools) + OAuth + cache + CLI
- **Phase 2**: Journal, write operations, PDF tools
- **Phase 3**: High-level workflows (whiteboard deep-dive, PDF research, knowledge review)
- **Phase 4 (current)**: E2E tests, performance optimization, topic analysis, orphan detection

## License

MIT
