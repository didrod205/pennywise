<div align="center">

# pennywise

**Exact money math for JavaScript — no floating-point errors, no lost cents. Zero dependencies, ~2 KB.**

[![npm version](https://img.shields.io/npm/v/pennywise.svg?color=success)](https://www.npmjs.com/package/pennywise)
[![bundle size](https://img.shields.io/bundlephobia/minzip/pennywise?label=gzip)](https://bundlephobia.com/package/pennywise)
[![CI](https://github.com/didrod205/pennywise/actions/workflows/ci.yml/badge.svg)](https://github.com/didrod205/pennywise/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/pennywise.svg)](https://www.npmjs.com/package/pennywise)
[![license](https://img.shields.io/npm/l/pennywise.svg)](./LICENSE)

</div>

You cannot store money in a `number`:

```js
0.1 + 0.2;            // 0.30000000000000004   ❌
19.99 * 3;            // 59.96999999999999      ❌
```

This isn't a bug you can prompt your way around — it's how binary floating point
works. **pennywise** stores every amount as a `BigInt` count of minor units
(cents, pence, yen…), so arithmetic is **exact**, and splitting a bill
**never loses or invents a cent**.

```ts
import { Money } from "pennywise";

Money.of("0.1", "USD").add(Money.of("0.2", "USD")).toDecimalString(); // "0.30" ✅
Money.of("19.99", "USD").multiply(3).format("en-US");                 // "$59.97" ✅

// Split $10 three ways — and get all of it back
Money.of("10.00", "USD").split(3).map(String);
// → ["3.34 USD", "3.33 USD", "3.33 USD"]   (sums to exactly $10.00)
```

---

## Why pennywise?

- 🎯 **Exact by construction.** `BigInt` minor units — no `0.1 + 0.2` surprises, ever.
- 🪙 **Never loses a cent.** `allocate`/`split` distribute every leftover unit deterministically; the parts always sum back to the original. (Proven by a fuzz test over hundreds of amounts.)
- 🌍 **Currency-aware.** Knows minor-unit scales (USD = 2, JPY = 0, BHD = 3…) and formats with the built-in `Intl.NumberFormat` — no locale data to ship.
- 🧮 **Real rounding modes.** Banker's rounding (half-even) by default, plus half-up/half-down/up/down/ceil/floor.
- 🔒 **Immutable & type-safe.** Every operation returns a new `Money`; full TypeScript types.
- 🪶 **~2 KB gzipped, zero dependencies.** Runs in Node 18+, Deno, Bun, Workers and the browser.

## Install

```bash
npm install pennywise
# or: pnpm add pennywise  /  yarn add pennywise  /  bun add pennywise
```

Ships ESM **and** CommonJS:

```ts
import { Money } from "pennywise";        // ESM / TypeScript
const { Money } = require("pennywise");   // CommonJS
```

## CLI

Exact money math in your terminal (or shell scripts) — no install needed:

```bash
npx pennywise tax 80 8.25            # tax: 6.60 USD / total: 86.60 USD
npx pennywise tip 64 18              # tip: 11.52 USD / total: 75.52 USD
npx pennywise split 100 3            # 33.34 / 33.33 / 33.33  (sums back to 100)
npx pennywise add 19.99 5.01         # 25.00 USD
npx pennywise format 1234.5 -c EUR --locale de-DE   # 1.234,50 €
```

Commands: `add` `sub` `mul` `div` `tax` `tip` `discount` `split` `allocate`
`format`. Options: `-c/--currency` (sets decimal places — JPY=0, etc.),
`--locale`, `--round`. Results are exact and never lose a cent.

## Usage

### Creating money

```ts
Money.of("19.99", "USD");      // from a decimal string (recommended — always exact)
Money.of(5, "USD");            // from a number → $5.00
Money.of("1000", "JPY");       // ¥1000 (0 decimal places, known automatically)
Money.ofMinor(1999, "USD");    // from minor units → $19.99
Money.of("1.005", "USD", { round: "half-up" }); // control rounding of excess digits
```

### Arithmetic

```ts
const price = Money.of("100.00", "USD");
price.add(Money.of("8.25", "USD"));     // $108.25
price.subtract(Money.of("10", "USD"));  // $90.00
price.multiply(3);                      // $300.00
price.divide(3);                        // $33.33  (rounded; use split() to be exact)
sum([a, b, c]);                         // add a whole list
```

### Tax, tips & discounts

```ts
const bill = Money.of("80", "USD");
bill.percentage(8.25);          // $6.60   — 8.25% of the bill
bill.addPercentage(20);         // $96.00  — add a 20% tip
bill.subtractPercentage(15);    // $68.00  — take 15% off

// Bounds
a.min(b); a.max(b);             // pick the smaller / larger
total.clamp(floor, cap);        // keep within a range
```

### Splitting without losing money

The classic problem: split `$0.05` three ways. Naive code gives `$0.0166…`
three times and loses a cent. pennywise distributes the remainder:

```ts
Money.of("0.05", "USD").allocate([1, 1, 1]).map(String);
// → ["0.02 USD", "0.02 USD", "0.01 USD"]   ✅ sums to $0.05

// Proportional splits (e.g. revenue share 70/20/10)
Money.of("999.99", "USD").allocate([70, 20, 10]);

// Equal split
Money.of("100.00", "USD").split(7); // 7 parts that sum back to $100.00
```

### Comparing

```ts
a.equals(b);  a.greaterThan(b);  a.lessThanOrEqual(b);  a.compare(b); // -1 | 0 | 1
a.isZero();   a.isNegative();    a.isPositive();
```

### Formatting & serialization

```ts
Money.of("1234.5", "USD").format("en-US"); // "$1,234.50"
Money.of("1234.5", "EUR").format("de-DE"); // "1.234,50 €"
Money.of("19.99", "USD").toDecimalString(); // "19.99"  (exact, no float)

const json = JSON.stringify(money);        // { "amount": "1999", "currency": "USD", "scale": 2 }
Money.fromJSON(JSON.parse(json));          // back to a Money
```

## API

| Method | Description |
| ------ | ----------- |
| `Money.of(amount, currency, opts?)` | From a decimal string/number. |
| `Money.ofMinor(units, currency, opts?)` | From minor units (cents). |
| `Money.fromJSON(json)` | Rebuild from `toJSON` output. |
| `.add(m)` / `.subtract(m)` | Exact addition/subtraction (same currency). |
| `.multiply(factor, opts?)` / `.divide(divisor, opts?)` | Scale by a count or rate, with rounding. |
| `.percentage(p)` / `.addPercentage(p)` / `.subtractPercentage(p)` | Tax, tips, discounts. |
| `.allocate(ratios)` / `.split(n)` | Distribute with no lost units. |
| `.min(m)` / `.max(m)` / `.clamp(lo, hi)` | Bounds. |
| `.compare(m)` / `.equals` / `.greaterThan` / … | Value comparison. |
| `.negate()` / `.absolute()` | Sign helpers. |
| `.isZero()` / `.isPositive()` / `.isNegative()` | Predicates. |
| `.toDecimalString()` / `.format(locale?, opts?)` | Exact string / localized string. |
| `.toJSON()` / `.toString()` | Serialize. |
| `sum(monies, zero?)` | Add a list. |

Options: `scale` (override decimal places) and `round` (`"half-even"` default,
`"half-up"`, `"half-down"`, `"up"`, `"down"`, `"ceil"`, `"floor"`).

## Comparison

|                          | `pennywise` | `number` math | `decimal.js` / big-number libs |
| ------------------------ | :---------: | :-----------: | :----------------------------: |
| Exact (no float error)   |     ✅      |      ❌       |              ✅                |
| No-lost-cent allocate    |     ✅      |      ❌       |              ⚠️ (DIY)          |
| Currency & Intl format   |     ✅      |      ❌       |              ❌                |
| Zero dependencies        |     ✅      |      ✅       |              ⚠️                |
| ~2 KB gzipped            |     ✅      |      ✅       |              ❌                |

## Contributing

Contributions are very welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md)
and our [Code of Conduct](./CODE_OF_CONDUCT.md).

```bash
git clone https://github.com/didrod205/pennywise.git
cd pennywise
npm install
npm test
```

## 💖 Sponsor

`pennywise` is free and MIT-licensed, built and maintained in spare time. If it
keeps your invoices balanced and your cents accounted for, please consider
supporting it — every bit helps keep the project healthy.

- ⭐ **Star this repo** — the simplest, free way to help others discover it.
- 🍋 **[Sponsor via Lemon Squeezy](https://elab-studio.lemonsqueezy.com/checkout/buy/5d059b89-51d0-456b-b33a-ed56994f7010)** — one-time or recurring support.

> Sponsoring? Open an issue and we'll add your name/logo here. Thank you! 🙏

## License

[MIT](./LICENSE) © pennywise contributors
