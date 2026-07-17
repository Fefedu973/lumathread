import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HeroWaveBackground,
  type HeroWaveBackgroundProps,
  type HeroWavePerformanceSample,
  type HeroWaveQualityPreset,
  type HeroWaveRendererStatus,
} from "../hero-wave-background";
import { HeroWaveBackground as ReferenceHeroWaveBackground } from "../benchmark/reference/hero-wave-background";
import {
  FixedRing,
  percentileSorted,
  performanceTrendPercentPerMinute,
} from "./benchmark-metrics";
import { demoHref } from "./routing";
import "./benchmark.css";

type BenchmarkMode = "refactor" | "reference" | "split";

interface FrameSample {
  elapsed: number;
  fps: number;
  frameMs: number;
  cpuMs: number | null;
  gpuMs: number | null;
}

interface FrameSummary {
  fps: number;
  medianMs: number;
  p95Ms: number;
  dropped: number;
  frames: number;
  cpuMs: number | null;
  gpuMs: number | null;
  gpuDisjoint: boolean;
  trendPctPerMinute: number;
  elapsedSeconds: number;
}

const EMPTY_SUMMARY: FrameSummary = {
  fps: 0,
  medianMs: 0,
  p95Ms: 0,
  dropped: 0,
  frames: 0,
  cpuMs: null,
  gpuMs: null,
  gpuDisjoint: false,
  trendPctPerMinute: 0,
  elapsedSeconds: 0,
};

const FRAME_WINDOW_SIZE = 900;
const PERFORMANCE_WINDOW_SIZE = 120;
const TREND_WINDOW_SIZE = 1_800;
const CHART_SAMPLE_COUNT = 180;

function useFrameMeter() {
  const startedAt = useRef<number | null>(null);
  const frameTimes = useRef(new FixedRing<number>(FRAME_WINDOW_SIZE));
  const performanceSamples = useRef(
    new FixedRing<HeroWavePerformanceSample>(PERFORMANCE_WINDOW_SIZE),
  );
  const history = useRef(new FixedRing<FrameSample>(TREND_WINDOW_SIZE));
  const bucket = useRef({ totalMs: 0, count: 0 });
  const totalFrames = useRef(0);
  const [samples, setSamples] = useState<FrameSample[]>([]);
  const [summary, setSummary] = useState<FrameSummary>(EMPTY_SUMMARY);

  const onFrame = useCallback((_time: number, delta: number) => {
    if (!(delta > 0) || !Number.isFinite(delta)) return;
    const now = performance.now();
    startedAt.current ??= now;
    const frameMs = delta * 1000;
    frameTimes.current.push(frameMs);
    bucket.current.totalMs += frameMs;
    bucket.current.count += 1;
    totalFrames.current += 1;
  }, []);

  const onPerformance = useCallback((sample: HeroWavePerformanceSample) => {
    performanceSamples.current.push(sample);
  }, []);

  const publish = useCallback(() => {
    const started = startedAt.current;
    const currentBucket = bucket.current;
    if (started === null || currentBucket.count === 0) return;
    const now = performance.now();
    const averageMs = currentBucket.totalMs / currentBucket.count;
    currentBucket.totalMs = 0;
    currentBucket.count = 0;

    const performanceWindow = performanceSamples.current.toArray();
    let cpuTotal = 0;
    let gpuTotal = 0;
    let gpuCount = 0;
    let gpuDisjoint = false;
    for (const performanceSample of performanceWindow) {
      cpuTotal += performanceSample.cpuMs;
      if (performanceSample.gpuMs !== undefined) {
        gpuTotal += performanceSample.gpuMs;
        gpuCount += 1;
      }
      gpuDisjoint ||= performanceSample.gpuDisjoint === true;
    }
    const cpuMs =
      performanceWindow.length > 0 ? cpuTotal / performanceWindow.length : null;
    const gpuMs = gpuCount > 0 ? gpuTotal / gpuCount : null;
    const sample: FrameSample = {
      elapsed: (now - started) / 1000,
      fps: 1000 / Math.max(averageMs, 0.001),
      frameMs: averageMs,
      cpuMs,
      gpuMs,
    };
    history.current.push(sample);
    const historyValues = history.current.toArray();
    const frameValues = frameTimes.current.toArray();
    const sortedFrameValues = [...frameValues].sort(
      (left, right) => left - right,
    );
    let dropped = 0;
    for (const value of frameValues) {
      if (value > 25) dropped += 1;
    }
    setSamples(historyValues.slice(-CHART_SAMPLE_COUNT));
    setSummary({
      fps: sample.fps,
      medianMs: percentileSorted(sortedFrameValues, 0.5),
      p95Ms: percentileSorted(sortedFrameValues, 0.95),
      dropped,
      frames: totalFrames.current,
      cpuMs,
      gpuMs,
      gpuDisjoint,
      trendPctPerMinute: performanceTrendPercentPerMinute(historyValues),
      elapsedSeconds: sample.elapsed,
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(publish, 1_000);
    return () => window.clearInterval(interval);
  }, [publish]);

  const reset = useCallback(() => {
    startedAt.current = null;
    frameTimes.current.clear();
    performanceSamples.current.clear();
    history.current.clear();
    bucket.current.totalMs = 0;
    bucket.current.count = 0;
    totalFrames.current = 0;
    setSamples([]);
    setSummary(EMPTY_SUMMARY);
  }, []);

  return { onFrame, onPerformance, reset, samples, summary };
}

function formatOptionalMs(value: number | null, disjoint = false) {
  if (disjoint) return "disjoint";
  return value === null ? "n/a" : `${value.toFixed(2)} ms`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="benchmark-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RendererPanel({
  label,
  status,
  children,
}: {
  label: string;
  status: HeroWaveRendererStatus | null;
  children: React.ReactNode;
}) {
  return (
    <section className="benchmark-renderer">
      <div className="benchmark-renderer-heading">
        <div>
          <span className="benchmark-renderer-label">{label}</span>
          <strong>{status?.renderer ?? "initializing"}</strong>
        </div>
        <span
          className={
            status?.supported ? "benchmark-dot active" : "benchmark-dot"
          }
          aria-label={
            status?.supported ? "Supported" : "Initializing or unsupported"
          }
        />
      </div>
      <div className="benchmark-canvas">{children}</div>
    </section>
  );
}

export default function BenchmarkPage() {
  const [mode, setMode] = useState<BenchmarkMode>("refactor");
  const [quality, setQuality] = useState<HeroWaveQualityPreset>("high");
  const [paused, setPaused] = useState(false);
  const [referenceStatus, setReferenceStatus] =
    useState<HeroWaveRendererStatus | null>(null);
  const [refactorStatus, setRefactorStatus] =
    useState<HeroWaveRendererStatus | null>(null);
  const referenceMeter = useFrameMeter();
  const refactorMeter = useFrameMeter();

  const sharedProps = useMemo<HeroWaveBackgroundProps>(
    () => ({
      paused,
      quality,
      fadeInDuration: 0,
      path: {
        mode: "organic",
        closed: true,
        organic: {
          pointCount: 24,
          turns: 1.8,
          amplitude: 1.08,
          roughness: 0.34,
          horizontalJitter: 0.14,
          speedVariation: 0.8,
          symmetry: 0.16,
          seed: 731,
        },
      },
      motion: {
        mode: "propagate",
        speed: 0.8,
        segmentLength: 0.86,
        tailTaper: 0.18,
        headTaper: 0.12,
      },
      propagation: {
        enabled: true,
        phaseSpeed: 0.9,
      },
      material: {
        preset: "soft-aurora",
        intensity: 0.9,
        glow: 1.24,
        upperGlowSpread: 1.12,
        lowerGlowSpread: 0.92,
      },
      palette: {
        stops: [
          { id: "blue", color: "#2438ff", offset: 0 },
          { id: "cyan", color: "#1adff5", offset: 0.48 },
          { id: "green", color: "#22f25f", offset: 1 },
        ],
        interpolation: "oklab",
        wrap: "repeat",
        speed: 0.7,
        hueDrift: 5,
      },
      dots: {
        enabled: true,
        spacing: 22,
        opacity: 0.42,
        twinkle: 0.42,
        reflect: 0.82,
        masks: [
          { id: "left", x: 0.24, y: 0.46, radius: 0.42, feather: 0.54 },
          { id: "right", x: 0.76, y: 0.58, radius: 0.48, feather: 0.62 },
        ],
      },
    }),
    [paused, quality],
  );

  const chartData = useMemo(() => {
    const length = Math.max(
      referenceMeter.samples.length,
      refactorMeter.samples.length,
    );
    return Array.from({ length }, (_, index) => ({
      index,
      reference: referenceMeter.samples[index]?.fps,
      refactor: refactorMeter.samples[index]?.fps,
    }));
  }, [referenceMeter.samples, refactorMeter.samples]);

  const reset = () => {
    referenceMeter.reset();
    refactorMeter.reset();
  };
  const showReference = mode === "reference" || mode === "split";
  const showRefactor = mode === "refactor" || mode === "split";

  return (
    <main className="benchmark-page">
      <header className="benchmark-header">
        <div>
          <a
            className="benchmark-brand"
            href={demoHref("/", import.meta.env.BASE_URL)}
          >
            <span aria-hidden="true" /> LumaThread
          </a>
          <p className="benchmark-eyebrow">RENDERER BENCHMARK</p>
          <h1>Measure before changing pixels.</h1>
          <p>
            The frozen extraction and the refactored renderer receive the same
            deterministic scene. Run them separately for useful numbers, or
            split the viewport for direct visual comparison.
          </p>
        </div>
        <nav className="benchmark-nav" aria-label="Development pages">
          <a href={demoHref("/dev/hero-background", import.meta.env.BASE_URL)}>
            Lab
          </a>
          <a
            aria-current="page"
            href={demoHref("/dev/benchmark", import.meta.env.BASE_URL)}
          >
            Benchmark
          </a>
        </nav>
      </header>

      <section className="benchmark-controls" aria-label="Benchmark controls">
        <div className="benchmark-segmented">
          {(["reference", "refactor", "split"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={mode === value ? "selected" : undefined}
              onClick={() => {
                setMode(value);
                reset();
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <label>
          Quality
          <select
            value={quality}
            onChange={(event) => {
              setQuality(event.target.value as HeroWaveQualityPreset);
              reset();
            }}
          >
            {(["auto", "ultra", "high", "balanced", "low"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <button type="button" onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={reset}>
          Reset samples
        </button>
      </section>

      <div
        className={
          mode === "split" ? "benchmark-stages split" : "benchmark-stages"
        }
      >
        {showReference ? (
          <RendererPanel label="Frozen reference" status={referenceStatus}>
            <ReferenceHeroWaveBackground
              {...sharedProps}
              onFrame={referenceMeter.onFrame}
              onRendererStatus={setReferenceStatus}
            />
          </RendererPanel>
        ) : null}
        {showRefactor ? (
          <RendererPanel label="Refactored" status={refactorStatus}>
            <HeroWaveBackground
              {...sharedProps}
              onFrame={refactorMeter.onFrame}
              onPerformance={refactorMeter.onPerformance}
              onRendererStatus={setRefactorStatus}
            />
          </RendererPanel>
        ) : null}
      </div>

      <section className="benchmark-results">
        <div className="benchmark-summary">
          <div>
            <span>Frozen reference</span>
            <div className="benchmark-metrics">
              <Metric
                label="FPS"
                value={referenceMeter.summary.fps.toFixed(1)}
              />
              <Metric
                label="Median"
                value={`${referenceMeter.summary.medianMs.toFixed(1)} ms`}
              />
              <Metric
                label="P95"
                value={`${referenceMeter.summary.p95Ms.toFixed(1)} ms`}
              />
              <Metric
                label=">25 ms"
                value={String(referenceMeter.summary.dropped)}
              />
              <Metric
                label="Drift/min"
                value={`${referenceMeter.summary.trendPctPerMinute.toFixed(2)}%`}
              />
              <Metric
                label="Elapsed"
                value={formatDuration(referenceMeter.summary.elapsedSeconds)}
              />
            </div>
          </div>
          <div>
            <span>Refactored</span>
            <div className="benchmark-metrics">
              <Metric
                label="FPS"
                value={refactorMeter.summary.fps.toFixed(1)}
              />
              <Metric
                label="Median"
                value={`${refactorMeter.summary.medianMs.toFixed(1)} ms`}
              />
              <Metric
                label="P95"
                value={`${refactorMeter.summary.p95Ms.toFixed(1)} ms`}
              />
              <Metric
                label=">25 ms"
                value={String(refactorMeter.summary.dropped)}
              />
              <Metric
                label="CPU submit"
                value={formatOptionalMs(refactorMeter.summary.cpuMs)}
              />
              <Metric
                label="GPU"
                value={formatOptionalMs(
                  refactorMeter.summary.gpuMs,
                  refactorMeter.summary.gpuDisjoint,
                )}
              />
              <Metric
                label="Drift/min"
                value={`${refactorMeter.summary.trendPctPerMinute.toFixed(2)}%`}
              />
              <Metric
                label="Elapsed"
                value={formatDuration(refactorMeter.summary.elapsedSeconds)}
              />
            </div>
          </div>
        </div>

        <div className="benchmark-chart" aria-label="FPS history graph">
          <div className="benchmark-chart-heading">
            <div>
              <span>Rolling performance</span>
              <strong>FPS over the last 3 minutes</strong>
            </div>
            <small>1 s buckets · bounded soak-test buffers</small>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 16, bottom: 4, left: -18 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
              <XAxis dataKey="index" hide />
              <YAxis
                domain={[0, "auto"]}
                tick={{ fill: "#77818a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0b1013",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  color: "#f6f8f9",
                }}
              />
              <Line
                type="monotone"
                dataKey="reference"
                stroke="#7c8b96"
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="refactor"
                stroke="#39e58c"
                dot={false}
                isAnimationActive={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
