# Cloud Run Deployment

Bu servis `Cloud Run` üzerinde `evalon-backtest-api` adıyla çalışacak şekilde hazırlanmıştır.

## Hedef Ayarlar

- `project`: `evalon-490523`
- `region`: `europe-west1`
- `service`: `evalon-backtest-api`
- `cpu`: `1`
- `memory`: `1Gi`
- `timeout`: `60s`
- `concurrency`: `8`
- `min-instances`: `1`
- `max-instances`: `3`

## Runtime Service Account

Runtime kimliği ayrı tutulur:

- `evalon-backtest-run@evalon-490523.iam.gserviceaccount.com`
- Gerekli runtime rolü: `roles/secretmanager.secretAccessor`

Deploy eden kimlik için beklenen roller:

- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/cloudbuild.builds.editor`
- `roles/iam.serviceAccountUser`
- `roles/secretmanager.admin`

## Secret Sözleşmesi

Gerekli secret'lar:

- `ORACLE_DB_USER`
- `ORACLE_DB_PASSWORD`
- `ORACLE_DB_DSN`
- `ORACLE_WALLET_ZIP_B64`

Opsiyonel secret'lar:

- `ORACLE_WALLET_PASSWORD`
- `GEMINI_API_KEY`

## Non-Secret Env

Deploy script şu env'leri set eder:

- `AI_ASSET_STORE_PATH=/tmp/evalon_ai_assets.json`
- `BIST_DEBUG=0`
- `GOOGLE_CLOUD_PROJECT=evalon-490523`
- `GOOGLE_CLOUD_LOCATION=global`
- `ORACLE_USE_POOL=1`
- `ORACLE_POOL_MIN=1`
- `ORACLE_POOL_MAX=4`
- `ORACLE_POOL_INC=1`

Opsiyonel:

- `ALLOWED_ORIGINS=https://your-app.vercel.app`
- `ALLOWED_ORIGIN_REGEX=^https://.*\.vercel\.app$`

## Authentication

Elindeki owner JSON yalnızca deploy/provisioning için kullanılmalı. Yerel örnek:

```bash
export CLOUDSDK_CONFIG=/tmp/gcloud-evalon
gcloud auth activate-service-account \
  --key-file=/Users/aliberkyesilduman/Downloads/evalon-490523-cb27db47fd0a.json
gcloud config set project evalon-490523
```

## Deploy

Vercel origin'lerini geçirerek deploy:

```bash
export CLOUDSDK_CONFIG=/tmp/gcloud-evalon
export ALLOWED_ORIGINS="https://your-frontend.vercel.app"

bash /Users/aliberkyesilduman/evalon_bitirme/backend/backtest/scripts/deploy_cloud_run.sh
```

Script eksik secret varsa durur, runtime service account'u yoksa oluşturur ve servis URL'ini stdout'a basar.

## Smoke Test

Container seviyesi smoke test:

```bash
bash /Users/aliberkyesilduman/evalon_bitirme/backend/backtest/scripts/smoke_test_cloud_run.sh \
  https://YOUR_SERVICE_URL
```

Gerçek Oracle testi:

```bash
RUN_ORACLE_SMOKE=1 \
REAL_TICKER=THYAO \
bash /Users/aliberkyesilduman/evalon_bitirme/backend/backtest/scripts/smoke_test_cloud_run.sh \
  https://YOUR_SERVICE_URL
```

## Web ve Mobile Cutover

Deploy sonrası:

1. Vercel'de `NEXT_PUBLIC_EVALON_API_URL` değerini Cloud Run `run.app` URL'i ile güncelle.
2. Mobile build sırasında `EVALON_API_BASE_URL=<run.app host>` geç.
3. Web `api/prices`, `api/prices/batch` ve `api/markets/list` akışlarını doğrula.
4. Mobile release smoke test tamamlandıktan sonra eski Vercel backend'i kapat.
