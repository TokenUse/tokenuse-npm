#!/usr/bin/env bash
set -euo pipefail

# AGENTS guard
# - coverage: governed directories must contain AGENTS.md
# - freshness: structural staged changes must include AGENTS.md updates
#
# Bypass (rare): SKIP_AGENTS_GUARD=1 git commit -m "..."

if [[ "${SKIP_AGENTS_GUARD:-}" == "1" ]]; then
  echo "[agents-guard] SKIP_AGENTS_GUARD=1 set; skipping."
  exit 0
fi

MAX_DEPTH="${AGENTS_GUARD_MAX_DEPTH:-3}"
CHECK_STAGED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --staged) CHECK_STAGED=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

is_ignored_path() {
  p="$1"
  case "$p" in
    .git/*|node_modules/*|dist/*|build/*|.next/*|.turbo/*|.vercel/*|.playwright-mcp/*|test-results/*|playwright-report/*)
      return 0 ;;
    */node_modules/*|*/dist/*|*/build/*|*/.next/*|*/.turbo/*|*/.vercel/*|*/.playwright-mcp/*|*/test-results/*|*/playwright-report/*)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

dir_depth() {
  d="$1"
  awk -F'/' '{print NF}' <<<"$d"
}

line_in_file() {
  needle="$1"
  file="$2"
  grep -Fqx "$needle" "$file"
}

coverage_check() {
  dirs_file="$(mktemp)"
  uniq_dirs_file="$(mktemp)"
  missing_file="$(mktemp)"

  while IFS= read -r -d '' file; do
    [[ -z "$file" ]] && continue
    is_ignored_path "$file" && continue

    dir="$(dirname "$file")"
    [[ "$dir" == "." ]] && continue

    depth="$(dir_depth "$dir")"
    if (( depth <= MAX_DEPTH )); then
      echo "$dir" >> "$dirs_file"
    fi
  done < <(git ls-files -z)

  sort -u "$dirs_file" > "$uniq_dirs_file"

  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    if [[ ! -f "$d/AGENTS.md" ]]; then
      echo "$d" >> "$missing_file"
    fi
  done < "$uniq_dirs_file"

  if [[ -s "$missing_file" ]]; then
    echo "[agents-guard] Missing AGENTS.md in governed folders (depth <= $MAX_DEPTH):" >&2
    sed 's/^/ - /' "$missing_file" >&2
    rm -f "$dirs_file" "$uniq_dirs_file" "$missing_file"
    return 1
  fi

  rm -f "$dirs_file" "$uniq_dirs_file" "$missing_file"
  return 0
}

staged_freshness_check() {
  staged_agents_file="$(mktemp)"
  changed_dirs_file="$(mktemp)"
  uniq_changed_dirs_file="$(mktemp)"
  missing_agents_file="$(mktemp)"
  stale_file="$(mktemp)"

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    case "$path" in
      AGENTS.md|*/AGENTS.md)
        echo "$path" >> "$staged_agents_file"
        ;;
    esac
  done < <(git diff --cached --name-only --diff-filter=ACMR)

  while IFS=$'\t' read -r status p1 p2; do
    [[ -z "$status" ]] && continue

    if [[ "$status" == R* ]]; then
      path="$p2"
    else
      path="$p1"
    fi

    [[ -z "$path" ]] && continue
    is_ignored_path "$path" && continue

    case "$path" in
      AGENTS.md|*/AGENTS.md|CLAUDE.md|*/CLAUDE.md)
        continue ;;
    esac

    dir="$(dirname "$path")"
    [[ "$dir" == "." ]] && continue

    depth="$(dir_depth "$dir")"
    if (( depth <= MAX_DEPTH )); then
      echo "$dir" >> "$changed_dirs_file"
    fi
  done < <(git diff --cached --name-status --diff-filter=ADR)

  sort -u "$changed_dirs_file" > "$uniq_changed_dirs_file"

  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    agents_path="$d/AGENTS.md"

    if [[ ! -f "$agents_path" ]] && ! line_in_file "$agents_path" "$staged_agents_file"; then
      echo "$d" >> "$missing_agents_file"
      continue
    fi

    if ! line_in_file "$agents_path" "$staged_agents_file"; then
      echo "$d" >> "$stale_file"
    fi
  done < "$uniq_changed_dirs_file"

  if [[ -s "$missing_agents_file" ]]; then
    echo "[agents-guard] Structural staged changes in folders missing AGENTS.md:" >&2
    sed 's/^/ - /' "$missing_agents_file" >&2
    echo "[agents-guard] Add and stage <folder>/AGENTS.md files." >&2
    rm -f "$staged_agents_file" "$changed_dirs_file" "$uniq_changed_dirs_file" "$missing_agents_file" "$stale_file"
    return 1
  fi

  if [[ -s "$stale_file" ]]; then
    echo "[agents-guard] Structural staged changes detected, but AGENTS.md not updated in:" >&2
    sed 's/^/ - /' "$stale_file" >&2
    echo "[agents-guard] Update and stage each folder AGENTS.md summary." >&2
    rm -f "$staged_agents_file" "$changed_dirs_file" "$uniq_changed_dirs_file" "$missing_agents_file" "$stale_file"
    return 1
  fi

  rm -f "$staged_agents_file" "$changed_dirs_file" "$uniq_changed_dirs_file" "$missing_agents_file" "$stale_file"
  return 0
}

coverage_check

if (( CHECK_STAGED == 1 )); then
  staged_freshness_check
fi

echo "[agents-guard] OK"
