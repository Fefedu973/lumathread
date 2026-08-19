import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing ${label} in ${path}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Non-unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    for (const buffer of resources.segmentBuffers) exactGl.deleteBuffer(buffer);`,
  `    for (const buffer of new Set(resources.segmentBuffers)) {
      exactGl.deleteBuffer(buffer);
    }`,
  "path resource segment buffer destruction",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const buffer = exactGl.createBuffer();
        if (!buffer) throw new Error("Unable to allocate a segment buffer.");
        exactGl.bindBuffer(exactGl.ARRAY_BUFFER, buffer);
        exactGl.bufferData(exactGl.ARRAY_BUFFER, 0, exactGl.STREAM_DRAW);
        segmentBuffers.push(buffer);
      }`,
  `      const sharedSegmentBuffer = exactGl.createBuffer();
      if (!sharedSegmentBuffer) {
        throw new Error("Unable to allocate the shared segment buffer.");
      }
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, sharedSegmentBuffer);
      exactGl.bufferData(exactGl.ARRAY_BUFFER, 0, exactGl.STREAM_DRAW);
      segmentBuffers.push(
        sharedSegmentBuffer,
        sharedSegmentBuffer,
        sharedSegmentBuffer,
      );`,
  "path segment buffer allocation",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (const buffer of segmentBuffers) exactGl.deleteBuffer(buffer);`,
  `      for (const buffer of new Set(segmentBuffers)) {
        exactGl.deleteBuffer(buffer);
      }`,
  "path segment buffer cleanup",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const uploadSceneGeometry = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
    pass: number,
  ) => {
    if (!exactGl) return;
    let sceneHash = 2_166_136_261;
    let totalFloatCount = 0;
    for (const entry of scene) {
      const count = entry.geometry.segmentCounts[pass] ?? 0;
      entry.segmentOffsets[pass] = totalFloatCount;
      totalFloatCount += count * HERO_PATH_SEGMENT_STRIDE;
      sceneHash = hashString(sceneHash, entry.geometry.id);
      sceneHash = hashMix(sceneHash, entry.geometry.meshRevision);
      sceneHash = hashMix(sceneHash, count);
    }
    if (resources.uploadedSceneHashes[pass] === sceneHash) return;
    resources.uploadedSceneHashes[pass] = sceneHash;
    if (totalFloatCount <= 0) return;

    let staging = resources.stagingData[pass]!;
    staging = ensureFloatCapacity(staging, totalFloatCount);
    resources.stagingData[pass] = staging;
    let cursor = 0;
    for (const entry of scene) {
      const count = entry.geometry.segmentCounts[pass] ?? 0;
      const floatCount = count * HERO_PATH_SEGMENT_STRIDE;
      if (floatCount <= 0) continue;
      staging.set(
        entry.geometry.segmentData[pass]!.subarray(0, floatCount),
        cursor,
      );
      cursor += floatCount;
    }

    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[pass]!);
    // Replacing the data store lets streaming backends avoid waiting for the
    // previous frame to finish reading the same storage.
    exactGl.bufferData(
      exactGl.ARRAY_BUFFER,
      staging.subarray(0, totalFloatCount),
      exactGl.STREAM_DRAW,
    );
  };`,
  `  const uploadSceneGeometry = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
  ) => {
    if (!exactGl) return;
    const sceneHashes: [number, number, number] = [
      2_166_136_261,
      2_166_136_261,
      2_166_136_261,
    ];
    let totalFloatCount = 0;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      let sceneHash = sceneHashes[pass]!;
      for (const entry of scene) {
        const count = entry.geometry.segmentCounts[pass] ?? 0;
        entry.segmentOffsets[pass] = totalFloatCount;
        totalFloatCount += count * HERO_PATH_SEGMENT_STRIDE;
        sceneHash = hashString(sceneHash, entry.geometry.id);
        sceneHash = hashMix(sceneHash, entry.geometry.meshRevision);
        sceneHash = hashMix(sceneHash, count);
      }
      sceneHashes[pass] = sceneHash;
    }
    const changed = sceneHashes.some(
      (hash, pass) => resources.uploadedSceneHashes[pass] !== hash,
    );
    if (!changed) return;
    resources.uploadedSceneHashes = sceneHashes;
    if (totalFloatCount <= 0) return;

    let staging = resources.stagingData[0]!;
    staging = ensureFloatCapacity(staging, totalFloatCount);
    resources.stagingData[0] = staging;
    let cursor = 0;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      for (const entry of scene) {
        const count = entry.geometry.segmentCounts[pass] ?? 0;
        const floatCount = count * HERO_PATH_SEGMENT_STRIDE;
        if (floatCount <= 0) continue;
        staging.set(
          entry.geometry.segmentData[pass]!.subarray(0, floatCount),
          cursor,
        );
        cursor += floatCount;
      }
    }

    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[0]!);
    // One orphaning upload covers far, mid, and core geometry. Per-pass
    // offsets still select exactly the same segment records at draw time.
    exactGl.bufferData(
      exactGl.ARRAY_BUFFER,
      staging.subarray(0, totalFloatCount),
      exactGl.STREAM_DRAW,
    );
  };`,
  "path scene geometry upload",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    exactGl.enable(exactGl.BLEND);
    exactGl.blendEquation(exactGl.FUNC_ADD);
    exactGl.blendFunc(exactGl.ONE, exactGl.ONE);
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      clearIntegralPass(resources, pass);
      uploadSceneGeometry(resources, preparedSceneFrames, pass);`,
  `    uploadSceneGeometry(resources, preparedSceneFrames);
    exactGl.enable(exactGl.BLEND);
    exactGl.blendEquation(exactGl.FUNC_ADD);
    exactGl.blendFunc(exactGl.ONE, exactGl.ONE);
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      clearIntegralPass(resources, pass);`,
  "path pass upload loop",
);

console.log("Applied shared path segment buffer experiment.");
