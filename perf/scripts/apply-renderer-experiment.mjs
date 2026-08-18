const mode =
  process.argv[2] ?? process.env.LUMATHREAD_RENDERER_EXPERIMENT ?? "combined";
const supportedModes = new Set(["shader", "scissor", "blit", "combined"]);
if (!supportedModes.has(mode)) {
  throw new Error(
    `Unknown renderer experiment ${JSON.stringify(mode)}. Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
}

if (mode === "shader" || mode === "combined") {
  await import(
    new URL(
      `./apply-renderer-optimization.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode === "scissor" || mode === "blit" || mode === "combined") {
  const boundsMode = mode === "scissor" ? "scissor" : "blit";
  await import(
    new URL(
      `./apply-glass-bounds-experiment.mjs?mode=${boundsMode}&experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

console.log(`Applied renderer experiment: ${mode}.`);
