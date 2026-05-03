# Cloud Run Job ve Scheduler'ı otomatik kuran script

$JOB_NAME="evalon-bist-news-scraper"
$REGION="europe-west3"

Write-Host "🚀 1. Cloud Run Job oluşturuluyor ve kod yükleniyor..." -ForegroundColor Cyan
# .gcloudignore dosyamız sayesinde oracle_wallet ve .env dosyaları da güvenle yüklenecek.
gcloud run jobs deploy $JOB_NAME `
  --source . `
  --command "python" `
  --args "daily_bist_news_job.py" `
  --region $REGION `
  --memory 4096Mi `
  --task-timeout 45m `
  --quiet

Write-Host "⏰ 2. Cloud Scheduler ile günlük tetikleyici (Cron) ayarlanıyor..." -ForegroundColor Cyan
# Eğer önceden varsa silip tekrar kurmak daha temiz olur
gcloud scheduler jobs delete "$JOB_NAME-trigger" --location $REGION --quiet 2>$null

# Her gün saat 18:30'da (Türkiye saatiyle) çalışacak şekilde ayarlanıyor.
# Timezone Europe/Istanbul
gcloud scheduler jobs create http "$JOB_NAME-trigger" `
  --location $REGION `
  --schedule "30 18 * * *" `
  --time-zone "Europe/Istanbul" `
  --uri "https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$(gcloud config get-value project)/jobs/$JOB_NAME:run" `
  --http-method POST `
  --oauth-service-account-email "$(gcloud config get-value account)"

Write-Host "✅ Tembel işi kurulum tamamlandı! Artık sen PC'ni kapatsan bile her gün 18:30'da Google otomatik çalıştıracak." -ForegroundColor Green
Write-Host "Hemen şimdi ilk test çalışmasını başlatmak istersen şu komutu girebilirsin:" -ForegroundColor Yellow
Write-Host "gcloud run jobs execute $JOB_NAME --region $REGION" -ForegroundColor Yellow
