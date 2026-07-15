#!/usr/bin/env bash
set -euo pipefail

# Prepares development frontend deployment values for GitHub Actions.
# Run after the development backend Cloud Run service deploys successfully.

if [[ -f development-github-variables.txt ]]; then
  set -a
  # shellcheck disable=SC1091
  source development-github-variables.txt
  set +a
fi

export PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-hotel-development-502419}}"
export REGION="${GCP_REGION:-${REGION:-asia-south2}}"
export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-arcadia-repo}"
export BACKEND_CLOUD_RUN_SERVICE="${BACKEND_CLOUD_RUN_SERVICE:-${CLOUD_RUN_SERVICE:-arcadia-backend-development}}"
export FRONTEND_CLOUD_RUN_SERVICE="${FRONTEND_CLOUD_RUN_SERVICE:-arcadia-dashboard-development}"
export FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-dashboard-web}"
export FRONTEND_RUNTIME_SA="${FRONTEND_RUNTIME_SA:-arcadia-dashboard-runner-development}"
export GCP_WORKLOAD_IDENTITY_PROVIDER="${GCP_WORKLOAD_IDENTITY_PROVIDER:-}"
export GCP_DEPLOY_SERVICE_ACCOUNT="${GCP_DEPLOY_SERVICE_ACCOUNT:-}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-/api/v1}"
export FRONTEND_MEMORY="${FRONTEND_MEMORY:-1Gi}"
export FRONTEND_CPU="${FRONTEND_CPU:-1}"
export FRONTEND_MIN_INSTANCES="${FRONTEND_MIN_INSTANCES:-0}"
export FRONTEND_MAX_INSTANCES="${FRONTEND_MAX_INSTANCES:-3}"

log() {
  printf "\n==> %s\n" "$*" >&2
}

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required value: ${name}" >&2
    echo "Run bash infra/development/full-setup.sh first so development-github-variables.txt exists." >&2
    exit 1
  fi
}

require_value PROJECT_ID
require_value REGION
require_value ARTIFACT_REPOSITORY
require_value BACKEND_CLOUD_RUN_SERVICE
require_value FRONTEND_CLOUD_RUN_SERVICE
require_value FRONTEND_IMAGE_NAME
require_value FRONTEND_RUNTIME_SA
require_value GCP_WORKLOAD_IDENTITY_PROVIDER
require_value GCP_DEPLOY_SERVICE_ACCOUNT

gcloud config set project "$PROJECT_ID"

export FRONTEND_RUNTIME_SA_EMAIL="${FRONTEND_RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

log "Creating or reusing frontend runtime service account"
if ! gcloud iam service-accounts describe "$FRONTEND_RUNTIME_SA_EMAIL" \
  --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$FRONTEND_RUNTIME_SA" \
    --project="$PROJECT_ID" \
    --display-name="Arcadia dashboard runner development"
fi

log "Allowing GitHub deploy service account to deploy as frontend runtime service account"
gcloud iam service-accounts add-iam-policy-binding "$FRONTEND_RUNTIME_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${GCP_DEPLOY_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

log "Reading backend Cloud Run URL"
API_PROXY_TARGET="$(gcloud run services describe "$BACKEND_CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

if [[ -z "$API_PROXY_TARGET" ]]; then
  echo "Could not find backend Cloud Run service URL for ${BACKEND_CLOUD_RUN_SERVICE}." >&2
  exit 1
fi

NEXT_PUBLIC_WS_BASE_URL="wss://${API_PROXY_TARGET#https://}"

cat > frontend-development-github-variables.txt <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY}
GCP_WORKLOAD_IDENTITY_PROVIDER=${GCP_WORKLOAD_IDENTITY_PROVIDER}
GCP_DEPLOY_SERVICE_ACCOUNT=${GCP_DEPLOY_SERVICE_ACCOUNT}
FRONTEND_CLOUD_RUN_SERVICE=${FRONTEND_CLOUD_RUN_SERVICE}
FRONTEND_IMAGE_NAME=${FRONTEND_IMAGE_NAME}
FRONTEND_CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${FRONTEND_RUNTIME_SA_EMAIL}
API_PROXY_TARGET=${API_PROXY_TARGET}
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL}
FRONTEND_MEMORY=${FRONTEND_MEMORY}
FRONTEND_CPU=${FRONTEND_CPU}
FRONTEND_MIN_INSTANCES=${FRONTEND_MIN_INSTANCES}
FRONTEND_MAX_INSTANCES=${FRONTEND_MAX_INSTANCES}
EOF

cat <<EOF

Frontend development setup complete.

Copy GitHub environment variables from:
frontend-development-github-variables.txt

Then run the Frontend CI/CD workflow on the development branch.
EOF
