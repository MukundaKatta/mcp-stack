# @mukundakatta/promptbudget-mcp

MCP server for token-budget-aware text handling. Three tools: count, truncate, chunk. Use when an LLM is preparing context, fitting chat history, or feeding long source documents through a prompt.

## Tools

| Tool | What it does |
|---|---|
| `count_tokens(text, max_tokens?, chars_per_token?)` | Pre-flight check. Returns `tokens`. With `max_tokens`, also returns `fits` + `overflow_tokens`. |
| `truncate_to_token_budget(text, max_tokens, strategy?, ...)` | Trim text to fit. 4 strategies: head, tail, head_tail, smart_cut. |
| `chunk_to_budget(text, max_tokens, overlap_tokens?, ...)` | Split long text into multiple under-budget chunks, with optional overlap. |

## Strategies for truncate

| Strategy | Drops | Good for |
|---|---|---|
| `head` | Tail | Long source docs you want to summarize from the top |
| `tail` (default) | Head | Chat history where latest matters most |
| `head_tail` | Middle | Instructions + latest turn both matter |
| `smart_cut` | Middle, with visible marker | Same as head_tail but model knows truncation happened |

## Real workflows

### "Does this fit in my prompt?"

```jsonc
// Tool call from your agent
{
  "name": "count_tokens",
  "arguments": { "text": "<...long text...>", "max_tokens": 4096 }
}
// Returns:
{ "tokens": 5230, "max_tokens": 4096, "fits": false, "overflow_tokens": 1134, "chars_per_token": 4 }
```

If `fits: true`, send as-is. If `fits: false`, decide between `truncate_to_token_budget` (lose info) or `chunk_to_budget` (multiple LLM calls).

### "Make this fit, keep the latest"

```jsonc
{
  "name": "truncate_to_token_budget",
  "arguments": { "text": "<chat history>", "max_tokens": 4096, "strategy": "tail" }
}
// Returns:
{ "truncated": "...", "original_tokens": 5230, "truncated_tokens": 4096, "strategy_used": "tail" }
```

### "Ingest this 50k-token doc into my RAG"

```jsonc
{
  "name": "chunk_to_budget",
  "arguments": { "text": "<long doc>", "max_tokens": 512, "overlap_tokens": 50 }
}
// Returns:
{
  "chunks": ["...", "...", "..."],
  "chunk_count": 110,
  "total_tokens": 50000,
  "chunk_max_tokens": 512,
  "overlap_tokens": 50
}
```

The `overlap_tokens` value lets sentences at chunk boundaries still have surrounding context in the next chunk — important for RAG retrieval quality.

## Token counting accuracy

The default `chars_per_token = 4` is the OpenAI rule of thumb. It's accurate within ~10–15% for English. For accurate accounting against a specific model, plug in your real tokenizer's chars-per-token ratio:

| Tokenizer | Chars/token (English) |
|---|---|
| `cl100k_base` (GPT-4, GPT-3.5) | ~4 |
| `o200k_base` (GPT-4o) | ~4.5 |
| Claude tokenizer | ~3.5 |
| Llama 3 | ~3.8 |

For non-English text, divide further (Chinese is ~1 char/token, code is ~3 chars/token).

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "promptbudget": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/promptbudget-mcp"]
    }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## Run directly (no MCP client)

```bash
npx -y @mukundakatta/promptbudget-mcp
```

The server speaks MCP over stdio. Pair with [`mcptools`](https://github.com/f/mcptools) or your client of choice. If nothing prints to the terminal, that is correct: stdio servers wait silently for an MCP client to connect.

## Sibling library

The Rust crate [`promptbudget`](https://crates.io/crates/promptbudget) implements the same logic in pure Rust, in case you'd rather link the algorithm into a non-MCP context.

## Changelog

- **0.2.0** (2026-05-10) — added `count_tokens` (pre-flight check) and `chunk_to_budget` (split-with-overlap). README expanded with workflow examples + tokenizer ratio table.
- **0.1.1** (2026-05-09) — added `mcpName` field for MCP Registry compatibility.
- **0.1.0** (2026-05-09) — initial release with `truncate_to_token_budget`.

## License

MIT OR Apache-2.0.
