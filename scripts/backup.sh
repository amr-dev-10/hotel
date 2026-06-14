#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DB_NAME="${DB_NAME:-arcadia}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/arcadia-backups}"
S3_BUCKET="${S3_BUCKET:-}"

mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/arcadia_${TIMESTAMP}.dump"

pg_dump -Fc "${DB_NAME}" > "${BACKUP_FILE}"

if [ -n "${S3_BUCKET}" ]; then
  aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/daily/arcadia_${TIMESTAMP}.dump"
  aws s3 ls "${S3_BUCKET}/daily/arcadia_${TIMESTAMP}.dump"
fi

echo "Backup completed: ${BACKUP_FILE}"
