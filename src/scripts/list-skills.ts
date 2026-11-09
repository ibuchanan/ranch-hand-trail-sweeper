#!/usr/bin/env bun

/**
 * list-skills: print the path of every skill's SKILL.md, one per line.
 *
 * Usage: bun run skill:list
 *
 * A starting point for project-specific skill tooling. Copy its shape for new
 * scripts: export the logic, and run it only when invoked directly.
 */

export async function listSkills(root: string): Promise<string[]> {
  const glob = new Bun.Glob("skills/*/SKILL.md");
  const paths: string[] = [];
  for await (const path of glob.scan({ cwd: root })) paths.push(path);
  return paths.sort();
}

if (import.meta.main) {
  for (const path of await listSkills(process.cwd())) console.log(path);
}
