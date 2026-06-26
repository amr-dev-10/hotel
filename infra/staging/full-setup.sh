#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/bootstrap.sh"
bash "${SCRIPT_DIR}/configure-secrets.sh"

cat <<'EOF'

Full staging setup complete.

Copy GitHub environment variables from:
github-variables.txt

There should be no backend GitHub environment secrets to copy:
github-secrets.txt
EOF
