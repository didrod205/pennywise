# Contributing to pennywise

Thanks for taking the time to contribute! 🎉 This project handles **money**, so
correctness is the top priority — contributions are reviewed with that in mind.

## Getting started

```bash
git clone https://github.com/didrod205/pennywise.git
cd pennywise
npm install
```

Common scripts:

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm test`           | Run the test suite once (Vitest).     |
| `npm run test:watch` | Re-run tests on change.               |
| `npm run typecheck`  | Type-check without emitting.          |
| `npm run coverage`   | Run tests with coverage.              |
| `npm run build`      | Build the `dist/` bundle (tsup).      |

## Pull requests

1. Fork the repo and create a topic branch (`fix/half-even-tie`).
2. **Add tests.** For anything touching arithmetic, allocation or rounding,
   include cases that pin the exact expected minor units. The "parts sum back to
   the original" invariant must always hold.
3. Make sure `npm run typecheck` and `npm test` pass.
4. Keep the public API small and the bundle zero-dependency.
5. Open the PR with a clear example (input → expected output).

## Reporting bugs

Open an issue with the **exact amounts, currency, operation and options**, the
result you got, and the result you expected. A failing test case is ideal.

## Code style

The project uses TypeScript in `strict` mode. There's no separate linter — the
compiler is the source of truth. Prefer clarity over cleverness.

By contributing you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
