import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Settings } from "../config/settings";
import {
  createResourceManager,
  type HeroWaveResourceState,
} from "../runtime/resource-manager";
import { selectTemporalPathCacheAction } from "../runtime/path-renderer";

function createFakeWebGl2(failTextureAt = Number.POSITIVE_INFINITY) {
  const calls = {
    createdFramebuffers: 0,
    createdTextures: 0,
    deletedFramebuffers: 0,
    deletedTextures: 0,
    textureUploads: 0,
  };
  const gl = {
    ARRAY_BUFFER: 0x8892,
    STREAM_DRAW: 0x88e0,
    STATIC_DRAW: 0x88e4,
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812f,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    RGBA16F: 0x881a,
    RGBA: 0x1908,
    HALF_FLOAT: 0x140b,
    R32F: 0x822e,
    RED: 0x1903,
    FLOAT: 0x1406,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    COLOR_ATTACHMENT0: 0x8ce0,
    COLOR_ATTACHMENT1: 0x8ce1,
    MAX_DRAW_BUFFERS: 0x8824,
    MAX_COLOR_ATTACHMENTS: 0x8cdf,
    getExtension: () => ({}),
    getParameter: () => 2,
    createBuffer: () => ({}) as WebGLBuffer,
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    createFramebuffer: () => {
      calls.createdFramebuffers += 1;
      return { id: calls.createdFramebuffers } as unknown as WebGLFramebuffer;
    },
    createTexture: () => {
      calls.createdTextures += 1;
      if (calls.createdTextures === failTextureAt) return null;
      return { id: calls.createdTextures } as unknown as WebGLTexture;
    },
    activeTexture: () => undefined,
    bindTexture: () => undefined,
    texParameteri: () => undefined,
    texImage2D: () => {
      calls.textureUploads += 1;
    },
    bindFramebuffer: () => undefined,
    framebufferTexture2D: () => undefined,
    drawBuffers: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    deleteProgram: () => undefined,
    deleteBuffer: () => undefined,
    deleteVertexArray: () => undefined,
    deleteFramebuffer: () => {
      calls.deletedFramebuffers += 1;
    },
    deleteTexture: () => {
      calls.deletedTextures += 1;
    },
  } as unknown as WebGL2RenderingContext;
  return { gl, calls };
}

const settings = {
  quality: {
    farScale: 0.25,
    midScale: 0.5,
    coreScale: 1,
    farMaxDimension: 2_048,
    midMaxDimension: 2_048,
    coreMaxDimension: 2_048,
  },
} as Settings;

function createResourceState(): HeroWaveResourceState {
  return {
    pathResources: undefined,
    terrainResources: undefined,
    glassResources: undefined,
    glassIntroStartedAt: null,
    pathRendererErrorLogged: false,
    canvasWidth: 640,
    canvasHeight: 360,
    dpr: 1,
    sizeRevision: 0,
    maskHash: -1,
    maskSizeRevision: -1,
    maskSettingsReference: null,
    backgroundCanvas: {} as HTMLCanvasElement,
    backgroundImageElement: null,
    backgroundImageSource: "",
    backgroundImageFit: "",
    backgroundImageSizeRevision: -1,
    backgroundImageRequest: 0,
  };
}

describe("HDR path target lifecycle", () => {
  test("bootstraps or advances no more than one temporal bank per frame", () => {
    const unset = Number.MIN_SAFE_INTEGER;
    expect(selectTemporalPathCacheAction(unset, 10, false, false)).toBe(
      "render-primary",
    );
    expect(selectTemporalPathCacheAction(10, 10, false, false)).toBe(
      "render-secondary",
    );
    expect(selectTemporalPathCacheAction(10, 10, true, false)).toBe("reuse");
    expect(selectTemporalPathCacheAction(10, 11, true, false)).toBe(
      "swap-render-secondary",
    );
    expect(selectTemporalPathCacheAction(10, 11, false, false)).toBe(
      "render-primary",
    );
    expect(selectTemporalPathCacheAction(10, 9, true, false)).toBe(
      "render-primary",
    );
    expect(selectTemporalPathCacheAction(10, 12, true, false)).toBe(
      "render-primary",
    );
    expect(selectTemporalPathCacheAction(10, 10, true, true)).toBe(
      "render-primary",
    );
  });

  test("allocates the temporal render-target bank only when requested", () => {
    const { gl, calls } = createFakeWebGl2();
    const resourceState = createResourceState();
    const manager = createResourceManager({
      gl,
      exactGl: gl,
      resourceState,
      withPrecision: (source) => source,
      reportError: () => undefined,
      reportStatus: () => undefined,
    });

    const resources = manager.ensurePathResources(settings);
    expect(resources).not.toBeNull();
    expect(resources).not.toBeUndefined();
    expect(resources?.temporalTargets).toBeNull();
    expect(resources?.temporalSecondBankReady).toBeFalse();
    expect(calls.createdFramebuffers).toBe(3);
    expect(calls.createdTextures).toBe(6);
    expect(calls.textureUploads).toBe(6);

    const temporalTargets = manager.ensureTemporalPathTargets(resources!);
    expect(resources?.temporalTargets).toBe(temporalTargets);
    expect(resources?.temporalSecondBankReady).toBeFalse();
    expect(calls.createdFramebuffers).toBe(6);
    expect(calls.createdTextures).toBe(11);
    expect(calls.textureUploads).toBe(11);

    expect(manager.ensureTemporalPathTargets(resources!)).toBe(temporalTargets);
    expect(calls.createdFramebuffers).toBe(6);
    expect(calls.createdTextures).toBe(11);

    resourceState.canvasWidth = 800;
    resourceState.sizeRevision += 1;
    resources!.temporalSecondBankReady = true;
    manager.allocatePathTargets(resources!, settings);
    expect(calls.textureUploads).toBe(21);
    expect(resources?.temporalSecondBankReady).toBeFalse();

    manager.destroyPathResources(resources!);
    expect(calls.deletedFramebuffers).toBe(6);
    expect(calls.deletedTextures).toBe(11);
  });

  test("cleans a partially allocated temporal target bank", () => {
    const { gl, calls } = createFakeWebGl2(11);
    const resourceState = createResourceState();
    const manager = createResourceManager({
      gl,
      exactGl: gl,
      resourceState,
      withPrecision: (source) => source,
      reportError: () => undefined,
      reportStatus: () => undefined,
    });

    const resources = manager.ensurePathResources(settings);
    expect(resources).not.toBeNull();
    expect(() => manager.ensureTemporalPathTargets(resources!)).toThrow();
    expect(resources?.temporalTargets).toBeNull();
    expect(calls.createdTextures).toBe(11);
    expect(calls.deletedTextures).toBe(4);

    manager.destroyPathResources(resources!);
    expect(calls.deletedTextures).toBe(10);
  });

  test("cleans a partially allocated primary target bank", () => {
    const { gl, calls } = createFakeWebGl2(5);
    const resourceState = createResourceState();
    const manager = createResourceManager({
      gl,
      exactGl: gl,
      resourceState,
      withPrecision: (source) => source,
      reportError: () => undefined,
      reportStatus: () => undefined,
    });

    expect(manager.ensurePathResources(settings)).toBeNull();
    expect(calls.createdTextures).toBe(5);
    expect(calls.deletedTextures).toBe(4);
    expect(calls.createdFramebuffers).toBe(3);
    expect(calls.deletedFramebuffers).toBe(3);
  });

  test("gates temporal eligibility on the presented initial frame", () => {
    const source = readFileSync("src/runtime/path-renderer.ts", "utf8");
    const readinessGate = source.indexOf("if (!isInitialFramePresented())");
    const temporalEligibility = source.indexOf(
      'root.motionMode === "travel"',
      readinessGate,
    );
    expect(readinessGate).toBeGreaterThan(-1);
    expect(temporalEligibility).toBeGreaterThan(readinessGate);

    const hookSource = readFileSync(
      "src/runtime/use-hero-wave-renderer.ts",
      "utf8",
    );
    expect(hookSource).toContain("let initialFramePresented = false;");
    expect(hookSource).toContain(
      "isInitialFramePresented: () => initialFramePresented",
    );
    const revealStart = hookSource.indexOf("const reveal = () =>");
    const firstPostRevealFrame = hookSource.indexOf(
      "presentedRaf = requestAnimationFrame",
      revealStart,
    );
    const secondPostRevealFrame = hookSource.indexOf(
      "presentedRaf = requestAnimationFrame",
      firstPostRevealFrame + 1,
    );
    const presentedSignal = hookSource.indexOf(
      "initialFramePresented = true",
      secondPostRevealFrame,
    );
    expect(firstPostRevealFrame).toBeGreaterThan(revealStart);
    expect(secondPostRevealFrame).toBeGreaterThan(firstPostRevealFrame);
    expect(presentedSignal).toBeGreaterThan(secondPostRevealFrame);
  });

  test("invalidates temporal banks when the motion mode changes", () => {
    const source = readFileSync("src/runtime/path-renderer.ts", "utf8");
    const keyStart = source.indexOf("const temporalHeroSettingsKey =");
    const keyEnd = source.indexOf("const updateTemporalHeroCache =", keyStart);
    const motionModeKey = source.indexOf("root.motionMode", keyStart);
    expect(keyStart).toBeGreaterThan(-1);
    expect(keyEnd).toBeGreaterThan(keyStart);
    expect(motionModeKey).toBeGreaterThan(keyStart);
    expect(motionModeKey).toBeLessThan(keyEnd);
  });
});
