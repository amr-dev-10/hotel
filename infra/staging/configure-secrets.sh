#!/usr/bin/env bash
set -euo pipefail

# Arcadia staging application secret configuration for Google Cloud Shell.
# Random secrets are generated once and then reused. Derived connection secrets
# are updated only if the underlying Cloud SQL or Redis values changed.

export PROJECT_ID="${PROJECT_ID:-arcadia-hotel-staging}"
export REGION="${REGION:-asia-south2}"
export GITHUB_REPO="${GITHUB_REPO:-amr-dev-10/hotel}"

export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-arcadia-repo}"
export BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-backend-api}"

export DB_INSTANCE="${DB_INSTANCE:-arcadia-db-staging}"
export DB_NAME="${DB_NAME:-arcadia}"
export DB_USER="${DB_USER:-arcadia_app}"
export DB_PASSWORD_SECRET="${DB_PASSWORD_SECRET:-arcadia-staging-db-password}"

export REDIS_INSTANCE="${REDIS_INSTANCE:-arcadia-redis-staging}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-staging}"
export VPC_EGRESS="${VPC_EGRESS:-private-ranges-only}"

export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-staging}"
export CLOUD_RUN_MIGRATION_JOB="${CLOUD_RUN_MIGRATION_JOB:-arcadia-backend-migrate-staging}"

export RUNTIME_SA="${RUNTIME_SA:-arcadia-backend-runner-staging}"
export DEPLOY_SA="${DEPLOY_SA:-arcadia-github-deploy-staging}"
export WIF_POOL="${WIF_POOL:-github-actions-pool}"
export WIF_PROVIDER="${WIF_PROVIDER:-github-actions-provider}"

export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-arcadia-staging-database-url}"
export REDIS_URL_SECRET="${REDIS_URL_SECRET:-arcadia-staging-redis-url}"
export CELERY_BROKER_URL_SECRET="${CELERY_BROKER_URL_SECRET:-arcadia-staging-celery-broker-url}"
export CELERY_RESULT_BACKEND_SECRET="${CELERY_RESULT_BACKEND_SECRET:-arcadia-staging-celery-result-backend}"
export JWT_SECRET_NAME="${JWT_SECRET_NAME:-arcadia-staging-jwt-secret}"
export ENCRYPTION_KEY_SECRET_NAME="${ENCRYPTION_KEY_SECRET_NAME:-arcadia-staging-encryption-key}"
export VAULT_MASTER_KEY_SECRET_NAME="${VAULT_MASTER_KEY_SECRET_NAME:-arcadia-staging-vault-master-key}"

export CORS_ORIGINS="${CORS_ORIGINS:-*}"
export DEFAULT_TIMEZONE="${DEFAULT_TIMEZONE:-Asia/Kolkata}"
export WHATSAPP_DRY_RUN="${WHATSAPP_DRY_RUN:-true}"

log() {
  printf "\n==> %s\n" "$*" >&2
}

secret_value() {
  gcloud secrets versions access latest \
    --secret="$1" \
    --project="$PROJECT_ID" 2>/dev/null || true
}

ensure_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$PROJECT_ID" \
      --replication-policy="automatic" \
      --labels="app=arcadia,env=staging" >/dev/null
  fi
}

ensure_random_secret() {
  local secret_name="$1"
  local hex_bytes="$2"
  local current
  local generated

  ensure_secret "$secret_name"
  current="$(secret_value "$secret_name")"
  if [[ -n "$current" ]]; then
    echo "Reusing existing secret: $secret_name" >&2
    return
  fi

  generated="$(openssl rand -hex "$hex_bytes")"
  printf "%s" "$generated" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null
  echo "Created secret: $secret_name" >&2
}

ensure_value_secret() {
  local secret_name="$1"
  local desired_value="$2"
  local current

  ensure_secret "$secret_name"
  current="$(secret_value "$secret_name")"
  if [[ "$current" == "$desired_value" ]]; then
    echo "Secret unchanged: $secret_name" >&2
    return
  fi

  printf "%s" "$desired_value" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null
  echo "Updated secret version: $secret_name" >&2
}

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"

log "Reading infrastructure outputs"
export DB_PASSWORD="$(secret_value "$DB_PASSWORD_SECRET")"
if [[ -z "$DB_PASSWORD" ]]; then
  echo "Missing ${DB_PASSWORD_SECRET}. Run: bash infra/staging/bootstrap.sh" >&2
  exit 1
fi

export CLOUD_SQL_CONNECTION_NAME="$(gcloud sql instances describe "$DB_INSTANCE" --format="value(connectionName)")"
export REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format="value(host)")"

export DATABASE_URL="postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION_NAME}"
export REDIS_URL="redis://${REDIS_HOST}:6379/0"
export CELERY_BROKER_URL="redis://${REDIS_HOST}:6379/1"
export CELERY_RESULT_BACKEND="redis://${REDIS_HOST}:6379/2"

log "Creating or updating derived connection secrets"
ensure_value_secret "$DATABASE_URL_SECRET" "$DATABASE_URL"
ensure_value_secret "$REDIS_URL_SECRET" "$REDIS_URL"
ensure_value_secret "$CELERY_BROKER_URL_SECRET" "$CELERY_BROKER_URL"
ensure_value_secret "$CELERY_RESULT_BACKEND_SECRET" "$CELERY_RESULT_BACKEND"

log "Creating or reusing long-lived app secrets"
ensure_random_secret "$JWT_SECRET_NAME" 32
ensure_random_secret "$ENCRYPTION_KEY_SECRET_NAME" 32
ensure_random_secret "$VAULT_MASTER_KEY_SECRET_NAME" 32

cat > github-variables.txt <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY}
BACKEND_IMAGE_NAME=${BACKEND_IMAGE_NAME}
CLOUD_RUN_SERVICE=${CLOUD_RUN_SERVICE}
CLOUD_RUN_MIGRATION_JOB=${CLOUD_RUN_MIGRATION_JOB}
CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA_EMAIL}
CLOUD_SQL_CONNECTION_NAME=${CLOUD_SQL_CONNECTION_NAME}
VPC_CONNECTOR=${VPC_CONNECTOR}
VPC_EGRESS=${VPC_EGRESS}
GCP_WORKLOAD_IDENTITY_PROVIDER=${WIF_PROVIDER_RESOURCE}
GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA_EMAIL}
CORS_ORIGINS=${CORS_ORIGINS}
DEFAULT_TIMEZONE=${DEFAULT_TIMEZONE}
WHATSAPP_DRY_RUN=${WHATSAPP_DRY_RUN}
DATABASE_URL_SECRET=${DATABASE_URL_SECRET}
REDIS_URL_SECRET=${REDIS_URL_SECRET}
CELERY_BROKER_URL_SECRET=${CELERY_BROKER_URL_SECRET}
CELERY_RESULT_BACKEND_SECRET=${CELERY_RESULT_BACKEND_SECRET}
JWT_SECRET_NAME=${JWT_SECRET_NAME}
ENCRYPTION_KEY_SECRET_NAME=${ENCRYPTION_KEY_SECRET_NAME}
VAULT_MASTER_KEY_SECRET_NAME=${VAULT_MASTER_KEY_SECRET_NAME}
EOF

cat > github-secrets.txt <<EOF
No GitHub Environment Secrets are required for the backend deploy workflow.

Application secrets are stored in Google Secret Manager and referenced by
the GitHub Environment Variables in github-variables.txt.

Do not paste DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, VAULT_MASTER_KEY, or
Redis URLs into GitHub. Keep those values in Secret Manager.
EOF

cat > secret-manager-summary.txt <<EOF
Secret Manager values configured:

${DATABASE_URL_SECRET}
${REDIS_URL_SECRET}
${CELERY_BROKER_URL_SECRET}
${CELERY_RESULT_BACKEND_SECRET}
${JWT_SECRET_NAME}
${ENCRYPTION_KEY_SECRET_NAME}
${VAULT_MASTER_KEY_SECRET_NAME}

GitHub output files:
github-variables.txt
github-secrets.txt
EOF

cat secret-manager-summary.txt
