# Release Versioning And Development Track

This document defines the versioning approach for Arcadia Hotel Platform development, staging deployment, database migrations, and infrastructure changes.

## Versioning Standard

Use Semantic Versioning for product releases:

```text
MAJOR.MINOR.PATCH
```

Meaning:

| Segment | Use when |
| --- | --- |
| `MAJOR` | Breaking API, database, auth, tenant model, or user workflow changes. |
| `MINOR` | Backward-compatible features, new modules, new endpoints, or new screens. |
| `PATCH` | Bug fixes, deployment fixes, security patches, small UI fixes, and non-breaking config changes. |

For release candidates and staging deploys, use prerelease labels:

```text
1.0.0-rc.1
1.0.0-rc.2
```

For build-specific deployment tracking, add build metadata:

```text
1.0.0-rc.1+staging.20260627.shaabcdef1
```

Recommended Git tag format:

```text
backend-v1.0.0-rc.1
dashboard-v1.0.0-rc.1
platform-v1.0.0-rc.1
infra-staging-v2026.06.27.1
```

## Current Version Sources

| Track | Current value | Source |
| --- | --- | --- |
| Backend API version | `1.0.0-rc.1` | `backend/app/main.py` FastAPI version |
| Dashboard app version | `1.0.0-rc.1` | `apps/dashboard/package.json` |
| Architecture version | `v5.2` | `docs/v5.2/` |
| Alembic schema head | `2c9008cee828` | `backend/alembic/versions/2c9008cee828_initial_schema.py` |
| Staging branch | `staging` | GitHub branch |
| Production branch | `main` | GitHub branch |
| Staging project | `arcadia-hotel-staging` | Google Cloud |
| Staging region | `asia-south2` | Google Cloud |

## Current Development Fix Track

This is the current tracked deployment hardening sequence for staging.

| Track ID | Version | Date | Scope | Summary | Status |
| --- | --- | --- | --- | --- | --- |
| `DEPLOY-STG-001` | `infra-staging-v2026.06.27.1` | 2026-06-27 | Infrastructure | Added Cloud Shell staging bootstrap scripts for Cloud SQL, Redis, Artifact Registry, VPC connector, IAM, WIF, and Secret Manager. | Applied |
| `DEPLOY-STG-002` | `backend-v1.0.0-rc.1` | 2026-06-27 | Backend CI/CD | Added GitHub Actions workflow for test, Docker build, Artifact Registry push, Alembic migration job, Cloud Run deploy, and `/health` smoke test. | Applied |
| `DEPLOY-STG-003` | `infra-staging-v2026.06.27.2` | 2026-06-27 | Secrets | Moved app secrets out of GitHub and into Google Secret Manager using Cloud Run `--set-secrets`. | Applied |
| `DEPLOY-STG-004` | `infra-staging-v2026.06.27.3` | 2026-06-27 | Cloud SQL | Fixed Cloud SQL tier mismatch by explicitly using `DB_EDITION=enterprise` with `DB_TIER=db-g1-small`. | Applied |
| `DEPLOY-STG-005` | `docs-v2026.06.27.1` | 2026-06-27 | Documentation | Added staging deployment runbook, troubleshooting notes, and versioning track. | Applied |
| `DEPLOY-STG-006` | `platform-v1.0.0-rc.1` | 2026-06-27 | Release Track | Promoted the current development line to the first major release candidate because staging is the first server deployment milestone. | Applied |
| `DEPLOY-STG-007` | `infra-staging-v2026.06.27.4` | 2026-06-27 | Admin Bootstrap | Added production-style one-time Cloud Run Job script for creating the first platform admin without permanent plaintext secrets. | Applied |
| `DEPLOY-STG-008` | `infra-staging-v2026.06.27.5` | 2026-06-27 | Admin Recovery | Added one-time Cloud Run Job script and backend seed module for platform admin password recovery without rotating long-lived secrets. | Applied |
| `DEPLOY-STG-009` | `dashboard-v1.0.0-rc.1` | 2026-06-27 | Frontend CI/CD | Added Next.js standalone Docker image, frontend Cloud Run workflow, staging GitHub variable generator, and deployment documentation. | Applied |

## Branch And Environment Track

| Branch | Environment | Purpose | Deployment behavior |
| --- | --- | --- | --- |
| `staging` | `staging` | Integration testing and serverless deployment validation. | Push or manual GitHub Action deploys to `arcadia-backend-staging`. |
| `main` | `production` | Production release branch. | Push or approved manual GitHub Action deploys to production. |

Recommended development flow:

```text
feature branch -> staging -> main
```

Use pull requests for:

- Feature branch into `staging`
- `staging` into `main`

## Release Candidate Flow

Use release candidates before production:

```text
1.0.0-rc.1
1.0.0-rc.2
1.0.0
```

Example:

| Step | Version | Branch | Action |
| --- | --- | --- | --- |
| First staging test | `1.0.0-rc.1` | `staging` | Deploy to staging and test. |
| Fix staging issue | `1.0.0-rc.2` | `staging` | Deploy fix and retest. |
| Production release | `1.0.0` | `main` | Merge and deploy after approval. |

## Docker Image Tags

The current backend workflow pushes:

```text
asia-south2-docker.pkg.dev/arcadia-hotel-staging/arcadia-repo/backend-api:<git-sha>
asia-south2-docker.pkg.dev/arcadia-hotel-staging/arcadia-repo/backend-api:staging-latest
```

Recommended future tags:

```text
backend-api:1.0.0-rc.1
backend-api:1.0.0-rc.1-shaabcdef1
backend-api:staging-latest
```

Keep the immutable Git SHA tag for rollback and audit.

## Database Migration Track

Alembic is the source of truth for schema versioning.

Current migration head:

```text
2c9008cee828_initial_schema
```

Migration rules:

- Every schema change must create a new Alembic revision.
- Do not edit already-applied migration files after staging or production deploy.
- Prefer backward-compatible migrations before production.
- A failed migration must block service deployment.
- Rolling back Cloud Run does not roll back database migrations.

Recommended migration naming:

```text
YYYYMMDD_HHMM_short_description
```

Example:

```text
20260627_1830_add_hotel_secret_versions.py
```

## Infrastructure Version Track

Infrastructure scripts use calendar-based versions because infrastructure changes are operational events.

Format:

```text
infra-<environment>-vYYYY.MM.DD.N
```

Examples:

```text
infra-staging-v2026.06.27.1
infra-staging-v2026.06.27.2
infra-production-v2026.07.01.1
```

Use a new infra version when changing:

- Cloud SQL settings
- Redis settings
- VPC connector settings
- IAM roles
- Workload Identity Federation
- Secret Manager naming
- Cloud Run deployment flags

## Documentation Version Track

Documentation versions use calendar versions:

```text
docs-vYYYY.MM.DD.N
```

Current deployment docs track:

```text
docs-v2026.06.27.1
```

Update docs when:

- A setup command changes.
- A GitHub variable changes.
- An infrastructure default changes.
- A known error and recovery path is discovered.
- A deployment workflow step changes.

## Commit Message Convention

Use Conventional Commits:

```text
type(scope): short summary
```

Recommended types:

| Type | Use |
| --- | --- |
| `feat` | New feature. |
| `fix` | Bug fix. |
| `chore` | Tooling, setup, dependency, or non-product work. |
| `docs` | Documentation only. |
| `ci` | GitHub Actions and automation. |
| `infra` | Cloud infrastructure scripts and IAM. |
| `db` | Alembic migrations and database changes. |
| `refactor` | Internal code change without behavior change. |
| `test` | Tests only. |

Examples:

```text
infra(staging): add idempotent Cloud Run bootstrap
ci(backend): deploy staging from staging branch
fix(cloudsql): force enterprise edition for db-g1-small
docs(deploy): add staging serverless runbook
db(hotels): add hotel billing table
```

## Release Checklist

Before tagging a staging release candidate:

- Backend tests pass.
- Alembic migration runs in staging.
- Cloud Run service deploys successfully.
- `/health` returns `{"ok": true}`.
- GitHub Actions logs show the Git SHA image tag.
- Secret Manager values exist.
- `github-variables.txt` matches GitHub environment variables.
- Documentation is updated.

Before production:

- Staging release candidate is tested.
- Production GitHub environment requires approval.
- Cloud SQL backup policy is confirmed.
- CORS is restricted to production frontend domain.
- Rollback plan is written.
- Database migration risk is reviewed.

## Current Major Release Line

The current app line is now the first major release line because this is the first server-side staging deployment.

Current staging release candidate:

```text
1.0.0-rc.1
```

After staging validation, promote as the first stable production release:

```text
1.0.0
```
