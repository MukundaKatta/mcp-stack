import { test } from "node:test";
import assert from "node:assert";
import { formatSql } from "../src/index.js";

test("basic SELECT gets formatted", () => {
  const r = formatSql("select a,b from t where x=1");
  assert.ok(r.formatted.includes("SELECT"));
  assert.ok(r.formatted.includes("FROM"));
  assert.ok(r.formatted.includes("WHERE"));
  assert.strictEqual(r.dialect, "sql");
});

test("keyword_case lower works", () => {
  const r = formatSql("SELECT * FROM t", { keyword_case: "lower" });
  assert.ok(r.formatted.includes("select"));
  assert.ok(!r.formatted.includes("SELECT"));
});

test("keyword_case preserve works", () => {
  const r = formatSql("Select * From t", { keyword_case: "preserve" });
  assert.ok(r.formatted.includes("Select"));
});

test("postgresql dialect handles ::cast syntax", () => {
  const r = formatSql("select '1'::int", { dialect: "postgresql" });
  assert.ok(r.formatted.includes("::"));
});

test("bigquery dialect handles backticks", () => {
  const r = formatSql("SELECT * FROM `proj.dataset.table`", { dialect: "bigquery" });
  assert.ok(r.formatted.includes("`proj.dataset.table`"));
});

test("returns line_count", () => {
  const r = formatSql("SELECT a, b, c FROM t WHERE x = 1 AND y = 2");
  assert.ok(r.line_count >= 1);
});

test("unsupported dialect throws", () => {
  assert.throws(
    () => formatSql("SELECT 1", { dialect: "cobol" }),
    /unsupported dialect/,
  );
});

test("invalid keyword_case throws", () => {
  assert.throws(
    () => formatSql("SELECT 1", { keyword_case: "title" }),
    /keyword_case must be one of/,
  );
});

test("complex query is multi-line", () => {
  const r = formatSql(
    "SELECT a.x, b.y FROM table_a a JOIN table_b b ON a.id = b.id WHERE a.created_at > '2024-01-01' GROUP BY a.x, b.y HAVING COUNT(*) > 5 ORDER BY a.x DESC LIMIT 10",
  );
  assert.ok(r.line_count >= 5);
});
