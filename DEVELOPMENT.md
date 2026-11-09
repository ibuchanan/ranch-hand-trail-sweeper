# Development

Install dependencies with `bun install`.
Run the checks before sending a pull request:

```sh
bun run lint
bun run lint:docs
bun run format:check
bun run typecheck
bun run test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process.

## Repository layout

- `.atlassian/`: Repository ownership metadata.
- `src/`: TypeScript source code.
- `docs/`: Diataxis guides, reference, explanations, and tutorials.
- `specs/`: Specifications and reference material; excluded from Biome checks.
- `dist/`: Build output; ignored by Git and excluded from Biome checks.
- `tests/`: Bun tests for skill scripts.
- `skills/`: Agent skills, one `<name>/SKILL.md` package per directory.
