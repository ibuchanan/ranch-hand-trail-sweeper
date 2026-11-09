import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkills } from "../../src/scripts/list-skills.ts";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "list-skills-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("lists each skill's SKILL.md in sorted order", async () => {
  for (const name of ["beta", "alpha"]) {
    await mkdir(join(root, "skills", name), { recursive: true });
    await writeFile(join(root, "skills", name, "SKILL.md"), "# skill\n");
  }
  expect(await listSkills(root)).toEqual([
    "skills/alpha/SKILL.md",
    "skills/beta/SKILL.md",
  ]);
});

test("ignores directories without a SKILL.md", async () => {
  await mkdir(join(root, "skills", "empty"), { recursive: true });
  expect(await listSkills(root)).toEqual([]);
});
