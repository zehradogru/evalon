# Cloud Run Job ve Scheduler'ı otomatik kuran script
# BIST Finansal Takvim Kazıyıcısı için

$JOB_NAME="evalon-bist-calendar-scraper"
$REGION="europe-west3"

Write-Host "🚀 1. Cloud Run Job oluşturuluyor ve kod yükleniyor..." -ForegroundColor Cyan
gcloud run jobs deploy $JOB_NAME `
  --source . `
  --command "python" `
  --args "main.py" `
  --region $REGION `
  --memory 512Mi `
  --task-timeout 15m `
  --quiet

Write-Host "⏰ 2. Cloud Scheduler ile günlük tetikleyici ayarlanıyor..." -ForegroundColor Cyan
# Önceden varsa sil
gcloud scheduler jobs delete "$JOB_NAME-trigger" --location $REGION --quiet 2>$null

# Her gün saat 07:00'da (Türkiye saatiyle) çalışacak — piyasa açılmadan önce
gcloud scheduler jobs create http "$JOB_NAME-trigger" `
  --location $REGION `
  --schedule "0 7 * * *" `
  --time-zone "Europe/Istanbul" `
  --uri "https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$(gcloud config get-value project)/jobs/$JOB_NAME:run" `
  --http-method POST `
  --oauth-service-account-email "$(gcloud config get-value account)"

Write-Host "✅ Takvim kazıyıcısı kurulumu tamamlandı!" -ForegroundColor Green
Write-Host "Her gün 07:00'da (İstanbul saati) otomatik çalışacak." -ForegroundColor Green
Write-Host "" -ForegroundColor Yellow
Write-Host "Hemen şimdi test etmek için:" -ForegroundColor Yellow
Write-Host "gcloud run jobs execute $JOB_NAME --region $REGION" -ForegroundColor Yellow
