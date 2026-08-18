import { execFileSync, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function parseArguments(argv) {
  const result = {
    baseline: "http://127.0.0.1:4173",
    candidate: "http://127.0.0.1:4174",
    out: "perf-results",
    repeats: 3,
    frames: 3,
    warmupFrames: 1,
    profileFrames: 2,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    index += 1;
    if (key === "--baseline") result.baseline = value;
    else if (key === "--candidate") result.candidate = value;
    else if (key === "--out") result.out = value;
    else if (key === "--repeats") result.repeats = Number(value);
    else if (key === "--frames") result.frames = Number(value);
    else if (key === "--warmup-frames") result.warmupFrames = Number(value);
    else if (key === "--profile-frames") result.profileFrames = Number(value);
  }
  return result;
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(
    sorted.length - 1,
    Math.max(0, (sorted.length - 1) * fraction),
  );
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  return percentile(values, 0.5);
}

function finiteValues(values) {
  return values.filter((value) => Number.isFinite(value));
}

function locateChrome() {
  const explicit = process.env.CHROME_PATH;
  if (explicit) return explicit;
  for (const command of [
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ]) {
    try {
      return execFileSync("which", [command], { encoding: "utf8" }).trim();
    } catch {
      // Keep searching.
    }
  }
  throw new Error("Unable to locate Chrome or Chromium.");
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const raw =
        typeof event.data === "string"
          ? event.data
          : Buffer.from(event.data).toString("utf8");
      const message = JSON.parse(raw);
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error)
          pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result ?? {});
        return;
      }
      const callbacks = this.listeners.get(message.method);
      if (!callbacks) return;
      for (const callback of [...callbacks]) callback(message.params ?? {});
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("CDP socket closed."));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timed out connecting to CDP.")),
        10_000,
      );
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(`CDP WebSocket error: ${String(event)}`));
      });
    });
    return new CdpClient(socket);
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(method, callback);
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      const callback = (params) => {
        clearTimeout(timeout);
        this.off(method, callback);
        resolve(params);
      };
      this.on(method, callback);
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(method, callbacks);
  }

  off(method, callback) {
    const callbacks = this.listeners.get(method);
    callbacks?.delete(callback);
  }

  close() {
    this.socket.close();
  }
}

async function waitForChrome(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome did not start: ${String(lastError)}`);
}

async function startChrome() {
  const executable = locateChrome();
  const port = 9222 + Math.floor(Math.random() * 500);
  const userDataDirectory = path.join(
    tmpdir(),
    `lumathread-chrome-${process.pid}-${Date.now()}`,
  );
  const args = [
    ...(process.env.LUMATHREAD_CHROME_HEADFUL === "1"
      ? []
      : ["--headless=new"]),
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDirectory}`,
    "about:blank",
  ];
  const processHandle = spawn(executable, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logLines = [];
  const collect = (chunk) => {
    const text = chunk.toString("utf8");
    logLines.push(text);
    if (logLines.length > 200) logLines.shift();
  };
  processHandle.stdout.on("data", collect);
  processHandle.stderr.on("data", collect);
  await waitForChrome(port);
  return {
    port,
    processHandle,
    userDataDirectory,
    logLines,
    async close() {
      processHandle.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => processHandle.once("exit", resolve)),
        sleep(3000),
      ]);
      if (!processHandle.killed) processHandle.kill("SIGKILL");
      await rm(userDataDirectory, { recursive: true, force: true });
    },
  };
}

async function openPage(chrome, url, viewport) {
  const response = await fetch(
    `http://127.0.0.1:${chrome.port}/json/new?about:blank`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Unable to create Chrome target: ${response.status}`);
  }
  const target = await response.json();
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await Promise.all([
    client.call("Page.enable"),
    client.call("Runtime.enable"),
    client.call("Performance.enable"),
    client.call("Network.enable"),
  ]);
  await client.call("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  const loaded = client.once("Page.loadEventFired", 30_000);
  await client.call("Page.navigate", { url });
  await loaded;
  return {
    target,
    client,
    async close() {
      client.close();
      await fetch(
        `http://127.0.0.1:${chrome.port}/json/close/${target.id}`,
      ).catch(() => undefined);
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime.evaluate failed.",
    );
  }
  return result.result?.value;
}

async function waitForHarness(client) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const state = await evaluate(
      client,
      `(() => {
        const harness = window.__LUMATHREAD_HARNESS__;
        return harness ? {
          ready: harness.ready,
          status: harness.rendererStatus,
          errors: harness.rendererErrors,
        } : null;
      })()`,
    );
    if (state?.errors?.length) {
      throw new Error(`Renderer errors: ${state.errors.join(" | ")}`);
    }
    if (
      state?.ready &&
      state.status?.renderer === "hdr" &&
      state.status?.supported &&
      !state.status?.approximate
    ) {
      return state;
    }
    await sleep(100);
  }
  throw new Error("Harness did not become ready with the HDR renderer.");
}

async function dispatchPointer(client, scenario, phase) {
  await evaluate(
    client,
    `(() => {
      const canvas = document.querySelector("canvas");
      const target = document.getElementById("harness-stage") || document.body;
      const rect = target.getBoundingClientRect();
      const radiusX = rect.width * ${scenario === "cta" ? "0.34" : "0.28"};
      const radiusY = rect.height * ${scenario === "cta" ? "0.18" : "0.24"};
      const x = rect.left + rect.width * 0.5 + Math.sin(${phase} * 1.71) * radiusX;
      const y = rect.top + rect.height * 0.48 + Math.cos(${phase} * 1.23) * radiusY;
      const init = {
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        bubbles: true,
        composed: true,
      };
      canvas?.dispatchEvent(new PointerEvent("pointermove", init));
      target.dispatchEvent(new PointerEvent("pointermove", init));
      window.dispatchEvent(new PointerEvent("pointermove", init));
    })()`,
  );
}

async function stepFrame(client, seconds = 1 / 60) {
  return evaluate(
    client,
    `(() => {
      const canvas = document.querySelector("canvas");
      const debug = canvas?.__waveDebug;
      const context = window.__LUMATHREAD_GL_CONTEXTS__?.[0];
      if (!debug || !context) {
        throw new Error("Synchronous renderer debug hooks are unavailable.");
      }
      const startedAt = performance.now();
      debug.step(${seconds});
      const submittedAt = performance.now();
      context.finish();
      const finishedAt = performance.now();
      return {
        submitMs: submittedAt - startedAt,
        drainMs: finishedAt - submittedAt,
        wallMs: finishedAt - startedAt,
      };
    })()`,
  );
}

function metricsToObject(metrics) {
  return Object.fromEntries(
    metrics.metrics.map(({ name, value }) => [name, value]),
  );
}

function metricDelta(before, after, name) {
  const first = before[name];
  const second = after[name];
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return second - first;
}

function summarizeRun(payload, metricsBefore, metricsAfter, stepSamples) {
  const wall = finiteValues(stepSamples.map((sample) => sample.wallMs));
  const submit = finiteValues(stepSamples.map((sample) => sample.submitMs));
  const drain = finiteValues(stepSamples.map((sample) => sample.drainMs));
  const renderedFrames = wall.length;
  const wallMean = mean(wall);
  const browserMilliseconds = (name) => {
    const delta = metricDelta(metricsBefore, metricsAfter, name);
    return delta === null ? null : delta * 1000;
  };
  const glPerFrame = {};
  for (const [name, value] of Object.entries(payload.gl?.counters ?? {})) {
    glPerFrame[name] = renderedFrames > 0 ? value / renderedFrames : null;
  }
  return {
    renderedFrames,
    fps: wallMean && wallMean > 0 ? 1000 / wallMean : null,
    wallMs: {
      mean: wallMean,
      p50: percentile(wall, 0.5),
      p95: percentile(wall, 0.95),
      p99: percentile(wall, 0.99),
    },
    submitMs: {
      mean: mean(submit),
      p50: percentile(submit, 0.5),
      p95: percentile(submit, 0.95),
      p99: percentile(submit, 0.99),
    },
    drainMs: {
      mean: mean(drain),
      p50: percentile(drain, 0.5),
      p95: percentile(drain, 0.95),
      p99: percentile(drain, 0.99),
    },
    browser: {
      taskDurationMs: browserMilliseconds("TaskDuration"),
      scriptDurationMs: browserMilliseconds("ScriptDuration"),
      layoutDurationMs: browserMilliseconds("LayoutDuration"),
      recalcStyleDurationMs: browserMilliseconds("RecalcStyleDuration"),
      jsHeapUsedBytes: metricsAfter.JSHeapUsedSize ?? null,
    },
    gl: payload.gl,
    glPerFrame,
    renderer: payload.runtime.rendererStatus,
    rendererErrors: payload.runtime.rendererErrors,
    webgl: payload.webgl,
    samples: stepSamples,
  };
}

export {
  parseArguments,
  sleep,
  percentile,
  mean,
  median,
  finiteValues,
  startChrome,
  openPage,
  evaluate,
  waitForHarness,
  dispatchPointer,
  stepFrame,
  metricsToObject,
  summarizeRun,
};
