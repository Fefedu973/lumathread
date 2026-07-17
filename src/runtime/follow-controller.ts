import type {
  HeroWaveFollowMode,
  HeroWaveFollowTarget,
  HeroWavePointerType,
} from "../types";
import { clamp } from "../math";
import { findClosestFilamentLocation } from "../interaction/filament-disturbance";

import {
  HERO_POINTER_HISTORY_LIMIT,
  HERO_FOLLOW_OVERSCAN,
  HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX,
  HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS,
  HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS,
  HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS,
  HERO_FOLLOW_HISTORY_MARGIN_SECONDS,
  type Settings,
} from "../config/settings";

import type {
  PointerTrailSample,
  FollowAnchor,
} from "../geometry/path-sampling";

import type {
  FilamentGeometryState,
  FilamentDisturbanceRuntime,
  FollowRuntimeState,
  FollowRuntimeModifiers,
} from "../runtime/state";

export interface FollowPointerState {
  canvasRect: DOMRect;
  rectDirty: boolean;
  dotPointerX: number;
  dotPointerY: number;
  dotPointerActive: boolean;
}

export interface FollowControllerOptions {
  canvas: HTMLCanvasElement;
  pointerState: FollowPointerState;
  getInteractionTime: () => number;
  requestFrame: () => void;
  acceptsFollowInput: (settings: Settings) => boolean;
  hasConditionalFollow: (settings: Settings) => boolean;
  getFollowState: (id: string) => FollowRuntimeState;
  geometryStates: Map<string, FilamentGeometryState>;
  getDisturbanceState: (id: string) => FilamentDisturbanceRuntime;
  getRootSettings: () => Settings;
  getActiveScene: (root: Settings) => Settings[];
  followStates: Map<string, FollowRuntimeState>;
}

export function createFollowController({
  canvas,
  pointerState,
  getInteractionTime,
  requestFrame,
  acceptsFollowInput,
  hasConditionalFollow,
  getFollowState,
  geometryStates,
  getDisturbanceState,
  getRootSettings,
  getActiveScene,
  followStates,
}: FollowControllerOptions) {
  const nowSeconds = () => performance.now() * 0.001;
  const pointerEventTimeSeconds = (eventTime: number) => {
    const nowMilliseconds = performance.now();
    let candidate = eventTime;
    if (candidate > 1_000_000_000_000) candidate -= performance.timeOrigin;
    if (
      !Number.isFinite(candidate) ||
      Math.abs(candidate - nowMilliseconds) > 60_000
    ) {
      candidate = nowMilliseconds;
    }
    return candidate * 0.001;
  };

  const resolveTargetElement = (target: HeroWaveFollowTarget) => {
    if (!target || target === "window") return null;
    if (target === "canvas") return canvas;
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement)
      return target;
    return "current" in target ? target.current : target;
  };

  const seedFollowAnchors = (
    anchors: readonly FollowAnchor[],
    x: number,
    top: number,
  ) => {
    for (const anchor of anchors) {
      anchor.x = x;
      anchor.top = top;
    }
  };

  const followAnchorsForMode = (
    state: FollowRuntimeState,
    mode: HeroWaveFollowMode,
  ) =>
    mode === "echo"
      ? state.echoAnchors
      : mode === "cascade"
        ? state.cascadeAnchors
        : state.hybridAnchors;

  const followPolylineLengthCssPx = (anchors: readonly FollowAnchor[]) => {
    let length = 0;
    const width = Math.max(pointerState.canvasRect.width, 1);
    const height = Math.max(pointerState.canvasRect.height, 1);
    for (let index = 1; index < anchors.length; index++) {
      const point = anchors[index]!;
      const previous = anchors[index - 1]!;
      length += Math.hypot(
        (point.x - previous.x) * width,
        (point.top - previous.top) * height,
      );
    }
    return length;
  };

  const resetFollowModeState = (
    state: FollowRuntimeState,
    mode: HeroWaveFollowMode,
    time: number,
  ) => {
    const x = state.headX;
    const top = state.headTop;
    state.lastMode = mode;
    state.history.length = 0;
    state.history.push({ x, top, time });
    state.persistentHistory.length = 0;
    state.persistentHistory.push({ x, top });
    seedFollowAnchors(state.echoAnchors, x, top);
    seedFollowAnchors(state.cascadeAnchors, x, top);
    seedFollowAnchors(state.hybridAnchors, x, top);
    seedFollowAnchors(state.hybridExactAnchors, x, top);
    seedFollowAnchors(state.hybridRopeAnchors, x, top);
    seedFollowAnchors(state.hybridResampledRopeAnchors, x, top);
    state.persistentCumulative.fill(0);
    state.anchorCumulative.fill(0);
    state.hybridInitialized = true;
    state.cascadeInitialized = true;
    state.cascadeInputInitialized = true;
    state.cascadeInputX = x;
    state.cascadeInputTop = top;
    state.cascadeProcessedInputRevision = state.inputRevision;
    state.lastSampleTime = time;
    state.rawVelocity = 0;
    state.velocity = 0;
    state.visibility = 1;
  };

  const appendFollowSample = (
    state: FollowRuntimeState,
    x: number,
    top: number,
    sampleTime: number,
    force = false,
  ) => {
    const latest = state.history[state.history.length - 1];
    if (!latest) {
      state.history.push({ x, top, time: sampleTime });
      state.headX = x;
      state.headTop = top;
      state.targetX = x;
      state.targetTop = top;
      state.idleCenterX = x;
      state.idleCenterTop = top;
      state.lastSampleTime = sampleTime;
      return;
    }
    const time = Math.max(sampleTime, latest.time + 0.000001);
    const distanceCssPx = Math.hypot(
      (x - latest.x) * Math.max(pointerState.canvasRect.width, 1),
      (top - latest.top) * Math.max(pointerState.canvasRect.height, 1),
    );
    const elapsed = Math.max(time - latest.time, 0.000001);
    if (
      !force &&
      distanceCssPx <= HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX &&
      elapsed <= HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS
    ) {
      latest.x = x;
      latest.top = top;
      latest.time = time;
    } else {
      state.history.push({ x, top, time });
    }
    if (state.history.length > HERO_POINTER_HISTORY_LIMIT) {
      state.history.splice(
        0,
        state.history.length - HERO_POINTER_HISTORY_LIMIT,
      );
    }
    state.lastSampleTime = time;
  };

  const preserveEchoHistoryAfterIdle = (
    state: FollowRuntimeState,
    mode: HeroWaveFollowMode,
    sampleTime: number,
  ) => {
    if (
      mode !== "echo" ||
      !state.active ||
      !Number.isFinite(state.lastInputTime)
    ) {
      return;
    }
    const frozenDuration =
      sampleTime - state.lastInputTime - HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS;
    if (frozenDuration <= 0) return;
    const latest = state.history[state.history.length - 1];
    const timelineShift = sampleTime - (latest?.time ?? state.lastInputTime);
    for (const sample of state.history) sample.time += timelineShift;
    if (Number.isFinite(state.lastSampleTime)) {
      state.lastSampleTime += timelineShift;
    }
  };

  const trimPersistentFollowHistory = (
    state: FollowRuntimeState,
    maximumCssPx: number,
  ) => {
    const history = state.persistentHistory;
    const width = Math.max(pointerState.canvasRect.width, 1);
    const height = Math.max(pointerState.canvasRect.height, 1);
    let accumulated = 0;
    let keepFrom = 0;
    for (let index = history.length - 2; index >= 0; index--) {
      const point = history[index]!;
      const leader = history[index + 1]!;
      const segmentLength = Math.hypot(
        (leader.x - point.x) * width,
        (leader.top - point.top) * height,
      );
      if (accumulated + segmentLength >= maximumCssPx) {
        const remaining = Math.max(maximumCssPx - accumulated, 0);
        const amount = segmentLength > 0 ? remaining / segmentLength : 0;
        point.x = leader.x + (point.x - leader.x) * amount;
        point.top = leader.top + (point.top - leader.top) * amount;
        keepFrom = index;
        break;
      }
      accumulated += segmentLength;
      keepFrom = index;
    }
    if (keepFrom > 0) history.splice(0, keepFrom);
    if (history.length > HERO_POINTER_HISTORY_LIMIT) {
      history.splice(0, history.length - HERO_POINTER_HISTORY_LIMIT);
    }
  };

  const appendPersistentFollowSample = (
    state: FollowRuntimeState,
    x: number,
    top: number,
    maximumCssPx: number,
  ) => {
    const history = state.persistentHistory;
    const latest = history[history.length - 1];
    const distance = latest
      ? Math.hypot(
          (x - latest.x) * Math.max(pointerState.canvasRect.width, 1),
          (top - latest.top) * Math.max(pointerState.canvasRect.height, 1),
        )
      : Number.POSITIVE_INFINITY;
    if (!latest || distance > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX) {
      history.push({ x, top });
    }
    trimPersistentFollowHistory(state, maximumCssPx);
  };

  const resampleFollowPath = (
    source: readonly FollowAnchor[],
    target: FollowAnchor[],
    cumulative: Float32Array,
    fallbackX: number,
    fallbackTop: number,
  ) => {
    const first = source[0];
    if (!first) {
      for (const anchor of target) {
        anchor.x = fallbackX;
        anchor.top = fallbackTop;
      }
      return 0;
    }
    const width = Math.max(pointerState.canvasRect.width, 1);
    const height = Math.max(pointerState.canvasRect.height, 1);
    cumulative[0] = 0;
    for (let index = 1; index < source.length; index++) {
      const point = source[index]!;
      const previous = source[index - 1]!;
      cumulative[index] =
        cumulative[index - 1]! +
        Math.hypot(
          (point.x - previous.x) * width,
          (point.top - previous.top) * height,
        );
    }
    const totalLength = cumulative[source.length - 1] ?? 0;
    let sourceIndex = 1;
    for (let index = 0; index < target.length; index++) {
      const targetLength =
        totalLength * (index / Math.max(target.length - 1, 1));
      while (
        sourceIndex < source.length - 1 &&
        (cumulative[sourceIndex] ?? 0) < targetLength
      ) {
        sourceIndex += 1;
      }
      const beforeIndex = Math.max(0, sourceIndex - 1);
      const before = source[beforeIndex] ?? first;
      const after = source[sourceIndex] ?? before;
      const beforeLength = cumulative[beforeIndex] ?? 0;
      const afterLength = cumulative[sourceIndex] ?? beforeLength;
      const amount =
        afterLength > beforeLength
          ? (targetLength - beforeLength) / (afterLength - beforeLength)
          : 0;
      const anchor = target[index]!;
      anchor.x = before.x + (after.x - before.x) * amount;
      anchor.top = before.top + (after.top - before.top) * amount;
    }
    return totalLength;
  };

  const recordFollowInput = (
    state: FollowRuntimeState,
    x: number,
    top: number,
    sampleTime: number,
  ) => {
    const elapsed = sampleTime - state.lastInputTime;
    const hasPreviousInput = Number.isFinite(state.lastInputTime);
    const distanceCssPx = hasPreviousInput
      ? Math.hypot(
          (x - state.lastInputX) * Math.max(pointerState.canvasRect.width, 1),
          (top - state.lastInputTop) *
            Math.max(pointerState.canvasRect.height, 1),
        )
      : Number.POSITIVE_INFINITY;
    if (hasPreviousInput && elapsed > 0 && elapsed <= 0.35) {
      const instantaneousVelocity = distanceCssPx / elapsed;
      state.rawVelocity = Math.max(
        state.rawVelocity * 0.35,
        instantaneousVelocity,
      );
    } else {
      state.rawVelocity = 0;
    }
    state.lastInputX = x;
    state.lastInputTop = top;
    state.lastInputTime = sampleTime;
    const cascadeDistanceCssPx = state.cascadeInputInitialized
      ? Math.hypot(
          (x - state.cascadeInputX) *
            Math.max(pointerState.canvasRect.width, 1),
          (top - state.cascadeInputTop) *
            Math.max(pointerState.canvasRect.height, 1),
        )
      : Number.POSITIVE_INFINITY;
    if (cascadeDistanceCssPx > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX) {
      state.cascadeInputInitialized = true;
      state.cascadeInputX = x;
      state.cascadeInputTop = top;
      state.inputRevision += 1;
    }
  };

  const updateFilamentPointer = (
    settings: Settings,
    clientX: number,
    clientY: number,
    sampleTime: number,
    pointerType: string,
  ) => {
    if (!acceptsFollowInput(settings)) return;
    if (
      !settings.follow.pointerTypes.includes(pointerType as HeroWavePointerType)
    ) {
      return;
    }
    const state = getFollowState(settings.id);
    if (state.lastMode !== settings.follow.mode) {
      resetFollowModeState(state, settings.follow.mode, sampleTime);
    }
    const conditional = hasConditionalFollow(settings);
    const target = conditional
      ? settings.follow.activation === "canvas"
        ? "canvas"
        : "window"
      : settings.follow.target;
    const element = resolveTargetElement(target);
    const targetRect = element?.getBoundingClientRect();
    const isInside =
      target === "window" ||
      (targetRect !== undefined &&
        clientX >= targetRect.left &&
        clientX <= targetRect.right &&
        clientY >= targetRect.top &&
        clientY <= targetRect.bottom);
    if (!isInside) {
      state.active = false;
      return;
    }
    const x = clamp(
      (clientX - pointerState.canvasRect.left) /
        Math.max(pointerState.canvasRect.width, 1),
      -HERO_FOLLOW_OVERSCAN,
      1 + HERO_FOLLOW_OVERSCAN,
    );
    const top = clamp(
      (clientY - pointerState.canvasRect.top) /
        Math.max(pointerState.canvasRect.height, 1),
      -HERO_FOLLOW_OVERSCAN,
      1 + HERO_FOLLOW_OVERSCAN,
    );
    if (conditional && !state.active) {
      state.headX = x;
      state.headTop = top;
      state.targetX = x;
      state.targetTop = top;
      resetFollowModeState(state, settings.follow.mode, sampleTime);
    }
    preserveEchoHistoryAfterIdle(state, settings.follow.mode, sampleTime);
    recordFollowInput(state, x, top, sampleTime);
    state.targetX = x;
    state.targetTop = top;
    state.idleCenterX = x;
    state.idleCenterTop = top;
    state.active = true;
    if (
      settings.follow.mode === "hybrid" &&
      settings.follow.headResponse >= 0.999
    ) {
      appendPersistentFollowSample(state, x, top, settings.follow.lengthCssPx);
    } else if (
      settings.follow.mode === "echo" &&
      (settings.follow.headResponse >= 0.999 || state.history.length === 0)
    ) {
      appendFollowSample(state, x, top, sampleTime);
    }
  };

  const updateFilamentDisturbance = (
    settings: Settings,
    clientX: number,
    clientY: number,
    pointerType: string,
  ) => {
    const config = settings.filamentInteraction;
    if (
      !config.enabled ||
      !config.pointerTypes.includes(pointerType as HeroWavePointerType)
    ) {
      return false;
    }
    const insideCanvas =
      clientX >= pointerState.canvasRect.left &&
      clientX <= pointerState.canvasRect.right &&
      clientY >= pointerState.canvasRect.top &&
      clientY <= pointerState.canvasRect.bottom;
    if (config.target === "canvas" && !insideCanvas) return false;

    const geometry = geometryStates.get(settings.id);
    const samples = geometry?.renderSamples;
    if (!geometry || !samples || samples.length < 2) return false;
    const pointerX =
      (clientX - pointerState.canvasRect.left) /
      Math.max(pointerState.canvasRect.width, 1);
    const pointerY =
      1 -
      (clientY - pointerState.canvasRect.top) /
        Math.max(pointerState.canvasRect.height, 1);
    const closest = findClosestFilamentLocation(
      samples,
      geometry.closed,
      pointerX,
      pointerY,
      Math.max(pointerState.canvasRect.width, 1),
      Math.max(pointerState.canvasRect.height, 1),
    );
    if (!closest || closest.distanceCssPx > config.radius) return false;

    const state = getDisturbanceState(settings.id);
    if (getInteractionTime() - state.lastTriggerTime < config.cooldown) {
      return false;
    }
    const proximity = clamp(1 - closest.distanceCssPx / config.radius, 0, 1);
    const falloff = proximity * proximity * (3 - 2 * proximity);
    let normalSign = closest.normalSign;
    if (config.direction === "push") normalSign *= -1;
    else if (config.direction === "alternate") {
      normalSign = state.alternateSign;
      state.alternateSign *= -1;
    }
    state.impulses.push({
      progress: closest.progress,
      startedAt: getInteractionTime(),
      strength: config.strength * falloff,
      normalSign,
    });
    if (state.impulses.length > config.maxImpulses) {
      state.impulses.splice(0, state.impulses.length - config.maxImpulses);
    }
    state.lastTriggerTime = getInteractionTime();
    return true;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (pointerState.rectDirty) {
      pointerState.canvasRect = canvas.getBoundingClientRect();
      pointerState.rectDirty = false;
    }
    const coalesced = event.getCoalescedEvents?.() ?? [];
    const samples = coalesced.length > 0 ? coalesced : [event];
    const latestSample = samples[samples.length - 1] ?? event;
    const root = getRootSettings();
    const pointerInsideCanvas =
      latestSample.clientX >= pointerState.canvasRect.left &&
      latestSample.clientX <= pointerState.canvasRect.right &&
      latestSample.clientY >= pointerState.canvasRect.top &&
      latestSample.clientY <= pointerState.canvasRect.bottom;
    const nextDotPointerActive =
      root.dotsEnabled && root.dotInteraction.enabled && pointerInsideCanvas;
    const previousDotPointerActive = pointerState.dotPointerActive;
    const previousDotPointerX = pointerState.dotPointerX;
    const previousDotPointerY = pointerState.dotPointerY;
    pointerState.dotPointerActive = nextDotPointerActive;
    if (nextDotPointerActive) {
      pointerState.dotPointerX = clamp(
        (latestSample.clientX - pointerState.canvasRect.left) /
          Math.max(pointerState.canvasRect.width, 1),
        0,
        1,
      );
      pointerState.dotPointerY =
        1 -
        clamp(
          (latestSample.clientY - pointerState.canvasRect.top) /
            Math.max(pointerState.canvasRect.height, 1),
          0,
          1,
        );
    }
    const dotPointerChanged =
      previousDotPointerActive !== pointerState.dotPointerActive ||
      Math.abs(previousDotPointerX - pointerState.dotPointerX) > 0.0001 ||
      Math.abs(previousDotPointerY - pointerState.dotPointerY) > 0.0001;
    const scene = getActiveScene(root);
    const hasFollowInput = scene.some(acceptsFollowInput);
    const hasFilamentInteraction = scene.some(
      (settings) => settings.filamentInteraction.enabled,
    );
    if (!hasFollowInput && !hasFilamentInteraction) {
      if (dotPointerChanged) requestFrame();
      return;
    }
    for (const sample of samples) {
      const sampleTime = pointerEventTimeSeconds(sample.timeStamp);
      for (const filament of scene) {
        const pointerType = sample.pointerType || event.pointerType || "mouse";
        if (hasFollowInput) {
          updateFilamentPointer(
            filament,
            sample.clientX,
            sample.clientY,
            sampleTime,
            pointerType,
          );
        }
        if (hasFilamentInteraction) {
          updateFilamentDisturbance(
            filament,
            sample.clientX,
            sample.clientY,
            pointerType,
          );
        }
      }
    }
    requestFrame();
  };
  const deactivatePointers = () => {
    pointerState.dotPointerActive = false;
    for (const state of followStates.values()) state.active = false;
    requestFrame();
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", deactivatePointers);
  document.addEventListener("pointerleave", deactivatePointers);

  const sampleHistoryAt = (
    history: readonly PointerTrailSample[],
    targetTime: number,
    fallbackX: number,
    fallbackTop: number,
  ) => {
    const first = history[0];
    if (!first) return { x: fallbackX, top: fallbackTop };
    const last = history[history.length - 1] ?? first;
    if (targetTime <= first.time) return { x: first.x, top: first.top };
    if (targetTime >= last.time) return { x: last.x, top: last.top };
    let low = 1;
    let high = history.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) * 0.5);
      if ((history[middle]?.time ?? 0) < targetTime) low = middle + 1;
      else high = middle;
    }
    const after = history[low] ?? last;
    const before = history[Math.max(0, low - 1)] ?? first;
    const amount = clamp(
      (targetTime - before.time) / Math.max(after.time - before.time, 0.000001),
      0,
      1,
    );
    return {
      x: before.x + (after.x - before.x) * amount,
      top: before.top + (after.top - before.top) * amount,
    };
  };

  const updateExternalFollowPosition = (
    settings: Settings,
    state: FollowRuntimeState,
    time: number,
  ) => {
    const position = settings.follow.position;
    if (!position || position.active === false) return false;
    let x = position.x;
    let top = position.y;
    if (position.space === "client") {
      x =
        (position.x - pointerState.canvasRect.left) /
        Math.max(pointerState.canvasRect.width, 1);
      top =
        (position.y - pointerState.canvasRect.top) /
        Math.max(pointerState.canvasRect.height, 1);
    }
    x = clamp(x, -HERO_FOLLOW_OVERSCAN, 1 + HERO_FOLLOW_OVERSCAN);
    top = clamp(top, -HERO_FOLLOW_OVERSCAN, 1 + HERO_FOLLOW_OVERSCAN);
    preserveEchoHistoryAfterIdle(state, settings.follow.mode, time);
    recordFollowInput(state, x, top, time);
    state.targetX = x;
    state.targetTop = top;
    state.idleCenterX = x;
    state.idleCenterTop = top;
    state.active = true;
    if (
      settings.follow.mode === "hybrid" &&
      settings.follow.headResponse >= 0.999
    ) {
      appendPersistentFollowSample(state, x, top, settings.follow.lengthCssPx);
    } else if (
      settings.follow.mode === "echo" &&
      (settings.follow.headResponse >= 0.999 || state.history.length === 0)
    ) {
      appendFollowSample(state, x, top, time);
    }
    return true;
  };

  const updateFollowRuntime = (
    settings: Settings,
    frameDelta: number,
    time: number,
  ) => {
    const state = getFollowState(settings.id);
    if (state.lastMode !== settings.follow.mode) {
      resetFollowModeState(state, settings.follow.mode, time);
    }
    updateExternalFollowPosition(settings, state, time);
    const idleAge = time - state.lastInputTime;
    if (!state.active) {
      if (
        settings.follow.leaveBehavior === "idle" &&
        idleAge >= settings.follow.idleDelay
      ) {
        state.targetX =
          state.idleCenterX +
          (Math.cos(time * settings.follow.idleSpeedX) *
            settings.follow.idleRadiusX) /
            Math.max(pointerState.canvasRect.width, 1);
        state.targetTop =
          state.idleCenterTop +
          (Math.sin(time * settings.follow.idleSpeedY) *
            settings.follow.idleRadiusY) /
            Math.max(pointerState.canvasRect.height, 1);
      } else if (settings.follow.leaveBehavior === "freeze") {
        state.rawVelocity = 0;
      }
    }
    const delta = clamp(frameDelta || 1 / 60, 1 / 240, 0.1);
    const headResponse = settings.follow.headResponse;
    const headAmount =
      headResponse >= 0.999
        ? 1
        : 1 - Math.exp(-(2 + headResponse * 80) * delta);
    if (state.active || settings.follow.leaveBehavior !== "freeze") {
      state.headX += (state.targetX - state.headX) * headAmount;
      state.headTop += (state.targetTop - state.headTop) * headAmount;
    }
    const headDistanceToTargetCssPx = Math.hypot(
      (state.targetX - state.headX) *
        Math.max(pointerState.canvasRect.width, 1),
      (state.targetTop - state.headTop) *
        Math.max(pointerState.canvasRect.height, 1),
    );
    if (
      settings.follow.mode === "hybrid" &&
      settings.follow.headResponse < 0.999 &&
      (idleAge <= 0.08 ||
        headDistanceToTargetCssPx > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX)
    ) {
      appendPersistentFollowSample(
        state,
        state.headX,
        state.headTop,
        settings.follow.lengthCssPx,
      );
    }
    const velocityResponse =
      1 -
      Math.exp(
        -settings.follow.velocityInfluence.response * Math.max(delta, 0.0001),
      );
    state.velocity += (state.rawVelocity - state.velocity) * velocityResponse;
    state.rawVelocity *= Math.exp(-8 * delta);
    const targetVisibility =
      !state.active &&
      settings.follow.leaveBehavior === "fade" &&
      idleAge >= settings.follow.idleDelay
        ? 0
        : 1;
    const visibilityResponse =
      1 - Math.exp((-4.6 * delta) / settings.follow.fadeDuration);
    state.visibility +=
      (targetVisibility - state.visibility) * visibilityResponse;

    const recentInput = idleAge <= HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS;
    const syntheticIdle =
      !state.active &&
      settings.follow.leaveBehavior === "idle" &&
      idleAge >= settings.follow.idleDelay;
    const collapseRequested =
      !state.active && settings.follow.leaveBehavior === "collapse";
    const selectedAnchors = () =>
      followAnchorsForMode(state, settings.follow.mode);

    if (
      settings.follow.mode === "echo" &&
      state.active &&
      idleAge >= HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS &&
      settings.follow.stationaryBehavior === "freeze"
    ) {
      return { state, anchors: state.echoAnchors };
    }

    if (
      !state.active &&
      settings.follow.leaveBehavior === "freeze" &&
      (state.hybridInitialized ||
        state.cascadeInitialized ||
        state.history.length > 0)
    ) {
      return { state, anchors: selectedAnchors() };
    }

    if (settings.follow.mode === "echo") {
      const stationaryAge = Math.max(
        idleAge - HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS,
        0,
      );
      const echoTime =
        state.active &&
        settings.follow.stationaryBehavior === "collapse" &&
        stationaryAge > 0
          ? state.lastInputTime +
            HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS +
            stationaryAge *
              (settings.follow.memorySeconds /
                settings.follow.stationaryCollapseDuration)
          : time;
      if (state.history.length === 0) {
        appendFollowSample(state, state.headX, state.headTop, echoTime, true);
      }
      const latest = state.history[state.history.length - 1];
      if (
        latest &&
        echoTime - latest.time >= HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS
      ) {
        appendFollowSample(state, state.headX, state.headTop, echoTime, true);
      }
      const cutoff =
        echoTime -
        settings.follow.memorySeconds -
        HERO_FOLLOW_HISTORY_MARGIN_SECONDS;
      while (
        state.history.length > 2 &&
        (state.history[1]?.time ?? echoTime) < cutoff
      ) {
        state.history.shift();
      }
      const echoCount = state.echoAnchors.length;
      for (let index = 0; index < echoCount; index++) {
        const age =
          settings.follow.memorySeconds *
          (1 - index / Math.max(echoCount - 1, 1));
        const sampled = sampleHistoryAt(
          state.history,
          echoTime - age,
          state.headX,
          state.headTop,
        );
        const anchor = state.echoAnchors[index]!;
        anchor.x = sampled.x;
        anchor.top = sampled.top;
      }
    } else if (settings.follow.mode === "cascade") {
      if (!state.cascadeInitialized) {
        for (const anchor of state.cascadeAnchors) {
          anchor.x = state.headX;
          anchor.top = state.headTop;
        }
        state.cascadeInitialized = true;
        state.cascadeProcessedInputRevision = state.inputRevision;
      }
      const head = state.cascadeAnchors[state.cascadeAnchors.length - 1]!;
      const headMoved =
        Math.hypot(
          (state.headX - head.x) * Math.max(pointerState.canvasRect.width, 1),
          (state.headTop - head.top) *
            Math.max(pointerState.canvasRect.height, 1),
        ) > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX;
      const hasNewInput =
        state.cascadeProcessedInputRevision !== state.inputRevision;
      const shouldAdvance =
        hasNewInput ||
        (settings.follow.headResponse < 0.999 && headMoved) ||
        syntheticIdle ||
        collapseRequested;
      head.x = state.headX;
      head.top = state.headTop;
      if (shouldAdvance) {
        const lag = clamp((settings.follow.memorySeconds - 0.28) / 1.42, 0, 1);
        const responseRate = 90 - lag * 60;
        // Cascade is input-driven. Advancing for every idle render frame made
        // the entire chain converge to the head and periodically disappear.
        const cascadeDelta = clamp(frameDelta || 1 / 60, 1 / 240, 1 / 60);
        const response = 1 - Math.exp(-responseRate * cascadeDelta);
        for (let index = state.cascadeAnchors.length - 2; index >= 0; index--) {
          const anchor = state.cascadeAnchors[index]!;
          const leader = state.cascadeAnchors[index + 1]!;
          anchor.x += (leader.x - anchor.x) * response;
          anchor.top += (leader.top - anchor.top) * response;
        }
      }
      if (hasNewInput) {
        state.cascadeProcessedInputRevision = state.inputRevision;
      }
    } else {
      if (state.persistentHistory.length === 0) {
        state.persistentHistory.push({ x: state.headX, top: state.headTop });
      }
      if (syntheticIdle) {
        appendPersistentFollowSample(
          state,
          state.headX,
          state.headTop,
          settings.follow.lengthCssPx,
        );
      }
      if (collapseRequested && state.persistentHistory.length > 1) {
        const removeCount = Math.min(
          state.persistentHistory.length - 1,
          Math.max(1, Math.ceil(delta * state.persistentHistory.length * 5)),
        );
        state.persistentHistory.splice(0, removeCount);
      }
      trimPersistentFollowHistory(state, settings.follow.lengthCssPx);
      const exactLength = resampleFollowPath(
        state.persistentHistory,
        state.hybridExactAnchors,
        state.persistentCumulative,
        state.headX,
        state.headTop,
      );
      if (!state.hybridInitialized) {
        for (let index = 0; index < state.hybridRopeAnchors.length; index++) {
          const source = state.hybridExactAnchors[index]!;
          const target = state.hybridRopeAnchors[index]!;
          target.x = source.x;
          target.top = source.top;
        }
        state.hybridInitialized = true;
      }
      const ropeHead =
        state.hybridRopeAnchors[state.hybridRopeAnchors.length - 1]!;
      ropeHead.x = state.headX;
      ropeHead.top = state.headTop;
      if (recentInput || syntheticIdle || collapseRequested) {
        const response = 1 - Math.exp(-18 * delta);
        const spacing = collapseRequested
          ? 0
          : Math.max(
              exactLength / Math.max(state.hybridRopeAnchors.length - 1, 1),
              2,
            );
        for (let pass = 0; pass < 3; pass++) {
          for (
            let index = state.hybridRopeAnchors.length - 2;
            index >= 0;
            index--
          ) {
            const anchor = state.hybridRopeAnchors[index]!;
            const leader = state.hybridRopeAnchors[index + 1]!;
            const dx =
              (leader.x - anchor.x) *
              Math.max(pointerState.canvasRect.width, 1);
            const dy =
              (leader.top - anchor.top) *
              Math.max(pointerState.canvasRect.height, 1);
            const distance = Math.max(Math.hypot(dx, dy), 0.0001);
            const correction = ((distance - spacing) / distance) * response;
            anchor.x += (leader.x - anchor.x) * correction;
            anchor.top += (leader.top - anchor.top) * correction;
          }
        }
      }
      resampleFollowPath(
        state.hybridRopeAnchors,
        state.hybridResampledRopeAnchors,
        state.anchorCumulative,
        state.headX,
        state.headTop,
      );
      for (let index = 0; index < state.hybridAnchors.length; index++) {
        const anchor = state.hybridAnchors[index]!;
        const exact = state.hybridExactAnchors[index]!;
        const rope = state.hybridResampledRopeAnchors[index]!;
        anchor.x = exact.x + (rope.x - exact.x) * settings.follow.viscosity;
        anchor.top =
          exact.top + (rope.top - exact.top) * settings.follow.viscosity;
      }
    }

    const anchors = selectedAnchors();
    const head = anchors[anchors.length - 1]!;
    head.x = state.headX;
    head.top = state.headTop;
    return { state, anchors };
  };

  const followModifiers = (
    settings: Settings,
    state: FollowRuntimeState | null,
    target: FollowRuntimeModifiers,
  ): FollowRuntimeModifiers => {
    if (!state) {
      target.width = 1;
      target.glow = 1;
      target.reflection = 1;
      target.intensity = 1;
      target.hueDegrees = 0;
      target.visibility = 1;
      return target;
    }
    const influence = settings.follow.velocityInfluence;
    const normalized = clamp(
      state.velocity / Math.max(influence.maxVelocityCssPx, 1),
      0,
      1,
    );
    target.width = Math.max(0.05, 1 + influence.width * normalized);
    target.glow = Math.max(0.05, 1 + influence.glow * normalized);
    target.reflection = Math.max(0, 1 + influence.reflection * normalized);
    target.intensity = Math.max(0, 1 + influence.intensity * normalized);
    target.hueDegrees = influence.hue * normalized;
    target.visibility = state.visibility;
    return target;
  };

  return {
    nowSeconds,
    onPointerMove,
    deactivatePointers,
    updateExternalFollowPosition,
    updateFollowRuntime,
    followModifiers,
    followAnchorsForMode,
    followPolylineLengthCssPx,
  };
}
