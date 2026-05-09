import { test } from "node:test";
import assert from "node:assert";
import {
  recallAtK,
  hitAtK,
  mrr,
  ndcgAtK,
  evaluateBatch,
} from "../src/index.js";

test("recall_at_k basic", () => {
  assert.strictEqual(recallAtK(["a", "b", "c"], ["b", "d"], 3), 0.5);
  assert.strictEqual(recallAtK(["a", "b", "c"], ["b", "d"], 1), 0);
  assert.strictEqual(recallAtK(["a", "b", "c"], ["b", "d"], 2), 0.5);
});

test("recall_at_k perfect", () => {
  assert.strictEqual(recallAtK(["a", "b"], ["a", "b"], 2), 1);
});

test("recall_at_k empty relevant returns 0", () => {
  assert.strictEqual(recallAtK(["a"], [], 1), 0);
});

test("hit_at_k basic", () => {
  assert.strictEqual(hitAtK(["a", "b", "c"], ["b"], 3), 1);
  assert.strictEqual(hitAtK(["a", "b", "c"], ["b"], 1), 0);
  assert.strictEqual(hitAtK(["x", "y", "z"], ["b"], 3), 0);
});

test("mrr first position", () => {
  assert.strictEqual(mrr(["a", "b"], ["a"]), 1);
});

test("mrr third position", () => {
  assert.ok(Math.abs(mrr(["x", "y", "z"], ["z"]) - 1 / 3) < 1e-9);
});

test("mrr no match returns 0", () => {
  assert.strictEqual(mrr(["x", "y"], ["a"]), 0);
});

test("ndcg perfect ordering equals 1", () => {
  assert.ok(Math.abs(ndcgAtK(["a", "b", "c"], ["a", "b"], 3) - 1) < 1e-9);
});

test("ndcg irrelevant at top discounts", () => {
  // retrieved [x, a], relevant {a}: DCG = 1/log2(3), IDCG = 1/log2(2) = 1
  const v = ndcgAtK(["x", "a"], ["a"], 2);
  assert.ok(Math.abs(v - 1 / Math.log2(3)) < 1e-9);
});

test("ndcg empty relevant returns 0", () => {
  assert.strictEqual(ndcgAtK(["a"], [], 1), 0);
});

test("evaluate_batch averages correctly", () => {
  const r = evaluateBatch(
    [
      { retrieved: ["a", "b"], relevant: ["a"] }, // perfect
      { retrieved: ["x", "y"], relevant: ["y"] }, // 2nd position
      { retrieved: ["m", "n"], relevant: ["unrelated"] }, // miss
    ],
    2,
  );
  assert.strictEqual(r.n_queries, 3);
  assert.ok(Math.abs(r.mean_hit_at_k - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r.mean_mrr - 0.5) < 1e-9);
});

test("evaluate_batch empty input returns zeros", () => {
  const r = evaluateBatch([], 5);
  assert.strictEqual(r.n_queries, 0);
  assert.strictEqual(r.mean_hit_at_k, 0);
});
