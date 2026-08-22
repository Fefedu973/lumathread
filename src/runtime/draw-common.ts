import { HERO_PATH_SEGMENT_STRIDE, type Settings } from "../config/settings";

import { buildDotMaskTextureData } from "../rendering/profile-textures";

import { hashMasks } from "../runtime/cache-keys";

import {
  buildHueMatrix,
  type ProgramBundle,
  type PathResources,
} from "../rendering/webgl-resources";

import type { DrawControllerOptions } from "./draw-types";

export function createDrawCommon({
  gl,
  exactGl,
  resourceState,
  maskTexture,
  fullscreenBuffer,
  getClockTime,
  hueMatrix,
}: DrawControllerOptions) {
  const updateMaskTexture = (settings: Settings) => {
    if (
      resourceState.maskSettingsReference === settings &&
      resourceState.maskSizeRevision === resourceState.sizeRevision
    ) {
      return;
    }
    const nextHash = hashMasks(settings.dotMasks, settings.maskFeather);
    resourceState.maskSettingsReference = settings;
    if (
      nextHash === resourceState.maskHash &&
      resourceState.maskSizeRevision === resourceState.sizeRevision
    )
      return;
    const mask = buildDotMaskTextureData(
      settings.dotMasks,
      settings.maskFeather,
      resourceState.canvasWidth / Math.max(resourceState.canvasHeight, 1),
    );
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    if (exactGl) {
      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.R8,
        mask.width,
        mask.height,
        0,
        exactGl.RED,
        exactGl.UNSIGNED_BYTE,
        mask.data,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        mask.width,
        mask.height,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        mask.data,
      );
    }
    resourceState.maskHash = nextHash;
    resourceState.maskSizeRevision = resourceState.sizeRevision;
  };

  const bindFullscreen = (bundle: ProgramBundle) => {
    const location = bundle.attributes.aPos ?? -1;
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }
  };

  const bindIntegralGeometry = (
    resources: PathResources,
    pass: number,
    bundle: ProgramBundle,
    segmentOffsetFloats = 0,
    instanceDivisor = 1,
  ) => {
    if (!exactGl) return;
    const corner = bundle.attributes.aCorner ?? -1;
    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.quadBuffer);
    if (corner >= 0) {
      exactGl.enableVertexAttribArray(corner);
      exactGl.vertexAttribPointer(corner, 2, exactGl.FLOAT, false, 0, 0);
      exactGl.vertexAttribDivisor(corner, 0);
    }
    const stride = HERO_PATH_SEGMENT_STRIDE * Float32Array.BYTES_PER_ELEMENT;
    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[pass]!);
    const bindAttribute = (name: string, size: number, offset: number) => {
      const location = bundle.attributes[name] ?? -1;
      if (location < 0) return;
      exactGl.enableVertexAttribArray(location);
      exactGl.vertexAttribPointer(
        location,
        size,
        exactGl.FLOAT,
        false,
        stride,
        (segmentOffsetFloats + offset) * Float32Array.BYTES_PER_ELEMENT,
      );
      exactGl.vertexAttribDivisor(location, instanceDivisor);
    };
    bindAttribute("aSegmentStart", 2, 0);
    bindAttribute("aSegmentEnd", 2, 2);
    bindAttribute("aProgressRange", 2, 4);
    bindAttribute("aEndpointWeights", 2, 6);
  };

  const bindCompositeTextures = (
    resources: PathResources,
    useTemporalBank = false,
  ) => {
    if (!exactGl) return;
    const temporalTargets = useTemporalBank ? resources.temporalTargets : null;
    if (useTemporalBank && !temporalTargets) {
      throw new Error("Temporal path targets have not been allocated.");
    }
    const nextWaveTextures =
      temporalTargets?.waveTextures ?? resources.waveTextures;
    const nextReflectionTextures =
      temporalTargets?.reflectionTextures ?? resources.reflectionTextures;
    exactGl.activeTexture(exactGl.TEXTURE0);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[0]);
    exactGl.activeTexture(exactGl.TEXTURE1);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.reflectionTextures[0]);
    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[1]);
    exactGl.activeTexture(exactGl.TEXTURE3);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.reflectionTextures[1]);
    exactGl.activeTexture(exactGl.TEXTURE4);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[2]);
    exactGl.activeTexture(exactGl.TEXTURE5);
    exactGl.bindTexture(exactGl.TEXTURE_2D, maskTexture);
    if (useTemporalBank) {
      exactGl.activeTexture(exactGl.TEXTURE7);
      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[0]);
      exactGl.activeTexture(exactGl.TEXTURE8);
      exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[0]);
      exactGl.activeTexture(exactGl.TEXTURE9);
      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[1]);
      exactGl.activeTexture(exactGl.TEXTURE10);
      exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[1]);
      exactGl.activeTexture(exactGl.TEXTURE11);
      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[2]);
    }
  };

  const localVisualTime = (settings: Settings) =>
    (getClockTime() * settings.filamentPlaybackRate + settings.timeOffset) *
    settings.speed;
  const paletteOffsetFor = (settings: Settings, visualTime: number) =>
    visualTime * settings.colorSpeed * 0.12;
  const fillHueMatrix = (
    settings: Settings,
    visualTime: number,
    hueOffsetDegrees: number,
  ) => {
    buildHueMatrix(
      ((settings.hue + visualTime * settings.hueDrift + hueOffsetDegrees) *
        Math.PI) /
        180,
      hueMatrix,
    );
  };

  return {
    updateMaskTexture,
    bindFullscreen,
    bindIntegralGeometry,
    bindCompositeTextures,
    localVisualTime,
    paletteOffsetFor,
    fillHueMatrix,
  };
}
