#!/usr/bin/env node
/**
 * pennywise CLI — exact money math in your terminal, zero-dependency.
 *
 *   pennywise add 19.99 5.01 --currency USD       # 25.00 USD
 *   pennywise tax 80 8.25                          # tax + total
 *   pennywise tip 64 18                            # tip + total
 *   pennywise split 100 3                          # 33.34 / 33.33 / 33.33
 *   pennywise format 1234.5 --currency EUR --locale de-DE   # 1.234,50 €
 */

import { Money, sum, type RoundingMode } from "./index.js";
import pkg from "../package.json";

const HELP = `pennywise — exact, BigInt-backed money math (no float errors).

Usage:
  pennywise <command> [amounts...] [options]

Commands:
  add <a> <b> …            Sum amounts
  sub <a> <b>              a − b
  mul <a> <factor>         Multiply by a scalar
  div <a> <divisor>        Divide by a scalar (rounded)
  tax <a> <percent>        Show the tax and the total (a + percent%)
  tip <a> <percent>        Show the tip and the total
  discount <a> <percent>   Show the discount and the final price
  split <a> <parts>        Split exactly into N parts (no cent lost)
  allocate <a> r1 r2 …     Split by ratios (e.g. 1 1 2)
  format <a>               Localized currency string

Options:
  -c, --currency <code>    ISO code (default USD). Sets decimal places (JPY=0…)
      --locale <bcp47>     Locale for \`format\` (e.g. en-US, de-DE, ko-KR)
      --round <mode>       half-even (default) | half-up | down | ceil | floor | …
  -h, --help               Show this help
  -v, --version            Show version

Every amount is stored as a BigInt of minor units, so results are exact and a
split always sums back to the original. Nothing leaves your machine.`;

interface Flags {
  currency: string;
  locale: string | undefined;
  round: RoundingMode;
  positional: string[];
}

function parse(argv: string[]): Flags {
  const f: Flags = { currency: "USD", locale: undefined, round: "half-even", positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-c" || a === "--currency") f.currency = (argv[++i] ?? "USD").toUpperCase();
    else if (a === "--locale") f.locale = argv[++i];
    else if (a === "--round") f.round = (argv[++i] ?? "half-even") as RoundingMode;
    else if (!a.startsWith("-")) f.positional.push(a);
  }
  return f;
}

function money(amount: string, f: Flags): Money {
  return Money.of(amount, f.currency, { round: f.round });
}

function out(...lines: string[]): void {
  process.stdout.write(lines.join("\n") + "\n");
}

function run(cmd: string, f: Flags): number {
  const p = f.positional;
  switch (cmd) {
    case "add": {
      if (p.length < 1) throw new Error("add needs at least one amount");
      out(sum(p.map((a) => money(a, f))).toString());
      return 0;
    }
    case "sub": {
      if (p.length !== 2) throw new Error("sub needs exactly two amounts");
      out(money(p[0]!, f).subtract(money(p[1]!, f)).toString());
      return 0;
    }
    case "mul": {
      if (p.length !== 2) throw new Error("mul needs an amount and a factor");
      out(money(p[0]!, f).multiply(p[1]!, { round: f.round }).toString());
      return 0;
    }
    case "div": {
      if (p.length !== 2) throw new Error("div needs an amount and a divisor");
      out(money(p[0]!, f).divide(p[1]!, { round: f.round }).toString());
      return 0;
    }
    case "tax":
    case "tip": {
      if (p.length !== 2) throw new Error(`${cmd} needs an amount and a percent`);
      const base = money(p[0]!, f);
      const extra = base.percentage(p[1]!, { round: f.round });
      out(`${cmd}:    ${extra.toString()}`, `total:  ${base.add(extra).toString()}`);
      return 0;
    }
    case "discount": {
      if (p.length !== 2) throw new Error("discount needs an amount and a percent");
      const base = money(p[0]!, f);
      const off = base.percentage(p[1]!, { round: f.round });
      out(`discount: ${off.toString()}`, `final:    ${base.subtract(off).toString()}`);
      return 0;
    }
    case "split": {
      if (p.length !== 2) throw new Error("split needs an amount and a part count");
      const parts = money(p[0]!, f).split(Number(p[1]));
      out(parts.map((m) => m.toString()).join("\n"));
      return 0;
    }
    case "allocate": {
      if (p.length < 2) throw new Error("allocate needs an amount and at least one ratio");
      const parts = money(p[0]!, f).allocate(p.slice(1));
      out(parts.map((m) => m.toString()).join("\n"));
      return 0;
    }
    case "format": {
      if (p.length !== 1) throw new Error("format needs one amount");
      out(money(p[0]!, f).format(f.locale));
      return 0;
    }
    default:
      process.stderr.write(`pennywise: unknown command "${cmd}". See --help.\n`);
      return 2;
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP + "\n");
    return argv.length === 0 ? 2 : 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`pennywise ${pkg.version}\n`);
    return 0;
  }
  const cmd = argv[0]!;
  const f = parse(argv.slice(1));
  try {
    return run(cmd, f);
  } catch (e) {
    process.stderr.write(`pennywise: ${(e as Error).message.replace(/^pennywise:\s*/, "")}\n`);
    return 1;
  }
}

process.exit(main());
