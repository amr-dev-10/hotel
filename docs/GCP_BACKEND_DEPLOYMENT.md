# Google Cloud Platform: Backend Deployment and CI/CD Guide

This guide deploys the Arcadia FastAPI backend to Google Cloud Run with:

- Cloud SQL for PostgreSQL.
- Memorystore for Redis.
- Artifact Registry for Docker images.
- GitHub Actions CI/CD.
- Alembic migrations run automatically before each Cloud Run service deploy.

Use this order:

1. Set up staging first.
2. Push backend code to `develop` to deploy staging.
3. Repeat the setup for production.
4. Push or merge backend code to `main` to deploy production.

You do not need the Google Cloud CLI installed in WSL for the first setup. Use Google Cloud Shell in the browser. Docker in WSL is useful for local testing, but GitHub Actions will build the production image in GitHub.

## Deployment Model

The workflow file is `.github/workflows/deploy-backend.yml`.

| Git branch | GitHub environment | Cloud Run service | Database |
| --- | --- | --- | --- |
| `develop` | `staging` | `arcadia-backend-staging` | staging Cloud SQL |
| `main` | `production` | `arcadia-backend` | production Cloud SQL |

Each deployment does this:

1. Validates required GitHub environment variables and secrets.
2. Installs backend dependencies.
3. Runs `python -m pytest backend/tests`.
4. Builds the Docker image from `backend/Dockerfile`.
5. Pushes the image to Artifact Registry.
6. Deploys or updates a Cloud Run Job for migrations.
7. Runs `alembic -c alembic.ini upgrade head` in that job and waits for it to finish.
8. Deploys the Cloud Run service only if migrations succeed.
9. Calls `/health` as a smoke test.

## Before You Start

You need:

- A Google Cloud account with billing enabled.
- A Google Cloud project for staging, for example `arcadia-hotel-staging`.
- A GitHub repository containing this code.
- Permission to create Google Cloud IAM service accounts, Cloud SQL, Redis, Artifact Registry, Cloud Run, and Workload Identity Federation resources.

Recommended production setup: use a separate Google Cloud project, for example `arcadia-hotel-production`, so staging cannot touch production data.

## Step 1: Open Cloud Shell

In Google Cloud Console, click the **Activate Cloud Shell** icon in the top bar.

Cloud Shell already has `gcloud`, so you can bootstrap staging even though the CLI is not installed in WSL.

Set your staging variables:

```bash
export PROJECT_ID="arcadia-hotel-staging"
export REGION="us-central1"
export GITHUB_REPO="YOUR_GITHUB_OWNER/YOUR_REPO_NAME"

export ARTIFACT_REPOSITORY="arcadia-repo"
export DB_INSTANCE="arcadia-db-staging"
export DB_NAME="arcadia"
export DB_USER="arcadia_app"
export DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
export REDIS_INSTANCE="arcadia-redis-staging"
export VPC_CONNECTOR="arcadia-vpc-staging"

export RUNTIME_SA="arcadia-backend-runner-staging"
export DEPLOY_SA="arcadia-github-deployer-staging"
export WIF_POOL="github-actions-pool"
export WIF_PROVIDER="github-actions-provider"

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

Important: replace `YOUR_GITHUB_OWNER/YOUR_REPO_NAME` with the exact GitHub repo, for example `myname/arcadia-hotel-platform`.

## Step 2: Enable Google Cloud APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com
```

## Step 3: Create Artifact Registry

```bash
gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Arcadia backend Docker images"
```

If the repository already exists, continue.

## Step 4: Create Staging Cloud SQL

For staging, use a small instance. For production, choose a stronger tier and enable stronger backup and availability settings.

```bash
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-size=10GB \
  --availability-type=ZONAL \
  --no-deletion-protection

gcloud sql databases create "$DB_NAME" \
  --instance="$DB_INSTANCE"

gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD"

export CLOUD_SQL_CONNECTION_NAME="$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')"
echo "Cloud SQL connection name: $CLOUD_SQL_CONNECTION_NAME"
echo "Database password: $DB_PASSWORD"
```

Save the printed database password now. You will paste it into GitHub as part of `DATABASE_URL`.

Cloud Run should connect to Cloud SQL through the Cloud SQL Unix socket, not `localhost`. For this app, the final SQLAlchemy URL format is:

```text
postgresql+psycopg://arcadia_app:DB_PASSWORD@/arcadia?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

If your password contains special URL characters like `@`, `/`, `:`, `?`, `#`, or `&`, URL-encode the password before putting it in `DATABASE_URL`.

## Step 5: Create Staging Redis and VPC Connector

Memorystore Redis uses a private IP address. Cloud Run needs private VPC egress to reach it. This guide uses a Serverless VPC Access connector.

```bash
gcloud redis instances create "$REDIS_INSTANCE" \
  --region="$REGION" \
  --size=1 \
  --tier=basic \
  --redis-version=redis_7_0

export REDIS_HOST="$(gcloud redis instances describe "$REDIS_INSTANCE" --region="$REGION" --format='value(host)')"
echo "Redis host: $REDIS_HOST"
```

Create the VPC connector:

```bash
gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR" \
  --region="$REGION" \
  --network=default \
  --range=10.8.0.0/28
```

If `10.8.0.0/28` is already used in your VPC, choose another unused `/28` range.

## Step 6: Create Runtime and Deploy Service Accounts

The runtime service account is used by the Cloud Run service and migration job. The deploy service account is impersonated by GitHub Actions.

```bash
gcloud iam service-accounts create "$RUNTIME_SA" \
  --display-name="Arcadia Backend Runtime Staging"

gcloud iam service-accounts create "$DEPLOY_SA" \
  --display-name="GitHub Actions Deploy Staging"

export RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
```

Grant runtime permissions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/vpcaccess.user"
```

Grant deploy permissions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/vpcaccess.user"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

## Step 7: Connect GitHub Actions Without a JSON Key

Use Workload Identity Federation instead of a long-lived service account key.

Create the pool and provider:

```bash
gcloud iam workload-identity-pools create "$WIF_POOL" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL" \
  --display-name="GitHub Actions provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
```

Allow only this GitHub repo to impersonate the deploy service account:

```bash
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}"

export WIF_PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
echo "Workload Identity Provider: $WIF_PROVIDER_RESOURCE"
echo "Deploy service account: $DEPLOY_SA_EMAIL"
```

Save the printed `Workload Identity Provider` and deploy service account email for GitHub.

## Step 8: Add the GitHub Staging Environment

In GitHub:

1. Open the repository.
2. Go to **Settings -> Environments**.
3. Create an environment named `staging`.
4. Add these environment variables:

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | `arcadia-hotel-staging` |
| `GCP_REGION` | `us-central1` |
| `ARTIFACT_REPOSITORY` | `arcadia-repo` |
| `BACKEND_IMAGE_NAME` | `backend-api` |
| `CLOUD_RUN_SERVICE` | `arcadia-backend-staging` |
| `CLOUD_RUN_MIGRATION_JOB` | `arcadia-backend-migrate-staging` |
| `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` | `arcadia-backend-runner-staging@arcadia-hotel-staging.iam.gserviceaccount.com` |
| `CLOUD_SQL_CONNECTION_NAME` | the value printed in Step 4 |
| `VPC_CONNECTOR` | `arcadia-vpc-staging` |
| `VPC_EGRESS` | `private-ranges-only` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | the provider resource printed in Step 7 |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | the deploy service account printed in Step 7 |
| `CORS_ORIGINS` | your staging frontend URL, or `*` while testing |
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` |
| `WHATSAPP_DRY_RUN` | `true` |

Add these environment secrets:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://arcadia_app:DB_PASSWORD@/arcadia?host=/cloudsql/CLOUD_SQL_CONNECTION_NAME` |
| `REDIS_URL` | `redis://REDIS_HOST:6379/0` |
| `CELERY_BROKER_URL` | `redis://REDIS_HOST:6379/1` |
| `CELERY_RESULT_BACKEND` | `redis://REDIS_HOST:6379/2` |
| `JWT_SECRET` | output of `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | output of `openssl rand -hex 32` |
| `VAULT_MASTER_KEY` | output of `openssl rand -hex 32` |

Replace `DB_PASSWORD`, `CLOUD_SQL_CONNECTION_NAME`, and `REDIS_HOST` with your real staging values. Do not include quotes around the secret values.

## Step 9: Deploy Staging from GitHub

Push backend changes to `develop`:

```bash
git checkout -b develop
git push origin develop
```

If the branch already exists:

```bash
git checkout develop
git pull
git push origin develop
```

Then open **GitHub -> Actions -> Backend CI/CD**. The run should:

- Run tests.
- Push the Docker image.
- Run Alembic migrations.
- Deploy `arcadia-backend-staging`.
- Print the Cloud Run service URL.

You can also run it manually from GitHub Actions with **Run workflow -> target: staging**.

## Step 10: Production Setup

After staging works, repeat Steps 1 through 8 for production.

Recommended production values:

| Item | Production example |
| --- | --- |
| Project | `arcadia-hotel-production` |
| Cloud Run service | `arcadia-backend` |
| Migration job | `arcadia-backend-migrate-production` |
| Cloud SQL instance | `arcadia-db-production` |
| Redis instance | `arcadia-redis-production` |
| VPC connector | `arcadia-vpc-production` |
| Runtime service account | `arcadia-backend-runner-production` |
| Deploy service account | `arcadia-github-deployer-production` |

Create a GitHub environment named `production` and add the production variables and secrets.

By default, pushes to `main` deploy production. If you want a manual approval before production deploys, enable required reviewers on the GitHub `production` environment.

Manual production deployments must be run from the `main` branch. This keeps production tied to the same branch that deploys automatically.

## Important Production Rules

- Set `AUTO_CREATE_TABLES=false`. The workflow already does this.
- Use Alembic migrations for schema changes.
- Keep migrations backward compatible when possible. The migration runs before the new service revision receives traffic.
- Back up production before risky migrations.
- A failed migration stops the service deployment, so the existing Cloud Run revision keeps serving.
- Rolling back a Cloud Run revision does not automatically roll back database migrations.
- Keep staging and production in separate Google Cloud projects or at least separate Cloud SQL instances.
- Replace `CORS_ORIGINS=*` with your real frontend domain before public testing.

## Optional: Install Google Cloud CLI in WSL

This is not required for CI/CD because Cloud Shell handles setup and GitHub Actions handles deployment.

If you want local `gcloud` inside WSL later, follow the official Linux install guide:

```text
https://cloud.google.com/sdk/docs/install#linux
```

After installing:

```bash
gcloud auth login
gcloud config set project arcadia-hotel-staging
```

## Useful Checks

View the deployed staging service:

```bash
gcloud run services describe arcadia-backend-staging \
  --region=us-central1 \
  --format='value(status.url)'
```

View migration job logs:

```bash
gcloud run jobs executions list \
  --job=arcadia-backend-migrate-staging \
  --region=us-central1
```

Check Alembic state through a one-off job execution:

```bash
gcloud run jobs execute arcadia-backend-migrate-staging \
  --region=us-central1 \
  --wait
```

## Troubleshooting

| Problem | Check |
| --- | --- |
| GitHub auth fails | `GITHUB_REPO` must exactly match `owner/repo`; check `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_DEPLOY_SERVICE_ACCOUNT`. |
| Docker push fails | Deploy service account needs `roles/artifactregistry.writer`. |
| Cloud Run deploy fails with service account error | Deploy service account needs `roles/iam.serviceAccountUser` on the runtime service account. |
| Alembic cannot find migrations | The image must include `backend/alembic.ini`; this repo now keeps it in the Docker build context. |
| Cloud SQL connection fails | Use `postgresql+psycopg://...@/arcadia?host=/cloudsql/PROJECT:REGION:INSTANCE`, and grant runtime service account `roles/cloudsql.client`. |
| Redis times out | Set `VPC_CONNECTOR` and `VPC_EGRESS=private-ranges-only`; verify the Redis private IP. |
| Service starts locally but not on Cloud Run | The container must listen on `$PORT`; `backend/Dockerfile` now does this. |

## Official References

- Google Cloud Workload Identity Federation for deployment pipelines: https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- Google GitHub Action for auth: https://github.com/google-github-actions/auth
- Google GitHub Action for setup-gcloud: https://github.com/google-github-actions/setup-gcloud
- Cloud Run deploy command: https://cloud.google.com/sdk/gcloud/reference/run/deploy
- Cloud Run jobs deploy command: https://cloud.google.com/sdk/gcloud/reference/run/jobs/deploy
- Cloud Run jobs execute command: https://cloud.google.com/sdk/gcloud/reference/run/jobs/execute
- Cloud SQL for PostgreSQL from Cloud Run: https://cloud.google.com/sql/docs/postgres/connect-run
