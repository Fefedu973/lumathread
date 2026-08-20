import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  dispatchPointer,
  evaluate,
  openPage,
  sleep,
  startChrome,
  stepFrame,
  waitForHarness,
} from "./benchmark-core.mjs";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const baselineUrl = readArg("--baseline", "http://127.0.0.1:4173");
const candidateUrl = readArg("--candidate", "http://127.0.0.1:4174");
const out = readArg("--out", "pointer-results");

const surfaces = [
  {
    name: "cta-dark-desktop",
    theme: "dark",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  {
    name: "cta-light-desktop",
    theme: "light",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  {
    name: "cta-dark-mobile-2x",
    theme: "dark",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
  {
    name: "cta-light-mobile-2x",
    theme: "light",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
];

async function screenshot(page, destination) {
  const result = await page.client.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(destination, Buffer.from(result.data, "base64"));
}

async function readCounters(page) {
  return evaluate(
    page.client,
    `JSON.parse(JSON.stringify(window.__LUMATHREAD_GL_STATS__))`,
  );
}

async function resetCounters(page) {
  await evaluate(page.client, `window.__LUMATHREAD_RESET_GL_STATS__?.()`);
}

async function leavePointer(page) {
  await evaluate(
    page.client,
    `(() => {
      const init = {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        bubbles: true,
        composed: true,
      };
      document.dispatchEvent(new PointerEvent("pointerleave", init));
      window.dispatchEvent(new Event("blur"));
    })()`,
  );
}

async function captureBuild(chrome, baseUrl, side, surface) {
  const query = new URLSearchParams({
    scenario: "cta",
    theme: surface.theme,
    mode: "benchmark",
    variant: "full",
  });
  const page = await openPage(
    chrome,
    `${baseUrl}/?${query.toString()}`,
    surface.viewport,
  );
  const directory = path.join(out, "screenshots", side);
  await mkdir(directory, { recursive: true });
  try {
    await waitForHarness(page.client);
    await evaluate(page.client, `document.fonts?.ready ?? Promise.resolve()`);
    await sleep(100);

    for (let frame = 0; frame < 10; frame += 1) {
      await stepFrame(page.client, 1 / 60);
    }
    await screenshot(
      page,
      path.join(directory, `${surface.name}-idle-before.png`),
    );

    await resetCounters(page);
    await dispatchPointer(page.client, "cta", 0.35);
    const enterFrame = await stepFrame(page.client, 1 / 60);
    const enterCounters = await readCounters(page);
    await screenshot(
      page,
      path.join(directory, `${surface.name}-pointer-enter-f0.png`),
    );

    const moveFrames = [];
    for (let frame = 1; frame <= 4; frame += 1) {
      await dispatchPointer(page.client, "cta", 0.35 + frame * 0.61);
      moveFrames.push(await stepFrame(page.client, 1 / 60));
      if (frame === 1 || frame === 4) {
        await screenshot(
          page,
          path.join(directory, `${surface.name}-pointer-move-f${frame}.png`),
        );
      }
    }
    const activeCounters = await readCounters(page);

    await resetCounters(page);
    await leavePointer(page);
    const leaveFrames = [];
    for (let frame = 0; frame <= 5; frame += 1) {
      leaveFrames.push(await stepFrame(page.client, 1 / 60));
      if (frame === 0 || frame === 1 || frame === 3 || frame === 5) {
        await screenshot(
          page,
          path.join(directory, `${surface.name}-pointer-leave-f${frame}.png`),
        );
      }
    }
    const leaveCounters = await readCounters(page);

    return {
      side,
      surface: surface.name,
      enterFrame,
      moveFrames,
      leaveFrames,
      enterCounters,
      activeCounters,
      leaveCounters,
      renderer: await evaluate(
        page.client,
        `window.__LUMATHREAD_HARNESS__.rendererStatus`,
      ),
      errors: await evaluate(
        page.client,
        `window.__LUMATHREAD_HARNESS__.rendererErrors`,
      ),
    };
  } finally {
    await page.close();
  }
}

const chrome = await startChrome();
try {
  const results = [];
  for (const surface of surfaces) {
    console.log(`Capturing pointer transitions for ${surface.name}...`);
    results.push(
      await captureBuild(chrome, baselineUrl, "baseline", surface),
    );
    results.push(
      await captureBuild(chrome, candidateUrl, "candidate", surface),
    );
  }
  await writeFile(
    path.join(out, "pointer-transition-metadata.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
} finally {
  await chrome.close();
}
