import { test } from "node:test";
import assert from "node:assert";
import {
  injectCitations,
  parseCitations,
  stripCitations,
} from "../src/index.js";

test("inject end appends one marker", () => {
  assert.strictEqual(
    injectCitations("hello", [{ idx: 1 }], { at: "end" }),
    "hello [1]",
  );
});

test("inject end multiple markers", () => {
  assert.strictEqual(
    injectCitations("hello", [{ idx: 1 }, { idx: 2 }, { idx: 3 }], {
      at: "end",
    }),
    "hello [1] [2] [3]",
  );
});

test("inject end on text already ending in space", () => {
  assert.strictEqual(
    injectCitations("hello ", [{ idx: 1 }], { at: "end" }),
    "hello [1]",
  );
});

test("inject end with no citations passes through", () => {
  assert.strictEqual(injectCitations("hello", []), "hello");
});

test("inject position", () => {
  assert.strictEqual(
    injectCitations("hello world", [{ idx: 7 }], {
      at: "position",
      position: 5,
    }),
    "hello[7] world",
  );
});

test("inject end on empty text", () => {
  assert.strictEqual(injectCitations("", [{ idx: 1 }]), "[1]");
});

test("parse finds all markers", () => {
  const m = parseCitations("foo [1] bar [2] baz");
  assert.strictEqual(m.length, 2);
  assert.deepStrictEqual(m[0], { pos: 4, idx: 1, len: 3 });
  assert.deepStrictEqual(m[1], { pos: 12, idx: 2, len: 3 });
});

test("parse handles multidigit", () => {
  const m = parseCitations("[42]");
  assert.deepStrictEqual(m[0], { pos: 0, idx: 42, len: 4 });
});

test("parse ignores non-numeric brackets", () => {
  const m = parseCitations("see [abc] and [123]");
  assert.strictEqual(m.length, 1);
  assert.strictEqual(m[0].idx, 123);
});

test("strip removes markers", () => {
  assert.strictEqual(stripCitations("foo [1] bar [12] baz"), "foo  bar  baz");
});

test("strip is no-op when no markers", () => {
  assert.strictEqual(stripCitations("plain text"), "plain text");
});

test("round-trip inject then parse", () => {
  const cited = injectCitations("Anthropic was founded in 2021.", [
    { idx: 1 },
    { idx: 2 },
  ]);
  const markers = parseCitations(cited);
  assert.strictEqual(markers.length, 2);
  assert.strictEqual(markers[0].idx, 1);
  assert.strictEqual(markers[1].idx, 2);
});

test("inject unknown 'at' throws", () => {
  assert.throws(
    () => injectCitations("hi", [{ idx: 1 }], { at: "middle" }),
    /unknown 'at' value/,
  );
});
