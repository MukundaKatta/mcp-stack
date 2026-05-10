import { test } from "node:test";
import assert from "node:assert";
import { parseJson5, toJson5, toStrictJson } from "../src/index.js";

test("parse json5 with comments", () => {
  const r = parseJson5(`{
    // a comment
    foo: 1,
    bar: 'hello',
  }`);
  assert.deepStrictEqual(r, { foo: 1, bar: "hello" });
});

test("parse json5 with trailing commas", () => {
  assert.deepStrictEqual(parseJson5("[1, 2, 3,]"), [1, 2, 3]);
});

test("parse json5 with unquoted keys", () => {
  assert.deepStrictEqual(parseJson5("{foo: 1}"), { foo: 1 });
});

test("parse json5 with single-quoted strings", () => {
  assert.deepStrictEqual(parseJson5("{a: 'b'}"), { a: "b" });
});

test("parse fails on truly broken JSON", () => {
  assert.throws(() => parseJson5("{not valid"), /JSON5 parse error/);
});

test("to_json5 emits unquoted keys when safe", () => {
  const out = toJson5({ foo: 1, "bar-baz": 2 }, 2);
  assert.ok(out.includes("foo:"));
  // JSON5 single-quotes keys with non-identifier chars (not double).
  assert.ok(out.includes("'bar-baz':"));
});

test("to_strict_json round-trips", () => {
  const json = toStrictJson(`{
    // comment
    a: 1,
    b: [2, 3,],
  }`);
  assert.deepStrictEqual(JSON.parse(json), { a: 1, b: [2, 3] });
});

test("to_strict_json indent 0 is one line", () => {
  const json = toStrictJson("{a:1,b:2}", 0);
  assert.strictEqual(json, '{"a":1,"b":2}');
});

test("parse json5 nan + infinity", () => {
  const r = parseJson5("{x: NaN, y: Infinity, z: -Infinity}");
  assert.ok(Number.isNaN(r.x));
  assert.strictEqual(r.y, Infinity);
  assert.strictEqual(r.z, -Infinity);
});

test("parse json5 hex numbers", () => {
  assert.deepStrictEqual(parseJson5("{x: 0x10}"), { x: 16 });
});
