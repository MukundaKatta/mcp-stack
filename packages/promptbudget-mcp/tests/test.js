import { test } from "node:test";
import assert from "node:assert";
import { countTokens, truncateToTokenBudget } from "../src/index.js";

test("countTokens basic", () => {
  assert.strictEqual(countTokens(""), 0);
  assert.strictEqual(countTokens("abcd"), 1);
  assert.strictEqual(countTokens("abcde"), 2); // 5/4 -> 2
});

test("countTokens uses chars not bytes for multibyte", () => {
  // "héllo" is 5 codepoints, 6 bytes
  assert.strictEqual(countTokens("héllo"), 2);
});

test("truncate passes through when under budget", () => {
  const r = truncateToTokenBudget("short", 100, "head");
  assert.strictEqual(r.truncated, "short");
  assert.strictEqual(r.strategy_used, "passthrough");
});

test("truncate head keeps prefix", () => {
  const r = truncateToTokenBudget("0123456789abcdef", 2, "head");
  assert.strictEqual(r.truncated, "01234567");
  assert.ok(r.truncated_tokens <= 2);
  assert.strictEqual(r.strategy_used, "head");
});

test("truncate tail keeps suffix", () => {
  const r = truncateToTokenBudget("0123456789abcdef", 2, "tail");
  assert.strictEqual(r.truncated, "89abcdef");
  assert.ok(r.truncated_tokens <= 2);
});

test("truncate head_tail drops middle", () => {
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const r = truncateToTokenBudget(s, 4, "head_tail", { head_ratio: 0.5 });
  assert.ok(r.truncated.startsWith("ABCDEFGH"));
  assert.ok(r.truncated.endsWith("STUVWXYZ"));
});

test("smart_cut inserts marker", () => {
  const r = truncateToTokenBudget("X".repeat(200), 10, "smart_cut", {
    head_ratio: 0.5,
    marker: " ... ",
  });
  assert.ok(r.truncated.includes(" ... "));
});

test("zero budget yields empty result", () => {
  const r = truncateToTokenBudget("abc", 0, "head");
  assert.strictEqual(r.truncated, "");
});

test("unknown strategy throws", () => {
  assert.throws(
    () => truncateToTokenBudget("abc", 5, "rotate"),
    /unknown strategy/,
  );
});
