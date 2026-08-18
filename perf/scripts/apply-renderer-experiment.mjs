const mode =
  process.argv[2] ??
  process.env.LUMATHREAD_RENDERER_EXPERIMENT ??
  "direct-specialized-viewport";
const supportedModes = new Set([
  "viewport",
  "specialized",
  "specialized-viewport",
  "direct-viewport",
  "direct-specialized-viewport",
]);
if (!supportedModes.has(mode)) {
  throw new Error(
    `Unknown renderer experiment ${JSON.stringify(mode)}. Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
}

if (mode.includes("specialized")) {
  await import(
    new URL(
      `./apply-glass-specialization-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    ),
  );
}

if (mode.includes("viewport")) {
  await import(
    new URL(
      `./apply-glass-viewport-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    ),
  );
}

if (mode.startsWith("direct")) {
  await import(
    new URL(
      `./apply-glass-direct-experiment.mjs?experiment=${encodeURIComponent(mode)}`,
      import.meta.url,
    ),
  );
}

console.log(`Applied renderer experiment: ${mode}.`);
