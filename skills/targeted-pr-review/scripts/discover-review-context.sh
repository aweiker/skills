#!/usr/bin/env bash
set -euo pipefail

if ! root=$(git rev-parse --show-toplevel 2>/dev/null); then
  echo "ERROR: not inside a git repository" >&2
  exit 1
fi

cd "$root"

base="${1:-}"
if [[ -z "$base" ]]; then
  origin_head=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)
  for candidate in "$origin_head" main master trunk develop; do
    [[ -z "$candidate" ]] && continue
    if git rev-parse --verify --quiet "origin/$candidate" >/dev/null; then
      base="origin/$candidate"
      break
    fi
    if git rev-parse --verify --quiet "$candidate" >/dev/null; then
      base="$candidate"
      break
    fi
  done
fi

branch=$(git branch --show-current 2>/dev/null || true)

changed_files_tmp=$(mktemp)
doc_files_tmp=$(mktemp)
keyword_tmp=$(mktemp)
ranked_docs_tmp=$(mktemp)
trap 'rm -f "$changed_files_tmp" "$doc_files_tmp" "$keyword_tmp" "$ranked_docs_tmp"' EXIT

diff_range=""
if [[ -n "$base" ]] && git rev-parse --verify --quiet "$base" >/dev/null; then
  diff_range="$base...HEAD"
  git diff --name-only "$diff_range" > "$changed_files_tmp" || true
fi

if [[ ! -s "$changed_files_tmp" ]]; then
  diff_range="working-tree"
  {
    git diff --name-only || true
    git diff --cached --name-only || true
  } | sort -u > "$changed_files_tmp"
fi

changed_count=$(wc -l < "$changed_files_tmp" | tr -d ' ')
if [[ "$diff_range" == "working-tree" ]]; then
  shortstat=$(git diff --shortstat || true)
  staged_shortstat=$(git diff --cached --shortstat || true)
  if [[ -n "$staged_shortstat" ]]; then
    shortstat="$shortstat; staged: $staged_shortstat"
  fi
else
  shortstat=$(git diff --shortstat "$diff_range" || true)
fi

find . \
  \( -name .git -o -name deps -o -name _build -o -name node_modules -o -name dist -o -name .venv -o -name venv -o -name __pycache__ -o -name .elixir_ls -o -name .claude -o -name .pi \) -prune \
  -o -type f -name '*.md' -print | sed 's#^./##' | sort > "$doc_files_tmp"

{
  printf '%s\n' "$branch" | tr '/_.-' '\n'
  while IFS= read -r file; do
    printf '%s\n' "$file" | tr '/_.-' '\n'
    basename "$file" | sed -E 's/\.(exs?|md|js|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|cpp|h|hpp)$//' | tr '/_.-' '\n'
  done < "$changed_files_tmp"
} |
  tr '[:upper:]' '[:lower:]' |
  sed -E 's/[^a-z0-9]+//g' |
  awk 'length($0) >= 3' |
  grep -Ev '^(lib|test|spec|src|app|docs|doc|readme|md|ex|exs|js|ts|py|rb|go|rs|java|index|mod|new|old|the|and|for|with|from|into|this|that)$' |
  sort -u > "$keyword_tmp" || true

score_doc() {
  local doc="$1"
  local score=0
  local lower_doc
  lower_doc=$(printf '%s' "$doc" | tr '[:upper:]' '[:lower:]')

  case "$lower_doc" in
    docs/domain/*|*/domain/*) score=$((score + 8)) ;;
  esac
  case "$lower_doc" in
    docs/impl/*|*/impl/*|*architecture*|*design*) score=$((score + 6)) ;;
  esac
  case "$lower_doc" in
    docs/plans/*|*/plans/*|*roadmap*|*guide*|*testing*|*contributing*|*agents*|*claude*) score=$((score + 4)) ;;
  esac

  while IFS= read -r kw; do
    [[ -z "$kw" ]] && continue
    if [[ "$lower_doc" == *"$kw"* ]]; then
      score=$((score + 5))
    fi
    if grep -Iiq -- "$kw" "$doc" 2>/dev/null; then
      score=$((score + 1))
    fi
  done < "$keyword_tmp"

  printf '%06d %s\n' "$score" "$doc"
}

while IFS= read -r doc; do
  score_doc "$doc"
done < "$doc_files_tmp" | sort -rn > "$ranked_docs_tmp"

changed_text=$(tr '\n' ' ' < "$changed_files_tmp" | tr '[:upper:]' '[:lower:]')
keyword_text=$(tr '\n' ' ' < "$keyword_tmp")
combined_text="$changed_text $keyword_text"

print_dimension_if() {
  local name="$1"
  local pattern="$2"
  local rationale="$3"
  if printf '%s' "$combined_text" | grep -Eq "$pattern"; then
    printf -- '- %s — %s\n' "$name" "$rationale"
  fi
}

cat <<EOF
# Targeted PR review context discovery

## Repository

- Root: $root
- Branch: ${branch:-unknown}
- Base: ${base:-unknown; using working-tree diff only}

## Root instructions discovered

EOF

for f in AGENTS.md CLAUDE.md CONTRIBUTING.md README.md Makefile .github/PULL_REQUEST_TEMPLATE.md .github/PULL_REQUEST_TEMPLATE/default.md; do
  if [[ -e "$f" ]]; then
    printf -- '- %s\n' "$f"
  fi
done

cat <<EOF

## Diff size

- Range: ${diff_range:-unknown}
- Changed files: $changed_count
- Shortstat: ${shortstat:-none}

## Changed files

EOF

if [[ -s "$changed_files_tmp" ]]; then
  sed 's/^/- /' "$changed_files_tmp"
else
  echo "- No changed files detected against base or working tree."
fi

cat <<'EOF'

## Keyword signals derived from branch and changed paths

EOF

if [[ -s "$keyword_tmp" ]]; then
  awk 'BEGIN {printf "- "} {printf "%s%s", sep, $0; sep=", "} END {printf "\n"}' "$keyword_tmp"
else
  echo "- None"
fi

cat <<'EOF'

## Dynamically ranked design/context docs

These are ranked at review time from discovered markdown files. Scores combine generic design-doc locations/names plus path/content keyword matches from the current branch and changed files.

EOF

awk '$1 > 0 {printf "- score=%d %s\n", $1, substr($0, 8)}' "$ranked_docs_tmp" | head -40 || true

cat <<'EOF'

## Suggested focused review dimensions

EOF

print_dimension_if "State machine / fail-closed behavior" '(state|status|phase|ready|readiness|gate|lifecycle|recovery|reset|kill|switch|stop|start|warmup|reconcile)' "changed names suggest lifecycle/status transitions; verify no stale success or fail-open path."
print_dimension_if "OTP/process responsiveness and ownership" '(genserver|supervisor|task|process|ets|handle|cast|call|continue|registry|worker|pipeline|runtime)' "changed names suggest OTP/process boundaries; verify ownership, blocking callbacks, supervision behavior, and safe async work."
print_dimension_if "API contract / idempotency compatibility" '(api|controller|router|endpoint|request|response|contract|schema|idempot|retry|order|place|public|client)' "changed names suggest public behavior; verify existing contracts and retry semantics still hold."
print_dimension_if "Security/privacy/ownership" '(auth|credential|secret|token|key|privacy|public|protected|ets|log|payload|sanitize|permission|access)' "changed names suggest sensitive boundaries; verify least privilege, no raw payload/secret leakage, and fail-closed errors."
print_dimension_if "Persistence/event/replay consistency" '(repo|schema|migration|event|store|ledger|replay|backfill|query|database|db|ets)' "changed names suggest stored/replayed state; verify persisted state and derived read models remain consistent."
print_dimension_if "Configuration/topology/dependency wiring" '(config|option|opts|setting|topology|supervisor|child|spec|dependency|provider|credential)' "changed names suggest runtime wiring; verify options/dependencies are propagated and fingerprint/rebuild rules are intentional."
print_dimension_if "Observability/error taxonomy" '(telemetry|metric|log|audit|event|error|exception|reason|failure)' "changed names suggest diagnostics; verify bounded logs, useful error categories, and no sensitive data."

cat <<'EOF'
- Test-gap review — always run: compare claims from docs/plans/PR body against assertions and negative tests.
- Scope review — always run: compare diff against roadmap/plan/issue intent and flag out-of-scope behavior.

## Notes for the reviewer

- Read the root instructions first.
- Read the top-ranked docs until you have enough domain and implementation invariants for the changed areas.
- Do not assume this ranking is complete; follow cross-references in selected docs when they look relevant.
- Generate focused review prompts from the suggested dimensions and from invariants found in the selected docs.
EOF
