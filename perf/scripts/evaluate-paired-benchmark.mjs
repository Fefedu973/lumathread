import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const inputPath = resolve(readArg("--input", "perf-results/benchmark.json"));
const outputPath = resolve(
  readArg("--output", "perf-results/paired-evaluation.json"),
);
const markdownPath = resolve(
  readArg("--markdown", "perf-results/paired-evaluation.md"),
);
const minimumImprovement = Number(readArg("--minimum-improvement", "0.02"));
const maximumRegression = Number(readArg("--maximum-regression", "0.02"));
const minimumScenarioCount = Number(readArg("--minimum-scenarios", "4"));

const report = JSON.parse(await readFile(inputPath, "utf8"));
const records = [];
const seen = new Set();

const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const firstNumber = (object, keys) => {
  if (!object || typeof object !== "object") return null;
  for (const key of keys) {
    const value = finiteNumber(object[key]);
    if (value !== null) return value;
  }
  return null;
};

const labelFor = (object, path) => {
  if (!object || typeof object !== "object") return path;
  for (const key of ["scenario", "name", "id", "label", "title"]) {
    if (typeof object[key] === "string" && object[key].trim()) {
      return object[key].trim();
    }
  }
  return path;
};

const addRecord = (path, object, ratio, source) => {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return;
  const label = labelFor(object, path);
  const key = `${label}\u0000${ratio.toFixed(10)}`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({ path, label, ratio, source });
};

const walk = (value, path = "root") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walk(entry, `${path}[${index}]`);
    });
    return;
  }
  if (!value || typeof value !== "object") return;

  const pairedRatio = firstNumber(value, [
    "pairedWallRatio",
    "pairedRatio",
    "wallRatio",
    "candidateToBaselineRatio",
  ]);
  if (pairedRatio !== null) {
    addRecord(path, value, pairedRatio, "reported-ratio");
  } else {
    const baselineDirect = firstNumber(value, [
      "baselineMs",
      "baselineWallMs",
      "baselineMedianMs",
      "baselineMeanMs",
    ]);
    const candidateDirect = firstNumber(value, [
      "candidateMs",
      "candidateWallMs",
      "candidateMedianMs",
      "candidateMeanMs",
    ]);
    if (
      baselineDirect !== null &&
      candidateDirect !== null &&
      baselineDirect > 0
    ) {
      addRecord(path, value, candidateDirect / baselineDirect, "direct-times");
    } else if (value.baseline && value.candidate) {
      const timeKeys = [
        "medianWallMs",
        "wallMs",
        "medianMs",
        "meanWallMs",
        "meanMs",
        "durationMs",
      ];
      const baselineNested = firstNumber(value.baseline, timeKeys);
      const candidateNested = firstNumber(value.candidate, timeKeys);
      if (
        baselineNested !== null &&
        candidateNested !== null &&
        baselineNested > 0
      ) {
        addRecord(
          path,
          value,
          candidateNested / baselineNested,
          "nested-times",
        );
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    walk(child, `${path}.${key}`);
  }
};

walk(report);

const scenarioLike = records.filter((record) =>
  /(hero|cta|desktop|mobile|dark|light|dpr)/i.test(
    `${record.label} ${record.path}`,
  ),
);
const selected =
  scenarioLike.length >= minimumScenarioCount ? scenarioLike : records;

if (selected.length < minimumScenarioCount) {
  throw new Error(
    `Fail-closed: recognized only ${selected.length} paired scenario ratios; ` +
      `${minimumScenarioCount} are required.`,
  );
}

const geometricRatio = Math.exp(
  selected.reduce((sum, record) => sum + Math.log(record.ratio), 0) /
    selected.length,
);
const worstRatio = Math.max(...selected.map((record) => record.ratio));
const bestRatio = Math.min(...selected.map((record) => record.ratio));
const improvement = 1 - geometricRatio;
const worstRegression = Math.max(0, worstRatio - 1);
const accepted =
  improvement >= minimumImprovement && worstRegression <= maximumRegression;

const evaluation = {
  accepted,
  inputPath,
  minimumImprovement,
  maximumRegression,
  minimumScenarioCount,
  scenarioCount: selected.length,
  geometricRatio,
  geometricImprovement: improvement,
  worstRatio,
  worstRegression,
  bestRatio,
  scenarios: selected.sort((left, right) =>
    left.label.localeCompare(right.label),
  ),
};

await writeFile(outputPath, `${JSON.stringify(evaluation, null, 2)}\n`);

const rows = evaluation.scenarios
  .map(
    (scenario) =>
      `| ${scenario.label.replaceAll("|", "\\|")} | ${scenario.ratio.toFixed(4)} | ${((1 - scenario.ratio) * 100).toFixed(2)}% | ${scenario.source} |`,
  )
  .join("\n");
const markdown = `# Paired benchmark evaluation

- Verdict: **${accepted ? "ACCEPT" : "REJECT"}**
- Scenarios: ${evaluation.scenarioCount}
- Geometric candidate/baseline ratio: ${geometricRatio.toFixed(4)}
- Geometric improvement: ${(improvement * 100).toFixed(2)}%
- Worst candidate/baseline ratio: ${worstRatio.toFixed(4)}
- Worst regression: ${(worstRegression * 100).toFixed(2)}%
- Required improvement: ${(minimumImprovement * 100).toFixed(2)}%
- Allowed worst regression: ${(maximumRegression * 100).toFixed(2)}%

| Scenario | Candidate / baseline | Improvement | Extraction |
|---|---:|---:|---|
${rows}
`;
await writeFile(markdownPath, markdown);

console.log(markdown);
if (!accepted) process.exitCode = 1;
