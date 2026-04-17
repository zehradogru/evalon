# Graph Chart Cloud Run Deployment

Bu klasor `chart.html`, `backtest.html`, `ai.html` ve bunlarin kullandigi `/api/v1/*` proxy rotalarini tek `Cloud Run` servisi olarak calistirmak icin hazirlanmistir.

## Hedef Ayarlar

- `project`: `evalon-490523`
- `region`: `europe-west1`
- `service`: `evalon-graph-web`
- `cpu`: `1`
- `memory`: `1Gi`
- `timeout`: `60s`
- `concurrency`: `20`
- `min-instances`: `1`
- `max-instances`: `3`

## Mimari

- Tek public host uzerinden static chart client sunulur.
- Ayni host altinda `/api/v1/*` Fastify proxy rotalari calisir.
- Proxy upstream'i `BACKTEST_API_BASE` ile `evalon-backtest-api` Cloud Run servisine gider.

Ornek production URL'ler:

- `/chart.html?symbol=ADEL&tf=1d`
- `/chart?symbol=ADEL&tf=1d`
- `/backtest.html?symbol=THYAO&tf=1h`
- `/ai.html`

## Runtime Service Account

Runtime kimligi ayri tutulur:

- `evalon-graph-web-run@evalon-490523.iam.gserviceaccount.com`

Bu servis su an public `evalon-backtest-api` upstream'ine gittigi icin ekstra secret veya IAM baglantisi gerektirmez.

## Runtime Env

Deploy script su env'leri set eder:

- `BACKTEST_API_BASE=https://evalon-backtest-api-474112640179.europe-west1.run.app/v1`
- `ALLOW_SYNTHETIC_CANDLES_FALLBACK=0`
- `NODE_ENV=production`

Opsiyonel override:

```bash
export BACKTEST_API_BASE="https://YOUR_BACKTEST_HOST/v1"
export ALLOW_SYNTHETIC_CANDLES_FALLBACK=1
```

## Authentication

Yerelde owner service account ile:

```bash
export CLOUDSDK_CONFIG=/tmp/gcloud-evalon
gcloud auth activate-service-account \
  --key-file=/Users/aliberkyesilduman/Downloads/evalon-490523-cb27db47fd0a.json
gcloud config set project evalon-490523
```

## Deploy

```bash
export CLOUDSDK_CONFIG=/tmp/gcloud-evalon
bash /Users/aliberkyesilduman/evalon_bitirme/backend/graph/scripts/deploy_cloud_run.sh
```

Script runtime service account yoksa olusturur ve servis URL'ini stdout'a basar.

## Smoke Test

```bash
bash /Users/aliberkyesilduman/evalon_bitirme/backend/graph/scripts/smoke_test_cloud_run.sh \
  https://YOUR_SERVICE_URL
```

## WebView Kullanimi

Web veya mobile tarafi yalnizca URL olusturup WebView acabilir:

```text
https://YOUR_GRAPH_HOST/chart.html?symbol=ADEL&tf=1d
```

Alternatif kisa path:

```text
https://YOUR_GRAPH_HOST/chart?symbol=ADEL&tf=1d
```

Desteklenen query parametreleri:

- `symbol`: hisse kodu, ornek `ADEL`, `THYAO`
- `tf`: timeframe, ornek `1m`, `5m`, `1h`, `4h`, `1d`, `1w`

## Notlar

- WebView kullanan istemci ayni origin icindeki API'lere ayrica dokunmaz; sayfa bunu kendi yapar.
- Web tarafinda `iframe` yerine tam ekran WebView veya yeni tab tercih etmek daha stabil olur.
- Mobile tarafinda URL her hisse seciminde yeniden hesaplanip WebView'e verilebilir.
