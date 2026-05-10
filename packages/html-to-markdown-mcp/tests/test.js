import { test } from "node:test";
import assert from "node:assert";
import { htmlToMd, extractText } from "../src/index.js";

test("simple paragraph", () => {
  const md = htmlToMd("<p>hello world</p>");
  assert.strictEqual(md.trim(), "hello world");
});

test("heading levels become ATX", () => {
  const md = htmlToMd("<h1>top</h1><h2>sub</h2>");
  assert.ok(md.includes("# top"));
  assert.ok(md.includes("## sub"));
});

test("link is inlined", () => {
  const md = htmlToMd('<a href="https://example.com">click</a>');
  assert.ok(md.includes("[click](https://example.com)"));
});

test("bold + italic", () => {
  const md = htmlToMd("<b>bold</b> and <i>italic</i>");
  assert.ok(md.includes("**bold**"));
  assert.ok(md.includes("*italic*"));
});

test("ul list", () => {
  const md = htmlToMd("<ul><li>a</li><li>b</li></ul>");
  assert.ok(md.includes("-   a"));
  assert.ok(md.includes("-   b"));
});

test("code block fenced", () => {
  const md = htmlToMd("<pre><code>x = 1</code></pre>");
  assert.ok(md.includes("```"));
  assert.ok(md.includes("x = 1"));
});

test("scripts and styles are stripped", () => {
  const md = htmlToMd(
    "<p>visible</p><script>alert('xss')</script><style>p{color:red}</style>",
  );
  assert.ok(md.includes("visible"));
  assert.ok(!md.includes("alert"));
  assert.ok(!md.includes("color:red"));
});

test("extract_text strips everything", () => {
  const t = extractText("<p>hello <b>bold</b> world</p>");
  assert.strictEqual(t, "hello bold world");
});

test("extract_text decodes entities", () => {
  const t = extractText("<p>Tom &amp; Jerry</p>");
  assert.strictEqual(t, "Tom & Jerry");
});

test("extract_text strips scripts even without normal tag context", () => {
  const t = extractText('<script>let x = 1;</script><p>only this</p>');
  assert.strictEqual(t, "only this");
});

test("extract_text normalizes whitespace", () => {
  const t = extractText("<p>a\n\n  b   c</p>");
  assert.strictEqual(t, "a b c");
});
