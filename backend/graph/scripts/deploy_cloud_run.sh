#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT_ID="${PROJECT_ID:-evalon-490523}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-evalon-graph-web}"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-evalon-graph-web-run@${PROJECT_ID}.iam.gserviceaccount.com}"
BACKTEST_API_BASE="${BACKTEST_API_BASE:-https://evalon-backtest-api-474112640179.europe-west1.run.app/v1}"
ALLOW_SYNTHETIC_CANDLES_FALLBACK="${ALLOW_SYNTHETIC_CANDLES_FALLBACK:-0}"

function ensure_runtime_service_account() {
  if gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    return
  fi

  local account_id
  account_id="${RUNTIME_SERVICE_ACCOUNT%@*}"
  account_id="${account_id##*/}"

  gcloud iam service-accounts create "${account_id}" \
    --display-name "Evalon Graph Web Cloud Run Runtime" \
    --project "${PROJECT_ID}"

  for _ in {1..10}; do
    if gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done

  echo "Runtime service account was created but is not yet visible: ${RUNTIME_SERVICE_ACCOUNT}" >&2
  exit 1
}

ensure_runtime_service_account

env_vars=(
  "BACKTEST_API_BASE=${BACKTEST_API_BASE}"
  "ALLOW_SYNTHETIC_CANDLES_FALLBACK=${ALLOW_SYNTHETIC_CANDLES_FALLBACK}"
  "NODE_ENV=production"
)

SERVICE_URL="$(
  gcloud run deploy "${SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --source "${APP_ROOT}" \
    --allow-unauthenticated \
    --concurrency 20 \
    --cpu 1 \
    --memory 1Gi \
    --max-instances 3 \
    --min-instances 1 \
    --service-account "${RUNTIME_SERVICE_ACCOUNT}" \
    --timeout 60 \
    --set-env-vars "$(IFS=,; echo "${env_vars[*]}")" \
    --format='value(status.url)'
)"

echo "Cloud Run URL: ${SERVICE_URL}"
