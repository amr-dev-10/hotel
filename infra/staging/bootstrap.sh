#!/usr/bin/env bash
set -euo pipefail

# Arcadia staging infrastructure bootstrap for Google Cloud Shell.
# Re-runs are safe: existing resources are reused, and the DB password is
# stored in Secret Manager instead of regenerated on every run.

export PROJECT_ID="${PROJECT_ID:-arcadia-hotel-staging}"
export REGION="${REGION:-asia-south2}"
export GITHUB_REPO="${GITHUB_REPO:-amr-dev-10/hotel}"

export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-arcadia-repo}"
export BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-backend-api}"

export DB_INSTANCE="${DB_INSTANCE:-arcadia-db-staging}"
export DB_NAME="${DB_NAME:-arcadia}"
export DB_USER="${DB_USER:-arcadia_app}"
export DB_EDITION="${DB_EDITION:-enterprise}"
export DB_TIER="${DB_TIER:-db-g1-small}"
export DB_PASSWORD_SECRET="${DB_PASSWORD_SECRET:-arcadia-staging-db-password}"

export REDIS_INSTANCE="${REDIS_INSTANCE:-arcadia-redis-staging}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-staging}"
export VPC_RANGE="${VPC_RANGE:-10.8.0.0/28}"

export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-staging}"
export CLOUD_RUN_MIGRATION_JOB="${CLOUD_RUN_MIGRATION_JOB:-arcadia-backend-migrate-staging}"

export RUNTIME_SA="${RUNTIME_SA:-arcadia-backend-runner-staging}"
export DEPLOY_SA="${DEPLOY_SA:-arcadia-github-deployer-staging}"

export WIF_POOL="${WIF_POOL:-github-actions-pool}"
export WIF_PROVIDER="${WIF_PROVIDER:-github-actions-provider}"

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

  ensure_secret "$secret_name"
  current="$(secret_value "$secret_name")"
  if [[ -n "$current" ]]; then
    printf "%s" "$current"
    return
  fi

  current="$(openssl rand -hex "$hex_bytes")"
  printf "%s" "$current" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null
  printf "%s" "$current"
}

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

log "Enabling Google Cloud APIs"
gcloud services enable \
  serviceusage.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com

log "Creating or reusing Artifact Registry"
if ! gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Arcadia backend Docker images"
else
  echo "Artifact Registry already exists."
fi

log "Creating or reusing Cloud SQL PostgreSQL"
if ! gcloud sql instances describe "$DB_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition="$DB_EDITION" \
    --tier="$DB_TIER" \
    --region="$REGION" \
    --storage-size=10GB \
    --availability-type=ZONAL \
    --no-deletion-protection
else
  echo "Cloud SQL instance already exists."
fi

if ! gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
else
  echo "Database already exists."
fi

log "Creating or reusing DB password secret"
export DB_PASSWORD="$(ensure_random_secret "$DB_PASSWORD_SECRET" 24)"

if gcloud sql users list --instance="$DB_INSTANCE" --format="value(name)" | grep -qx "$DB_USER"; then
  echo "Database user exists. Re-applying the Secret Manager password."
  gcloud sql users set-password "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD"
else
  gcloud sql users create "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD"
fi

export CLOUD_SQL_CONNECTION_NAME="$(gcloud sql instances describe "$DB_INSTANCE" --format="value(connectionName)")"

log "Creating or reusing Redis"
if ! gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" >/dev/null 2>&1; then
  gcloud redis instances create "$REDIS_INSTANCE" \
    --region="$REGION" \
    --size=1 \
    --tier=basic \
    --redis-version=redis_7_0 \
    --network=default
else
  echo "Redis instance already exists."
fi

export REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format="value(host)")"

log "Creating or reusing Serverless VPC Access connector"
if ! gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --region="$REGION" >/dev/null 2>&1; then
  gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
    --region="$REGION" \
    --network=default \
    --range="$VPC_RANGE"
else
  echo "VPC connector already exists."
fi

log "Creating or reusing service accounts"
if ! gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA" \
    --display-name="Arcadia Backend Runtime Staging"
else
  echo "Runtime service account already exists."
fi

if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA" \
    --display-name="GitHub Actions Deploy Staging"
else
  echo "Deploy service account already exists."
fi

log "Granting runtime service account permissions"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/vpcaccess.user" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

log "Granting GitHub deploy service account permissions"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/run.admin" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/vpcaccess.user" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/secretmanager.viewer" \
  --quiet

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID" \
  --quiet

log "Creating or reusing Workload Identity Federation pool"
if ! gcloud iam workload-identity-pools describe "$WIF_POOL" \
  --project="$PROJECT_ID" \
  --location="global" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$WIF_POOL" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions"
else
  echo "Workload Identity pool already exists."
fi

log "Creating or reusing GitHub OIDC provider"
if ! gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL" \
    --display-name="GitHub Actions provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
else
  echo "Workload Identity provider already exists."
fi

export WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"

log "Allowing GitHub repo to impersonate deploy service account"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}" \
  --quiet

cat > bootstrap-summary.txt <<EOF
Arcadia staging infrastructure is ready.

Project: ${PROJECT_ID}
Region: ${REGION}
Cloud SQL connection name: ${CLOUD_SQL_CONNECTION_NAME}
Redis host: ${REDIS_HOST}
Runtime service account: ${RUNTIME_SA_EMAIL}
Deploy service account: ${DEPLOY_SA_EMAIL}
Workload Identity provider: ${WIF_PROVIDER_RESOURCE}
DB password secret: ${DB_PASSWORD_SECRET}

Next command:
bash infra/staging/configure-secrets.sh
EOF

cat bootstrap-summary.txt
