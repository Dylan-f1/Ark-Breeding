// Numeric helpers reproducing the C# semantics ASB relies on.

/** C# `Math.Round(x)`: midpoints go to the nearest even integer (banker's rounding). */
export function roundHalfEven(x: number): number {
  if (Math.abs(x % 1) === 0.5) return 2 * Math.round(x / 2);
  return Math.round(x);
}

/** C# `Math.Round(x, digits, MidpointRounding.AwayFromZero)`. */
export function roundAwayFromZero(x: number, digits: number): number {
  const f = 10 ** digits;
  return (Math.sign(x) * Math.round(Math.abs(x) * f)) / f;
}

/** C# `Math.Round(x, digits)` (midpoints to even). */
export function roundToEven(x: number, digits: number): number {
  const f = 10 ** digits;
  return roundHalfEven(x * f) / f;
}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** Distance to the next representable float32 (ASB ExtensionMethods.FloatPrecision). */
export function floatPrecision(x: number): number {
  if (Number.isNaN(x)) return x;
  if (x === 0) {
    u32[0] = 1;
    return f32[0]!;
  }
  f32[0] = x;
  const value = f32[0]!;
  u32[0] = u32[0]! + 1;
  return Math.fround(f32[0]! - value);
}

/** Mutable range of doubles (ASB MinMaxDouble). */
export class Range {
  constructor(
    public min: number,
    public max: number = min,
  ) {}

  static of(r: Range): Range {
    return new Range(r.min, r.max);
  }

  get mean(): number {
    return (this.min + this.max) / 2;
  }

  set exact(value: number) {
    this.min = value;
    this.max = value;
  }

  get valid(): boolean {
    return this.min <= this.max;
  }

  includes(value: number): boolean {
    return this.max >= value && this.min <= value;
  }

  includesRange(r: Range): boolean {
    return this.max >= r.max && this.min <= r.min;
  }

  overlaps(r: Range): boolean {
    return this.max >= r.min && this.min <= r.max;
  }

  /** Narrows to the intersection; returns false (unchanged) when there is no overlap. */
  intersect(r: Range): boolean {
    if (!this.overlaps(r)) return false;
    this.min = Math.max(this.min, r.min);
    this.max = Math.min(this.max, r.max);
    return true;
  }

  times(f: number): Range {
    return new Range(this.min * f, this.max * f);
  }
}

/** Integer range (ASB MinMaxInt). `fromDoubles` mirrors the (double, double) constructor: ceil(min), floor(max). */
export class IntRange {
  constructor(
    public min: number,
    public max: number,
  ) {}

  static fromDoubles(min: number, max: number): IntRange {
    return new IntRange(Math.ceil(min), Math.floor(max));
  }

  get mean(): number {
    return (this.min + this.max) / 2;
  }

  get valid(): boolean {
    return this.min <= this.max;
  }

  includes(value: number): boolean {
    return this.max >= value && this.min <= value;
  }

  intersect(min: number, max: number): boolean {
    if (!(this.max >= min && this.min <= max)) return false;
    this.min = Math.trunc(Math.max(this.min, min));
    this.max = Math.trunc(Math.min(this.max, max));
    return true;
  }
}
