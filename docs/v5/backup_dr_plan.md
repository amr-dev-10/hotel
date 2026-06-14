# Backup And Disaster Recovery

## Targets

- RPO: less than 5 minutes with PostgreSQL WAL archiving in production.
- RTO: less than 30 minutes with full backup restore plus point-in-time recovery.
- Full backup: daily at 02:00 UTC.
- PITR window: 30 days.
- Restore test: monthly into staging.

## Storage

- PostgreSQL full dumps and WAL archives should go to versioned object storage.
- Redis should use RDB snapshots and AOF where operationally useful; Redis data is still treated as cache/session state.
- Uploaded media/export/import files should use object storage versioning and lifecycle retention.
- Application configuration should live in a secret manager; `.env` files are local-development only.

## Restore Summary

1. Stop API and worker processes.
2. Restore the latest full database backup before the target time.
3. Replay WAL to the target point in time.
4. Run integrity verification.
5. Restart API and workers.
6. Verify health, login, tenant isolation, room availability, folios, campaigns, and imports/exports.
