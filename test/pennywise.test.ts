import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, Money, sum } from "../src/pennywise.js";

describe("construction & exactness", () => {
  it("avoids floating-point error (the 0.1 + 0.2 problem)", () => {
    const result = Money.of("0.1", "USD").add(Money.of("0.2", "USD"));
    expect(result.toDecimalString()).toBe("0.30");
    expect(result.amount).toBe(30n);
  });

  it("parses decimals and whole numbers", () => {
    expect(Money.of("19.99", "USD").amount).toBe(1999n);
    expect(Money.of(5, "USD").toDecimalString()).toBe("5.00");
    expect(Money.of("1000", "JPY").amount).toBe(1000n); // 0 decimals
    expect(Money.of("1.234", "BHD").amount).toBe(1234n); // 3 decimals
  });

  it("creates from minor units", () => {
    expect(Money.ofMinor(1999, "USD").toDecimalString()).toBe("19.99");
    expect(Money.ofMinor("100000000000000000000", "USD").toDecimalString()).toBe(
      "1000000000000000000.00",
    );
  });

  it("rounds inputs that exceed the currency scale", () => {
    expect(Money.of("1.005", "USD").toDecimalString()).toBe("1.00"); // half-even → even
    expect(Money.of("1.015", "USD").toDecimalString()).toBe("1.02"); // half-even → even
    expect(Money.of("1.005", "USD", { round: "half-up" }).toDecimalString()).toBe("1.01");
    expect(Money.of("1.999", "USD", { round: "down" }).toDecimalString()).toBe("1.99");
  });

  it("rejects exponential-notation numbers and bad input", () => {
    expect(() => Money.of(1e-7, "USD")).toThrow(TypeError);
    expect(() => Money.of("abc", "USD")).toThrow(TypeError);
    expect(() => Money.ofMinor(1.5, "USD")).toThrow(TypeError);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(Money.of("10.00", "USD").subtract(Money.of("3.33", "USD")).toDecimalString()).toBe("6.67");
  });

  it("multiplies by counts and rates", () => {
    expect(Money.of("1.99", "USD").multiply(3).toDecimalString()).toBe("5.97");
    expect(Money.of("100", "USD").multiply("1.0825").toDecimalString()).toBe("108.25");
    expect(Money.of("100", "USD").multiply(7n).toDecimalString()).toBe("700.00");
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.of("1", "USD").add(Money.of("1", "EUR"))).toThrow(CurrencyMismatchError);
  });

  it("sums a list", () => {
    const total = sum([Money.of("1.10", "USD"), Money.of("2.20", "USD"), Money.of("3.30", "USD")]);
    expect(total.toDecimalString()).toBe("6.60");
  });
});

describe("allocate & split (the no-lost-penny guarantee)", () => {
  it("distributes a leftover cent fairly", () => {
    const parts = Money.of("0.05", "USD").allocate([1, 1, 1]);
    expect(parts.map((p) => p.toDecimalString())).toEqual(["0.02", "0.02", "0.01"]);
  });

  it("always sums back to the original (fuzz over many values)", () => {
    const ratios = [3, 5, 1, 7, 2];
    for (let cents = 0; cents <= 500; cents++) {
      const money = Money.ofMinor(cents, "USD");
      const parts = money.allocate(ratios);
      const back = parts.reduce((a, b) => a + b.amount, 0n);
      expect(back).toBe(money.amount);
    }
  });

  it("splits evenly and conserves the total", () => {
    const parts = Money.of("10.00", "USD").split(3);
    expect(parts.map((p) => p.toDecimalString())).toEqual(["3.34", "3.33", "3.33"]);
    expect(sum(parts).toDecimalString()).toBe("10.00");
  });

  it("handles negative amounts", () => {
    const parts = Money.of("-0.05", "USD").allocate([1, 1, 1]);
    expect(sum(parts).toDecimalString()).toBe("-0.05");
  });

  it("supports fractional/decimal ratios", () => {
    const parts = Money.of("100.00", "USD").allocate([0.25, 0.75]);
    expect(parts.map((p) => p.toDecimalString())).toEqual(["25.00", "75.00"]);
    expect(sum(parts).toDecimalString()).toBe("100.00");
  });

  it("rejects ratios that sum to zero", () => {
    expect(() => Money.of("1", "USD").allocate([0, 0])).toThrow(RangeError);
  });
});

describe("comparison", () => {
  it("compares values", () => {
    const a = Money.of("5.00", "USD");
    const b = Money.of("7.50", "USD");
    expect(a.lessThan(b)).toBe(true);
    expect(b.greaterThan(a)).toBe(true);
    expect(a.equals(Money.of("5", "USD"))).toBe(true);
    expect(a.compare(b)).toBe(-1);
  });

  it("reports sign", () => {
    expect(Money.of("0", "USD").isZero()).toBe(true);
    expect(Money.of("-1", "USD").isNegative()).toBe(true);
    expect(Money.of("1", "USD").isPositive()).toBe(true);
  });
});

describe("formatting & serialization", () => {
  it("formats with Intl", () => {
    expect(Money.of("1234.5", "USD").format("en-US")).toBe("$1,234.50");
    expect(Money.of("1000", "JPY").format("en-US")).toBe("¥1,000");
  });

  it("round-trips through JSON", () => {
    const money = Money.of("19.99", "USD");
    const json = JSON.parse(JSON.stringify(money));
    expect(Money.fromJSON(json).equals(money)).toBe(true);
  });

  it("has a readable toString", () => {
    expect(Money.of("19.99", "USD").toString()).toBe("19.99 USD");
  });
});

describe("divide", () => {
  it("divides by an integer with banker's rounding", () => {
    expect(Money.of("100", "USD").divide(3).toDecimalString()).toBe("33.33");
    expect(Money.of("10", "USD").divide(4).toDecimalString()).toBe("2.50");
  });

  it("divides by a decimal divisor", () => {
    expect(Money.of("100", "USD").divide("2.5").toDecimalString()).toBe("40.00");
  });

  it("works for zero-decimal currencies", () => {
    expect(Money.of("1000", "JPY").divide(3).toDecimalString()).toBe("333");
  });

  it("throws on division by zero", () => {
    expect(() => Money.of("1", "USD").divide(0)).toThrow(/division by zero/);
    expect(() => Money.of("1", "USD").divide(0n)).toThrow(/division by zero/);
  });
});

describe("percentage", () => {
  it("takes a percentage of an amount", () => {
    expect(Money.of("80", "USD").percentage(8.25).toDecimalString()).toBe("6.60");
    expect(Money.of("200", "USD").percentage("10").toDecimalString()).toBe("20.00");
    expect(Money.of("50", "USD").percentage(0).toDecimalString()).toBe("0.00");
  });

  it("adds and subtracts a percentage (tip / discount)", () => {
    expect(Money.of("80", "USD").addPercentage(20).toDecimalString()).toBe("96.00");
    expect(Money.of("100", "USD").subtractPercentage(15).toDecimalString()).toBe("85.00");
  });

  it("handles fractional percentages exactly", () => {
    expect(Money.of("1000", "USD").percentage("2.5").toDecimalString()).toBe("25.00");
  });
});

describe("min / max / clamp", () => {
  const a = Money.of("3", "USD");
  const b = Money.of("5", "USD");
  it("picks the smaller / larger", () => {
    expect(a.min(b).equals(a)).toBe(true);
    expect(a.max(b).equals(b)).toBe(true);
  });
  it("clamps into a range", () => {
    expect(Money.of("12", "USD").clamp(a, Money.of("10", "USD")).toDecimalString()).toBe("10.00");
    expect(Money.of("1", "USD").clamp(a, b).toDecimalString()).toBe("3.00");
    expect(Money.of("4", "USD").clamp(a, b).toDecimalString()).toBe("4.00");
  });
  it("rejects cross-currency comparison", () => {
    expect(() => a.min(Money.of("1", "EUR"))).toThrow(CurrencyMismatchError);
  });
});
