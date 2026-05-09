#!/usr/bin/env node
// ragdrift-mcp — knowledge tools for RAG drift diagnostics.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- knowledge base for the 5 dimensions ---

export const DIMENSIONS = {
  data: {
    name: "data",
    catches: "Per-feature distribution shift on tabular features (latency, retrieval count, prompt token count, etc.).",
    methods: ["Kolmogorov-Smirnov (KS)", "Population Stability Index (PSI)"],
    typical_score_range: "0.0 (no shift) to ~1.0 (severe). PSI is unbounded but typically <1 in practice.",
    suggested_thresholds: { conservative: 0.05, moderate: 0.10, lax: 0.25 },
    notes:
      "PSI 0.10–0.25 is the credit-risk industry's 'investigate' band. KS dominates when the shape changes; PSI when bin masses redistribute.",
  },
  embedding: {
    name: "embedding",
    catches: "Distribution shift in the embedding space itself — corpus drift, model swap, or upstream re-embedding.",
    methods: ["MMD² with RBF kernel (Gretton et al. 2012)", "Sliced Wasserstein-1 (Bonneel et al. 2015)"],
    typical_score_range: "0.0 to ~10+ (combined MMD²+SW). Values above 0.05 with default thresholds usually mean real drift.",
    suggested_thresholds: { conservative: 0.05, moderate: 0.5, lax: 2.0 },
    notes:
      "MMD is sample-efficient and sensitive to subtle shape changes. Sliced Wasserstein is bandwidth-free and geometric. Together they catch more failure modes than either alone.",
  },
  response: {
    name: "response",
    catches: "Length distribution and (optional) semantic shift in model responses.",
    methods: ["KS on response lengths", "Sliced Wasserstein on response embeddings (optional)"],
    typical_score_range: "0.0 to ~1.0 (KS only); add semantic SW for combined.",
    suggested_thresholds: { conservative: 0.10, moderate: 0.20, lax: 0.40 },
    notes: "If your model started replying with much longer or shorter answers, this fires.",
  },
  confidence: {
    name: "confidence",
    catches: "Distribution of model confidence scores plus calibration shift (when ground-truth correctness is available).",
    methods: ["KS on confidence distributions", "|ECE_current − ECE_baseline| (Naeini et al. 2015)"],
    typical_score_range: "0.0 to ~1.5 in extreme cases.",
    suggested_thresholds: { conservative: 0.10, moderate: 0.20, lax: 0.40 },
    notes:
      "Detects 'the model got more confident but no better calibrated' — a silent failure mode that doesn't surface as latency or 5xx.",
  },
  query: {
    name: "query",
    catches: "Workload composition shift — the *mix* of intents your users are sending.",
    methods: ["k-means clustering of baseline queries", "symmetric KL divergence on cluster assignment frequencies"],
    typical_score_range: "0.0 to a few (KL is unbounded but rarely exceeds 5 in practice).",
    suggested_thresholds: { conservative: 0.05, moderate: 0.10, lax: 0.30 },
    notes: "If last week was 70% billing questions and this week is 70% returns, this is what fires.",
  },
};

const VALID_DIMS = Object.keys(DIMENSIONS);

function categorize(score, dim) {
  const t = DIMENSIONS[dim].suggested_thresholds;
  if (score < t.conservative) return "no significant shift";
  if (score < t.moderate) return "moderate shift, watch closely";
  if (score < t.lax) return "significant shift, investigate";
  return "severe shift, action required";
}

export function interpretDriftScore(score, dimension, threshold = null) {
  if (!VALID_DIMS.includes(dimension)) {
    throw new Error(
      `unknown dimension '${dimension}'. Use one of: ${VALID_DIMS.join(", ")}.`,
    );
  }
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error("score must be a finite number");
  }
  const d = DIMENSIONS[dimension];
  const severity = categorize(score, dimension);
  const exceeded = threshold != null ? score >= threshold : null;
  return {
    dimension,
    score,
    threshold,
    exceeded,
    severity,
    method_used: d.methods.join(" + "),
    interpretation: `${d.catches} Score ${score.toFixed(4)} → ${severity}.`,
    next_steps: nextStepsFor(dimension, severity),
  };
}

function nextStepsFor(dimension, severity) {
  if (severity === "no significant shift") {
    return "Nothing to do. Continue monitoring.";
  }
  const map = {
    data: "Review the most-shifted feature columns. Check for upstream pipeline changes (ETL, feature engineering).",
    embedding: "Did the embedding model change? Was the corpus re-indexed? Compare baseline + current document samples.",
    response: "Did the system prompt change? Did the model version update? Spot-check 10 responses from each window.",
    confidence: "Calibration likely broke. If you have ground-truth, recompute ECE and look at the most overconfident bin.",
    query: "User intent mix shifted. Look at the top emerging cluster — is it a new use-case or a regression?",
  };
  return map[dimension];
}

export function recommendThresholds(
  dimension,
  sampleSize = 1000,
  falsePositiveBudget = 0.05,
) {
  if (!VALID_DIMS.includes(dimension)) {
    throw new Error(
      `unknown dimension '${dimension}'. Use one of: ${VALID_DIMS.join(", ")}.`,
    );
  }
  const d = DIMENSIONS[dimension];
  // Smaller samples need higher thresholds — the variance under H0 grows.
  // Crude scaling: multiply moderate by sqrt(1000 / sample_size), clamped.
  const scale = Math.max(0.5, Math.min(3, Math.sqrt(1000 / Math.max(50, sampleSize))));
  const moderate = +(d.suggested_thresholds.moderate * scale).toFixed(4);
  // FP budget tightens; budget=0.05 -> use moderate; budget=0.01 -> 1.4x stricter.
  const fpAdjust = Math.max(0.7, Math.min(1.5, 0.05 / Math.max(0.005, falsePositiveBudget)));
  return {
    dimension,
    sample_size: sampleSize,
    false_positive_budget: falsePositiveBudget,
    recommended: {
      conservative: +(moderate * 0.5 * fpAdjust).toFixed(4),
      moderate: +(moderate * fpAdjust).toFixed(4),
      lax: +(moderate * 2.0 * fpAdjust).toFixed(4),
    },
    rationale:
      `Default thresholds tuned for n=1000. With n=${sampleSize}, scaled by sqrt(1000/n). False-positive budget ${falsePositiveBudget} adjusts strictness multiplicatively.`,
  };
}

export function explainDriftDimensions() {
  return { dimensions: Object.values(DIMENSIONS) };
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "interpret_drift_score",
    description:
      "Given a drift score and a dimension (data | embedding | response | confidence | query), return a plain-English interpretation, severity classification, and suggested next steps. Optionally compare against a threshold.",
    inputSchema: {
      type: "object",
      properties: {
        score: { type: "number", description: "The drift score from a detector." },
        dimension: { type: "string", enum: VALID_DIMS },
        threshold: { type: "number", description: "Optional. If provided, returns whether the score exceeds it." },
      },
      required: ["score", "dimension"],
    },
  },
  {
    name: "recommend_thresholds",
    description:
      "Suggest threshold values for a drift dimension based on sample size and false-positive budget. Returns conservative/moderate/lax thresholds and a rationale.",
    inputSchema: {
      type: "object",
      properties: {
        dimension: { type: "string", enum: VALID_DIMS },
        sample_size: { type: "integer", minimum: 50, default: 1000 },
        false_positive_budget: { type: "number", minimum: 0.005, maximum: 0.5, default: 0.05 },
      },
      required: ["dimension"],
    },
  },
  {
    name: "explain_drift_dimensions",
    description:
      "Return a structured reference explaining all five drift dimensions (data, embedding, response, confidence, query): what each catches, the underlying methods, suggested thresholds, and notes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const server = new Server(
  { name: "ragdrift-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "interpret_drift_score":
        result = interpretDriftScore(args.score, args.dimension, args.threshold ?? null);
        break;
      case "recommend_thresholds":
        result = recommendThresholds(
          args.dimension,
          args.sample_size ?? 1000,
          args.false_positive_budget ?? 0.05,
        );
        break;
      case "explain_drift_dimensions":
        result = explainDriftDimensions();
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `error: ${e.message}` }],
      isError: true,
    };
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
