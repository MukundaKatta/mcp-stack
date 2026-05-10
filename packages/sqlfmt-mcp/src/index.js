#!/usr/bin/env node
// sqlfmt-mcp — deterministic SQL formatting via the `sql-formatter` library.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { format } from "sql-formatter";

// --- pure logic ---

const SUPPORTED_DIALECTS = [
  "sql", "bigquery", "db2", "db2i", "duckdb", "hive", "mariadb", "mysql",
  "n1ql", "plsql", "postgresql", "redshift", "singlestoredb", "snowflake",
  "spark", "sqlite", "tidb", "transactsql", "trino",
];

export function formatSql(sql, options = {}) {
  const language = options.dialect ?? "sql";
  if (!SUPPORTED_DIALECTS.includes(language)) {
    throw new Error(
      `unsupported dialect '${language}'. Supported: ${SUPPORTED_DIALECTS.join(", ")}`,
    );
  }
  const tabWidth = options.tab_width ?? 2;
  const useTabs = options.use_tabs ?? false;
  const keywordCase = options.keyword_case ?? "upper";
  if (!["preserve", "upper", "lower"].includes(keywordCase)) {
    throw new Error("keyword_case must be one of: preserve, upper, lower");
  }
  const formatted = format(sql, {
    language,
    tabWidth,
    useTabs,
    keywordCase,
  });
  return {
    formatted,
    dialect: language,
    line_count: formatted.split("\n").length,
  };
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "format_sql",
    description:
      "Format a SQL string using a dialect-aware formatter. Supports 19 dialects (postgres, mysql, snowflake, bigquery, redshift, spark, etc.). Use when an LLM produces SQL inline and you want it normalized for review or for a downstream tool that expects a specific style.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "Raw SQL to format." },
        dialect: {
          type: "string",
          enum: SUPPORTED_DIALECTS,
          default: "sql",
          description: "Generic 'sql' covers most ANSI cases; pick specifically for dialect-only syntax.",
        },
        tab_width: { type: "integer", minimum: 1, maximum: 8, default: 2 },
        use_tabs: { type: "boolean", default: false },
        keyword_case: {
          type: "string",
          enum: ["preserve", "upper", "lower"],
          default: "upper",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "list_dialects",
    description:
      "Return the list of SQL dialects supported by the formatter. Useful when an LLM needs to confirm dialect availability before formatting.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const server = new Server(
  { name: "sqlfmt-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "format_sql":
        result = formatSql(args.sql, {
          dialect: args.dialect,
          tab_width: args.tab_width,
          use_tabs: args.use_tabs,
          keyword_case: args.keyword_case,
        });
        break;
      case "list_dialects":
        result = { dialects: SUPPORTED_DIALECTS };
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `error: ${e.message}` }], isError: true };
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
