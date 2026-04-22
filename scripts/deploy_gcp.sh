#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-anti-gaming}"
DB_INSTANCE="${DB_INSTANCE:-anti-gaming-db}"
DB_NAME="${DB_NAME:-anti_gaming}"
DB_USER="${DB_USER:-anti_gaming_app}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_TIER="${DB_TIER:-db-custom-1-3840}"
DB_EDITION="${DB_EDITION:-ENTERPRISE}"
IMPORT_BUCKET="${IMPORT_BUCKET:-${PROJECT_ID}-anti-gaming-deploy}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required."
  exit 1
fi

if [[ -z "${DB_PASSWORD}" ]]; then
  echo "DB_PASSWORD is required."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  --project "${PROJECT_ID}"

echo "==> Setting gcloud project"
gcloud config set project "${PROJECT_ID}"

echo "==> Ensuring Cloud SQL instance exists"
if ! gcloud sql instances describe "${DB_INSTANCE}" >/dev/null 2>&1; then
  gcloud sql instances create "${DB_INSTANCE}" \
    --database-version=POSTGRES_16 \
    --edition="${DB_EDITION}" \
    --tier="${DB_TIER}" \
    --region="${REGION}" \
    --storage-size=10GB \
    --backup \
    --enable-point-in-time-recovery
fi

echo "==> Ensuring database exists"
if ! gcloud sql databases describe "${DB_NAME}" --instance="${DB_INSTANCE}" >/dev/null 2>&1; then
  gcloud sql databases create "${DB_NAME}" --instance="${DB_INSTANCE}"
fi

echo "==> Ensuring app user exists"
if ! gcloud sql users list --instance="${DB_INSTANCE}" --format="value(name)" | grep -qx "${DB_USER}"; then
  gcloud sql users create "${DB_USER}" --instance="${DB_INSTANCE}" --password="${DB_PASSWORD}"
else
  gcloud sql users set-password "${DB_USER}" --instance="${DB_INSTANCE}" --password="${DB_PASSWORD}"
fi

echo "==> Uploading schema for import"
if ! gsutil ls -b "gs://${IMPORT_BUCKET}" >/dev/null 2>&1; then
  gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${IMPORT_BUCKET}"
fi
gsutil cp "${ROOT_DIR}/schema.sql" "gs://${IMPORT_BUCKET}/schema.sql"

echo "==> Importing schema"
gcloud sql import sql "${DB_INSTANCE}" "gs://${IMPORT_BUCKET}/schema.sql" \
  --database="${DB_NAME}" \
  --quiet || true

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "${DB_INSTANCE}" --format='value(connectionName)')"
DATABASE_URL="postgresql+psycopg://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${INSTANCE_CONNECTION_NAME}"

echo "==> Deploying Cloud Run service"
gcloud run deploy "${SERVICE_NAME}" \
  --source "${ROOT_DIR}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --add-cloudsql-instances "${INSTANCE_CONNECTION_NAME}" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL},APP_ENV=production,CORS_ORIGINS=*" \
  --port 8080

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"

cat <<EOF

Deployment complete.

Cloud Run URL:
${SERVICE_URL}

Useful pages:
- Dashboard: ${SERVICE_URL}/
- Learner:   ${SERVICE_URL}/learner.html
- API docs:  ${SERVICE_URL}/docs
- Health:    ${SERVICE_URL}/health

EOF
