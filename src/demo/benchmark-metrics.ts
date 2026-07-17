export interface TrendSample {
  elapsed: number;
  fps: number;
}

export class FixedRing<T> {
  readonly capacity: number;
  private readonly values: Array<T | undefined>;
  private next = 0;
  private count = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.values = new Array<T | undefined>(this.capacity);
  }

  get size() {
    return this.count;
  }

  push(value: T) {
    this.values[this.next] = value;
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  clear() {
    this.values.fill(undefined);
    this.next = 0;
    this.count = 0;
  }

  toArray(): T[] {
    const result = new Array<T>(this.count);
    const start = (this.next - this.count + this.capacity) % this.capacity;
    for (let index = 0; index < this.count; index++) {
      result[index] = this.values[(start + index) % this.capacity]!;
    }
    return result;
  }
}

export function percentileSorted(
  sortedValues: readonly number[],
  amount: number,
) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor(amount * sortedValues.length)),
  );
  return sortedValues[index]!;
}

export function average(values: readonly number[]) {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

/** Least-squares FPS change normalized as percent per minute. */
export function performanceTrendPercentPerMinute(
  samples: readonly TrendSample[],
) {
  if (samples.length < 10) return 0;
  const firstElapsed = samples[0]!.elapsed;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const sample of samples) {
    const x = sample.elapsed - firstElapsed;
    sumX += x;
    sumY += sample.fps;
    sumXX += x * x;
    sumXY += x * sample.fps;
  }
  const count = samples.length;
  const denominator = count * sumXX - sumX * sumX;
  const averageFps = sumY / count;
  if (Math.abs(denominator) < 1e-9 || averageFps <= 0) return 0;
  const fpsPerSecond = (count * sumXY - sumX * sumY) / denominator;
  return (fpsPerSecond * 60 * 100) / averageFps;
}
