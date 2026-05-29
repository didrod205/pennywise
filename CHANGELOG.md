# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

### Added

- Initial release.
- `Money` — immutable, `BigInt`-backed monetary value (exact, no floating point).
- `Money.of` / `Money.ofMinor` / `Money.fromJSON` constructors.
- Exact `add`, `subtract`, `multiply` (by count or rate) with rounding modes
  (`half-even` default, `half-up`, `half-down`, `up`, `down`, `ceil`, `floor`).
- `allocate(ratios)` and `split(n)` that distribute remainders so parts always
  sum back to the original — no lost or invented cents.
- Comparison (`compare`, `equals`, `greaterThan`, …) and sign predicates.
- `toDecimalString`, `format` (via `Intl.NumberFormat`), `toJSON`, `toString`.
- Currency minor-unit scales for ISO 4217 (USD = 2, JPY = 0, BHD = 3, …).
- `sum` helper for lists.
- Ships ESM + CJS with full TypeScript types.

[Unreleased]: https://github.com/didrod205/pennywise/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/didrod205/pennywise/releases/tag/v0.1.0
