(() => {
  const benchmarkMode =
    new URLSearchParams(window.location.search).get("mode") === "benchmark";
  const contexts = [];
  const percentile = (values, fraction) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const position = Math.min(
      sorted.length - 1,
      Math.max(0, (sorted.length - 1) * fraction),
    );
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const weight = position - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };
  const summarize = (samples, frameCount, key) => {
    const groups = new Map();
    for (const sample of samples) {
      const name = sample[key];
      const values = groups.get(name) ?? [];
      values.push(sample.ms);
      groups.set(name, values);
    }
    return Object.fromEntries(
      [...groups.entries()].map(([name, values]) => {
        const totalMs = values.reduce((sum, value) => sum + value, 0);
        return [
          name,
          {
            count: values.length,
            countPerFrame: frameCount > 0 ? values.length / frameCount : null,
            totalMs,
            frameMeanMs: frameCount > 0 ? totalMs / frameCount : null,
            drawMeanMs: values.length > 0 ? totalMs / values.length : null,
            drawP50Ms: percentile(values, 0.5),
            drawP95Ms: percentile(values, 0.95),
          },
        ];
      }),
    );
  };
  const classifyShader = (source) => {
    if (
      source.includes("layout(location = 0) out vec4 outWave") &&
      source.includes("float core = lineKernel(92.0")
    ) {
      return "path-integral-core";
    }
    if (
      source.includes("layout(location = 0) out vec4 outWave") &&
      source.includes("float ridge = lineKernel(20.0")
    ) {
      return "path-integral-mid";
    }
    if (
      source.includes("layout(location = 0) out vec4 outWave") &&
      source.includes("float atmosphere = lineKernel(4.6")
    ) {
      return "path-integral-far";
    }
    if (
      source.includes("uniform sampler2D uFarWave") &&
      source.includes("out vec4 fragmentColor")
    ) {
      return "path-composite";
    }
    if (
      source.includes("uniform sampler2D uTextMask") &&
      source.includes("float glassTwinkle")
    ) {
      return "glass-effect";
    }
    if (
      source.includes("uniform sampler2D uEffect") &&
      source.includes("uniform float uProgress")
    ) {
      return "glass-composite";
    }
    if (
      source.includes("uniform sampler2D uSource") &&
      source.includes("uniform vec2 uDirection")
    ) {
      return "glass-blur";
    }
    if (
      source.includes("varying float vDepthFade") &&
      source.includes("gl_PointCoord")
    ) {
      return "terrain-dots";
    }
    if (source.includes("movingCurveAndSlope")) return "sine-composite";
    return null;
  };
  const instrument = (context, type) => {
    if (context.__lumathreadGpuProfiled) return;
    Object.defineProperty(context, "__lumathreadGpuProfiled", { value: true });
    const extension =
      benchmarkMode && type === "webgl2"
        ? context.getExtension("EXT_disjoint_timer_query_webgl2")
        : null;
    const shaderStages = new WeakMap();
    const programShaders = new WeakMap();
    const programStages = new WeakMap();
    const state = {
      frame: 0,
      pending: [],
      samples: [],
      errors: [],
      disjointCount: 0,
      active: null,
      ordinals: new Map(),
      currentProgram: null,
    };
    const wrap = (name, before, after) => {
      const original = context[name];
      if (typeof original !== "function") return;
      context[name] = function profiledWebGlCall(...args) {
        let token;
        try {
          token = before?.(args);
        } catch (error) {
          state.errors.push(`${name} before: ${String(error)}`);
        }
        try {
          return original.apply(context, args);
        } finally {
          try {
            after?.(args, token);
          } catch (error) {
            state.errors.push(`${name} after: ${String(error)}`);
          }
        }
      };
    };
    const beginDraw = () => {
      if (!extension || state.active) return null;
      const query = context.createQuery();
      if (!query) return null;
      const stage =
        (state.currentProgram
          ? programStages.get(state.currentProgram)
          : null) ?? "other";
      const ordinal = (state.ordinals.get(stage) ?? 0) + 1;
      state.ordinals.set(stage, ordinal);
      const token = {
        query,
        stage,
        label: `${stage}#${ordinal}`,
        frame: state.frame,
      };
      context.beginQuery(extension.TIME_ELAPSED_EXT, query);
      state.active = query;
      return token;
    };
    const endDraw = (_args, token) => {
      if (!extension || !token) return;
      context.endQuery(extension.TIME_ELAPSED_EXT);
      state.active = null;
      state.pending.push(token);
    };
    const collect = () => {
      if (!extension || state.pending.length === 0) return;
      if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
        state.disjointCount += 1;
        for (const token of state.pending) context.deleteQuery(token.query);
        state.pending.length = 0;
        return;
      }
      let writeIndex = 0;
      for (const token of state.pending) {
        if (
          !context.getQueryParameter(token.query, context.QUERY_RESULT_AVAILABLE)
        ) {
          state.pending[writeIndex++] = token;
          continue;
        }
        const nanoseconds = Number(
          context.getQueryParameter(token.query, context.QUERY_RESULT),
        );
        context.deleteQuery(token.query);
        if (Number.isFinite(nanoseconds)) {
          state.samples.push({
            stage: token.stage,
            label: token.label,
            frame: token.frame,
            ms: nanoseconds / 1_000_000,
          });
        }
      }
      state.pending.length = writeIndex;
    };
    const reset = () => {
      collect();
      for (const token of state.pending) context.deleteQuery(token.query);
      state.frame = 0;
      state.pending.length = 0;
      state.samples.length = 0;
      state.errors.length = 0;
      state.disjointCount = 0;
      state.active = null;
      state.ordinals.clear();
    };
    wrap("shaderSource", ([shader, source]) => {
      const stage = typeof source === "string" ? classifyShader(source) : null;
      if (shader && stage) shaderStages.set(shader, stage);
    });
    wrap("attachShader", ([program, shader]) => {
      if (!program || !shader) return;
      const shaders = programShaders.get(program) ?? [];
      shaders.push(shader);
      programShaders.set(program, shaders);
    });
    wrap(
      "linkProgram",
      undefined,
      ([program]) => {
        if (!program) return;
        for (const shader of programShaders.get(program) ?? []) {
          const stage = shaderStages.get(shader);
          if (!stage) continue;
          programStages.set(program, stage);
          break;
        }
      },
    );
    wrap("useProgram", ([program]) => {
      state.currentProgram = program ?? null;
    });
    for (const name of [
      "drawArrays",
      "drawArraysInstanced",
      "drawElements",
      "drawElementsInstanced",
    ]) {
      wrap(name, beginDraw, endDraw);
    }
    wrap("finish", undefined, () => {
      collect();
      state.frame += 1;
      state.ordinals.clear();
    });
    context.__lumathreadGpuProfiler = {
      beginFrame() {
        state.frame += 1;
        state.ordinals.clear();
      },
      collect,
      reset,
      snapshot() {
        collect();
        return {
          supported: Boolean(extension),
          extension: extension
            ? "EXT_disjoint_timer_query_webgl2"
            : null,
          frameCount: state.frame,
          pendingCount: state.pending.length,
          sampleCount: state.samples.length,
          disjointCount: state.disjointCount,
          errors: [...state.errors],
          byStage: summarize(state.samples, state.frame, "stage"),
          byDraw: summarize(state.samples, state.frame, "label"),
        };
      },
    };
    contexts.push(context);
  };
  const previousGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function profiledGetContext(
    type,
    ...args
  ) {
    const context = previousGetContext.call(this, type, ...args);
    if (
      context &&
      (type === "webgl" || type === "experimental-webgl" || type === "webgl2")
    ) {
      try {
        instrument(context, type);
      } catch {
        // The counter harness remains usable when timer-query instrumentation fails.
      }
    }
    return context;
  };
  const emptySnapshot = () => ({
    supported: false,
    extension: null,
    frameCount: 0,
    pendingCount: 0,
    sampleCount: 0,
    disjointCount: 0,
    errors: [],
    byStage: {},
    byDraw: {},
  });
  window.__LUMATHREAD_GPU_PROFILER__ = {
    beginFrame() {
      for (const context of contexts) {
        context.__lumathreadGpuProfiler?.beginFrame();
      }
    },
    collect() {
      for (const context of contexts) {
        context.__lumathreadGpuProfiler?.collect();
      }
    },
    reset() {
      for (const context of contexts) context.__lumathreadGpuProfiler?.reset();
    },
    snapshot() {
      for (const context of contexts) {
        context.__lumathreadGpuProfiler?.collect();
      }
      return contexts[0]?.__lumathreadGpuProfiler?.snapshot() ?? emptySnapshot();
    },
  };
  const glStats = window.__LUMATHREAD_GL_STATS__;
  if (glStats) {
    Object.defineProperty(glStats, "gpuProfile", {
      enumerable: true,
      get: () => window.__LUMATHREAD_GPU_PROFILER__.snapshot(),
    });
  }
  const resetCounters = window.__LUMATHREAD_RESET_GL_STATS__;
  window.__LUMATHREAD_RESET_GL_STATS__ = () => {
    resetCounters?.();
    window.__LUMATHREAD_GPU_PROFILER__.reset();
  };
})();
