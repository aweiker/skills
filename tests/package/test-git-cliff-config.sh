#!/usr/bin/env bash
set -euo pipefail

if ! command -v git-cliff >/dev/null 2>&1; then
  echo "git-cliff not installed; skipping cliff.toml smoke test"
  exit 0
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

git-cliff --config cliff.toml --unreleased --tag v0.0.0 --with-commit "fix: smoke test git-cliff config" > "$tmp"

if ! grep -Eq '^## \[(0\.0\.0|unreleased)\]' "$tmp"; then
  echo "ERROR: git-cliff output did not include expected release header" >&2
  cat "$tmp" >&2
  exit 1
fi

if ! grep -q 'Smoke test git-cliff config' "$tmp"; then
  echo "ERROR: git-cliff output did not include the expected conventional commit subject" >&2
  cat "$tmp" >&2
  exit 1
fi

echo "git-cliff config smoke test passed"
