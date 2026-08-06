#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

chmod +x .githooks/pre-commit devops/agents/verify-agents.sh scripts/setup-git-hooks.sh

git config core.hooksPath .githooks

echo "[hooks] Installed. core.hooksPath=.githooks"
echo "[hooks] Pre-commit now enforces AGENTS coverage + freshness checks."
