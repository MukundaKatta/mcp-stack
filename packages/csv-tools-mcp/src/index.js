#!/usr/bin/env node
// csv-tools-mcp — RFC 4180-aware CSV parsing/generation as MCP tools.
//
// LLMs reliably mishandle CSV edge cases (embedded commas, escaped quotes,
// CRLF vs LF, BOMs, ragged rows). These tools route those through proper
// state-machine parsing so callers don't have to guess.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic ---

const BOM = "﻿";

/**
 * Parse a CSV string per RFC 4180 (with light tolerances).
 *
 * Returns `{ headers, rows }` where `rows` is an array of objects keyed by
 * header. If `has_header` is false, returns `{ rows }` with arrays.
 */
export function parseCsv(input, options = {}) {
  const hasHeader = options.has_header !== false;
  const delimiter = options.delimiter ?? ",";
  if (delimiter.length !== 1) {
    throw new Error("delimiter must be a single character");
  }

  let text = input;
  if (text.startsWith(BOM)) text = text.slice(1);

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 2;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  // Trailing cell / row.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (!hasHeader) {
    return { rows };
  }
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0];
  const objRows = rows.slice(1).map((r) => {
    const o = {};
    for (let j = 0; j < headers.length; j++) o[headers[j]] = r[j] ?? "";
    return o;
  });
  return { headers, rows: objRows };
}

/**
 * Serialize rows to CSV. If `headers` provided, writes a header row first.
 */
export function toCsv(rows, options = {}) {
  const delimiter = options.delimiter ?? ",";
  const headers = options.headers;
  const lines = [];
  if (headers) lines.push(headers.map((h) => quote(h, delimiter)).join(delimiter));
  for (const r of rows) {
    if (Array.isArray(r)) {
      lines.push(r.map((c) => quote(c, delimiter)).join(delimiter));
    } else if (headers) {
      lines.push(headers.map((h) => quote(r[h] ?? "", delimiter)).join(delimiter));
    } else {
      // Object row without headers: deterministic key order.
      const keys = Object.keys(r);
      lines.push(keys.map((k) => quote(r[k] ?? "", delimiter)).join(delimiter));
    }
  }
  return lines.join("\n");
}

function quote(value, delimiter) {
  const s = String(value ?? "");
  const needs = s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r");
  if (!needs) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Pluck a subset of columns from already-parsed rows.
 */
export function pluckColumns(rows, columns) {
  return rows.map((r) => {
    const out = {};
    for (const c of columns) out[c] = r[c] ?? "";
    return out;
  });
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "parse_csv",
    description:
      "Parse a CSV string into structured rows. Handles quoted fields with embedded commas, escaped double quotes, CRLF/LF newlines, and a leading BOM. Returns headers + rows-as-objects when has_header is true (default), or raw arrays otherwise.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Raw CSV text." },
        has_header: { type: "boolean", default: true },
        delimiter: { type: "string", default: ",", description: "Single-char delimiter." },
      },
      required: ["text"],
    },
  },
  {
    name: "to_csv",
    description:
      "Serialize rows to a CSV string with proper quoting. Accepts arrays of arrays or arrays of objects. If headers are provided, the first row is the header line.",
    inputSchema: {
      type: "object",
      properties: {
        rows: { type: "array", description: "Array of arrays or array of objects." },
        headers: { type: "array", items: { type: "string" } },
        delimiter: { type: "string", default: "," },
      },
      required: ["rows"],
    },
  },
  {
    name: "pluck_columns",
    description:
      "Reduce already-parsed rows (objects keyed by header) to just the named columns. Useful when CSV has many columns and you only need a few.",
    inputSchema: {
      type: "object",
      properties: {
        rows: { type: "array", description: "Array of objects (output of parse_csv with has_header=true)." },
        columns: { type: "array", items: { type: "string" } },
      },
      required: ["rows", "columns"],
    },
  },
];

const server = new Server(
  { name: "csv-tools-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "parse_csv":
        result = parseCsv(args.text, {
          has_header: args.has_header,
          delimiter: args.delimiter,
        });
        break;
      case "to_csv":
        result = { csv: toCsv(args.rows, { headers: args.headers, delimiter: args.delimiter }) };
        break;
      case "pluck_columns":
        result = { rows: pluckColumns(args.rows, args.columns) };
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
