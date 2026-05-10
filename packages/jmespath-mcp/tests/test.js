import { test } from "node:test";
import assert from "node:assert";
import { jsonQuery } from "../src/index.js";

const data = {
  people: [
    { name: "alice", age: 30, state: "WA" },
    { name: "bob", age: 25, state: "CA" },
    { name: "carol", age: 35, state: "WA" },
  ],
};

test("simple key lookup", () => {
  assert.strictEqual(jsonQuery("people[0].name", data), "alice");
});

test("projection over array", () => {
  assert.deepStrictEqual(jsonQuery("people[*].name", data), [
    "alice", "bob", "carol",
  ]);
});

test("filter expression", () => {
  const r = jsonQuery("people[?state == 'WA'].name", data);
  assert.deepStrictEqual(r, ["alice", "carol"]);
});

test("built-in function: length", () => {
  assert.strictEqual(jsonQuery("length(people)", data), 3);
});

test("pipe expression", () => {
  // Sort people by age, then take names.
  const r = jsonQuery("sort_by(people, &age)[*].name", data);
  assert.deepStrictEqual(r, ["bob", "alice", "carol"]);
});

test("accepts JSON string input", () => {
  const r = jsonQuery("foo", '{"foo": 42}');
  assert.strictEqual(r, 42);
});

test("invalid JSON string throws useful error", () => {
  assert.throws(
    () => jsonQuery("foo", "{not json}"),
    /invalid JSON input/,
  );
});

test("invalid JMESPath throws useful error", () => {
  assert.throws(
    () => jsonQuery("foo[", data),
    /jmespath error/,
  );
});

test("missing path returns null (JMESPath spec)", () => {
  assert.strictEqual(jsonQuery("nothing.here", data), null);
});
