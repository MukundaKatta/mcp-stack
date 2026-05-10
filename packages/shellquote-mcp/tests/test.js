import { test } from "node:test";
import assert from "node:assert";
import {
  quoteBash,
  quoteBashArgv,
  quoteCmd,
  quotePowershell,
} from "../src/index.js";

test("bash: empty arg is empty single-quotes", () => {
  assert.strictEqual(quoteBash(""), "''");
});

test("bash: safe bareword passes through", () => {
  assert.strictEqual(quoteBash("hello-world.txt"), "hello-world.txt");
});

test("bash: spaces force single quotes", () => {
  assert.strictEqual(quoteBash("hello world"), "'hello world'");
});

test("bash: $VAR is suppressed inside single quotes", () => {
  assert.strictEqual(quoteBash("$HOME"), "'$HOME'");
});

test("bash: embedded single quote escapes correctly", () => {
  assert.strictEqual(quoteBash("don't"), "'don'\\''t'");
});

test("bash: argv joins with spaces", () => {
  assert.strictEqual(
    quoteBashArgv(["echo", "hello world", "$HOME"]),
    "echo 'hello world' '$HOME'",
  );
});

test("cmd: empty arg is empty double-quotes", () => {
  assert.strictEqual(quoteCmd(""), '""');
});

test("cmd: safe bareword passes through", () => {
  assert.strictEqual(quoteCmd("hello.txt"), "hello.txt");
});

test("cmd: spaces force double quotes", () => {
  assert.strictEqual(quoteCmd("hello world"), '"hello world"');
});

test("cmd: embedded double quote is doubled", () => {
  assert.strictEqual(quoteCmd('he said "hi"'), '"he said ""hi"""');
});

test("powershell: empty arg is empty single-quotes", () => {
  assert.strictEqual(quotePowershell(""), "''");
});

test("powershell: bareword passes through", () => {
  assert.strictEqual(quotePowershell("path-x"), "path-x");
});

test("powershell: spaces force single quotes", () => {
  assert.strictEqual(quotePowershell("a b"), "'a b'");
});

test("powershell: embedded single quote is doubled", () => {
  assert.strictEqual(quotePowershell("don't"), "'don''t'");
});

test("bash: backslashes are literal inside single quotes", () => {
  assert.strictEqual(quoteBash("a\\b"), "'a\\b'");
});

test("bash: handles newline by quoting", () => {
  assert.strictEqual(quoteBash("line1\nline2"), "'line1\nline2'");
});
