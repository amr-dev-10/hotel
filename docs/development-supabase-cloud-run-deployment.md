# Development Server Deployment: Cloud Run + Supabase

This runbook deploys the Arcadia development server the same way staging is
deployed, with one intentional difference:

- Staging uses Google Cloud SQL.
- Development uses Supabase Postgres.

The backend GitHub Action still runs Alembic automatically before deploying the
Cloud Run service:

```text
push to development
-> run tests
-> build backend image
-> deploy Cloud Run migration job
-> run alembic -c alembic.ini upgrade head
-> deploy backend service only if migration succeeds
-> smoke test /health
```

## 0. Important Supabase URL Note

You provided:

```text
postgresql://postgres.sxanwwkmhmgtinsilbqm:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

That is the Supabase shared pooler transaction-mode port, `6543`. This project
now disables psycopg prepared statements automatically when the URL contains
`pooler.supabase.com:6543`, so the Cloud Run app and Alembic migration job can
use the transaction pooler.

Use this SQLAlchemy URL format in Google Secret Manager:

```text
postgresql+psycopg://postgres.sxanwwkmhmgtinsilbqm:<URL_ENCODED_PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
```

Use `postgresql+psycopg://`, not plain `postgresql://`, because the backend uses
the `psycopg` SQLAlchemy driver.

If you later choose the Supabase session pooler instead, change only the port to
`5432`.

## Where Each Step Runs

Use this before following the sequence:

| Step | Where you do it |
| --- | --- |
| Commit and push repo files | Your local terminal in this repo |
| Supabase project/password lookup | Supabase Dashboard |
| Google APIs, Redis, IAM, Secret Manager | Google Cloud Shell |
| `DATABASE_URL` setup | Google Cloud Shell, stored in Google Secret Manager |
| GitHub environment variables | GitHub repo Settings -> Environments |
| Backend deploy | GitHub Actions |
| Frontend deploy | GitHub Actions |
| Super admin creation | Google Cloud Shell after backend deploy |

## 1. Push The Deployment Workflow Changes

These files must be on the `development` branch before GitHub Actions can deploy
development:

```text
.github/workflows/deploy-backend.yml
.github/workflows/deploy-frontend.yml
backend/app/core/database.py
backend/alembic/env.py
docs/development-supabase-cloud-run-deployment.md
infra/development/
```

From your local machine:

```bash
git add .github/workflows/deploy-backend.yml .github/workflows/deploy-frontend.yml backend/app/core/database.py backend/alembic/env.py docs/development-supabase-cloud-run-deployment.md docs/README.md infra/development
git commit -m "Add development Supabase Cloud Run deployment"
git checkout -B development
git push -u origin development
```

If `development` already exists:

```bash
git checkout development
git pull origin development
git push origin development
```

## 2. Open Google Cloud Shell

Open Google Cloud Console, select the Google Cloud project you want to use, then
open Cloud Shell.

Recommended project choice:

```text
Best isolation: a separate project such as arcadia-hotel-development
Fastest setup: the same project used for staging, with development resource names
```

All commands below use `PROJECT_ID`. Set it carefully before running anything.

## 3. Clone The Development Branch In Cloud Shell

```bash
git clone -b development https://github.com/amr-dev-10/hotel.git
cd hotel
```

If the repo already exists in Cloud Shell:

```bash
cd ~/hotel
git fetch origin
git checkout development
git pull origin development
```

## 4. Set Development Variables

Paste this in Cloud Shell. Replace `PROJECT_ID` if needed.

```bash
export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"

export ARTIFACT_REPOSITORY="arcadia-repo"
export BACKEND_IMAGE_NAME="backend-api"
export FRONTEND_IMAGE_NAME="dashboard-web"

export CLOUD_RUN_SERVICE="arcadia-backend-development"
export CLOUD_RUN_MIGRATION_JOB="arcadia-backend-migrate-development"
export FRONTEND_CLOUD_RUN_SERVICE="arcadia-dashboard-development"

export RUNTIME_SA="arcadia-backend-runner-development"
export FRONTEND_RUNTIME_SA="arcadia-dashboard-runner-development"
export DEPLOY_SA="arcadia-github-deploy-development"

export REDIS_INSTANCE="arcadia-redis-development"
export VPC_CONNECTOR="arcadia-vpc-development"
export VPC_RANGE="10.9.0.0/28"
export VPC_EGRESS="private-ranges-only"

export WIF_POOL="github-actions-pool"
export WIF_PROVIDER="github-actions-provider"

export DATABASE_URL_SECRET="arcadia-development-database-url"
export REDIS_URL_SECRET="arcadia-development-redis-url"
export CELERY_BROKER_URL_SECRET="arcadia-development-celery-broker-url"
export CELERY_RESULT_BACKEND_SECRET="arcadia-development-celery-result-backend"
export JWT_SECRET_NAME="arcadia-development-jwt-secret"
export ENCRYPTION_KEY_SECRET_NAME="arcadia-development-encryption-key"
export VAULT_MASTER_KEY_SECRET_NAME="arcadia-development-vault-master-key"

export WHATSAPP_DRY_RUN="true"
export WHATSAPP_VERIFY_TOKEN_SECRET="arcadia-development-whatsapp-verify-token"
export WHATSAPP_APP_SECRET_SECRET="arcadia-development-whatsapp-app-secret"
export CORS_ORIGINS="*"
export DEFAULT_TIMEZONE="Asia/Kolkata"
export WHATSAPP_API_VERSION="v25.0"
```

If `10.9.0.0/28` is already used by another VPC connector, change `VPC_RANGE`
to another unused `/28`, for example `10.10.0.0/28`.

Recommended setup command:

```bash
bash infra/development/full-setup.sh
```

This runs:

```bash
bash infra/development/bootstrap.sh
bash infra/development/configure-secrets.sh
```

`configure-secrets.sh` asks for the Supabase DB password, URL-encodes it, stores
the final transaction-pooler `DATABASE_URL` in Google Secret Manager, and writes
`development-github-variables.txt`.

If this command completes successfully, skip to Step 14. Steps 5 through 13
below show what the development scripts do internally and are useful for manual
debugging.

## 5. Enable Google Cloud APIs

No Cloud SQL API is needed for this development setup.

```bash
gcloud config set project "$PROJECT_ID"

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
```

## 6. Create Or Reuse Artifact Registry

```bash
if ! gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Arcadia Docker images"
else
  echo "Artifact Registry already exists."
fi
```

## 7. Create Or Reuse Redis And VPC Connector

The database is Supabase, but the backend still uses Redis/Celery. This keeps
the same Memorystore Redis pattern used by staging.

```bash
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

if ! gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --region="$REGION" >/dev/null 2>&1; then
  gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
    --region="$REGION" \
    --network=default \
    --range="$VPC_RANGE"
else
  echo "VPC connector already exists."
fi
```

## 8. Create Service Accounts

```bash
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export FRONTEND_RUNTIME_SA_EMAIL="${FRONTEND_RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

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
```

## 9. Grant IAM Permissions

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/vpcaccess.user" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

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
```

## 10. Configure GitHub Workload Identity Federation

If the project already has the same GitHub WIF pool/provider from staging, these
commands reuse it.

```bash
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

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}" \
  --quiet
```

## 11. Create Supabase Database URL Secret

Run this section in Google Cloud Shell. This is where the database URL is
configured.

The final `DATABASE_URL` is stored in Google Secret Manager under:

```text
arcadia-development-database-url
```

GitHub only receives this secret name:

```text
DATABASE_URL_SECRET=arcadia-development-database-url
```

Do not paste the actual Supabase URL or password into GitHub.

In Cloud Shell, enter the Supabase database password when prompted:

```bash
read -rsp "Supabase DB password: " SUPABASE_DB_PASSWORD
echo
export SUPABASE_DB_PASSWORD
export ENCODED_SUPABASE_PASSWORD="$(python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"], safe=""))')"
unset SUPABASE_DB_PASSWORD

export SUPABASE_DATABASE_URL="postgresql+psycopg://postgres.sxanwwkmhmgtinsilbqm:${ENCODED_SUPABASE_PASSWORD}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
unset ENCODED_SUPABASE_PASSWORD
```

Create or update the Secret Manager secret:

```bash
if ! gcloud secrets describe "$DATABASE_URL_SECRET" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create "$DATABASE_URL_SECRET" \
    --project="$PROJECT_ID" \
    --replication-policy="automatic" \
    --labels="app=arcadia,env=development"
fi

printf "%s" "$SUPABASE_DATABASE_URL" | gcloud secrets versions add "$DATABASE_URL_SECRET" \
  --project="$PROJECT_ID" \
  --data-file=-

unset SUPABASE_DATABASE_URL
```

Do not run `scripts/postgres_setup.sql` against Supabase. Supabase already has
the project database and role; Alembic will create the application schema.

## 12. Create Redis And App Secret Manager Values

```bash
ensure_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$PROJECT_ID" \
      --replication-policy="automatic" \
      --labels="app=arcadia,env=development" >/dev/null
  fi
}

set_value_secret() {
  local secret_name="$1"
  local desired_value="$2"
  ensure_secret "$secret_name"
  printf "%s" "$desired_value" | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null
  echo "Updated $secret_name"
}

ensure_random_secret() {
  local secret_name="$1"
  ensure_secret "$secret_name"
  if gcloud secrets versions access latest --secret="$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Reusing $secret_name"
    return
  fi
  openssl rand -hex 32 | gcloud secrets versions add "$secret_name" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null
  echo "Created $secret_name"
}

set_value_secret "$REDIS_URL_SECRET" "redis://${REDIS_HOST}:6379/0"
set_value_secret "$CELERY_BROKER_URL_SECRET" "redis://${REDIS_HOST}:6379/1"
set_value_secret "$CELERY_RESULT_BACKEND_SECRET" "redis://${REDIS_HOST}:6379/2"

ensure_random_secret "$JWT_SECRET_NAME"
ensure_random_secret "$ENCRYPTION_KEY_SECRET_NAME"
ensure_random_secret "$VAULT_MASTER_KEY_SECRET_NAME"
ensure_random_secret "$WHATSAPP_VERIFY_TOKEN_SECRET"

ensure_secret "$WHATSAPP_APP_SECRET_SECRET"
```

`WHATSAPP_APP_SECRET_SECRET` may remain empty while `WHATSAPP_DRY_RUN=true`.

## 13. Generate GitHub Development Variables

```bash
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

cat development-github-variables.txt
```

## 14. Configure GitHub Environment

Open:

```text
https://github.com/amr-dev-10/hotel
```

Go to:

```text
Settings -> Environments -> New environment
```

Create:

```text
development
```

Add every line from `development-github-variables.txt` as a GitHub environment
variable.

Do not add application secrets to GitHub. GitHub stores only Secret Manager
secret names.

## 15. Deploy Backend Development

Use GitHub UI:

```text
Actions -> Backend CI/CD -> Run workflow
Branch: development
target: development
```

Or push a backend change to `development`:

```bash
git checkout development
git push origin development
```

Expected backend workflow order:

```text
Run backend tests
Build backend Docker image
Deploy arcadia-backend-migrate-development
Run alembic upgrade head against Supabase
Deploy arcadia-backend-development
Smoke test /health
```

If Alembic fails, the backend service is not deployed.

## 16. Verify Backend

In Cloud Shell:

```bash
SERVICE_URL="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

echo "$SERVICE_URL"
curl "$SERVICE_URL/health"
```

Expected:

```json
{"ok":true}
```

In Supabase SQL Editor, you can verify migration history:

```sql
select * from alembic_version;
```

## 17. Configure Frontend Development Variables

Run this only after the backend deploy succeeds.

Recommended command:

```bash
bash infra/development/configure-frontend.sh
```

This writes `frontend-development-github-variables.txt`. Add every line from
that file to the same GitHub `development` environment.

Manual fallback:

```bash
SERVICE_URL="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

export API_PROXY_TARGET="$SERVICE_URL"
export NEXT_PUBLIC_API_BASE_URL="/api/v1"
export NEXT_PUBLIC_WS_BASE_URL="wss://${SERVICE_URL#https://}"
export FRONTEND_MEMORY="1Gi"
export FRONTEND_CPU="1"
export FRONTEND_MIN_INSTANCES="0"
export FRONTEND_MAX_INSTANCES="3"

cat > frontend-development-github-variables.txt <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_REGION=${REGION}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY}
GCP_WORKLOAD_IDENTITY_PROVIDER=${WIF_PROVIDER_RESOURCE}
GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOY_SA_EMAIL}
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

cat frontend-development-github-variables.txt
```

Add every line from `frontend-development-github-variables.txt` to the same
GitHub `development` environment.

## 18. Deploy Frontend Development

Use GitHub UI:

```text
Actions -> Frontend CI/CD -> Run workflow
Branch: development
target: development
```

Verify:

```bash
FRONTEND_URL="$(gcloud run services describe "$FRONTEND_CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

echo "$FRONTEND_URL"
curl -fsS "$FRONTEND_URL/platform/login" >/dev/null && echo "Frontend OK"
```

## 19. Create First Development Platform Admin

Run this in Google Cloud Shell after the backend deploy succeeds:

```bash
bash infra/development/bootstrap-platform-admin.sh
```

The script prints the generated password once. Save it in a password manager.

If you need to reset that password later, run:

```bash
bash infra/development/reset-platform-admin-password.sh
```

## 20. Test Platform Login

```bash
SERVICE_URL="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

ADMIN_EMAIL="admin-development@arcadia.io"
ADMIN_PASSWORD="PASTE_PASSWORD_FROM_PASSWORD_MANAGER"

curl -sS -X POST "$SERVICE_URL/api/v1/platform/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
```

## Troubleshooting

### Alembic Fails With Supabase Pooler Errors

The project disables psycopg prepared statements automatically when the
`DATABASE_URL` contains `pooler.supabase.com:6543`. First confirm Secret Manager
has the expected transaction-pooler URL:

```text
postgresql+psycopg://postgres.sxanwwkmhmgtinsilbqm:<password>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
```

If it still fails with a pooler-specific error, try the shared pooler
session-mode port instead:

```text
postgresql+psycopg://postgres.sxanwwkmhmgtinsilbqm:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

If your Supabase project has direct IPv4 enabled, direct connection is also fine
for migrations.

### Password Authentication Failed

Check:

- The Supabase database password is correct.
- Special characters in the password are URL-encoded.
- The Secret Manager value starts with `postgresql+psycopg://`.
- The URL includes `?sslmode=require`.

### GitHub Action Says Missing Variables

Compare GitHub `development` environment variables with:

```bash
cat development-github-variables.txt
cat frontend-development-github-variables.txt
```

### Secret Access Denied

The backend runtime service account needs:

```text
roles/secretmanager.secretAccessor
```

### Redis Connection Timeout

Check:

- `VPC_CONNECTOR=arcadia-vpc-development`
- `VPC_EGRESS=private-ranges-only`
- Redis instance exists in the same region.
- Backend Cloud Run service and migration job are deployed with the VPC connector.

### Frontend Calls Staging Backend

Check the GitHub `development` environment values:

```text
API_PROXY_TARGET=<development backend Cloud Run URL>
NEXT_PUBLIC_WS_BASE_URL=wss://<development backend Cloud Run host>
```

Then rerun the Frontend CI/CD workflow.

## Official References

- Supabase connection methods: https://supabase.com/docs/guides/database/connecting-to-postgres
- Cloud Run Secret Manager integration: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run deploy command: https://cloud.google.com/sdk/gcloud/reference/run/deploy
