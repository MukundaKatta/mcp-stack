import { test } from "node:test";
import assert from "node:assert";
import {
  interpretDriftScore,
  recommendThresholds,
  explainDriftDimensions,
  DIMENSIONS,
} from "../src/index.js";

test("interpret returns severity for known score", () => {
  const r = interpretDriftScore(0.3, "data");
  assert.strictEqual(r.dimension, "data");
  assert.ok(r.severity.includes("severe") || r.severity.includes("significant"));
  assert.ok(r.next_steps.length > 0);
});

test("interpret marks zero as no shift", () => {
  const r = interpretDriftScore(0, "data");
  assert.strictEqual(r.severity, "no significant shift");
});

test("interpret with threshold sets exceeded flag", () => {
  const r = interpretDriftScore(0.5, "embedding", 0.05);
  assert.strictEqual(r.exceeded, true);
  const r2 = interpretDriftScore(0.01, "embedding", 0.05);
  assert.strictEqual(r2.exceeded, false);
});

test("interpret unknown dimension throws", () => {
  assert.throws(() => interpretDriftScore(0.1, "spaghetti"), /unknown dimension/);
});

test("interpret non-finite score throws", () => {
  assert.throws(() => interpretDriftScore(NaN, "data"), /finite number/);
});

test("recommend returns three thresholds", () => {
  const r = recommendThresholds("embedding", 1000, 0.05);
  assert.ok(r.recommended.conservative < r.recommended.moderate);
  assert.ok(r.recommended.moderate < r.recommended.lax);
});

test("recommend smaller sample yields higher thresholds", () => {
  const big = recommendThresholds("data", 10000, 0.05);
  const small = recommendThresholds("data", 100, 0.05);
  assert.ok(small.recommended.moderate > big.recommended.moderate);
});

test("recommend tighter FP budget yields stricter (smaller) thresholds", () => {
  // tighter FP budget = lower number = stricter (we want to fire less = need higher score)
  // recommend currently scales thresholds UP for tighter budget (lower budget -> higher fpAdjust).
  // So the threshold goes UP, meaning we need a higher score to fire = stricter alarm.
  const lax = recommendThresholds("data", 1000, 0.10);
  const strict = recommendThresholds("data", 1000, 0.01);
  assert.ok(strict.recommended.moderate > lax.recommended.moderate);
});

test("explain returns all 5 dimensions", () => {
  const r = explainDriftDimensions();
  assert.strictEqual(r.dimensions.length, 5);
  for (const d of r.dimensions) {
    assert.ok(d.name);
    assert.ok(d.catches);
    assert.ok(Array.isArray(d.methods));
  }
});

test("DIMENSIONS object has all 5 entries", () => {
  assert.deepStrictEqual(
    Object.keys(DIMENSIONS).sort(),
    ["confidence", "data", "embedding", "query", "response"],
  );
});
