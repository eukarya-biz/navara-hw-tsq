#!/usr/bin/env bash
# Builds the site and pushes dist/ to the gh-pages branch.
set -euo pipefail

cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile
pnpm build

WORKTREE_DIR=".gh-pages-worktree"
rm -rf "$WORKTREE_DIR"

if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch origin gh-pages
  git worktree add "$WORKTREE_DIR" gh-pages
else
  git worktree add --detach "$WORKTREE_DIR"
  (cd "$WORKTREE_DIR" && git checkout --orphan gh-pages && git rm -rf . >/dev/null)
fi

find "$WORKTREE_DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$WORKTREE_DIR/"

cd "$WORKTREE_DIR"
git add -A
if git diff --cached --quiet; then
  echo "Nothing to deploy: dist is unchanged."
else
  git commit -m "Deploy $(git -C .. rev-parse --short HEAD)"
  git push origin gh-pages
fi

cd ..
git worktree remove "$WORKTREE_DIR" --force
