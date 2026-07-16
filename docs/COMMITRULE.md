# Commit Message Convention

This repo loosely follows [Conventional Commits](https://www.conventionalcommits.org/): `type: short description`.

## Common Types

| Type | Meaning | Example |
|---|---|---|
| `feat` | A new feature | `feat: add XRechnung export` |
| `fix` | A bug fix | `fix: handle empty invoice lines` |
| `docs` | Documentation only | `docs: update roadmap` |
| `style` | Formatting (no code logic changes) | `style: format TypeScript files` |
| `refactor` | Improve code without changing behavior | `refactor: simplify VAT validator` |
| `test` | Add or update tests | `test: add reverse charge fixtures` |
| `chore` | Maintenance tasks | `chore: update dependencies` |
| `build` | Build system changes | `build: configure Docker image` |
| `ci` | CI/CD changes | `ci: run KoSIT tests in GitHub Actions` |
| `perf` | Performance improvements | `perf: cache XML schema compilation` |
| `revert` | Revert a previous commit | `revert: remove experimental validator` |

## How strict is this?

`feat`, `fix`, `docs`, and `chore` cover most commits and should always be used. The rest apply when they clearly fit. This isn't enforced by CI or commitlint yet — it's a convention, not a hard requirement.
