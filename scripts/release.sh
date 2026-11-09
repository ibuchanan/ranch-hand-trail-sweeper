#!/usr/bin/env bash
set -euo pipefail

[[ $# == 0 ]] || { echo 'Usage: release (pushes origin main)' >&2; exit 1; }
[[ $(git symbolic-ref --short HEAD) == main ]] || { echo 'Release from main.' >&2; exit 1; }
[[ -z $(git status --porcelain --untracked-files=all) ]] || { echo 'Commit or remove local changes first.' >&2; exit 1; }
bun run release:check
[[ -z $(git status --porcelain --untracked-files=all) ]] || { echo 'Checks changed the worktree; inspect before releasing.' >&2; exit 1; }

version=$(git cliff --offline --no-exec --bumped-version)
version=${version#v}
tag="v$version"
tmp=$(mktemp -d "$(git rev-parse --git-path .)/release.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
git cliff --offline --no-exec --tag "$tag" --output "$tmp/CHANGELOG.md"
jq --arg version "$version" '.version = $version' package.json > "$tmp/package.json"
cp "$tmp/package.json" package.json
cp "$tmp/CHANGELOG.md" CHANGELOG.md
git add -- package.json CHANGELOG.md
git commit -m "chore(release): $tag"
git tag -m "$tag" "$tag"
git -c push.followTags=false push --atomic origin main "refs/tags/$tag"
