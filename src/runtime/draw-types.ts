import type { HeroWaveRendererStatus } from "../types";

import type { Settings } from "../config/settings";

import type { ProgramBundle } from "../rendering/webgl-resources";

import type {
  FilamentStyleTextures,
  FollowRuntimeModifiers,
  PreparedFilamentFrame,
} from "../runtime/state";

import type { createMusicFrameController } from "../audio/music-runtime";

import type {
  createFollowController,
  FollowPointerState,
} from "./follow-controller";
import type { createGeometryController } from "./geometry-controller";
import type {
  createResourceManager,
  HeroWaveResourceState,
} from "./resource-manager";

export interface DrawControllerOptions {
  gl: WebGLRenderingContext;
  exactGl: WebGL2RenderingContext | null;
  resourceState: HeroWaveResourceState;
  sineProgram: ProgramBundle;
  fullscreenBuffer: WebGLBuffer;
  glowTexture0: WebGLTexture;
  glowTexture1: WebGLTexture;
  maskTexture: WebGLTexture;
  backgroundTexture: WebGLTexture;
  hueMatrix: Float32Array;
  zeroFloat4: Float32Array;
  preparedSceneFrames: PreparedFilamentFrame[];
  followModifierScratch: FollowRuntimeModifiers;
  musicModifierScratch: FollowRuntimeModifiers;
  pointerState: FollowPointerState;
  getClockTime: () => number;
  isRunning: () => boolean;
  requestFrame: () => void;
  activateProgram: (program: WebGLProgram | null) => void;
  getStyleTextures: (settings: Settings) => FilamentStyleTextures;
  updateBackgroundImage: (settings: Settings) => void;
  hasConditionalFollow: (settings: Settings) => boolean;
  reportStatus: (status: HeroWaveRendererStatus) => void;
  resourceManager: ReturnType<typeof createResourceManager>;
  geometryController: ReturnType<typeof createGeometryController>;
  musicController: ReturnType<typeof createMusicFrameController>;
  followController: ReturnType<typeof createFollowController>;
}
