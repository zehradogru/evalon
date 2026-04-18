#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT_ID="${PROJECT_ID:-evalon-490523}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-evalon-backtest-api}"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-evalon-backtest-run@${PROJECT_ID}.iam.gserviceaccount.com}"
GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"
ALLOWED_ORIGIN_REGEX="${ALLOWED_ORIGIN_REGEX:-}"

required_secrets=(
  ORACLE_DB_USER
  ORACLE_DB_PASSWORD
  ORACLE_DB_DSN
  ORACLE_WALLET_ZIP_B64
)

optional_secrets=(
  ORACLE_WALLET_PASSWORD
  GEMINI_API_KEY
)

function ensure_runtime_service_account() {
  if gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    return
  fi

  local account_id
  account_id="${RUNTIME_SERVICE_ACCOUNT%@*}"
  account_id="${account_id##*/}"

  gcloud iam service-accounts create "${account_id}" \
    --display-name "Evalon Backtest Cloud Run Runtime" \
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

function ensure_secret_binding() {
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None \
    --quiet >/dev/null
}

function require_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "${secret_name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Missing required secret: ${secret_name}" >&2
    exit 1
  fi
}

function append_secret_binding_if_present() {
  local secret_name="$1"
  if gcloud secrets describe "${secret_name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    secret_bindings+=("${secret_name}=${secret_name}:latest")
  fi
}

ensure_runtime_service_account
ensure_secret_binding

secret_bindings=()
for secret_name in "${required_secrets[@]}"; do
  require_secret "${secret_name}"
  secret_bindings+=("${secret_name}=${secret_name}:latest")
done

for secret_name in "${optional_secrets[@]}"; do
  append_secret_binding_if_present "${secret_name}"
done

env_vars=(
  "AI_ASSET_STORE_PATH=/tmp/evalon_ai_assets.json"
  "BIST_DEBUG=0"
  "GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION}"
  "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
  "ORACLE_POOL_INC=1"
  "ORACLE_POOL_MAX=4"
  "ORACLE_POOL_MIN=1"
  "ORACLE_USE_POOL=1"
)

if [[ -n "${ALLOWED_ORIGINS}" ]]; then
  env_vars+=("ALLOWED_ORIGINS=${ALLOWED_ORIGINS}")
fi

if [[ -n "${ALLOWED_ORIGIN_REGEX}" ]]; then
  env_vars+=("ALLOWED_ORIGIN_REGEX=${ALLOWED_ORIGIN_REGEX}")
fi

SERVICE_URL="$(
  gcloud run deploy "${SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --source "${APP_ROOT}" \
    --allow-unauthenticated \
    --concurrency 8 \
    --cpu 1 \
    --memory 1Gi \
    --max-instances 3 \
    --min-instances 1 \
    --service-account "${RUNTIME_SERVICE_ACCOUNT}" \
    --timeout 60 \
    --set-env-vars "$(IFS=,; echo "${env_vars[*]}")" \
    --set-secrets "$(IFS=,; echo "${secret_bindings[*]}")" \
    --format='value(status.url)'
)"

echo "Cloud Run URL: ${SERVICE_URL}"
