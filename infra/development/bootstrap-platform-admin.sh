#!/usr/bin/env bash
set -euo pipefail

# Creates the first development platform admin through a one-time Cloud Run Job.

export GITHUB_VARIABLES_FILE="${GITHUB_VARIABLES_FILE:-development-github-variables.txt}"

if [[ -f "$GITHUB_VARIABLES_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$GITHUB_VARIABLES_FILE"
  set +a
fi

export PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-hotel-development-502419}}"
export REGION="${GCP_REGION:-${REGION:-asia-south2}}"
export ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-development}"
export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-development}"
export CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT="${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:-arcadia-backend-run-dev@${PROJECT_ID}.iam.gserviceaccount.com}"
export CLOUD_SQL_CONNECTION_NAME="${CLOUD_SQL_CONNECTION_NAME:-}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-development}"
export VPC_EGRESS="${VPC_EGRESS:-private-ranges-only}"

export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-arcadia-development-database-url}"
export REDIS_URL_SECRET="${REDIS_URL_SECRET:-arcadia-development-redis-url}"
export CELERY_BROKER_URL_SECRET="${CELERY_BROKER_URL_SECRET:-arcadia-development-celery-broker-url}"
export CELERY_RESULT_BACKEND_SECRET="${CELERY_RESULT_BACKEND_SECRET:-arcadia-development-celery-result-backend}"
export JWT_SECRET_NAME="${JWT_SECRET_NAME:-arcadia-development-jwt-secret}"
export ENCRYPTION_KEY_SECRET_NAME="${ENCRYPTION_KEY_SECRET_NAME:-arcadia-development-encryption-key}"
export VAULT_MASTER_KEY_SECRET_NAME="${VAULT_MASTER_KEY_SECRET_NAME:-arcadia-development-vault-master-key}"

export PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-admin-development@arcadia.io}"
export PLATFORM_ADMIN_NAME="${PLATFORM_ADMIN_NAME:-Arcadia Development Admin}"
export PLATFORM_ADMIN_JOB="${PLATFORM_ADMIN_JOB:-arcadia-platform-admin-bootstrap-development}"
export PLATFORM_ADMIN_TEMP_SECRET="${PLATFORM_ADMIN_TEMP_SECRET:-arcadia-development-platform-admin-password-bootstrap}"

log() {
  printf "\n==> %s\n" "$*" >&2
}

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required value: ${name}" >&2
    echo "Run bash infra/development/full-setup.sh and deploy the backend first." >&2
    exit 1
  fi
}

cleanup() {
  gcloud run jobs delete "$PLATFORM_ADMIN_JOB" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --quiet >/dev/null 2>&1 || true

  gcloud secrets delete "$PLATFORM_ADMIN_TEMP_SECRET" \
    --project="$PROJECT_ID" \
    --quiet >/dev/null 2>&1 || true
}

require_value PROJECT_ID
require_value REGION
require_value CLOUD_RUN_SERVICE
require_value CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT
require_value VPC_CONNECTOR
require_value VPC_EGRESS
require_value DATABASE_URL_SECRET
require_value REDIS_URL_SECRET
require_value CELERY_BROKER_URL_SECRET
require_value CELERY_RESULT_BACKEND_SECRET
require_value JWT_SECRET_NAME
require_value ENCRYPTION_KEY_SECRET_NAME
require_value VAULT_MASTER_KEY_SECRET_NAME

trap cleanup EXIT

gcloud config set project "$PROJECT_ID"

log "Reading deployed backend image"
IMAGE_URI="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(spec.template.spec.containers[0].image)")"

if [[ -z "$IMAGE_URI" ]]; then
  echo "Could not find a deployed image for ${CLOUD_RUN_SERVICE}." >&2
  echo "Deploy the backend with GitHub Actions first, then rerun this script." >&2
  exit 1
fi

PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-ArcadiaDevAdmin-$(openssl rand -hex 12)}"

log "Creating temporary Secret Manager password"
cleanup

printf "%s" "$PLATFORM_ADMIN_PASSWORD" | gcloud secrets create "$PLATFORM_ADMIN_TEMP_SECRET" \
  --project="$PROJECT_ID" \
  --replication-policy="automatic" \
  --labels="app=arcadia,env=${ENVIRONMENT_NAME},purpose=platform-admin-bootstrap" \
  --data-file=- >/dev/null

gcloud secrets add-iam-policy-binding "$PLATFORM_ADMIN_TEMP_SECRET" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

APP_ENV_VARS="^|^ENVIRONMENT=${ENVIRONMENT_NAME}|AUTO_CREATE_TABLES=false|PLATFORM_ADMIN_NAME=${PLATFORM_ADMIN_NAME}|PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL}"
APP_SECRET_REFS="DATABASE_URL=${DATABASE_URL_SECRET}:latest,REDIS_URL=${REDIS_URL_SECRET}:latest,CELERY_BROKER_URL=${CELERY_BROKER_URL_SECRET}:latest,CELERY_RESULT_BACKEND=${CELERY_RESULT_BACKEND_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest,ENCRYPTION_KEY=${ENCRYPTION_KEY_SECRET_NAME}:latest,VAULT_MASTER_KEY=${VAULT_MASTER_KEY_SECRET_NAME}:latest,PLATFORM_ADMIN_PASSWORD=${PLATFORM_ADMIN_TEMP_SECRET}:latest"

log "Deploying one-time platform admin bootstrap job"
args=(
  run jobs deploy "$PLATFORM_ADMIN_JOB"
  "--project=$PROJECT_ID"
  "--region=$REGION"
  "--image=$IMAGE_URI"
  "--service-account=$CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT"
  "--set-env-vars=$APP_ENV_VARS"
  "--set-secrets=$APP_SECRET_REFS"
  "--vpc-connector=$VPC_CONNECTOR"
  "--vpc-egress=$VPC_EGRESS"
  "--command=python"
  "--args=-m,app.seeds.seed_platform_admin"
  "--tasks=1"
  "--max-retries=0"
  "--task-timeout=300s"
  "--quiet"
)
if [[ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  args+=("--set-cloudsql-instances=$CLOUD_SQL_CONNECTION_NAME")
fi
gcloud "${args[@]}"

log "Running one-time platform admin bootstrap job"
gcloud run jobs execute "$PLATFORM_ADMIN_JOB" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --wait

SERVICE_URL="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

cat <<EOF

Development platform admin bootstrap finished.

Save these credentials in your password manager now:

Platform URL: ${SERVICE_URL}
Email: ${PLATFORM_ADMIN_EMAIL}
Password: ${PLATFORM_ADMIN_PASSWORD}

Important:
- If the job logs say "Platform admin already exists", this password was not applied.
- For that case, rerun with a new PLATFORM_ADMIN_EMAIL or use the reset script.
- The temporary Cloud Run Job and Secret Manager password secret are deleted automatically.
EOF
