#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-evalon-490523}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
SERVICE_NAME="evalon-web"
REPO="cloud-run-source-deploy"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE_NAME"

BACKEND_API_URL="${NEXT_PUBLIC_EVALON_API_URL:-https://evalon-backtest-api-474112640179.europe-west1.run.app}"
GRAPH_WEB_URL="${NEXT_PUBLIC_EVALON_GRAPH_WEB_URL:-https://evalon-graph-web-474112640179.europe-west1.run.app}"

# Firebase vars — load from .env.local if present
ENV_LOCAL="$(dirname "$0")/../.env.local"
if [[ -f "$ENV_LOCAL" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_LOCAL" | grep 'NEXT_PUBLIC_FIREBASE' | xargs)
fi

: "${NEXT_PUBLIC_FIREBASE_API_KEY:?NEXT_PUBLIC_FIREBASE_API_KEY is required}"
: "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required}"
: "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:?NEXT_PUBLIC_FIREBASE_PROJECT_ID is required}"
: "${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:?NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required}"
: "${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:?NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is required}"
: "${NEXT_PUBLIC_FIREBASE_APP_ID:?NEXT_PUBLIC_FIREBASE_APP_ID is required}"
: "${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:?}"

echo "→ Authenticating with Docker registry..."
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

echo "→ Building Docker image..."
cd "$(dirname "$0")/.."
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" \
  --build-arg NEXT_PUBLIC_EVALON_API_URL="$BACKEND_API_URL" \
  --build-arg NEXT_PUBLIC_EVALON_GRAPH_WEB_URL="$GRAPH_WEB_URL" \
  -t "$IMAGE" \
  .

echo "→ Pushing image..."
docker push "$IMAGE"

echo "→ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "NEXT_PUBLIC_EVALON_API_URL=$BACKEND_API_URL" \
  --quiet

echo "✓ Deploy complete!"
gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.url)"
