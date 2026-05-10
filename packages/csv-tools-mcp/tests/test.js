import { test } from "node:test";
import assert from "node:assert";
import { parseCsv, toCsv, pluckColumns } from "../src/index.js";

test("parse plain CSV with header", () => {
  const r = parseCsv("a,b,c\n1,2,3\n4,5,6");
  assert.deepStrictEqual(r.headers, ["a", "b", "c"]);
  assert.deepStrictEqual(r.rows, [
    { a: "1", b: "2", c: "3" },
    { a: "4", b: "5", c: "6" },
  ]);
});

test("parse handles quoted field with embedded comma", () => {
  const r = parseCsv('a,b\n"hello, world",2');
  assert.strictEqual(r.rows[0].a, "hello, world");
  assert.strictEqual(r.rows[0].b, "2");
});

test("parse handles escaped double quote", () => {
  const r = parseCsv('a\n"she said ""hi"""');
  assert.strictEqual(r.rows[0].a, 'she said "hi"');
});

test("parse handles CRLF newlines", () => {
  const r = parseCsv("a,b\r\n1,2\r\n3,4");
  assert.strictEqual(r.rows.length, 2);
  assert.strictEqual(r.rows[1].a, "3");
});

test("parse handles BOM prefix", () => {
  const r = parseCsv("﻿a,b\n1,2");
  assert.deepStrictEqual(r.headers, ["a", "b"]);
});

test("parse no-header mode returns arrays", () => {
  const r = parseCsv("1,2\n3,4", { has_header: false });
  assert.deepStrictEqual(r.rows, [["1", "2"], ["3", "4"]]);
  assert.strictEqual(r.headers, undefined);
});

test("parse handles ragged rows without crashing", () => {
  const r = parseCsv("a,b,c\n1,2,3\n4,5");
  assert.strictEqual(r.rows[1].c, ""); // missing cell becomes empty string
});

test("parse rejects multi-char delimiter", () => {
  assert.throws(() => parseCsv("a,b\n1,2", { delimiter: ",," }), /single character/);
});

test("to_csv quotes fields with commas", () => {
  const out = toCsv([["a, b", "c"]], { headers: ["x", "y"] });
  assert.strictEqual(out, 'x,y\n"a, b",c');
});

test("to_csv escapes embedded double quotes", () => {
  const out = toCsv([['he said "hi"', "ok"]]);
  assert.strictEqual(out, '"he said ""hi""",ok');
});

test("to_csv from objects with headers", () => {
  const out = toCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }], { headers: ["a", "b"] });
  assert.strictEqual(out, "a,b\n1,2\n3,4");
});

test("pluck_columns picks subset", () => {
  const rows = [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }];
  const r = pluckColumns(rows, ["a", "c"]);
  assert.deepStrictEqual(r, [{ a: 1, c: 3 }, { a: 4, c: 6 }]);
});

test("round-trip parse → to_csv preserves data", () => {
  const original = "name,note\nalice,\"hi, alice\"\nbob,\"she said \"\"hi\"\"\"";
  const parsed = parseCsv(original);
  const back = toCsv(parsed.rows, { headers: parsed.headers });
  // Re-parse to compare normalized
  const reParsed = parseCsv(back);
  assert.deepStrictEqual(reParsed.rows, parsed.rows);
});
