import { test } from "node:test";
import assert from "node:assert";
import { convertTz, nowIn, getTzOffset } from "../src/index.js";

test("convert UTC instant to America/New_York during EST", () => {
  // 2026-01-15T18:00:00Z is EST (UTC-5)
  const r = convertTz("2026-01-15T18:00:00Z", "America/New_York");
  assert.strictEqual(r.offset_minutes, -300);
  assert.strictEqual(r.offset_string, "-05:00");
  assert.ok(r.local_iso.startsWith("2026-01-15T13:00:00"));
});

test("convert UTC to America/New_York during EDT (DST)", () => {
  // 2026-07-15T18:00:00Z is EDT (UTC-4)
  const r = convertTz("2026-07-15T18:00:00Z", "America/New_York");
  assert.strictEqual(r.offset_minutes, -240);
  assert.strictEqual(r.offset_string, "-04:00");
  assert.ok(r.local_iso.startsWith("2026-07-15T14:00:00"));
});

test("convert UTC to Asia/Kolkata (no DST, +5:30)", () => {
  const r = convertTz("2026-05-10T00:00:00Z", "Asia/Kolkata");
  assert.strictEqual(r.offset_minutes, 330);
  assert.strictEqual(r.offset_string, "+05:30");
  assert.ok(r.local_iso.startsWith("2026-05-10T05:30:00"));
});

test("convert UTC to UTC is +00:00", () => {
  const r = convertTz("2026-05-10T12:00:00Z", "UTC");
  assert.strictEqual(r.offset_minutes, 0);
  assert.strictEqual(r.offset_string, "+00:00");
});

test("now_in returns a structured result", () => {
  const r = nowIn("America/Los_Angeles");
  assert.ok(r.instant);
  assert.strictEqual(r.timezone, "America/Los_Angeles");
  assert.ok(r.local_iso);
  assert.ok(typeof r.offset_minutes === "number");
});

test("tz_offset detects DST shift", () => {
  // US DST starts on the second Sunday of March = 2026-03-08.
  // At 02:00 EST (07:00 UTC), clocks jump forward to 03:00 EDT.
  const before = getTzOffset("2026-03-08T06:00:00Z", "America/New_York");
  const after = getTzOffset("2026-03-08T08:00:00Z", "America/New_York");
  assert.strictEqual(before.offset_minutes, -300); // EST
  assert.strictEqual(after.offset_minutes, -240); // EDT
});

test("invalid timezone throws", () => {
  assert.throws(() => convertTz("2026-05-10T00:00:00Z", "Mars/Olympus"), /unknown IANA timezone/);
});

test("invalid instant throws", () => {
  assert.throws(() => convertTz("not-a-date", "UTC"), /invalid ISO instant/);
});
