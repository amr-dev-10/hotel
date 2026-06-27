#!/usr/bin/env bash
set -euo pipefail

# Creates the first staging platform admin through a one-time Cloud Run Job.
# This mirrors the production-safe process:
# 1. Generate a temporary password.
# 2. Store it briefly in Secret Manager.
# 3. Run the seed module in the deployed backend image.
# 4. Delete the job and temporary secret.
# 5. Print the credentials once for storage in a password manager.

if [[ -f github-variables.txt ]]; then
  set -a
  # shellcheck disable=SC1091
  source github-variables.txt
  set +a
fi

export PROJECT_ID="${GCP_PROJECT_ID:-${PROJECT_ID:-arcadia-hotel-staging}}"
export REGION="${GCP_REGION:-${REGION:-asia-south2}}"
export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-staging}"
export CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT="${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:-arcadia-backend-runner-staging@${PROJECT_ID}.iam.gserviceaccount.com}"
export CLOUD_SQL_CONNECTION_NAME="${CLOUD_SQL_CONNECTION_NAME:-}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-staging}"
export VPC_EGRESS="${VPC_EGRESS:-private-ranges-only}"

export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-arcadia-staging-database-url}"
export REDIS_URL_SECRET="${REDIS_URL_SECRET:-arcadia-staging-redis-url}"
export CELERY_BROKER_URL_SECRET="${CELERY_BROKER_URL_SECRET:-arcadia-staging-celery-broker-url}"
export CELERY_RESULT_BACKEND_SECRET="${CELERY_RESULT_BACKEND_SECRET:-arcadia-staging-celery-result-backend}"
export JWT_SECRET_NAME="${JWT_SECRET_NAME:-arcadia-staging-jwt-secret}"
export ENCRYPTION_KEY_SECRET_NAME="${ENCRYPTION_KEY_SECRET_NAME:-arcadia-staging-encryption-key}"
export VAULT_MASTER_KEY_SECRET_NAME="${VAULT_MASTER_KEY_SECRET_NAME:-arcadia-staging-vault-master-key}"

export PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-admin@arcadia.io}"
export PLATFORM_ADMIN_NAME="${PLATFORM_ADMIN_NAME:-Arcadia Super Admin}"
export PLATFORM_ADMIN_JOB="${PLATFORM_ADMIN_JOB:-arcadia-platform-admin-bootstrap-staging}"
export PLATFORM_ADMIN_TEMP_SECRET="${PLATFORM_ADMIN_TEMP_SECRET:-arcadia-staging-platform-admin-password-bootstrap}"

log() {
  printf "\n==> %s\n" "$*" >&2
}

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required value: ${name}" >&2
    echo "Run bash infra/staging/full-setup.sh and copy github-variables.txt first." >&2
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
require_value CLOUD_SQL_CONNECTION_NAME
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

PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-ArcadiaAdmin-$(openssl rand -hex 12)}"

log "Creating temporary Secret Manager password"
cleanup

printf "%s" "$PLATFORM_ADMIN_PASSWORD" | gcloud secrets create "$PLATFORM_ADMIN_TEMP_SECRET" \
  --project="$PROJECT_ID" \
  --replication-policy="automatic" \
  --labels="app=arcadia,env=staging,purpose=platform-admin-bootstrap" \
  --data-file=- >/dev/null

gcloud secrets add-iam-policy-binding "$PLATFORM_ADMIN_TEMP_SECRET" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

APP_ENV_VARS="^|^ENVIRONMENT=staging|AUTO_CREATE_TABLES=false|PLATFORM_ADMIN_NAME=${PLATFORM_ADMIN_NAME}|PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL}"
APP_SECRET_REFS="DATABASE_URL=${DATABASE_URL_SECRET}:latest,REDIS_URL=${REDIS_URL_SECRET}:latest,CELERY_BROKER_URL=${CELERY_BROKER_URL_SECRET}:latest,CELERY_RESULT_BACKEND=${CELERY_RESULT_BACKEND_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest,ENCRYPTION_KEY=${ENCRYPTION_KEY_SECRET_NAME}:latest,VAULT_MASTER_KEY=${VAULT_MASTER_KEY_SECRET_NAME}:latest,PLATFORM_ADMIN_PASSWORD=${PLATFORM_ADMIN_TEMP_SECRET}:latest"

log "Deploying one-time platform admin bootstrap job"
gcloud run jobs deploy "$PLATFORM_ADMIN_JOB" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE_URI" \
  --service-account="$CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars="$APP_ENV_VARS" \
  --set-secrets="$APP_SECRET_REFS" \
  --vpc-connector="$VPC_CONNECTOR" \
  --vpc-egress="$VPC_EGRESS" \
  --command="python" \
  --args="-m,app.seeds.seed_platform_admin" \
  --tasks=1 \
  --max-retries=0 \
  --task-timeout=300s \
  --quiet

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

Platform admin bootstrap finished.

Save these credentials in your password manager now:

Platform URL: ${SERVICE_URL}
Email: ${PLATFORM_ADMIN_EMAIL}
Password: ${PLATFORM_ADMIN_PASSWORD}

Important:
- If the job logs say "Platform admin already exists", this password was not applied.
- For that case, rerun with a new PLATFORM_ADMIN_EMAIL or add a controlled password reset flow.
- The temporary Cloud Run Job and Secret Manager password secret are deleted automatically.
EOF
