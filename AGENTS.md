# Agent guidance

- Skills live in `skills/<name>/`, and `<name>` must match the `name` in its
  `SKILL.md` frontmatter. Create one with `bun run skill:new <name>`.
- Run `bun run lint` after editing a skill; it validates frontmatter,
  references, and prompt quality.
- Keep `SKILL.md` short and move detail to `references/`. Put runnable helpers
  in the skill's `scripts/` and test them with `bun test`.
- Use `.scratch/` for temporary files and directories.
