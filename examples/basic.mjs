// Run with: node examples/basic.mjs
// (after `npm run build`, this imports the built bundle)
import { Money, sum } from "../dist/index.js";

// 1. Exact arithmetic — no floating-point error
const a = Money.of("0.1", "USD");
const b = Money.of("0.2", "USD");
console.log("0.1 + 0.2 =", a.add(b).toDecimalString()); // "0.30"

// 2. Tax, then format
const price = Money.of("19.99", "USD");
const withTax = price.multiply("1.0825");
console.log("with tax:", withTax.format("en-US"));

// 3. Split a bill three ways without losing a cent
const bill = Money.of("100.00", "USD");
const shares = bill.split(3);
console.log("split:", shares.map(String));
console.log("re-summed:", sum(shares).toDecimalString());

// 4. Revenue share 70 / 20 / 10
const revenue = Money.of("999.99", "USD");
console.log("share:", revenue.allocate([70, 20, 10]).map(String));
