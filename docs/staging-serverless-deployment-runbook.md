# Staging Serverless Deployment Runbook

This runbook documents the current staging deployment setup for the Arcadia Hotel backend in Google Cloud.

Version tracking for this deployment work is maintained in:

```text
docs/release-versioning-and-development-track.md
```

Repository:

```text
https://github.com/amr-dev-10/hotel
```

Staging branch:

```text
staging
```

Current staging release candidate:

```text
1.0.0-rc.1
```

Production promotion target after staging validation:

```text
1.0.0
```

Google Cloud project:

```text
arcadia-hotel-staging
```

Region:

```text
asia-south2
```

## Current Repo Changes

The staging deployment is driven by these files:

| File | Purpose |
| --- | --- |
| `.github/workflows/deploy-backend.yml` | GitHub Actions CI/CD for staging and production backend deploys. |
| `infra/staging/bootstrap.sh` | Creates or reuses Google Cloud infrastructure for staging. |
| `infra/staging/configure-secrets.sh` | Creates or reuses Secret Manager values and writes GitHub setup files. |
| `infra/staging/full-setup.sh` | Runs bootstrap and secret configuration together. |
| `docs/GCP_BACKEND_DEPLOYMENT.md` | Main deployment guide. |
| `docs/staging-serverless-deployment-runbook.md` | This operational runbook. |
| `backend/Dockerfile` | Cloud Run container image definition. |
| `backend/alembic.ini` | Alembic config with portable migration path. |

The workflow deploys staging from the `staging` branch and production from the `main` branch.

## Infrastructure Created For Staging

The Cloud Shell scripts create or reuse:

- Cloud Run service: `arcadia-backend-staging`
- Cloud Run migration job: `arcadia-backend-migrate-staging`
- Artifact Registry repository: `arcadia-repo`
- Cloud SQL PostgreSQL instance: `arcadia-db-staging`
- Cloud SQL database: `arcadia`
- Cloud SQL user: `arcadia_app`
- Cloud SQL edition: `enterprise`
- Cloud SQL tier: `db-g1-small`
- Memorystore Redis instance: `arcadia-redis-staging`
- Serverless VPC Access connector: `arcadia-vpc-staging`
- Runtime service account: `arcadia-backend-runner-staging`
- GitHub deploy service account: `arcadia-github-deployer-staging`
- Workload Identity Federation pool: `github-actions-pool`
- Workload Identity Federation provider: `github-actions-provider`

## Secret Model

Application secret values are stored in Google Secret Manager, not GitHub.

Generated once and reused:

- `arcadia-staging-db-password`
- `arcadia-staging-jwt-secret`
- `arcadia-staging-encryption-key`
- `arcadia-staging-vault-master-key`

Derived from current infrastructure and updated only when changed:

- `arcadia-staging-database-url`
- `arcadia-staging-redis-url`
- `arcadia-staging-celery-broker-url`
- `arcadia-staging-celery-result-backend`

GitHub stores only the Secret Manager secret names as environment variables.

## Before Running Cloud Shell

Commit and push the deployment files to the `staging` branch from your local machine.

```bash
git add .github/workflows/deploy-backend.yml .gitignore docs/GCP_BACKEND_DEPLOYMENT.md docs/staging-serverless-deployment-runbook.md infra/staging
git commit -m "Add staging serverless deployment runbook"
git checkout -B staging
git push -u origin staging
```

If you already created the `staging` branch and only need to push new updates:

```bash
git checkout staging
git add .github/workflows/deploy-backend.yml .gitignore docs/GCP_BACKEND_DEPLOYMENT.md docs/staging-serverless-deployment-runbook.md infra/staging
git commit -m "Update staging deployment automation"
git push origin staging
```

## Step 1: Open Google Cloud Shell

Open Google Cloud Console, select:

```text
arcadia-hotel-staging
```

Then click **Activate Cloud Shell**.

## Step 2: Clone The Staging Branch

If the repo is not cloned yet:

```bash
git clone -b staging https://github.com/amr-dev-10/hotel.git
cd hotel
```

If the repo is already cloned:

```bash
cd ~/hotel
git fetch origin
git checkout staging
git pull origin staging
```

## Step 3: Run Full Staging Setup

Run:

```bash
bash infra/staging/full-setup.sh
```

This runs:

```bash
bash infra/staging/bootstrap.sh
bash infra/staging/configure-secrets.sh
```

Expected final output:

```text
GitHub output files:
github-variables.txt
github-secrets.txt

Full staging setup complete.

Copy GitHub environment variables from:
github-variables.txt

There should be no backend GitHub environment secrets to copy:
github-secrets.txt
```

That means Google Cloud setup is complete. The next work is in GitHub.

## Step 4: Check Generated GitHub Files

In Cloud Shell:

```bash
cat github-variables.txt
cat github-secrets.txt
```

`github-variables.txt` should contain values like:

```text
GCP_PROJECT_ID=arcadia-hotel-staging
GCP_REGION=asia-south2
ARTIFACT_REPOSITORY=arcadia-repo
BACKEND_IMAGE_NAME=backend-api
CLOUD_RUN_SERVICE=arcadia-backend-staging
CLOUD_RUN_MIGRATION_JOB=arcadia-backend-migrate-staging
CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=arcadia-backend-runner-staging@arcadia-hotel-staging.iam.gserviceaccount.com
CLOUD_SQL_CONNECTION_NAME=arcadia-hotel-staging:asia-south2:arcadia-db-staging
VPC_CONNECTOR=arcadia-vpc-staging
VPC_EGRESS=private-ranges-only
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions-pool/providers/github-actions-provider
GCP_DEPLOY_SERVICE_ACCOUNT=arcadia-github-deployer-staging@arcadia-hotel-staging.iam.gserviceaccount.com
CORS_ORIGINS=*
DEFAULT_TIMEZONE=Asia/Kolkata
WHATSAPP_DRY_RUN=true
DATABASE_URL_SECRET=arcadia-staging-database-url
REDIS_URL_SECRET=arcadia-staging-redis-url
CELERY_BROKER_URL_SECRET=arcadia-staging-celery-broker-url
CELERY_RESULT_BACKEND_SECRET=arcadia-staging-celery-result-backend
JWT_SECRET_NAME=arcadia-staging-jwt-secret
ENCRYPTION_KEY_SECRET_NAME=arcadia-staging-encryption-key
VAULT_MASTER_KEY_SECRET_NAME=arcadia-staging-vault-master-key
```

`github-secrets.txt` should say no backend GitHub secrets are required.

## Step 5: Configure GitHub Environment

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
staging
```

Add every line from `github-variables.txt` as a GitHub environment variable.

Do not add application secrets to GitHub. Values like `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `VAULT_MASTER_KEY`, and Redis URLs remain in Google Secret Manager.

## Step 6: Trigger The Staging Deployment

Option A, from GitHub UI:

```text
Actions -> Backend CI/CD -> Run workflow
Branch: staging
target: staging
```

Option B, from local terminal:

```bash
git checkout staging
git commit --allow-empty -m "Trigger staging deploy"
git push origin staging
```

## Step 7: Watch GitHub Actions

Open:

```text
https://github.com/amr-dev-10/hotel/actions
```

The `Backend CI/CD` workflow should:

1. Validate GitHub environment variables.
2. Set up Python.
3. Install backend dependencies.
4. Run backend tests.
5. Authenticate to Google Cloud with Workload Identity Federation.
6. Configure Docker for Artifact Registry.
7. Build and push the backend image.
8. Deploy the Alembic migration Cloud Run Job.
9. Run Alembic migrations.
10. Deploy the backend Cloud Run service.
11. Smoke-test `/health`.

## Step 8: Verify Staging Backend

In Cloud Shell:

```bash
SERVICE_URL="$(gcloud run services describe arcadia-backend-staging \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --format='value(status.url)')"

echo "$SERVICE_URL"
curl "$SERVICE_URL/health"
```

Expected response:

```json
{"ok":true}
```

## Useful Cloud Shell Checks

List staging secrets:

```bash
gcloud secrets list \
  --project=arcadia-hotel-staging \
  --filter="labels.app=arcadia AND labels.env=staging"
```

Show migration job executions:

```bash
gcloud run jobs executions list \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --job=arcadia-backend-migrate-staging
```

Show Cloud Run service URL:

```bash
gcloud run services describe arcadia-backend-staging \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --format="value(status.url)"
```

Rerun only Secret Manager configuration:

```bash
bash infra/staging/configure-secrets.sh
```

Rerun full setup safely:

```bash
bash infra/staging/full-setup.sh
```

## Troubleshooting Notes From Setup

### Cloud SQL Enterprise Plus Tier Error

Error:

```text
Invalid Tier (db-g1-small) for (ENTERPRISE_PLUS) Edition.
Use a predefined Tier like db-perf-optimized-N-* instead.
```

Meaning:

Cloud SQL attempted to create the instance as Enterprise Plus, but `db-g1-small` is compatible with Enterprise edition. The script now sets:

```bash
export DB_EDITION="${DB_EDITION:-enterprise}"
...
--edition="$DB_EDITION"
--tier="$DB_TIER"
```

Recovery:

```bash
cd ~/hotel
git pull origin staging
bash infra/staging/full-setup.sh
```

The earlier Artifact Registry creation is fine. The script will reuse it.

### Full Setup Complete Message

Output:

```text
Full staging setup complete.
Copy GitHub environment variables from:
github-variables.txt
```

Meaning:

Google Cloud infrastructure and Secret Manager setup completed. You still need to copy `github-variables.txt` into GitHub `Settings -> Environments -> staging`, then run the GitHub Action.

### VPC Connector Range Conflict

If `10.8.0.0/28` is already in use, choose another unused `/28` range:

```bash
export VPC_RANGE="10.9.0.0/28"
bash infra/staging/full-setup.sh
```

### GitHub Action Missing Variables

If the workflow fails with missing variables, compare GitHub environment variables against:

```bash
cat github-variables.txt
```

Every line from that file must exist under:

```text
GitHub -> Settings -> Environments -> staging -> Environment variables
```

### GitHub Authentication Fails

Check these values in GitHub environment variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_PROJECT_ID`

Also check that the script used:

```text
GITHUB_REPO=amr-dev-10/hotel
```

### Secret Access Fails In Cloud Run

The runtime service account must have:

```text
roles/secretmanager.secretAccessor
```

The bootstrap script grants this to:

```text
arcadia-backend-runner-staging@arcadia-hotel-staging.iam.gserviceaccount.com
```

### Redis Connection Times Out

Check:

- `VPC_CONNECTOR=arcadia-vpc-staging`
- `VPC_EGRESS=private-ranges-only`
- Redis instance exists in `asia-south2`
- Cloud Run service and migration job both include VPC connector flags

### Alembic Migration Fails

Check job executions:

```bash
gcloud run jobs executions list \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --job=arcadia-backend-migrate-staging
```

Then open the latest execution logs in Google Cloud Console.

The workflow deploys the service only after migration succeeds.

## Operational Rules

- Do not rotate `JWT_SECRET` casually. It logs users out.
- Do not rotate `ENCRYPTION_KEY` or `VAULT_MASTER_KEY` casually. They may affect encrypted app data.
- Do not change the database password unless you also update Secret Manager.
- Do not paste app secrets into GitHub.
- Keep staging and production in separate Google Cloud projects if possible.
- Keep `AUTO_CREATE_TABLES=false` in Cloud Run. Alembic owns schema changes.
- A failed migration stops deployment, so the previous Cloud Run revision keeps serving.
- Rolling back Cloud Run does not roll back database migrations.

## Production Notes

Production should use the same pattern with different names:

| Resource | Staging | Production Example |
| --- | --- | --- |
| Branch | `staging` | `main` |
| GitHub environment | `staging` | `production` |
| Project | `arcadia-hotel-staging` | `arcadia-hotel-production` |
| Cloud Run service | `arcadia-backend-staging` | `arcadia-backend` |
| Migration job | `arcadia-backend-migrate-staging` | `arcadia-backend-migrate-production` |
| Cloud SQL instance | `arcadia-db-staging` | `arcadia-db-production` |
| Redis instance | `arcadia-redis-staging` | `arcadia-redis-production` |
| VPC connector | `arcadia-vpc-staging` | `arcadia-vpc-production` |

Before production use:

- Enable required reviewers on the GitHub `production` environment.
- Replace `CORS_ORIGINS=*` with the real frontend domain.
- Use a stronger Cloud SQL tier and backup policy.
- Confirm monitoring and alerting.
- Take database backups before risky migrations.

## Official References

- Workload Identity Federation: https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- Cloud Run secrets: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run deploy command: https://cloud.google.com/sdk/gcloud/reference/run/deploy
- Cloud Run jobs deploy command: https://cloud.google.com/sdk/gcloud/reference/run/jobs/deploy
- Cloud SQL for PostgreSQL from Cloud Run: https://cloud.google.com/sql/docs/postgres/connect-run
- Memorystore Redis regions: https://cloud.google.com/memorystore/docs/redis/regions
