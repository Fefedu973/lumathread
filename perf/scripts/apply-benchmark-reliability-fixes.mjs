import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Expected block not found in ${path}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

const profilerPath = "perf/harness/gl-profiler.js";
await replaceOnce(
  profilerPath,
  `    context.__lumathreadGpuProfiler = {
      beginFrame() {
        state.frame += 1;
        state.ordinals.clear();
      },
      collect,
      reset,
      snapshot() {
        collect();
        return {`,
  `    const drain = async (timeoutMs = 2_000) => {
      if (!extension || state.pending.length === 0) return true;
      const startedAt = performance.now();
      context.flush();
      while (state.pending.length > 0) {
        collect();
        if (state.pending.length === 0) return true;
        if (performance.now() - startedAt >= timeoutMs) return false;
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      return true;
    };
    context.__lumathreadGpuProfiler = {
      beginFrame() {
        state.frame += 1;
        state.ordinals.clear();
      },
      collect,
      drain,
      reset,
      snapshot() {
        collect();
        return {`,
);
await replaceOnce(
  profilerPath,
  `    collect() {
      for (const context of contexts) {
        context.__lumathreadGpuProfiler?.collect();
      }
    },
    reset() {`,
  `    collect() {
      for (const context of contexts) {
        context.__lumathreadGpuProfiler?.collect();
      }
    },
    async drain(timeoutMs = 2_000) {
      const results = await Promise.all(
        contexts.map((context) =>
          context.__lumathreadGpuProfiler?.drain?.(timeoutMs) ?? true,
        ),
      );
      return results.every(Boolean);
    },
    reset() {`,
);

const corePath = "perf/scripts/benchmark-core.mjs";
const coreSource = await readFile(corePath, "utf8");
const chromeStart = coreSource.indexOf("async function startChrome() {");
const chromeEnd = coreSource.indexOf(
  "\nasync function createTarget",
  chromeStart,
);
if (chromeStart < 0 || chromeEnd < 0) {
  throw new Error("Unable to locate startChrome in benchmark-core.mjs");
}
const reliableStartChrome = `async function startChrome() {
  const chromePath = locateChrome();
  const attempts = 3;
  const failures = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const profile = path.join(
      tmpdir(),
      \`lumathread-perf-\${process.pid}-\${Date.now()}-\${attempt}\`,
    );
    const port = 9222 + Math.floor(Math.random() * 10_000);
    const args = [
      "--headless=new",
      "--disable-gpu-sandbox",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-domain-reliability",
      "--disable-features=Translate,BackForwardCache,InterestFeedContentSuggestions",
      "--disable-hang-monitor",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
      "--password-store=basic",
      "--use-mock-keychain",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--enable-unsafe-swiftshader",
      \`--remote-debugging-port=\${port}\`,
      \`--user-data-dir=\${profile}\`,
      "about:blank",
    ];
    const child = spawn(chromePath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const logLines = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => logLines.push(chunk));
    try {
      const version = await waitForJson(
        \`http://127.0.0.1:\${port}/json/version\`,
        30_000,
      );
      const browserClient = await CdpClient.connect(
        version.webSocketDebuggerUrl,
      );
      return {
        child,
        browserClient,
        profile,
        port,
        logLines,
        async close() {
          try {
            await browserClient.call("Browser.close");
          } catch {
            child.kill("SIGKILL");
          }
          browserClient.close();
          if (child.exitCode === null) {
            await new Promise((resolve) => child.once("exit", resolve));
          }
          await rm(profile, { recursive: true, force: true });
        },
      };
    } catch (error) {
      failures.push(
        \`attempt \${attempt}/\${attempts}: \${String(error)}\\n\${logLines.join("")}\`,
      );
      child.kill("SIGKILL");
      if (child.exitCode === null) {
        await Promise.race([
          new Promise((resolve) => child.once("exit", resolve)),
          sleep(2_000),
        ]);
      }
      await rm(profile, { recursive: true, force: true });
      if (attempt < attempts) await sleep(250 * attempt);
    }
  }
  throw new Error(
    \`Unable to start Chrome after \${attempts} attempts.\\n\${failures.join("\\n---\\n")}\`,
  );
}
`;
let nextCore =
  coreSource.slice(0, chromeStart) +
  reliableStartChrome +
  coreSource.slice(chromeEnd);
const oldStep = `async function stepFrame(client, seconds = 1 / 60) {
  return evaluate(
    client,
    \`(() => {
      const canvas = document.querySelector("canvas");
      const debug = canvas?.__waveDebug;
      const context = window.__LUMATHREAD_GL_CONTEXTS__?.[0];
      if (!debug || !context) {
        throw new Error("Synchronous renderer debug hooks are unavailable.");
      }
      const startedAt = performance.now();
      debug.step(\${seconds});
      const submittedAt = performance.now();
      context.finish();
      const finishedAt = performance.now();
      return {
        submitMs: submittedAt - startedAt,
        drainMs: finishedAt - submittedAt,
        wallMs: finishedAt - startedAt,
      };
    })()\`,
  );
}`;
const newStep = `async function stepFrame(client, seconds = 1 / 60) {
  return evaluate(
    client,
    \`(async () => {
      const canvas = document.querySelector("canvas");
      const debug = canvas?.__waveDebug;
      const context = window.__LUMATHREAD_GL_CONTEXTS__?.[0];
      if (!debug || !context) {
        throw new Error("Synchronous renderer debug hooks are unavailable.");
      }
      const startedAt = performance.now();
      debug.step(\${seconds});
      const submittedAt = performance.now();
      context.finish();
      const finishedAt = performance.now();
      await window.__LUMATHREAD_GPU_PROFILER__?.drain?.(2_000);
      return {
        submitMs: submittedAt - startedAt,
        drainMs: finishedAt - submittedAt,
        wallMs: finishedAt - startedAt,
      };
    })()\`,
  );
}`;
const stepIndex = nextCore.indexOf(oldStep);
if (stepIndex < 0 || nextCore.indexOf(oldStep, stepIndex + 1) >= 0) {
  throw new Error("Unable to locate unique stepFrame in benchmark-core.mjs");
}
nextCore =
  nextCore.slice(0, stepIndex) +
  newStep +
  nextCore.slice(stepIndex + oldStep.length);
await writeFile(corePath, nextCore);

console.log("Applied Chrome retry and GPU-query drain fixes.");
