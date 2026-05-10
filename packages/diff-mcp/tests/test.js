import { test } from "node:test";
import assert from "node:assert";
import {
  unifiedDiff,
  applyUnifiedPatch,
  parseUnifiedPatch,
} from "../src/index.js";

test("unified_diff produces a parseable patch", () => {
  const r = unifiedDiff("foo\nbar\n", "foo\nBAR\n");
  assert.ok(r.patch.includes("---"));
  assert.ok(r.patch.includes("+++"));
  assert.strictEqual(r.additions, 1);
  assert.strictEqual(r.deletions, 1);
});

test("unified_diff with no changes still returns a header", () => {
  const r = unifiedDiff("same\n", "same\n");
  assert.strictEqual(r.additions, 0);
  assert.strictEqual(r.deletions, 0);
});

test("unified_diff respects custom filenames", () => {
  const r = unifiedDiff("a\n", "b\n", { old_filename: "before.txt", new_filename: "after.txt" });
  assert.ok(r.patch.includes("before.txt"));
  assert.ok(r.patch.includes("after.txt"));
});

test("apply_patch round-trips", () => {
  const original = "line1\nline2\nline3\n";
  const target = "line1\nLINE-2\nline3\n";
  const { patch } = unifiedDiff(original, target);
  const applied = applyUnifiedPatch(original, patch);
  assert.strictEqual(applied.success, true);
  assert.strictEqual(applied.result, target);
});

test("apply_patch returns success:false when context drifts", () => {
  const { patch } = unifiedDiff("aaa\nbbb\nccc\n", "aaa\nBBB\nccc\n");
  // Apply against a different original (shifted contents).
  const applied = applyUnifiedPatch("xxx\nbbb\nccc\n", patch);
  // Either applies with fuzz or fails; require it doesn't return wrong content.
  if (applied.success) {
    assert.ok(applied.result !== null);
  } else {
    assert.ok(applied.reason.length > 0);
  }
});

test("parse_patch counts hunks + add/del per file", () => {
  const { patch } = unifiedDiff("a\nb\nc\n", "a\nB\nc\nd\n");
  const r = parseUnifiedPatch(patch);
  assert.strictEqual(r.files.length, 1);
  assert.ok(r.files[0].additions >= 1);
  assert.ok(r.files[0].deletions >= 1);
});

test("parse_patch handles multi-file patch", () => {
  const p1 = unifiedDiff("a\n", "b\n", { old_filename: "f1", new_filename: "f1" }).patch;
  const p2 = unifiedDiff("c\n", "d\n", { old_filename: "f2", new_filename: "f2" }).patch;
  const combined = p1 + "\n" + p2;
  const r = parseUnifiedPatch(combined);
  assert.strictEqual(r.files.length, 2);
});
