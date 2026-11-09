#!/usr/bin/env bash
# Sonar pre-commit gate for staged files (macOS/Linux).
#
# Runs a secrets-only scan (`sonar hook git-pre-commit`). The golden-path command
# `sonar analyze --staged` also triggers Agentic Analysis, which currently returns
# 403 for the VTEX org (feature not enabled yet), so it is kept commented out below.
# Code quality is still enforced by the full Sonar scan in CI.
set -euo pipefail

if command -v sonar >/dev/null 2>&1; then
  SONAR_CMD="$(command -v sonar)"
elif [[ -x "${HOME}/.local/share/sonarqube-cli/bin/sonar" ]]; then
  SONAR_CMD="${HOME}/.local/share/sonarqube-cli/bin/sonar"
else
  echo "Sonar CLI not found. Install with:" >&2
  echo "  curl -o- https://raw.githubusercontent.com/SonarSource/sonarqube-cli/refs/heads/master/user-scripts/install.sh | bash" >&2
  exit 1
fi

# Golden path (re-enable when Agentic Analysis is available for the org):
# exec "$SONAR_CMD" analyze --staged --project vtex_goldenpath
exec "$SONAR_CMD" hook git-pre-commit
