import { readFile, writeFile } from "node:fs/promises";

const path = "src/rendering/shaders.ts";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`Expected one ${label} block, found ${count}.`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  `  float aspect = uCanvasResolution.x / max(uCanvasResolution.y, 1.0);
  vec2 segmentStart = vec2(aSegmentStart.x * aspect, aSegmentStart.y);
  vec2 segmentEnd = vec2(aSegmentEnd.x * aspect, aSegmentEnd.y);
  vec2 segmentVector = segmentEnd - segmentStart;
  float segmentLength = length(segmentVector);
  vec2 tangent = segmentVector / max(segmentLength, 0.000001);
  vec2 sourcePoint = segmentStart + segmentVector * sourceParameter;
`,
  `  vec2 segmentStartPx = aSegmentStart * uTargetResolution;
  vec2 segmentEndPx = aSegmentEnd * uTargetResolution;
  vec2 segmentVectorPx = segmentEndPx - segmentStartPx;
  float segmentLengthPx = length(segmentVectorPx);
  vec2 tangentPx = segmentVectorPx / max(segmentLengthPx, 0.000001);
  vec2 sourcePointPx = segmentStartPx + segmentVectorPx * sourceParameter;
`,
  "source vertex geometry",
);

replaceOnce(
  `  float arcWeight = segmentLength * quadratureWeight;
  vec3 waveColor`,
  `  float arcWeight = segmentLengthPx * quadratureWeight;
  vec3 waveColor`,
  "source arc weight",
);

replaceOnce(
  `  vSourceFrame = vec4(sourcePoint, tangent);
  vShape = vec4(
    taperWidth,
`,
  `  vSourceFrame = vec4(sourcePointPx, tangentPx);
  vShape = vec4(
    taperWidth * uTargetResolution.y,
`,
  "source varyings",
);

replaceOnce(
  "  if (segmentLength <= 0.000001 || segmentAlpha <= 0.000001) {\n",
  "  if (segmentLengthPx <= 0.000001 || segmentAlpha <= 0.000001) {\n",
  "source visibility",
);

replaceOnce(
  `  vec2 startPx = aSegmentStart * uTargetResolution;
  vec2 endPx = aSegmentEnd * uTargetResolution;
  vec2 directionPx = endPx - startPx;
  vec2 tangentPx = directionPx / max(length(directionPx), 0.0001);
  vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
  vec2 sourcePx = mix(startPx, endPx, sourceParameter);
`,
  `  vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
`,
  "duplicate pixel geometry",
);

replaceOnce(
  "  vec2 positionPx = sourcePx\n",
  "  vec2 positionPx = sourcePointPx\n",
  "source support origin",
);

replaceOnce(
  `  float aspect = uCanvasResolution.x / max(uCanvasResolution.y, 1.0);
  vec2 queryUv = gl_FragCoord.xy / uTargetResolution;
  vec2 query = vec2(queryUv.x * aspect, queryUv.y);
  vec2 offset = query - vSourceFrame.xy;
`,
  `  vec2 offset = gl_FragCoord.xy - vSourceFrame.xy;
`,
  "fragment query coordinates",
);

replaceOnce(
  `  float profileSpread = vShape.y * directionalSpread * vShape.x;
  float pixelRadius = 0.08 / max(uTargetResolution.y, 1.0);
`,
  `  float profileSpread = vShape.y * directionalSpread * vShape.x;
  float pixelRadius = 0.08;
`,
  "pixel regularization radius",
);

await writeFile(path, source);
console.log("Applied pixel-space source-integral experiment.");
