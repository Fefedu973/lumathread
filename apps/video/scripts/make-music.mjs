/**
 * Generates public/music.wav — a 29s minimal-electronic track at 120 BPM,
 * aligned with the video's bar grid (1 bar = 2s = 60 frames @ 30fps):
 *
 *   bars  1–2  ( 0– 4s)  Hook       — pads + pluck arp, no drums
 *   bars  3–5  ( 4–10s)  Paths      — kick + bass in, clap from bar 4
 *   bars  6–7  (10–14s)  Glass      — open hats, brighter arp
 *   bars  8–9  (14–18s)  Interaction — brighter visual interlude
 *   bars 10–11 (18–22s)  Install    — filtered down, riser into the drop
 *   bars 12–13 (22–26s)  Landing    — the drop: full mix, octave bass
 *   bar  14+   (26–29s)  End card   — outro pad, fade to silence
 *
 * Pure deterministic DSP — no dependencies. Run: node scripts/make-music.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const DURATION = 30; // 29s of music + 1s tail
const N = SR * DURATION;
const BEAT = 0.5; // 120 BPM
const BAR = 4 * BEAT;

const barStart = (bar) => (bar - 1) * BAR;

// ---------------------------------------------------------------- utilities

const TWO_PI = Math.PI * 2;

let prngState = 0x9e3779b9;
const random = () => {
  // xorshift32 — deterministic noise
  prngState ^= prngState << 13;
  prngState ^= prngState >>> 17;
  prngState ^= prngState << 5;
  prngState >>>= 0;
  return prngState / 0xffffffff - 0.5;
};

const track = () => new Float64Array(N);

const lpCoeff = (fc) => 1 - Math.exp((-TWO_PI * fc) / SR);

const lowpass = (buffer, fc) => {
  const a = lpCoeff(fc);
  let y = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    y += a * (buffer[i] - y);
    buffer[i] = y;
  }
};

const highpass = (buffer, fc) => {
  const a = lpCoeff(fc);
  let y = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    y += a * (buffer[i] - y);
    buffer[i] -= y;
  }
};

/** Piecewise-linear automation: points = [[timeSec, value], …]. */
const automation = (points) => (t) => {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [t0, v0] = points[i - 1];
    const [t1, v1] = points[i];
    if (t <= t1) {
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
};

const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5));

// ------------------------------------------------------------------- chords

const A1 = 55,
  F1 = 43.65,
  C2 = 65.41,
  G1 = 49.0;
const CHORDS = {
  Am9: [220.0, 261.63, 329.63, 493.88],
  Fmaj7: [174.61, 220.0, 261.63, 329.63],
  Cmaj7: [130.81, 196.0, 246.94, 329.63],
  G6: [196.0, 246.94, 293.66, 392.0],
};
// One chord per bar, resolving back to Am for the drop and the outro.
const BAR_CHORDS = [
  "Am9",
  "Fmaj7",
  "Cmaj7",
  "G6",
  "Am9",
  "Fmaj7",
  "Cmaj7",
  "G6",
  "Am9",
  "Fmaj7",
  "Cmaj7",
  "G6",
  "Am9",
  "Am9",
];
const BAR_ROOTS = [A1, F1, C2, G1, A1, F1, C2, G1, A1, F1, C2, G1, A1, A1];

// -------------------------------------------------------------------- drums

const kickTimes = [];
for (let bar = 3; bar <= 9; bar += 1) {
  for (let beat = 0; beat < 4; beat += 1) {
    kickTimes.push(barStart(bar) + beat * BEAT);
  }
}
// bar-9 fill: eighth-note roll over the last two beats
kickTimes.push(
  barStart(9) + 2.25,
  barStart(9) + 2.75,
  barStart(9) + 3.25,
  barStart(9) + 3.75,
);
for (let bar = 12; bar <= 13; bar += 1) {
  for (let beat = 0; beat < 4; beat += 1) {
    kickTimes.push(barStart(bar) + beat * BEAT);
  }
}
kickTimes.sort((a, b) => a - b);

const renderKick = (buffer) => {
  for (const t0 of kickTimes) {
    const start = Math.floor(t0 * SR);
    const len = Math.floor(0.34 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      // pitch envelope 150 → 46 Hz
      const phase = 46 * t + 104 * 0.028 * (1 - Math.exp(-t / 0.028));
      const body = Math.sin(TWO_PI * phase) * Math.exp(-t / 0.22);
      const click = random() * Math.exp(-t / 0.0035) * 0.7;
      buffer[start + i] += body + click;
    }
  }
};

const clapTimes = [];
for (let bar = 4; bar <= 13; bar += 1) {
  clapTimes.push(barStart(bar) + BEAT, barStart(bar) + 3 * BEAT);
}

const renderClap = (buffer) => {
  for (const t0 of clapTimes) {
    const start = Math.floor(t0 * SR);
    const len = Math.floor(0.28 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      const burst = (x) => (x >= 0 && x < 0.012 ? Math.exp(-x / 0.004) : 0);
      const amp =
        (burst(t) + burst(t - 0.011) + burst(t - 0.023)) * 0.6 +
        Math.exp(-t / 0.085) * 0.45;
      buffer[start + i] += random() * amp * 2;
    }
  }
  highpass(buffer, 900);
  lowpass(buffer, 5200);
};

const hatEvents = []; // {t, open, gain}
for (let bar = 2; bar <= 13; bar += 1) {
  const openBars = bar >= 6;
  for (let eighth = 0; eighth < 8; eighth += 1) {
    const t = barStart(bar) + eighth * 0.25;
    const offbeat = eighth % 2 === 1;
    if (offbeat && openBars) {
      hatEvents.push({ t, open: true, gain: 1 });
    } else {
      hatEvents.push({ t, open: false, gain: offbeat ? 1 : 0.55 });
    }
  }
}

const renderHats = (buffer) => {
  for (const { t: t0, open, gain } of hatEvents) {
    const start = Math.floor(t0 * SR);
    const decay = open ? 0.16 : 0.038;
    const len = Math.floor(decay * 6 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      buffer[start + i] += random() * Math.exp(-t / decay) * gain;
    }
  }
  highpass(buffer, 7000);
};

const crashEvents = [
  { t: 0.0, gain: 0.4 },
  { t: 4.0, gain: 0.55 },
  { t: 10.0, gain: 0.55 },
  { t: 14.0, gain: 0.5 },
  { t: 18.0, gain: 0.5 },
  { t: 22.0, gain: 1 },
  { t: 26.0, gain: 0.45 },
];

const renderCrash = (buffer) => {
  for (const { t: t0, gain } of crashEvents) {
    const start = Math.floor(t0 * SR);
    const len = Math.floor(1.8 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      const amp = Math.exp(-t / 0.55) * (1 + 0.4 * Math.exp(-t / 0.015));
      buffer[start + i] += random() * amp * gain;
    }
  }
  highpass(buffer, 4200);
};

// --------------------------------------------------------------------- bass

const renderBass = (buffer) => {
  for (let bar = 3; bar <= 13; bar += 1) {
    const root = BAR_ROOTS[bar - 1];
    for (let eighth = 0; eighth < 8; eighth += 1) {
      const t0 = barStart(bar) + eighth * 0.25;
      const octaveUp = bar >= 12 && eighth % 2 === 1; // drop bounce
      const f = root * (octaveUp ? 2 : 1);
      const start = Math.floor(t0 * SR);
      const len = Math.floor(0.23 * SR);
      for (let i = 0; i < len && start + i < N; i += 1) {
        const t = i / SR;
        const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.14);
        buffer[start + i] +=
          (Math.sin(TWO_PI * f * t) * 0.85 + saw(2 * f * t) * 0.3) * env;
      }
    }
  }
  lowpass(buffer, 2100);
};

// -------------------------------------------------------------------- pluck

const pluckEvents = []; // {t, f, gain}
const ARP_ORDER = [0, 2, 1, 3, 0, 2, 1, 3];
const ARP_OCTAVE = [1, 1, 2, 1, 1, 2, 1, 2];

const arpGain = automation([
  [0, 0.85],
  [4, 0.55],
  [10, 0.75],
  [14, 0.8],
  [18, 0.45],
  [21.9, 0.45],
  [22, 1],
  [26, 0.6],
  [28.5, 0.25],
]);

for (let bar = 1; bar <= 14; bar += 1) {
  const tones = CHORDS[BAR_CHORDS[bar - 1]];
  const sixteenths = bar === 12 || bar === 13; // drop doubles the rate
  const steps = sixteenths ? 16 : 8;
  const step = BAR / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = barStart(bar) + i * step;
    if (bar === 14 && i % 2 === 1) continue; // sparser outro
    const idx = i % ARP_ORDER.length;
    pluckEvents.push({
      t,
      f: tones[ARP_ORDER[idx]] * ARP_OCTAVE[idx],
      gain: arpGain(t),
    });
  }
}

const renderPluck = (buffer) => {
  for (const { t: t0, f, gain } of pluckEvents) {
    const start = Math.floor(t0 * SR);
    const len = Math.floor(0.4 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      const env = Math.min(1, t / 0.002) * Math.exp(-t * 9);
      buffer[start + i] +=
        (saw(f * t) * 0.45 +
          Math.sin(TWO_PI * f * t) * 0.35 +
          Math.sin(TWO_PI * 2 * f * t) * 0.3) *
        env *
        gain;
    }
  }
  lowpass(buffer, 4300);
  // dotted-eighth echo
  const delay = Math.floor(0.375 * SR);
  for (let i = N - 1; i >= delay; i -= 1) {
    buffer[i] += buffer[i - delay] * 0.26;
  }
};

// ---------------------------------------------------------------------- pad

const padCutoff = automation([
  [0, 700],
  [2, 1000],
  [4, 1400],
  [10, 1800],
  [14, 2100],
  [18, 700],
  [21.9, 750],
  [22, 2600],
  [26, 1400],
  [29, 450],
]);
const padGain = automation([
  [0, 0.0],
  [1.2, 0.9],
  [4, 0.7],
  [14, 0.75],
  [18, 0.55],
  [21.9, 0.5],
  [22, 1],
  [26, 0.85],
  [28.6, 0.15],
]);

const renderPad = (buffer) => {
  const segments = [];
  for (let bar = 1; bar <= 13; bar += 1) {
    segments.push({ start: barStart(bar), end: barStart(bar + 1), bar });
  }
  segments.push({ start: barStart(14), end: 29, bar: 14 });

  for (const { start: s0, end: s1, bar } of segments) {
    const tones = CHORDS[BAR_CHORDS[bar - 1]];
    const startSample = Math.floor(s0 * SR);
    const endSample = Math.min(N, Math.floor((s1 + 0.5) * SR)); // 0.5s release
    const segLen = s1 - s0;
    for (const f of tones) {
      for (const detune of [0.9965, 1, 1.0035]) {
        const fd = f * detune;
        const phase0 = random() * 10; // deterministic per-voice phase offset
        for (let i = startSample; i < endSample; i += 1) {
          const t = i / SR - s0;
          const env =
            Math.min(1, t / 0.35) *
            (t < segLen ? 1 : Math.max(0, 1 - (t - segLen) / 0.5));
          buffer[i] += saw(fd * t + phase0) * env * 0.16;
        }
      }
    }
  }

  // time-varying one-pole lowpass
  let y = 0;
  for (let i = 0; i < N; i += 1) {
    const t = i / SR;
    const a = lpCoeff(padCutoff(t));
    y += a * (buffer[i] - y);
    buffer[i] = y * padGain(t);
  }
};

// ------------------------------------------------------------------ effects

const renderRiser = (buffer) => {
  const s0 = 20,
    s1 = 22;
  let y = 0;
  for (let i = Math.floor(s0 * SR); i < Math.floor(s1 * SR); i += 1) {
    const t = i / SR;
    const progress = (t - s0) / (s1 - s0);
    const a = lpCoeff(250 + progress * 5200);
    const x = random();
    y += a * (x - y);
    buffer[i] += (x - y) * progress ** 1.6 * 1.1;
  }
};

const renderDownlifter = (buffer) => {
  const s0 = 26;
  for (let i = Math.floor(s0 * SR); i < Math.floor(28.2 * SR); i += 1) {
    const t = i / SR - s0;
    const f = 60 + 480 * Math.exp(-t * 1.6);
    const env = Math.exp(-t / 0.9);
    buffer[i] += Math.sin(TWO_PI * f * t) * env * 0.3 + random() * env * 0.12;
  }
};

const renderSubBoom = (buffer) => {
  const start = Math.floor(22 * SR);
  for (let i = 0; i < Math.floor(0.9 * SR) && start + i < N; i += 1) {
    const t = i / SR;
    buffer[start + i] +=
      Math.sin(TWO_PI * (40 + 30 * Math.exp(-t / 0.05)) * t) *
      Math.exp(-t / 0.35);
  }
};

// ----------------------------------------------------------------- sidechain

const buildDuck = () => {
  const duck = new Float64Array(N).fill(1);
  const depth = 0.55;
  for (const k of kickTimes) {
    const start = Math.floor(k * SR);
    const len = Math.floor(0.4 * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      const t = i / SR;
      const factor = 1 - depth * Math.exp(-t / 0.115);
      if (factor < duck[start + i]) duck[start + i] = factor;
    }
  }
  return duck;
};

// ---------------------------------------------------------------------- mix

console.log("Rendering tracks…");
const kick = track();
renderKick(kick);
const clap = track();
renderClap(clap);
const hats = track();
renderHats(hats);
const crash = track();
renderCrash(crash);
const bass = track();
renderBass(bass);
const pluck = track();
renderPluck(pluck);
const pad = track();
renderPad(pad);
const fx = track();
renderRiser(fx);
renderDownlifter(fx);
renderSubBoom(fx);

const duck = buildDuck();

const GAINS = {
  kick: 0.95,
  clap: 0.4,
  hats: 0.16,
  crash: 0.22,
  bass: 0.5,
  pluck: 0.34,
  pad: 0.42,
  fx: 0.5,
};

const masterGain = automation([
  [0, 0],
  [0.03, 1],
  [27.8, 1],
  [29.0, 0],
  [30, 0],
]);

const left = new Float64Array(N);
const right = new Float64Array(N);
const haasPad = Math.floor(0.007 * SR);
const haasPluck = Math.floor(0.005 * SR);

for (let i = 0; i < N; i += 1) {
  const ducked =
    bass[i] * GAINS.bass * duck[i] +
    pad[i] * GAINS.pad * duck[i] +
    pluck[i] * GAINS.pluck * duck[i] ** 0.6;
  const center = kick[i] * GAINS.kick + clap[i] * GAINS.clap + fx[i] * GAINS.fx;

  const padL = i >= haasPad ? pad[i - haasPad] : 0;
  const pluckR = i >= haasPluck ? pluck[i - haasPluck] : 0;

  left[i] =
    center +
    ducked +
    hats[i] * GAINS.hats * 0.8 +
    crash[i] * GAINS.crash +
    (padL - pad[i]) * GAINS.pad * duck[i] * 0.5;
  right[i] =
    center +
    ducked +
    hats[i] * GAINS.hats * 1.1 +
    crash[i] * GAINS.crash * 0.9 +
    (pluckR - pluck[i]) * GAINS.pluck * 0.5;
}

// soft clip + normalize + master fade
let peak = 0;
for (let i = 0; i < N; i += 1) {
  left[i] = Math.tanh(left[i] * 1.15);
  right[i] = Math.tanh(right[i] * 1.15);
  const g = masterGain(i / SR);
  left[i] *= g;
  right[i] *= g;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const norm = 0.93 / peak;

// ---------------------------------------------------------------- WAV write

const bytesPerSample = 2;
const dataSize = N * 2 * bytesPerSample;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(2, 22); // stereo
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 2 * bytesPerSample, 28);
wav.writeUInt16LE(2 * bytesPerSample, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);

for (let i = 0; i < N; i += 1) {
  const l = Math.max(-1, Math.min(1, left[i] * norm));
  const r = Math.max(-1, Math.min(1, right[i] * norm));
  wav.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
}

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "public", "music.wav");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, wav);

// section RMS report so the arrangement can be sanity-checked without ears
const rms = (from, to) => {
  let sum = 0;
  const a = Math.floor(from * SR);
  const b = Math.floor(to * SR);
  for (let i = a; i < b; i += 1) {
    const v = (left[i] + right[i]) * 0.5 * norm;
    sum += v * v;
  }
  return Math.sqrt(sum / (b - a));
};
console.log(
  `Wrote ${outPath} (${(wav.length / 1e6).toFixed(1)} MB, peak norm ×${norm.toFixed(2)})`,
);
for (const [label, a, b] of [
  ["hook   0–4s", 0, 4],
  ["paths  4–10s", 4, 10],
  ["glass 10–14s", 10, 14],
  ["input 14–18s", 14, 18],
  ["install 18–22s", 18, 22],
  ["landing 22–26s", 22, 26],
  ["outro 26–29s", 26, 29],
]) {
  console.log(`  RMS ${label}: ${rms(a, b).toFixed(3)}`);
}
