# @mukundakatta/citecite-mcp

MCP server for RAG citation markers. Inject `[N]` markers into LLM output,
parse them back when post-processing, or strip them entirely.

## Tools

- **`inject_citations(text, citations, at?)`** — append `[1] [2] [3]` markers
  at the end of text, or insert at a position offset.
- **`parse_citations(text)`** — return every `[N]` found in source order with
  position, idx, and marker length.
- **`strip_citations(text)`** — remove every `[N]` marker.

## Install — Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "citecite": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/citecite-mcp"]
    }
  }
}
```

## Install — Cursor / Cline / Windsurf / Zed

Same shape in each tool's MCP config. Transport is stdio over
`npx -y @mukundakatta/citecite-mcp`.

## Use case

You ran a RAG pipeline. The LLM produced an answer. The retrieval layer told
you which source chunks were used. Now the LLM (a second pass, or the same
agent) needs to inject `[1] [2]` markers tied to those sources, or to parse
markers back out of an existing piece of text. That's what this is for.

## License

MIT OR Apache-2.0.
