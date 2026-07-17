import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const rendererDirectories = [
  "audio",
  "config",
  "geometry",
  "rendering",
  "runtime",
] as const;

function sourceLineCount(path: string) {
  return readFileSync(path, "utf8").split(/\r?\n/).length;
}

describe("renderer module boundaries", () => {
  test("keeps the public component facade intentionally small", () => {
    expect(sourceLineCount("src/hero-wave-background.tsx")).toBeLessThanOrEqual(
      20,
    );
    expect(
      sourceLineCount("src/runtime/HdrHeroWaveBackground.tsx"),
    ).toBeLessThanOrEqual(300);
  });

  test("prevents renderer responsibilities from collapsing into a monolith", () => {
    const oversized: Array<[string, number]> = [];
    for (const directory of rendererDirectories) {
      const root = join("src", directory);
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile() || ![".ts", ".tsx"].includes(extname(entry.name))) {
          continue;
        }
        const path = join(root, entry.name);
        const lines = sourceLineCount(path);
        if (lines > 1_800) oversized.push([path, lines]);
      }
    }
    expect(oversized).toEqual([]);
  });
});
