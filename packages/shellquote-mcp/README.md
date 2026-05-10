# @mukundakatta/shellquote-mcp

MCP server for safe shell argument escaping. Stops LLM-generated shell commands from breaking (or worse) on quotes, spaces, `$VAR` interpolation, and backslashes.

## Tools

- **`quote_bash(arg)`** — single-quote escape for bash/sh/zsh. Suppresses all metacharacter expansion.
- **`quote_bash_argv(args)`** — escape a list and join with spaces.
- **`quote_cmd(arg)`** — Windows cmd.exe (caveat: cmd has unfixable delayed-expansion corners).
- **`quote_powershell(arg)`** — single-quoted PS string.

## Why this exists

LLMs constantly get shell escaping wrong:

- `bash -c "echo $HOME"` interpolates the variable instead of passing it literal
- `cmd /c "del file.txt"` breaks if the filename has spaces
- Embedded single quotes in bash require the awkward `'\''` dance the LLM forgets

This tool returns a string the shell will accept verbatim, with no metacharacter surprises.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "shellquote": { "command": "npx", "args": ["-y", "@mukundakatta/shellquote-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
