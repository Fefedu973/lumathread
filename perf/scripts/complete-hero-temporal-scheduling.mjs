import { readFile, writeFile } from "node:fs/promises";

const path = "src/runtime/path-renderer.ts";
const source = await readFile(path, "utf8");
const activeMarker =
  "if (shouldUseTemporalHeroCache(root, preparedSceneFrames))";

if (source.includes(activeMarker)) {
  console.log("Temporal Hero draw scheduling is already complete.");
  process.exit(0);
}

for (const required of [
  "const renderPreparedPathBank = (",
  "const shouldUseTemporalHeroCache = (",
  "const updateTemporalHeroCache = (",
  "temporalFramebuffers",
  "temporalWaveTextures",
]) {
  if (!source.includes(required)) {
    throw new Error(
      `Temporal transform stopped before required symbol: ${required}`,
    );
  }
}

const functionMarker = "  const drawPathScene = (";
const functionStart = source.lastIndexOf(functionMarker);
if (functionStart < 0) throw new Error("Unable to locate drawPathScene.");

const uploadMarker =
  "    uploadSceneGeometry(resources, preparedSceneFrames);\n";
const uploadStart = source.indexOf(uploadMarker, functionStart);
if (uploadStart < 0) {
  throw new Error("Unable to locate prepared-scene geometry upload.");
}
const replacementStart = uploadStart + uploadMarker.length;

const compositeMarker = "    compositePath(resources, root);\n  };";
const replacementEnd = source.indexOf(compositeMarker, replacementStart);
if (replacementEnd < 0) {
  throw new Error("Unable to locate the generic path-scene tail.");
}

const scheduling = `    if (shouldUseTemporalHeroCache(root, preparedSceneFrames)) {
      const temporalMix = updateTemporalHeroCache(
        resources,
        root,
        preparedSceneFrames,
      );
      compositePath(resources, root, temporalMix, true);
      return;
    }
    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;
    resources.temporalSettingsReference = null;
    resources.temporalSizeRevision = -1;
    renderPreparedPathBank(
      resources,
      preparedSceneFrames,
      resources.framebuffers,
      null,
    );
`;

const completed =
  source.slice(0, replacementStart) +
  scheduling +
  source.slice(replacementEnd);
if (!completed.includes(activeMarker)) {
  throw new Error("Temporal scheduling completion did not produce activation.");
}
await writeFile(path, completed);
console.log("Completed temporal Hero draw scheduling.");
