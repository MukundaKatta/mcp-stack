import { test } from "node:test";
import assert from "node:assert";
import {
  countTokens,
  countWithBudget,
  truncateToTokenBudget,
  chunkToBudget,
} from "../src/index.js";

// --- countTokens ---

test("countTokens basic", () => {
  assert.strictEqual(countTokens(""), 0);
  assert.strictEqual(countTokens("abcd"), 1);
  assert.strictEqual(countTokens("abcde"), 2);
});

test("countTokens uses chars not bytes for multibyte", () => {
  assert.strictEqual(countTokens("héllo"), 2);
});

// --- countWithBudget ---

test("countWithBudget returns just count when no budget", () => {
  const r = countWithBudget("hello");
  assert.strictEqual(r.tokens, 2);
  assert.strictEqual(r.max_tokens, undefined);
  assert.strictEqual(r.fits, undefined);
});

test("countWithBudget reports fits=true when under", () => {
  const r = countWithBudget("hi", { max_tokens: 100 });
  assert.strictEqual(r.fits, true);
  assert.strictEqual(r.overflow_tokens, 0);
});

test("countWithBudget reports fits=false + overflow when over", () => {
  const r = countWithBudget("X".repeat(200), { max_tokens: 10 });
  assert.strictEqual(r.fits, false);
  assert.strictEqual(r.overflow_tokens, 50 - 10);
});

// --- truncateToTokenBudget ---

test("truncate passes through when under budget", () => {
  const r = truncateToTokenBudget("short", 100, "head");
  assert.strictEqual(r.strategy_used, "passthrough");
});

test("truncate head keeps prefix", () => {
  const r = truncateToTokenBudget("0123456789abcdef", 2, "head");
  assert.strictEqual(r.truncated, "01234567");
});

test("truncate tail keeps suffix", () => {
  const r = truncateToTokenBudget("0123456789abcdef", 2, "tail");
  assert.strictEqual(r.truncated, "89abcdef");
});

test("truncate head_tail drops middle", () => {
  const r = truncateToTokenBudget("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 4, "head_tail");
  assert.ok(r.truncated.startsWith("ABCDEFGH"));
  assert.ok(r.truncated.endsWith("STUVWXYZ"));
});

test("truncate smart_cut inserts marker", () => {
  const r = truncateToTokenBudget("X".repeat(200), 10, "smart_cut", { marker: " ... " });
  assert.ok(r.truncated.includes(" ... "));
});

test("truncate unknown strategy throws", () => {
  assert.throws(() => truncateToTokenBudget("abc", 5, "rotate"), /unknown strategy/);
});

// --- chunkToBudget ---

test("chunk: empty text returns empty result", () => {
  const r = chunkToBudget("", 100);
  assert.deepStrictEqual(r.chunks, []);
  assert.strictEqual(r.chunk_count, 0);
});

test("chunk: short text returns single chunk", () => {
  const r = chunkToBudget("hello world", 100);
  assert.strictEqual(r.chunk_count, 1);
  assert.strictEqual(r.chunks[0], "hello world");
});

test("chunk: splits at chunk_chars boundary", () => {
  const r = chunkToBudget("abcdefgh", 1);
  assert.strictEqual(r.chunk_count, 2);
  assert.strictEqual(r.chunks[0], "abcd");
  assert.strictEqual(r.chunks[1], "efgh");
});

test("chunk: respects overlap", () => {
  const r = chunkToBudget("abcdefghijklmnop", 2, { overlap_tokens: 1 });
  assert.strictEqual(r.chunk_count, 3);
  assert.strictEqual(r.chunks[0], "abcdefgh");
  assert.strictEqual(r.chunks[1], "efghijkl");
  assert.strictEqual(r.chunks[2], "ijklmnop");
});

test("chunk: overlap >= max_tokens throws", () => {
  assert.throws(
    () => chunkToBudget("abc", 2, { overlap_tokens: 2 }),
    /overlap_tokens must be strictly less than max_tokens/,
  );
});

test("chunk: max_tokens 0 or negative throws", () => {
  assert.throws(() => chunkToBudget("abc", 0), /positive integer/);
});

test("chunk: total_tokens reflects whole input", () => {
  const r = chunkToBudget("abcdefgh", 1);
  assert.strictEqual(r.total_tokens, 2);
});

test("chunk: respects multibyte codepoints", () => {
  const r = chunkToBudget("héllo", 1);
  assert.strictEqual(r.chunks[0], "héll");
  assert.strictEqual(r.chunks[1], "o");
});
