#!/usr/bin/env node
// timezone-mcp — IANA timezone math via the built-in Intl APIs.
// LLMs hallucinate offsets and DST rules. This server returns real answers.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic ---

function validateTz(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch (_) {
    throw new Error(`unknown IANA timezone: '${tz}'`);
  }
}

/** Format a Date in a target IANA timezone as ISO-like '2026-05-10T13:45:00'. */
function formatInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  let hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}

/** Returns offset in minutes east of UTC for a given IANA tz at a given UTC instant. */
function tzOffsetMinutes(date, tz) {
  // Compute by formatting the same instant in the target tz and in UTC, diff.
  const localStr = formatInTz(date, tz);
  const utcStr = formatInTz(date, "UTC");
  const local = Date.parse(localStr + "Z");
  const utc = Date.parse(utcStr + "Z");
  return Math.round((local - utc) / 60000);
}

function offsetString(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const m = Math.abs(minutes);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function convertTz(isoInstant, toTz) {
  validateTz(toTz);
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid ISO instant: '${isoInstant}'`);
  }
  const offsetMin = tzOffsetMinutes(date, toTz);
  return {
    instant: date.toISOString(),
    timezone: toTz,
    local_iso: `${formatInTz(date, toTz)}${offsetString(offsetMin)}`,
    offset_minutes: offsetMin,
    offset_string: offsetString(offsetMin),
  };
}

export function nowIn(tz) {
  return convertTz(new Date().toISOString(), tz);
}

export function getTzOffset(isoInstant, tz) {
  validateTz(tz);
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid ISO instant: '${isoInstant}'`);
  }
  const offsetMin = tzOffsetMinutes(date, tz);
  return {
    timezone: tz,
    instant: date.toISOString(),
    offset_minutes: offsetMin,
    offset_string: offsetString(offsetMin),
  };
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "convert_tz",
    description:
      "Convert a UTC ISO instant into a given IANA timezone. Returns the local ISO string with offset, the offset in minutes, and the formatted offset string. Handles DST automatically.",
    inputSchema: {
      type: "object",
      properties: {
        instant: { type: "string", description: "ISO 8601 UTC instant, e.g. '2026-05-10T13:45:00Z'." },
        timezone: { type: "string", description: "IANA timezone, e.g. 'America/New_York', 'Asia/Kolkata'." },
      },
      required: ["instant", "timezone"],
    },
  },
  {
    name: "now_in",
    description:
      "Get the current local time in a given IANA timezone. Same return shape as convert_tz.",
    inputSchema: {
      type: "object",
      properties: { timezone: { type: "string" } },
      required: ["timezone"],
    },
  },
  {
    name: "tz_offset",
    description:
      "Get the UTC offset for a timezone at a specific instant. Useful for DST boundary checks: pass an instant a few hours apart to detect a DST transition.",
    inputSchema: {
      type: "object",
      properties: {
        instant: { type: "string" },
        timezone: { type: "string" },
      },
      required: ["instant", "timezone"],
    },
  },
];

const server = new Server(
  { name: "timezone-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "convert_tz":
        result = convertTz(args.instant, args.timezone);
        break;
      case "now_in":
        result = nowIn(args.timezone);
        break;
      case "tz_offset":
        result = getTzOffset(args.instant, args.timezone);
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
