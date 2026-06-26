# Google Cloud Platform: Backend Deployment and CI/CD Guide

This guide deploys the Arcadia FastAPI backend to Google Cloud Run with:

- Cloud Run for the backend service.
- Cloud Run Jobs for Alembic migrations.
- Cloud SQL for PostgreSQL.
- Memorystore for Redis.
- Artifact Registry for Docker images.
- Secret Manager for application secrets.
- GitHub Actions with Workload Identity Federation.

The staging setup is now script-driven and safe to rerun. Random values such as the DB password, `JWT_SECRET`, `ENCRYPTION_KEY`, and `VAULT_MASTER_KEY` are generated once, stored in Secret Manager, and reused on later runs.

## Deployment Model

| Git branch | GitHub environment | Cloud Run service | Database |
| --- | --- | --- | --- |
| `staging` | `staging` | `arcadia-backend-staging` | staging Cloud SQL |
| `main` | `production` | `arcadia-backend` | production Cloud SQL |

The workflow file is `.github/workflows/deploy-backend.yml`.

Each deploy:

1. Validates GitHub environment variables.
2. Runs backend tests.
3. Builds and pushes the Docker image.
4. Deploys or updates the migration Cloud Run Job.
5. Runs `alembic -c alembic.ini upgrade head`.
6. Deploys the Cloud Run service only if migrations succeed.
7. Smoke-tests `/health`.

App secrets are not stored in GitHub. GitHub stores only Secret Manager secret names, and Cloud Run reads the actual values from Secret Manager at runtime.

## Staging: One-Command Setup

Open Google Cloud Shell, then run:

```bash
git clone https://github.com/amr-dev-10/hotel.git
cd hotel
bash infra/staging/full-setup.sh
```

If the repo is already cloned:

```bash
cd hotel
git pull
bash infra/staging/full-setup.sh
```

The scripts use these defaults:

| Setting | Value |
| --- | --- |
| Project | `arcadia-hotel-staging` |
| Region | `asia-south2` |
| GitHub repo | `amr-dev-10/hotel` |
| Artifact Registry | `arcadia-repo` |
| Cloud SQL instance | `arcadia-db-staging` |
| Cloud SQL edition | `enterprise` |
| Cloud SQL tier | `db-g1-small` |
| Redis instance | `arcadia-redis-staging` |
| VPC connector | `arcadia-vpc-staging` |
| Runtime service account | `arcadia-backend-runner-staging` |
| Deploy service account | `arcadia-github-deployer-staging` |

To override a value, export it before running:

```bash
export PROJECT_ID="arcadia-hotel-staging"
export REGION="asia-south2"
export GITHUB_REPO="amr-dev-10/hotel"
export DB_EDITION="enterprise"
export DB_TIER="db-g1-small"
bash infra/staging/full-setup.sh
```

## What The Scripts Do

`infra/staging/bootstrap.sh` creates or reuses:

- Required Google Cloud APIs.
- Artifact Registry.
- Cloud SQL PostgreSQL.
- PostgreSQL database and user.
- Memorystore Redis.
- Serverless VPC Access connector.
- Runtime and deploy service accounts.
- IAM roles.
- Workload Identity Federation pool and provider.
- DB password Secret Manager secret.

`infra/staging/configure-secrets.sh` creates or updates:

- `DATABASE_URL` secret.
- `REDIS_URL` secret.
- `CELERY_BROKER_URL` secret.
- `CELERY_RESULT_BACKEND` secret.
- `JWT_SECRET` secret.
- `ENCRYPTION_KEY` secret.
- `VAULT_MASTER_KEY` secret.
- `github-variables.txt`.
- `github-secrets.txt`.

`infra/staging/full-setup.sh` runs both scripts.

## No-Regeneration Behavior

These secrets are generated once and reused:

- `arcadia-staging-db-password`
- `arcadia-staging-jwt-secret`
- `arcadia-staging-encryption-key`
- `arcadia-staging-vault-master-key`

These secrets are derived from current infrastructure and get a new Secret Manager version only if their value changes:

- `arcadia-staging-database-url`
- `arcadia-staging-redis-url`
- `arcadia-staging-celery-broker-url`
- `arcadia-staging-celery-result-backend`

This prevents accidental user logouts from a regenerated JWT secret and prevents accidental database outages from a changed DB password.

## GitHub Environment Setup

After `full-setup.sh` finishes, Cloud Shell creates:

```text
github-variables.txt
github-secrets.txt
```

In GitHub:

1. Open `amr-dev-10/hotel`.
2. Go to **Settings -> Environments**.
3. Create an environment named `staging`.
4. Add every line from `github-variables.txt` as an environment variable.
5. Read `github-secrets.txt`.

For the backend deploy workflow, `github-secrets.txt` should say that no GitHub environment secrets are required. App secrets live in Google Secret Manager.

## Deploy Staging

Push backend changes to `staging`:

```bash
git checkout staging
git push origin staging
```

Then open **GitHub -> Actions -> Backend CI/CD**.

You can also run the workflow manually:

1. Open **Actions -> Backend CI/CD**.
2. Click **Run workflow**.
3. Select `target: staging`.

## Production Setup

Production should use a separate Google Cloud project.

Recommended production values:

| Item | Production example |
| --- | --- |
| Project | `arcadia-hotel-production` |
| Region | `asia-south2` |
| Cloud Run service | `arcadia-backend` |
| Migration job | `arcadia-backend-migrate-production` |
| Cloud SQL instance | `arcadia-db-production` |
| Redis instance | `arcadia-redis-production` |
| VPC connector | `arcadia-vpc-production` |
| Runtime service account | `arcadia-backend-runner-production` |
| Deploy service account | `arcadia-github-deployer-production` |

Create production scripts by copying `infra/staging`, changing defaults to production names, and creating a GitHub environment named `production`.

Pushes to `main` deploy production. Manual production deployments must also run from the `main` branch. Enable required reviewers on the GitHub `production` environment before public use.

## Platform Admin Bootstrap

Do not store `PLATFORM_ADMIN_PASSWORD` as a long-lived GitHub or Cloud Run environment variable.

For the first platform admin, use a one-time bootstrap process:

1. Generate a temporary password.
2. Run the admin seed once through a controlled one-off job or local authenticated database connection.
3. Store the password in a password manager for the real admin user.
4. Remove the plain-text password from shell history and any files.

Do not leave a plain-text admin password in Cloud Run env vars or GitHub secrets.

## Useful Commands

View the staging service URL:

```bash
gcloud run services describe arcadia-backend-staging \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --format="value(status.url)"
```

View recent migration executions:

```bash
gcloud run jobs executions list \
  --project=arcadia-hotel-staging \
  --region=asia-south2 \
  --job=arcadia-backend-migrate-staging
```

View Secret Manager secret names:

```bash
gcloud secrets list \
  --project=arcadia-hotel-staging \
  --filter="labels.app=arcadia AND labels.env=staging"
```

Rerun secret configuration only:

```bash
bash infra/staging/configure-secrets.sh
```

## Important Rules

- Keep `AUTO_CREATE_TABLES=false` in Cloud Run. The workflow sets it automatically.
- Use Alembic migrations for schema changes.
- A failed migration stops deployment, so the existing Cloud Run revision continues serving.
- Rolling back Cloud Run does not roll back database migrations.
- Keep staging and production in separate projects or at least separate databases.
- Replace `CORS_ORIGINS=*` with the real frontend domain before external testing.
- Do not rotate `JWT_SECRET`, `ENCRYPTION_KEY`, `VAULT_MASTER_KEY`, or the DB password casually.

## Official References

- Workload Identity Federation: https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- Cloud Run secrets: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run deploy command: https://cloud.google.com/sdk/gcloud/reference/run/deploy
- Cloud Run jobs deploy command: https://cloud.google.com/sdk/gcloud/reference/run/jobs/deploy
- Cloud SQL for PostgreSQL from Cloud Run: https://cloud.google.com/sql/docs/postgres/connect-run
- Memorystore Redis regions: https://cloud.google.com/memorystore/docs/redis/regions
