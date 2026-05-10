import { test } from "node:test";
import assert from "node:assert";
import { testRegex, findAll, replace } from "../src/index.js";

test("test_regex matches with offsets", () => {
  const r = testRegex("\\d+", "abc 123 def 456");
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.match, "123");
  assert.strictEqual(r.start, 4);
  assert.strictEqual(r.end, 7);
});

test("test_regex no match returns matched:false", () => {
  const r = testRegex("xyz", "abc");
  assert.strictEqual(r.matched, false);
});

test("test_regex captures named groups", () => {
  const r = testRegex("(?<year>\\d{4})-(?<month>\\d{2})", "2026-05-10");
  assert.strictEqual(r.named_groups.year, "2026");
  assert.strictEqual(r.named_groups.month, "05");
});

test("test_regex captures positional groups", () => {
  const r = testRegex("(\\w+)@(\\w+)", "alice@example");
  assert.deepStrictEqual(r.groups, ["alice", "example"]);
});

test("test_regex with case-insensitive flag", () => {
  const r = testRegex("HELLO", "hello world", "i");
  assert.strictEqual(r.matched, true);
  assert.strictEqual(r.match, "hello");
});

test("find_all returns every match", () => {
  const r = findAll("\\d+", "1 22 333");
  assert.strictEqual(r.count, 3);
  assert.deepStrictEqual(r.matches.map((m) => m.match), ["1", "22", "333"]);
});

test("find_all preserves group info per match", () => {
  const r = findAll("(\\w)=(\\d)", "a=1 b=2 c=3");
  assert.strictEqual(r.count, 3);
  assert.deepStrictEqual(r.matches[1].groups, ["b", "2"]);
});

test("find_all is safe against zero-width matches", () => {
  // Empty-string match is the canonical infinite-loop trap.
  const r = findAll("a*", "aaa", "g");
  // Should terminate, not hang.
  assert.ok(r.count >= 1);
});

test("find_all returns empty when no match", () => {
  const r = findAll("z", "aaa");
  assert.strictEqual(r.count, 0);
  assert.deepStrictEqual(r.matches, []);
});

test("replace with backreferences", () => {
  const r = replace("(\\w+)@(\\w+)", "alice@example", "$2/$1");
  assert.strictEqual(r.result, "example/alice");
  assert.strictEqual(r.replaced, true);
});

test("replace with named groups", () => {
  const r = replace("(?<y>\\d{4})-(?<m>\\d{2})", "2026-05", "$<m>/$<y>");
  assert.strictEqual(r.result, "05/2026");
});

test("replace returns replaced:false when no match", () => {
  const r = replace("z+", "abc", "X");
  assert.strictEqual(r.replaced, false);
  assert.strictEqual(r.result, "abc");
});

test("invalid regex throws useful error", () => {
  assert.throws(() => testRegex("[unclosed", "anything"), /Invalid regular expression|Unterminated/);
});
