#!/usr/bin/env bash
set -euo pipefail

# Arcadia development infrastructure bootstrap for Google Cloud Shell.
# This intentionally does not create Cloud SQL. Development uses Supabase
# Postgres through the DATABASE_URL Secret Manager value.

export PROJECT_ID="${PROJECT_ID:-hotel-development-502419}"
export REGION="${REGION:-asia-south2}"
export GITHUB_REPO="${GITHUB_REPO:-amr-dev-10/hotel}"

export ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-arcadia-repo}"
export BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-backend-api}"
export FRONTEND_IMAGE_NAME="${FRONTEND_IMAGE_NAME:-dashboard-web}"

export REDIS_INSTANCE="${REDIS_INSTANCE:-arcadia-redis-development}"
export VPC_CONNECTOR="${VPC_CONNECTOR:-arcadia-vpc-development}"
export VPC_RANGE="${VPC_RANGE:-10.9.0.0/28}"

export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-arcadia-backend-development}"
export CLOUD_RUN_MIGRATION_JOB="${CLOUD_RUN_MIGRATION_JOB:-arcadia-backend-migrate-development}"
export FRONTEND_CLOUD_RUN_SERVICE="${FRONTEND_CLOUD_RUN_SERVICE:-arcadia-dashboard-development}"

export RUNTIME_SA="${RUNTIME_SA:-arcadia-backend-runner-development}"
export FRONTEND_RUNTIME_SA="${FRONTEND_RUNTIME_SA:-arcadia-dashboard-runner-development}"
export DEPLOY_SA="${DEPLOY_SA:-arcadia-github-deploy-development}"

export WIF_POOL="${WIF_POOL:-github-actions-pool}"
export WIF_PROVIDER="${WIF_PROVIDER:-github-actions-provider}"

log() {
  printf "\n==> %s\n" "$*" >&2
}

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export FRONTEND_RUNTIME_SA_EMAIL="${FRONTEND_RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

log "Enabling Google Cloud APIs"
gcloud services enable \
  serviceusage.googleapis.com \
  run.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com

log "Creating or reusing Artifact Registry"
if ! gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Arcadia development Docker images"
else
  echo "Artifact Registry already exists."
fi

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
    --display-name="Arcadia backend runner development"
else
  echo "Backend runtime service account already exists."
fi

if ! gcloud iam service-accounts describe "$FRONTEND_RUNTIME_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$FRONTEND_RUNTIME_SA" \
    --display-name="Arcadia dashboard runner development"
else
  echo "Frontend runtime service account already exists."
fi

if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOY_SA" \
    --display-name="GitHub Actions deploy development"
else
  echo "Deploy service account already exists."
fi

log "Granting runtime service account permissions"
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
  --role="roles/secretmanager.viewer" \
  --quiet

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID" \
  --quiet

gcloud iam service-accounts add-iam-policy-binding "$FRONTEND_RUNTIME_SA_EMAIL" \
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

cat > development-bootstrap-summary.txt <<EOF
Arcadia development infrastructure is ready.

Project: ${PROJECT_ID}
Region: ${REGION}
Redis host: ${REDIS_HOST}
Backend runtime service account: ${RUNTIME_SA_EMAIL}
Frontend runtime service account: ${FRONTEND_RUNTIME_SA_EMAIL}
Deploy service account: ${DEPLOY_SA_EMAIL}
Workload Identity provider: ${WIF_PROVIDER_RESOURCE}

Next command:
bash infra/development/configure-secrets.sh
EOF

cat development-bootstrap-summary.txt
