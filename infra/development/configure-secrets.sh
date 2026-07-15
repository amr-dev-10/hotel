#!/usr/bin/env bash
set -euo pipefail

# Arcadia development Secret Manager configuration for Google Cloud Shell.
# Supabase is used for Postgres; the database URL is stored only in Google
# Secret Manager and referenced by GitHub environment variables.

export PROJECT_ID="${PROJECT_ID:-hotel-development-502419}"
export REGION="${REGION:-asia-south2}"

export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-arcadia-repo}"
export BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-backend-api}"

export REDIS_INSTANCE="${REDIS_INSTANCE:-arcadia-redis-development}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-development}"
export VPC_EGRESS="${VPC_EGRESS:-private-ranges-only}"

export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-development}"
export CLOUD_RUN_MIGRATION_JOB="${CLOUD_RUN_MIGRATION_JOB:-arcadia-backend-migrate-development}"

export RUNTIME_SA="${RUNTIME_SA:-arcadia-backend-run-dev}"
export FRONTEND_RUNTIME_SA="${FRONTEND_RUNTIME_SA:-arcadia-dashboard-run-dev}"
export DEPLOY_SA="${DEPLOY_SA:-arcadia-github-deploy-dev}"

export WIF_POOL="${WIF_POOL:-github-actions-pool}"
export WIF_PROVIDER="${WIF_PROVIDER:-github-actions-provider}"

export DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-arcadia-development-database-url}"
export REDIS_URL_SECRET="${REDIS_URL_SECRET:-arcadia-development-redis-url}"
export CELERY_BROKER_URL_SECRET="${CELERY_BROKER_URL_SECRET:-arcadia-development-celery-broker-url}"
export CELERY_RESULT_BACKEND_SECRET="${CELERY_RESULT_BACKEND_SECRET:-arcadia-development-celery-result-backend}"
export JWT_SECRET_NAME="${JWT_SECRET_NAME:-arcadia-development-jwt-secret}"
export ENCRYPTION_KEY_SECRET_NAME="${ENCRYPTION_KEY_SECRET_NAME:-arcadia-development-encryption-key}"
export VAULT_MASTER_KEY_SECRET_NAME="${VAULT_MASTER_KEY_SECRET_NAME:-arcadia-development-vault-master-key}"

export CORS_ORIGINS="${CORS_ORIGINS:-*}"
export DEFAULT_TIMEZONE="${DEFAULT_TIMEZONE:-Asia/Kolkata}"
export WHATSAPP_API_VERSION="${WHATSAPP_API_VERSION:-v25.0}"
export WHATSAPP_DRY_RUN="${WHATSAPP_DRY_RUN:-true}"
export WHATSAPP_VERIFY_TOKEN_SECRET="${WHATSAPP_VERIFY_TOKEN_SECRET:-arcadia-development-whatsapp-verify-token}"
export WHATSAPP_APP_SECRET_SECRET="${WHATSAPP_APP_SECRET_SECRET:-arcadia-development-whatsapp-app-secret}"

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
      --labels="app=arcadia,env=development" >/dev/null
  fi
}

ensure_random_secret() {
  local secret_name="$1"
  local hex_bytes="${2:-32}"
  local current

  ensure_secret "$secret_name"
  current="$(secret_value "$secret_name")"
  if [[ -n "$current" ]]; then
    echo "Reusing existing secret: $secret_name" >&2
    return
  fi

  openssl rand -hex "$hex_bytes" | gcloud secrets versions add "$secret_name" \
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

build_supabase_database_url() {
  if [[ -n "${SUPABASE_DATABASE_URL:-}" ]]; then
    printf "%s" "$SUPABASE_DATABASE_URL"
    return
  fi

  local password
  local encoded_password
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    password="$SUPABASE_DB_PASSWORD"
  else
    if [[ ! -t 0 ]]; then
      echo "SUPABASE_DATABASE_URL or SUPABASE_DB_PASSWORD is required for non-interactive runs." >&2
      exit 1
    fi
    read -rsp "Supabase DB password: " password
    echo >&2
  fi

  encoded_password="$(SUPABASE_DB_PASSWORD="$password" python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"], safe=""))')"
  printf "postgresql+psycopg://postgres.sxanwwkmhmgtinsilbqm:%s@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require" "$encoded_password"
}

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export FRONTEND_RUNTIME_SA_EMAIL="${FRONTEND_RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"

log "Reading Redis host"
export REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format="value(host)")"

log "Creating or updating database and Redis connection secrets"
DATABASE_URL="$(build_supabase_database_url)"
ensure_value_secret "$DATABASE_URL_SECRET" "$DATABASE_URL"
ensure_value_secret "$REDIS_URL_SECRET" "redis://${REDIS_HOST}:6379/0"
ensure_value_secret "$CELERY_BROKER_URL_SECRET" "redis://${REDIS_HOST}:6379/1"
ensure_value_secret "$CELERY_RESULT_BACKEND_SECRET" "redis://${REDIS_HOST}:6379/2"
unset DATABASE_URL

log "Creating or reusing long-lived app secrets"
ensure_random_secret "$JWT_SECRET_NAME" 32
ensure_random_secret "$ENCRYPTION_KEY_SECRET_NAME" 32
ensure_random_secret "$VAULT_MASTER_KEY_SECRET_NAME" 32
ensure_random_secret "$WHATSAPP_VERIFY_TOKEN_SECRET" 24

if [[ -n "$(secret_value "$WHATSAPP_APP_SECRET_SECRET")" ]]; then
  echo "Reusing existing secret: $WHATSAPP_APP_SECRET_SECRET" >&2
else
  ensure_value_secret "$WHATSAPP_APP_SECRET_SECRET" "development-dry-run-placeholder"
fi

cat > development-github-variables.txt <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY}
BACKEND_IMAGE_NAME=${BACKEND_IMAGE_NAME}
CLOUD_RUN_SERVICE=${CLOUD_RUN_SERVICE}
CLOUD_RUN_MIGRATION_JOB=${CLOUD_RUN_MIGRATION_JOB}
CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA_EMAIL}
CLOUD_SQL_CONNECTION_NAME=
VPC_CONNECTOR=${VPC_CONNECTOR}
VPC_EGRESS=${VPC_EGRESS}
GCP_WORKLOAD_IDENTITY_PROVIDER=${WIF_PROVIDER_RESOURCE}
GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA_EMAIL}
CORS_ORIGINS=${CORS_ORIGINS}
DEFAULT_TIMEZONE=${DEFAULT_TIMEZONE}
WHATSAPP_API_VERSION=${WHATSAPP_API_VERSION}
WHATSAPP_DRY_RUN=${WHATSAPP_DRY_RUN}
WHATSAPP_VERIFY_TOKEN_SECRET=${WHATSAPP_VERIFY_TOKEN_SECRET}
WHATSAPP_APP_SECRET_SECRET=${WHATSAPP_APP_SECRET_SECRET}
DATABASE_URL_SECRET=${DATABASE_URL_SECRET}
REDIS_URL_SECRET=${REDIS_URL_SECRET}
CELERY_BROKER_URL_SECRET=${CELERY_BROKER_URL_SECRET}
CELERY_RESULT_BACKEND_SECRET=${CELERY_RESULT_BACKEND_SECRET}
JWT_SECRET_NAME=${JWT_SECRET_NAME}
ENCRYPTION_KEY_SECRET_NAME=${ENCRYPTION_KEY_SECRET_NAME}
VAULT_MASTER_KEY_SECRET_NAME=${VAULT_MASTER_KEY_SECRET_NAME}
EOF

cat > development-github-secrets.txt <<EOF
No GitHub Environment Secrets are required for the backend deploy workflow.

Application secrets are stored in Google Secret Manager and referenced by
the GitHub Environment Variables in development-github-variables.txt.

Do not paste DATABASE_URL, Redis URLs, JWT_SECRET, ENCRYPTION_KEY, or
VAULT_MASTER_KEY into GitHub.
EOF

cat > development-secret-manager-summary.txt <<EOF
Secret Manager values configured:

${DATABASE_URL_SECRET}
${REDIS_URL_SECRET}
${CELERY_BROKER_URL_SECRET}
${CELERY_RESULT_BACKEND_SECRET}
${JWT_SECRET_NAME}
${ENCRYPTION_KEY_SECRET_NAME}
${VAULT_MASTER_KEY_SECRET_NAME}

GitHub output files:
development-github-variables.txt
development-github-secrets.txt
EOF

cat development-secret-manager-summary.txt
