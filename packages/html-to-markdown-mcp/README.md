# @mukundakatta/html-to-markdown-mcp

MCP server for HTML → Markdown conversion. For web-scraping and read-the-page agents.

## Tools

- **`html_to_md(html, ...options)`** — Turndown-based conversion with sane defaults (ATX headings, fenced code, inline links). Strips scripts/styles by default.
- **`extract_text(html)`** — strip everything, return whitespace-normalized text. Faster than `html_to_md` when you only need text content.

## Why this exists

Web-scraping agents constantly need clean Markdown from HTML. LLMs do this inline but inconsistently across turns (different heading styles, different list markers, sometimes leaving raw HTML tags in). A deterministic converter avoids the variance.

This is intentionally not a full content-extraction pipeline (no Readability-style "main content" detection — use that in a separate step if needed).

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "html-to-markdown": { "command": "npx", "args": ["-y", "@mukundakatta/html-to-markdown-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
