# Development Deployment Field Guide: Google Cloud Run + Supabase

This guide records the full development deployment flow used for the
`development` branch, including the errors encountered and how they were fixed.
Use it next time as the step-by-step reference for deploying the development
environment without needing help.

The development environment uses:

- Google Cloud Run for backend and frontend services.
- Google Cloud Run Jobs for Alembic migrations, admin bootstrap, and seed data.
- Google Artifact Registry for Docker images.
- Google Secret Manager for app secrets.
- Google Memorystore Redis for Redis/Celery URLs.
- Supabase Postgres for the development database.
- GitHub Actions for build, migration, and deploy.

Staging is not affected as long as the `development` service names, secrets,
Redis instance, and GitHub environment stay separate from staging.

## 1. Important Locations

Use this before running anything:

| Action | Where to do it |
| --- | --- |
| Clone repo, run infra scripts, inspect Cloud Run logs | Google Cloud Shell |
| Add generated deployment variables | GitHub repo settings |
| Run backend/frontend deployment | GitHub Actions |
| Run one-time seed/admin jobs | Google Cloud Shell |
| Code fixes and commits | Local repo, then push to GitHub |

Cloud Shell path used in this setup:

```bash
~/hotel-development-502419/hotel
```

GitHub repo:

```text
amr-dev-10/hotel
```

Development GCP project:

```text
hotel-development-502419
```

Region:

```text
asia-south2
```

## 2. Cloud Run Isolation

Cloud Run does not have a shared central directory like a normal VPS.

Each service runs as its own container:

```text
Development backend: arcadia-backend-development
Staging backend:     arcadia-backend-staging

Development frontend: arcadia-dashboard-development
Staging frontend:     arcadia-dashboard-staging
```

Development deployment will not overwrite staging unless you accidentally use
staging resource names, staging GitHub environment variables, or staging
database secrets.

The biggest safety rule:

```text
Development DATABASE_URL must point to the development Supabase database.
Never point development at staging Cloud SQL or production data.
```

## 3. Prepare Cloud Shell

Open Google Cloud Shell.

Confirm the repo exists:

```bash
ls
cd ~/hotel-development-502419/hotel
```

Make sure the branch is `development`:

```bash
git branch --show-current
git checkout development
git pull origin development
```

Set the basic variables before running infra setup:

```bash
export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"

gcloud config set project "$PROJECT_ID"
```

Why these are first:

- `PROJECT_ID` tells every `gcloud` command which GCP project to modify.
- `REGION` keeps Cloud Run, Redis, Artifact Registry, and VPC connector together.
- `GITHUB_REPO` limits Workload Identity Federation to the correct GitHub repo.

## 4. If Cloud Shell Has No Active Account

You may see this error:

```text
ERROR: (gcloud.projects.describe) You do not currently have an active account selected.
Please run:

  gcloud auth login
```

Fix it:

```bash
gcloud auth list
```

If your email appears, select it:

```bash
gcloud config set account YOUR_EMAIL_HERE
```

If no account appears, authenticate:

```bash
gcloud auth login
```

Then confirm:

```bash
gcloud auth list
gcloud config list
```

After auth is fixed, rerun:

```bash
gcloud config set project "$PROJECT_ID"
```

## 5. Run Development Infra Setup

Run this in Google Cloud Shell:

```bash
cd ~/hotel-development-502419/hotel

export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"

gcloud config set project "$PROJECT_ID"

bash infra/development/full-setup.sh
```

The script does two things:

```bash
bash infra/development/bootstrap.sh
bash infra/development/configure-secrets.sh
```

`bootstrap.sh` creates or reuses:

- Required Google Cloud APIs.
- Artifact Registry repository.
- Memorystore Redis.
- Serverless VPC Access connector.
- Runtime and deploy service accounts.
- IAM permissions.
- GitHub Workload Identity Federation pool and provider.

`configure-secrets.sh` creates or updates:

- Supabase `DATABASE_URL` in Secret Manager.
- Redis and Celery Secret Manager values.
- JWT, encryption, and vault keys.
- WhatsApp dry-run secret placeholders.
- `development-github-variables.txt`.
- `development-github-secrets.txt`.

When prompted:

```text
Supabase DB password:
```

Paste the Supabase database password. It will not visibly type in the terminal.
Press Enter.

Do not paste this password into GitHub.

## 6. Error: Service Account Name Too Long

During the first run, setup stopped here:

```text
ERROR: (gcloud.iam.service-accounts.create) INVALID_ARGUMENT:
The account ID "arcadia-backend-runner-development" does not have a length between 6 and 30.
```

Why it happened:

Google service account IDs must be between 6 and 30 characters. The original
default name was too long.

Resources created before the failure were fine:

```text
APIs enabled
Artifact Registry created
Redis created
VPC connector created
```

Do not delete those resources. The setup scripts are safe to rerun.

Fix by using shorter service account IDs:

```bash
cd ~/hotel-development-502419/hotel

export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"

export RUNTIME_SA="arcadia-backend-run-dev"
export FRONTEND_RUNTIME_SA="arcadia-dashboard-run-dev"
export DEPLOY_SA="arcadia-github-deploy-dev"

gcloud config set project "$PROJECT_ID"

bash infra/development/full-setup.sh
```

Expected success output includes:

```text
Arcadia development infrastructure is ready.

Project: hotel-development-502419
Region: asia-south2
Redis host: ...
Backend runtime service account: arcadia-backend-run-dev@hotel-development-502419.iam.gserviceaccount.com
Frontend runtime service account: arcadia-dashboard-run-dev@hotel-development-502419.iam.gserviceaccount.com
Deploy service account: arcadia-github-deploy-dev@hotel-development-502419.iam.gserviceaccount.com
Workload Identity provider: projects/.../providers/github-actions-provider
```

Then the secrets section should finish and print:

```text
Full development setup complete.

Copy backend GitHub environment variables from:
development-github-variables.txt

There should be no backend GitHub environment secrets to copy:
development-github-secrets.txt

After the backend deploy succeeds, run:
bash infra/development/configure-frontend.sh
```

The Cloud Shell message below is harmless:

```text
[environment: untagged] Read more to tag: g.co/cloud/project-env-tag.
```

## 7. Paste Backend Variables Into GitHub

In Cloud Shell:

```bash
cat development-github-variables.txt
```

You should see values like:

```text
GCP_PROJECT_ID=hotel-development-502419
GCP_REGION=asia-south2
ARTIFACT_REPOSITORY=arcadia-repo
BACKEND_IMAGE_NAME=backend-api
CLOUD_RUN_SERVICE=arcadia-backend-development
CLOUD_RUN_MIGRATION_JOB=arcadia-backend-migrate-development
CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=arcadia-backend-run-dev@hotel-development-502419.iam.gserviceaccount.com
CLOUD_SQL_CONNECTION_NAME=
VPC_CONNECTOR=arcadia-vpc-development
VPC_EGRESS=private-ranges-only
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_DEPLOY_SERVICE_ACCOUNT=arcadia-github-deploy-dev@hotel-development-502419.iam.gserviceaccount.com
CORS_ORIGINS=*
DEFAULT_TIMEZONE=Asia/Kolkata
WHATSAPP_API_VERSION=v25.0
WHATSAPP_DRY_RUN=true
WHATSAPP_VERIFY_TOKEN_SECRET=arcadia-development-whatsapp-verify-token
WHATSAPP_APP_SECRET_SECRET=arcadia-development-whatsapp-app-secret
DATABASE_URL_SECRET=arcadia-development-database-url
REDIS_URL_SECRET=arcadia-development-redis-url
CELERY_BROKER_URL_SECRET=arcadia-development-celery-broker-url
CELERY_RESULT_BACKEND_SECRET=arcadia-development-celery-result-backend
JWT_SECRET_NAME=arcadia-development-jwt-secret
ENCRYPTION_KEY_SECRET_NAME=arcadia-development-encryption-key
VAULT_MASTER_KEY_SECRET_NAME=arcadia-development-vault-master-key
```

Open GitHub:

```text
GitHub repo -> Settings -> Environments -> development -> Environment variables
```

Add each line as an environment variable.

For example:

```text
GCP_PROJECT_ID=hotel-development-502419
```

means:

```text
Name:  GCP_PROJECT_ID
Value: hotel-development-502419
```

### Blank Variable

This one is intentionally blank:

```text
CLOUD_SQL_CONNECTION_NAME=
```

Why:

- Staging uses Cloud SQL.
- Development uses Supabase.
- Development does not need a Cloud SQL connector.

If GitHub allows empty values, add it as empty. If GitHub does not allow empty
values, skip it for development.

Do not add Supabase password, full database URL, JWT secret, encryption key, or
vault master key to GitHub. They are stored in Google Secret Manager.

## 8. Deploy Backend From GitHub Actions

Open:

```text
GitHub -> Actions -> Backend CI/CD -> Run workflow
```

Choose:

```text
Branch: development
target: development
```

Run it.

Expected workflow:

```text
Validate variables
Run backend tests
Build backend Docker image
Deploy migration Cloud Run Job
Run Alembic migrations
Deploy backend Cloud Run service
Smoke test /health
```

If migration fails, the backend service is not deployed. That is safe.

## 9. Error: Alembic Invalid Interpolation Syntax

The backend workflow reached migration and failed:

```text
Run gcloud run jobs execute "$CLOUD_RUN_MIGRATION_JOB" ...
Executing job failed
```

Cloud Run logs showed:

```text
ValueError: invalid interpolation syntax in
'postgresql+psycopg://...:PASSWORD_WITH_PERCENT_ESCAPES@...'
```

Why it happened:

Supabase passwords with special characters are URL-encoded. For example, `@`
becomes `%40`. Alembic stores the URL in a Python `ConfigParser`, and raw `%`
is treated as interpolation syntax.

Fix in `backend/alembic/env.py`:

```python
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
```

This escapes `%` only for Alembic config storage while keeping the real database
URL for SQLAlchemy.

After committing and pushing this fix to `development`, rerun:

```text
GitHub -> Actions -> Backend CI/CD -> Run workflow
Branch: development
target: development
```

Security note:

If a Cloud Run error log or chat message exposes the encoded database password,
rotate the Supabase DB password after the deployment is stable, then rerun:

```bash
bash infra/development/configure-secrets.sh
```

That updates the `arcadia-development-database-url` secret in Google Secret
Manager.

## 10. Verify Backend

After Backend CI/CD succeeds, run in Cloud Shell:

```bash
cd ~/hotel-development-502419/hotel

export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"

gcloud config set project "$PROJECT_ID"

BACKEND_URL="$(gcloud run services describe arcadia-backend-development \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

echo "$BACKEND_URL"
curl "$BACKEND_URL/health"
```

Expected:

```json
{"ok":true}
```

## 11. Configure Frontend After Backend Succeeds

Do not run frontend setup before the backend deploy succeeds. It needs the
backend Cloud Run URL.

In Cloud Shell:

```bash
cd ~/hotel-development-502419/hotel
git checkout development
git pull origin development

export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export FRONTEND_RUNTIME_SA="arcadia-dashboard-run-dev"

gcloud config set project "$PROJECT_ID"

bash infra/development/configure-frontend.sh
```

This creates:

```text
frontend-development-github-variables.txt
```

Show it:

```bash
cat frontend-development-github-variables.txt
```

Paste every line into the same GitHub environment:

```text
GitHub repo -> Settings -> Environments -> development -> Environment variables
```

Keep all backend variables already there.

Important generated values include:

```text
FRONTEND_CLOUD_RUN_SERVICE=arcadia-dashboard-development
FRONTEND_IMAGE_NAME=dashboard-web
FRONTEND_CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=arcadia-dashboard-run-dev@hotel-development-502419.iam.gserviceaccount.com
API_PROXY_TARGET=https://BACKEND_CLOUD_RUN_URL
NEXT_PUBLIC_API_BASE_URL=/api/v1
NEXT_PUBLIC_WS_BASE_URL=wss://BACKEND_CLOUD_RUN_HOST
```

## 12. Deploy Frontend From GitHub Actions

Open:

```text
GitHub -> Actions -> Frontend CI/CD -> Run workflow
```

Choose:

```text
Branch: development
target: development
```

Run it.

Expected workflow:

```text
Validate frontend variables
Authenticate to Google Cloud
Build frontend Docker image
Push image to Artifact Registry
Deploy arcadia-dashboard-development
Smoke test /platform/login
```

Get the frontend URL:

```bash
FRONTEND_URL="$(gcloud run services describe arcadia-dashboard-development \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format="value(status.url)")"

echo "$FRONTEND_URL"
```

Open:

```text
FRONTEND_URL/platform/login
```

## 13. Create First Development Platform Admin

After backend deploy succeeds, create the first platform admin with a one-time
Cloud Run Job.

In Cloud Shell:

```bash
cd ~/hotel-development-502419/hotel
source development-github-variables.txt

bash infra/development/bootstrap-platform-admin.sh
```

The script prints:

```text
Platform URL: ...
Email: admin-development@arcadia.io
Password: GENERATED_PASSWORD
```

Save the password immediately. It is printed once.

If you lose the password later:

```bash
cd ~/hotel-development-502419/hotel
source development-github-variables.txt

bash infra/development/reset-platform-admin-password.sh
```

## 14. Insert Small Seed Data

Use a one-time Cloud Run Job so the seed command runs against the deployed
development database and uses the same Secret Manager values as the backend.

The built-in `small` preset inserts:

```text
1 hotel
25 rooms
12 staff
100 guests
120 reservations
500 tickets
```

In Cloud Shell:

```bash
cd ~/hotel-development-502419/hotel
source development-github-variables.txt

gcloud config set project "$GCP_PROJECT_ID"
```

Get the deployed backend image:

```bash
IMAGE_URI="$(gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format="value(spec.template.spec.containers[0].image)")"

echo "$IMAGE_URI"
```

Create the seed job:

```bash
APP_ENV_VARS="^|^ENVIRONMENT=development|AUTO_CREATE_TABLES=false"

APP_SECRET_REFS="DATABASE_URL=${DATABASE_URL_SECRET}:latest,REDIS_URL=${REDIS_URL_SECRET}:latest,CELERY_BROKER_URL=${CELERY_BROKER_URL_SECRET}:latest,CELERY_RESULT_BACKEND=${CELERY_RESULT_BACKEND_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest,ENCRYPTION_KEY=${ENCRYPTION_KEY_SECRET_NAME}:latest,VAULT_MASTER_KEY=${VAULT_MASTER_KEY_SECRET_NAME}:latest"

gcloud run jobs deploy arcadia-seed-small-development \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --image="$IMAGE_URI" \
  --service-account="$CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT" \
  --set-env-vars="$APP_ENV_VARS" \
  --set-secrets="$APP_SECRET_REFS" \
  --vpc-connector="$VPC_CONNECTOR" \
  --vpc-egress="$VPC_EGRESS" \
  --command=python \
  --args=-m,app.seeds.run,--size,small,--hotel-slug,arcadia-demo \
  --tasks=1 \
  --max-retries=0 \
  --task-timeout=900s \
  --quiet
```

Run the seed job:

```bash
gcloud run jobs execute arcadia-seed-small-development \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --wait
```

Demo hotel login:

```text
Hotel slug: arcadia-demo
Email: owner@arcadia.demo
Password: DemoPass123!
```

Important:

This does not reset the database. If you run the seed job again, it can add
another batch of generated guests, reservations, and tickets.

## 15. Useful Log Commands

Describe a failed migration execution:

```bash
gcloud run jobs executions describe EXECUTION_NAME \
  --project=hotel-development-502419 \
  --region=asia-south2
```

Read migration job logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="arcadia-backend-migrate-development"' \
  --project=hotel-development-502419 \
  --limit=100 \
  --format='table(timestamp,severity,textPayload,jsonPayload.message)'
```

Read logs for one exact execution:

```bash
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="arcadia-backend-migrate-development" AND labels."run.googleapis.com/execution_name"="EXECUTION_NAME"' \
  --project=hotel-development-502419 \
  --limit=100 \
  --format='table(timestamp,severity,textPayload,jsonPayload.message)'
```

List Cloud Run services:

```bash
gcloud run services list \
  --project=hotel-development-502419 \
  --region=asia-south2
```

List Cloud Run jobs:

```bash
gcloud run jobs list \
  --project=hotel-development-502419 \
  --region=asia-south2
```

## 16. Full Command Sequence Summary

Use this compact sequence after the repo fixes are already pushed.

### Cloud Shell: setup infra

```bash
cd ~/hotel-development-502419/hotel
git checkout development
git pull origin development

export PROJECT_ID="hotel-development-502419"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"
export RUNTIME_SA="arcadia-backend-run-dev"
export FRONTEND_RUNTIME_SA="arcadia-dashboard-run-dev"
export DEPLOY_SA="arcadia-github-deploy-dev"

gcloud config set project "$PROJECT_ID"

bash infra/development/full-setup.sh
```

### GitHub: paste backend variables

```bash
cat development-github-variables.txt
```

Paste into:

```text
GitHub -> Settings -> Environments -> development -> Environment variables
```

### GitHub: deploy backend

```text
Actions -> Backend CI/CD -> Run workflow
Branch: development
target: development
```

### Cloud Shell: configure frontend

```bash
cd ~/hotel-development-502419/hotel
source development-github-variables.txt
export FRONTEND_RUNTIME_SA="arcadia-dashboard-run-dev"

bash infra/development/configure-frontend.sh
cat frontend-development-github-variables.txt
```

Paste those frontend variables into the same GitHub `development` environment.

### GitHub: deploy frontend

```text
Actions -> Frontend CI/CD -> Run workflow
Branch: development
target: development
```

### Cloud Shell: admin and seed

```bash
cd ~/hotel-development-502419/hotel
source development-github-variables.txt

bash infra/development/bootstrap-platform-admin.sh
```

Then optionally run the small seed job from section 14.

## 17. Troubleshooting Checklist

If setup fails:

- Run `gcloud auth list`.
- Confirm active project with `gcloud config list`.
- Confirm `PROJECT_ID=hotel-development-502419`.
- Rerun setup. The scripts reuse already-created resources.

If GitHub Actions says variables are missing:

- Check GitHub environment is named exactly `development`.
- Confirm variables were added under Environment variables, not repo variables.
- Confirm the workflow is run with `target: development`.

If migration fails:

- Read Cloud Run job logs.
- Check `DATABASE_URL_SECRET=arcadia-development-database-url`.
- Confirm Supabase password is correct.
- Confirm URL uses `postgresql+psycopg://`.
- If error mentions interpolation syntax, ensure the Alembic percent-escape fix is pushed.

If frontend points to the wrong backend:

- Rerun `bash infra/development/configure-frontend.sh`.
- Paste the regenerated `API_PROXY_TARGET` and `NEXT_PUBLIC_WS_BASE_URL`.
- Rerun Frontend CI/CD.

If staging is affected:

- Stop and inspect GitHub variables.
- Confirm you did not edit the `staging` GitHub environment.
- Confirm development variables use `arcadia-*-development` resource names.
- Confirm development database secret points to Supabase development DB.

