import { test } from "node:test";
import assert from "node:assert";
import { parseConfig, formatConfig, convert } from "../src/index.js";

test("parse JSON", () => {
  assert.deepStrictEqual(parseConfig('{"a":1}', "json"), { a: 1 });
});

test("parse TOML basic", () => {
  const r = parseConfig('name = "x"\nport = 8080', "toml");
  assert.strictEqual(r.name, "x");
  assert.strictEqual(r.port, 8080);
});

test("parse YAML basic", () => {
  const r = parseConfig("name: x\nport: 8080", "yaml");
  assert.strictEqual(r.name, "x");
  assert.strictEqual(r.port, 8080);
});

test("parse TOML table-of-tables", () => {
  const r = parseConfig(`[[server]]\nname = "a"\n[[server]]\nname = "b"`, "toml");
  assert.strictEqual(r.server.length, 2);
  assert.strictEqual(r.server[0].name, "a");
});

test("format JSON", () => {
  const r = formatConfig({ a: 1 }, "json");
  assert.strictEqual(r, '{\n  "a": 1\n}');
});

test("format TOML", () => {
  const r = formatConfig({ name: "x", port: 8080 }, "toml");
  assert.ok(r.includes("name = \"x\""));
  // @iarna/toml uses TOML's optional underscore separators on large ints,
  // so 8080 renders as "8_080". Tolerate either.
  assert.ok(/port\s*=\s*8_?080/.test(r), `got: ${r}`);
});

test("format YAML", () => {
  const r = formatConfig({ a: 1, b: [2, 3] }, "yaml");
  assert.ok(r.includes("a: 1"));
});

test("convert TOML -> JSON", () => {
  const r = convert('name = "x"', "toml", "json");
  assert.deepStrictEqual(JSON.parse(r), { name: "x" });
});

test("convert YAML -> TOML round trips", () => {
  const yamlText = "name: x\nport: 8080";
  const tomlText = convert(yamlText, "yaml", "toml");
  const back = parseConfig(tomlText, "toml");
  assert.strictEqual(back.name, "x");
  assert.strictEqual(back.port, 8080);
});

test("invalid format throws", () => {
  assert.throws(() => parseConfig("a:1", "ini"), /must be one of/);
});

test("malformed input throws useful error", () => {
  assert.throws(() => parseConfig("{not json", "json"), /json parse error/);
  assert.throws(() => parseConfig("[invalid toml", "toml"), /toml parse error/);
});
