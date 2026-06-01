/**
 * pennywise — exact, dependency-free money math for JavaScript & TypeScript.
 *
 * Floating point can't represent money: `0.1 + 0.2 === 0.30000000000000004`.
 * pennywise stores every amount as a `BigInt` count of minor units (cents,
 * pence, …), so addition, subtraction and multiplication are exact, and
 * splitting a bill never loses or invents a cent.
 */

/** Rounding strategy used when an operation can't land on an exact minor unit. */
export type RoundingMode =
  | "half-even" // banker's rounding (default) — ties go to the nearest even unit
  | "half-up" // ties round away from zero
  | "half-down" // ties round toward zero
  | "up" // always away from zero
  | "down" // always toward zero (truncate)
  | "ceil" // toward +∞
  | "floor"; // toward −∞

/** ISO 4217 currencies whose minor-unit exponent isn't the default of 2. */
const CURRENCY_SCALE: Record<string, number> = {
  JPY: 0, KRW: 0, VND: 0, CLP: 0, ISK: 0, XOF: 0, XAF: 0, XPF: 0,
  UGX: 0, RWF: 0, GNF: 0, PYG: 0, DJF: 0, KMF: 0, BIF: 0, VUV: 0,
  BHD: 3, KWD: 3, OMR: 3, TND: 3, JOD: 3, LYD: 3, IQD: 3,
};

/** Default number of decimal places for a currency code. */
export function scaleFor(currency: string): number {
  return CURRENCY_SCALE[currency.toUpperCase()] ?? 2;
}

/** Thrown when an operation mixes two different currencies. */
export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Cannot operate on different currencies: ${a} and ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** Divide `num / den` (den > 0) and round the result to a whole number. */
function roundDiv(num: bigint, den: bigint, mode: RoundingMode): bigint {
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const q = num / den; // truncates toward zero
  const r = num % den; // same sign as num
  if (r === 0n) return q;

  const neg = num < 0n;
  const awayFromZero = neg ? q - 1n : q + 1n;
  const absR2 = (r < 0n ? -r : r) * 2n;

  switch (mode) {
    case "down":
      return q;
    case "up":
      return awayFromZero;
    case "floor":
      return neg ? q - 1n : q;
    case "ceil":
      return neg ? q : q + 1n;
    case "half-up":
      return absR2 >= den ? awayFromZero : q;
    case "half-down":
      return absR2 > den ? awayFromZero : q;
    case "half-even":
      if (absR2 > den) return awayFromZero;
      if (absR2 < den) return q;
      return q % 2n === 0n ? q : awayFromZero; // tie → nearest even
    default:
      throw new RangeError(`pennywise: unknown rounding mode "${mode as string}"`);
  }
}

function parseDecimalToMinor(input: string, scale: number, mode: RoundingMode): bigint {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) {
    throw new TypeError(`pennywise: "${input}" is not a valid decimal amount`);
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const intPart = match[2] as string;
  const frac = match[3] ?? "";
  const digits = BigInt(intPart + frac);
  const num = digits * pow10(scale);
  const den = pow10(frac.length);
  const minor = den === 1n ? num : roundDiv(num, den, mode);
  return sign * minor;
}

function numberToDecimalString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError(`pennywise: ${value} is not a finite number`);
  }
  const str = String(value);
  if (/e/i.test(str)) {
    throw new TypeError(
      `pennywise: ${value} uses exponential notation; pass the amount as a string for exact precision`,
    );
  }
  return str;
}

function toWeights(ratios: ReadonlyArray<number | bigint | string>): bigint[] {
  if (ratios.length === 0) throw new RangeError("pennywise: allocate requires at least one ratio");
  let maxFrac = 0;
  const parsed = ratios.map((r) => {
    const str =
      typeof r === "bigint" ? r.toString() : typeof r === "number" ? numberToDecimalString(r) : r.trim();
    const m = /^(\d+)(?:\.(\d+))?$/.exec(str.trim());
    if (!m) throw new TypeError(`pennywise: ratio "${str}" must be a non-negative number`);
    const frac = m[2] ?? "";
    if (frac.length > maxFrac) maxFrac = frac.length;
    return { int: m[1] as string, frac };
  });
  return parsed.map(({ int, frac }) => BigInt(int + frac.padEnd(maxFrac, "0")));
}

/** Turn a percentage (e.g. `8.25` or `"8.25"`) into a decimal rate string ("0.0825"). */
function toRate(percent: number | string | bigint, per: "100"): string {
  const decimal =
    typeof percent === "bigint"
      ? percent.toString()
      : typeof percent === "number"
        ? numberToDecimalString(percent)
        : percent.trim();
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimal);
  if (!m) throw new TypeError(`pennywise: "${decimal}" is not a valid percentage`);
  const sign = m[1] === "-" ? "-" : "";
  const digits = (m[2] as string) + (m[3] ?? "");
  const fracLen = (m[3] ?? "").length + per.length - 1; // /100 shifts the point 2 places
  const padded = digits.padStart(fracLen + 1, "0");
  const cut = padded.length - fracLen;
  const intPart = padded.slice(0, cut) || "0";
  const fracPart = padded.slice(cut);
  return fracPart ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
}

export interface MoneyOptions {
  /** Override the currency's default number of decimal places. */
  scale?: number;
  /** Rounding mode for inputs that exceed `scale`. Default: `"half-even"`. */
  round?: RoundingMode;
}

/** Serialized form produced by {@link Money.toJSON}. */
export interface MoneyJSON {
  amount: string; // minor units, as a string (BigInt is not JSON-safe)
  currency: string;
  scale: number;
}

/**
 * An immutable monetary value: a `BigInt` amount of minor units, a currency
 * code, and a scale (decimal places). Every method returns a new `Money`.
 */
export class Money {
  /** Amount in minor units (e.g. cents). Exact. */
  readonly amount: bigint;
  /** ISO 4217-style currency code, upper-cased. */
  readonly currency: string;
  /** Number of decimal places this value is tracked at. */
  readonly scale: number;

  constructor(minorUnits: bigint, currency: string, scale: number) {
    this.amount = minorUnits;
    this.currency = currency.toUpperCase();
    this.scale = scale;
    Object.freeze(this);
  }

  /**
   * Create money from a human decimal amount.
   *
   * ```ts
   * Money.of("19.99", "USD");  // $19.99
   * Money.of(5, "USD");        // $5.00
   * Money.of("1000", "JPY");   // ¥1000 (0 decimal places)
   * ```
   */
  static of(amount: string | number, currency: string, options: MoneyOptions = {}): Money {
    const scale = options.scale ?? scaleFor(currency);
    const round = options.round ?? "half-even";
    const decimal = typeof amount === "number" ? numberToDecimalString(amount) : amount;
    return new Money(parseDecimalToMinor(decimal, scale, round), currency, scale);
  }

  /**
   * Create money directly from minor units.
   *
   * ```ts
   * Money.ofMinor(1999, "USD"); // $19.99
   * ```
   */
  static ofMinor(minorUnits: bigint | number | string, currency: string, options: MoneyOptions = {}): Money {
    const scale = options.scale ?? scaleFor(currency);
    const minor =
      typeof minorUnits === "bigint"
        ? minorUnits
        : typeof minorUnits === "string"
          ? BigInt(minorUnits)
          : (Number.isInteger(minorUnits)
              ? BigInt(minorUnits)
              : (() => {
                  throw new TypeError(`pennywise: minor units must be an integer, got ${minorUnits}`);
                })());
    return new Money(minor, currency, scale);
  }

  /** Reconstruct a Money from {@link toJSON} output. */
  static fromJSON(json: MoneyJSON): Money {
    return new Money(BigInt(json.amount), json.currency, json.scale);
  }

  private sameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  private rescaledAmount(newScale: number): bigint {
    return this.amount * pow10(newScale - this.scale);
  }

  /** Align two amounts to a common (larger) scale. */
  private align(other: Money): [bigint, bigint, number] {
    this.sameCurrency(other);
    if (this.scale === other.scale) return [this.amount, other.amount, this.scale];
    const scale = Math.max(this.scale, other.scale);
    return [this.rescaledAmount(scale), other.rescaledAmount(scale), scale];
  }

  add(other: Money): Money {
    const [a, b, scale] = this.align(other);
    return new Money(a + b, this.currency, scale);
  }

  subtract(other: Money): Money {
    const [a, b, scale] = this.align(other);
    return new Money(a - b, this.currency, scale);
  }

  /**
   * Multiply by a scalar (a count, a rate like `0.0825`, …), rounding the
   * result back to this value's scale.
   *
   * ```ts
   * Money.of("100", "USD").multiply("1.0825"); // $108.25
   * ```
   */
  multiply(factor: number | string | bigint, options: { round?: RoundingMode } = {}): Money {
    const round = options.round ?? "half-even";
    if (typeof factor === "bigint") {
      return new Money(this.amount * factor, this.currency, this.scale);
    }
    const decimal = typeof factor === "number" ? numberToDecimalString(factor) : factor;
    const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
    if (!m) throw new TypeError(`pennywise: "${decimal}" is not a valid factor`);
    const sign = m[1] === "-" ? -1n : 1n;
    const frac = m[3] ?? "";
    const fNum = sign * BigInt((m[2] as string) + frac);
    const fDen = pow10(frac.length);
    return new Money(roundDiv(this.amount * fNum, fDen, round), this.currency, this.scale);
  }

  /**
   * Divide by a scalar divisor, rounding the result back to this value's scale.
   * Note: dividing money loses precision — to split a bill exactly without
   * losing a cent, use {@link split} or {@link allocate} instead.
   *
   * ```ts
   * Money.of("100", "USD").divide(3); // $33.33 (rounded; not exact thirds)
   * ```
   */
  divide(divisor: number | string | bigint, options: { round?: RoundingMode } = {}): Money {
    const round = options.round ?? "half-even";
    if (typeof divisor === "bigint") {
      if (divisor === 0n) throw new RangeError("pennywise: division by zero");
      return new Money(roundDiv(this.amount, divisor, round), this.currency, this.scale);
    }
    const decimal = typeof divisor === "number" ? numberToDecimalString(divisor) : divisor;
    const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
    if (!m) throw new TypeError(`pennywise: "${decimal}" is not a valid divisor`);
    const sign = m[1] === "-" ? -1n : 1n;
    const frac = m[3] ?? "";
    const dNum = sign * BigInt((m[2] as string) + frac);
    const dDen = pow10(frac.length);
    if (dNum === 0n) throw new RangeError("pennywise: division by zero");
    // amount / (dNum/dDen) = amount * dDen / dNum
    return new Money(roundDiv(this.amount * dDen, dNum, round), this.currency, this.scale);
  }

  /**
   * Take a percentage of this amount (tax, tip, discount, interest…).
   *
   * ```ts
   * Money.of("80", "USD").percentage(8.25);  // $6.60  (8.25% of $80)
   * Money.of("80", "USD").addPercentage(20); // $96.00 (add a 20% tip)
   * ```
   */
  percentage(percent: number | string | bigint, options: { round?: RoundingMode } = {}): Money {
    return this.multiply(toRate(percent, "100"), options);
  }

  /** This amount plus `percent`% of it (e.g. add tax/tip). */
  addPercentage(percent: number | string | bigint, options: { round?: RoundingMode } = {}): Money {
    return this.add(this.percentage(percent, options));
  }

  /** This amount minus `percent`% of it (e.g. apply a discount). */
  subtractPercentage(percent: number | string | bigint, options: { round?: RoundingMode } = {}): Money {
    return this.subtract(this.percentage(percent, options));
  }

  /** The smaller of this and `other` (currencies must match). */
  min(other: Money): Money {
    return this.lessThanOrEqual(other) ? this : other;
  }

  /** The larger of this and `other` (currencies must match). */
  max(other: Money): Money {
    return this.greaterThanOrEqual(other) ? this : other;
  }

  /** Clamp this amount into the inclusive `[low, high]` range. */
  clamp(low: Money, high: Money): Money {
    return this.min(high).max(low);
  }

  /**
   * Split this amount into parts proportional to `ratios`, distributing every
   * leftover minor unit so the parts **sum back exactly** to the original.
   *
   * ```ts
   * Money.of("0.05", "USD").allocate([1, 1, 1]);
   * // → [$0.02, $0.02, $0.01]  (sums to $0.05 — no penny lost)
   * ```
   */
  allocate(ratios: ReadonlyArray<number | bigint | string>): Money[] {
    const weights = toWeights(ratios);
    const sumW = weights.reduce((a, b) => a + b, 0n);
    if (sumW <= 0n) throw new RangeError("pennywise: ratios must sum to a positive value");

    const neg = this.amount < 0n;
    const total = neg ? -this.amount : this.amount;

    const bases: bigint[] = [];
    const remainders: bigint[] = [];
    let allocated = 0n;
    for (const w of weights) {
      const num = total * w;
      const base = num / sumW;
      bases.push(base);
      remainders.push(num - base * sumW);
      allocated += base;
    }

    let leftover = total - allocated; // in [0, weights.length)
    const order = weights
      .map((_, i) => i)
      .sort((a, b) => {
        const ra = remainders[a] as bigint;
        const rb = remainders[b] as bigint;
        if (rb !== ra) return rb > ra ? 1 : -1;
        return a - b; // stable: earlier index wins ties
      });
    for (let k = 0; k < order.length && leftover > 0n; k++) {
      const idx = order[k] as number;
      bases[idx] = (bases[idx] as bigint) + 1n;
      leftover -= 1n;
    }

    return bases.map((b) => new Money(neg ? -b : b, this.currency, this.scale));
  }

  /** Split into `parts` equal shares (remainder distributed across the first shares). */
  split(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new RangeError(`pennywise: split count must be a positive integer, got ${parts}`);
    }
    return this.allocate(new Array(parts).fill(1));
  }

  negate(): Money {
    return new Money(-this.amount, this.currency, this.scale);
  }

  absolute(): Money {
    return this.amount < 0n ? this.negate() : this;
  }

  /** -1, 0 or 1 — compares value (currencies must match). */
  compare(other: Money): -1 | 0 | 1 {
    const [a, b] = this.align(other);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.compare(other) === 0;
  }
  greaterThan(other: Money): boolean {
    return this.compare(other) === 1;
  }
  greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }
  lessThan(other: Money): boolean {
    return this.compare(other) === -1;
  }
  lessThanOrEqual(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  isZero(): boolean {
    return this.amount === 0n;
  }
  isPositive(): boolean {
    return this.amount > 0n;
  }
  isNegative(): boolean {
    return this.amount < 0n;
  }

  /** Exact decimal string, e.g. `"19.99"` (no currency, no float involved). */
  toDecimalString(): string {
    const neg = this.amount < 0n;
    const abs = neg ? -this.amount : this.amount;
    const factor = pow10(this.scale);
    const whole = (abs / factor).toString();
    const sign = neg ? "-" : "";
    if (this.scale === 0) return sign + whole;
    const frac = (abs % factor).toString().padStart(this.scale, "0");
    return `${sign}${whole}.${frac}`;
  }

  /**
   * Localized currency string via `Intl.NumberFormat`.
   *
   * ```ts
   * Money.of("1234.5", "USD").format("en-US"); // "$1,234.50"
   * Money.of("1234.5", "EUR").format("de-DE"); // "1.234,50 €"
   * ```
   */
  format(locale?: string | string[], options: Intl.NumberFormatOptions = {}): string {
    const value = Number(this.toDecimalString());
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
      ...options,
    }).format(value);
  }

  toJSON(): MoneyJSON {
    return { amount: this.amount.toString(), currency: this.currency, scale: this.scale };
  }

  toString(): string {
    return `${this.toDecimalString()} ${this.currency}`;
  }
}

/** Sum a list of Money (all the same currency). Returns `zero` for an empty list. */
export function sum(monies: readonly Money[], zero?: Money): Money {
  if (monies.length === 0) {
    if (zero) return zero;
    throw new RangeError("pennywise: sum of an empty list needs a `zero` fallback");
  }
  return monies.reduce((acc, m) => acc.add(m));
}
