import { readFile, writeFile } from "node:fs/promises";

await import(
  new URL(
    `./apply-glass-bounds-experiment.mjs?mode=scissor&viewport=${Date.now()}`,
    import.meta.url,
  )
);

const rendererPath = "src/runtime/glass-terrain-renderer.ts";

async function replaceOnce(before, after) {
  const source = await readFile(rendererPath, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error("Expected viewport source block was not found.");
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error("Expected a unique viewport source block.");
  }
  await writeFile(
    rendererPath,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  `    if (effectBounds) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }`,
  `    if (effectBounds) {
      gl.viewport(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    }`,
);

await replaceOnce(
  `    if (canBlitScene && effectBounds) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canBlitScene) gl.disable(gl.SCISSOR_TEST);`,
  `    if (canBlitScene && effectBounds) {
      gl.viewport(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canBlitScene) {
      gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    }`,
);

console.log("Applied bounded glass viewport experiment.");
