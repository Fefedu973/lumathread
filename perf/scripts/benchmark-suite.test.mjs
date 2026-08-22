import { expect, test } from "bun:test";

import { drainGpuProfiler } from "./benchmark-suite.mjs";

function pageWithUnsupportedProfiler() {
  return {
    client: {
      call: async () => ({
        result: {
          value: {
            supported: false,
            extension: null,
            frameCount: 0,
            pendingCount: 0,
            sampleCount: 0,
            disjointCount: 0,
            errors: [],
            byStage: {},
            byDraw: {},
          },
        },
      }),
    },
  };
}

test("GPU proof remains fail-closed when timer queries are unavailable", async () => {
  let failure = null;
  try {
    await drainGpuProfiler(pageWithUnsupportedProfiler(), 1);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure?.message).toContain(
    "GPU timer-query extension is unavailable",
  );
});

test("explicitly uninstrumented wall runs may omit timer queries", async () => {
  const profile = await drainGpuProfiler(
    pageWithUnsupportedProfiler(),
    1,
    false,
  );
  expect(profile.supported).toBeFalse();
});
