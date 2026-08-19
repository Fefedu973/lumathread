import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? ".";
const fileAt = (path) => (root === "." ? path : join(root, path));

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) {
    throw new Error(`Expected block not found in ${path}: ${before.slice(0, 120)}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

const rendererPath = fileAt("src/runtime/use-hero-wave-renderer.ts");
await replaceOnce(
  rendererPath,
  `      if (
        !running ||
        frameScheduled ||
        document.visibilityState === "hidden" ||`,
  `      if (
        !running ||
        frameScheduled ||
        settings.paused ||
        manualPausedRef.current ||
        document.visibilityState === "hidden" ||`,
);
await replaceOnce(
  rendererPath,
  `      step: (seconds: number) => {
        const safeSeconds = finite(seconds, 0);`,
  `      step: (seconds: number) => {
        if (frameScheduled) {
          cancelAnimationFrame(raf);
          frameScheduled = false;
        }
        const safeSeconds = finite(seconds, 0);`,
);

console.log(
  root === "."
    ? "Applied deterministic single-frame debug stepping."
    : `Applied deterministic single-frame debug stepping to ${root}.`,
);
