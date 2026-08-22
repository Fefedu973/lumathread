import { readFile, writeFile } from "node:fs/promises";

const rendererPath = "src/runtime/glass-terrain-renderer.ts";
const requestedPassPairs = Number.parseInt(
  process.env.LUMATHREAD_GLASS_BLUR_PAIRS ?? "2",
  10,
);
if (![1, 2, 3].includes(requestedPassPairs)) {
  throw new Error(
    `LUMATHREAD_GLASS_BLUR_PAIRS must be 1, 2, or 3; received ${JSON.stringify(
      process.env.LUMATHREAD_GLASS_BLUR_PAIRS,
    )}.`,
  );
}

const source = await readFile(rendererPath, "utf8");
const before = `    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
    const baseStep =
      0.45 +
      settings.glassText.blur * 1.2 +
      settings.glassText.frost * 1.8 +
      settings.glassText.diffusion * 2.8;
    let source = resources.sceneTexture;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const step = baseStep * (1 + iteration * 0.28);
      drawBlurPass(
        source,
        resources.blurTextures[0],
        step / resources.blurWidth,
        0,
      );
      drawBlurPass(
        resources.blurTextures[0],
        resources.blurTextures[1],
        0,
        step / resources.blurHeight,
      );
      source = resources.blurTextures[1];
    }
    return resources.blurTextures[1];`;
const after = `    const originalIterations =
      2 + Math.round(settings.glassText.diffusion * 2);
    const targetIterations = Math.min(
      originalIterations,
      ${requestedPassPairs},
    );
    const baseStep =
      0.45 +
      settings.glassText.blur * 1.2 +
      settings.glassText.frost * 1.8 +
      settings.glassText.diffusion * 2.8;
    const originalSteps = Array.from(
      { length: originalIterations },
      (_, iteration) => baseStep * (1 + iteration * 0.28),
    );
    const compressedSteps = Array.from(
      { length: targetIterations },
      (_, group) => {
        const start = Math.floor(
          (group * originalIterations) / targetIterations,
        );
        const end = Math.floor(
          ((group + 1) * originalIterations) / targetIterations,
        );
        let variance = 0;
        for (let iteration = start; iteration < end; iteration++) {
          const step = originalSteps[iteration] ?? 0;
          variance += step * step;
        }
        return Math.sqrt(variance);
      },
    );
    let source = resources.sceneTexture;
    for (const step of compressedSteps) {
      drawBlurPass(
        source,
        resources.blurTextures[0],
        step / resources.blurWidth,
        0,
      );
      drawBlurPass(
        resources.blurTextures[0],
        resources.blurTextures[1],
        0,
        step / resources.blurHeight,
      );
      source = resources.blurTextures[1];
    }
    return resources.blurTextures[1];`;
const first = source.indexOf(before);
if (first < 0) {
  throw new Error("Expected glass scene blur loop was not found.");
}
if (source.indexOf(before, first + before.length) >= 0) {
  throw new Error("Expected a unique glass scene blur loop.");
}
await writeFile(
  rendererPath,
  source.slice(0, first) + after + source.slice(first + before.length),
);

console.log(
  `Compressed glass scene blur to at most ${requestedPassPairs} separable pass pair(s).`,
);
