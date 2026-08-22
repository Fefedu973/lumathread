const mode =
  process.argv[2] ??
  process.env.LUMATHREAD_RENDERER_EXPERIMENT ??
  "twinkle-uniform-cache-path-core-output-specialized-viewport";
const supportedModes = new Set([
  "noop",
  "viewport",
  "specialized",
  "specialized-viewport",
  "direct-viewport",
  "direct-specialized-viewport",
  "twinkle",
  "uniform-cache",
  "path-core-output",
  "twinkle-uniform-cache",
  "twinkle-path-core-output",
  "twinkle-uniform-cache-path-core-output",
  "twinkle-uniform-cache-path-core-output-specialized-viewport",
  "blur-minus-one",
  "blur-half",
  "blur-1-specialized-viewport",
  "blur-2-specialized-viewport",
  "blur-3-specialized-viewport",
]);
if (!supportedModes.has(mode)) {
  throw new Error(
    `Unknown renderer experiment ${JSON.stringify(mode)}. Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
}

if (mode.includes("twinkle")) {
  await import(
    new URL(
      `./apply-glass-twinkle-branch-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode.includes("uniform-cache")) {
  await import(
    new URL(
      `./apply-uniform-cache-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode.includes("path-core-output")) {
  await import(
    new URL(
      `./apply-path-core-output-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode === "blur-minus-one" || mode === "blur-half") {
  await import(
    new URL(
      `./apply-glass-blur-collapse-experiment.mjs?mode=${mode.slice(5)}`,
      import.meta.url,
    )
  );
}

if (mode.includes("specialized")) {
  await import(
    new URL(
      `./apply-glass-specialization-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode.includes("viewport")) {
  await import(
    new URL(
      `./apply-glass-viewport-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

const blurMatch = /^blur-([123])-/.exec(mode);
if (blurMatch) {
  process.env.LUMATHREAD_GLASS_BLUR_PAIRS = blurMatch[1];
  await import(
    new URL(
      `./apply-glass-blur-compression-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

if (mode.startsWith("direct")) {
  await import(
    new URL(
      `./apply-glass-direct-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    )
  );
}

console.log(`Applied renderer experiment: ${mode}.`);
