import { createDrawCommon } from "./draw-common";
import { createGlassTerrainRenderer } from "./glass-terrain-renderer";
import { createPathRenderer } from "./path-renderer";
import { createSineRenderer } from "./sine-renderer";
import type { DrawControllerOptions } from "./draw-types";

export function createDrawController(options: DrawControllerOptions) {
  const common = createDrawCommon(options);
  const glassTerrain = createGlassTerrainRenderer(options, common);
  const { drawSine } = createSineRenderer(options, common, glassTerrain);
  const { drawPathScene } = createPathRenderer(options, common, glassTerrain);

  return {
    drawSine,
    drawPathScene,
    drawTerrainDots: glassTerrain.drawTerrainDots,
    compositeGlassText: glassTerrain.compositeGlassText,
    localVisualTime: common.localVisualTime,
  };
}
