#!/usr/bin/env bash
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
sanitized=$(echo "$branch" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/^-*//; s/-*$//')

echo ""
echo "Preview URL: https://${sanitized}-esgrima.fjararibet.workers.dev"
echo ""
