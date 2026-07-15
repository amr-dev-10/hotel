#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/bootstrap.sh"
bash "${SCRIPT_DIR}/configure-secrets.sh"

cat <<'EOF'

Full development setup complete.

Copy backend GitHub environment variables from:
development-github-variables.txt

There should be no backend GitHub environment secrets to copy:
development-github-secrets.txt

After the backend deploy succeeds, run:
bash infra/development/configure-frontend.sh
EOF
