param(
    [string]$JobName = "evalon-bist-calendar-scraper",
    [string]$Region = "europe-west3",
    [string]$Schedule = "30 6 * * *",
    [string]$TimeZone = "Europe/Istanbul",
    [switch]$SkipScheduler,
    [switch]$SkipExecuteTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-GcloudPath {
    $candidates = @(
        (Get-Command gcloud.cmd -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        (Get-Command gcloud -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        (Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd")
    ) | Where-Object { $_ -and (Test-Path $_) }

    if (-not $candidates) {
        throw "gcloud CLI bulunamadı. Önce Google Cloud CLI kurulmalı."
    }

    return $candidates[0]
}

function Read-DotEnv([string]$Path) {
    $values = @{}
    if (-not (Test-Path $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim("'").Trim('"')
        if ($key) {
            $values[$key] = $value
        }
    }

    return $values
}

function Copy-Tree([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Reset-StageDir([string]$StageDir) {
    $tempRoot = [System.IO.Path]::GetFullPath($env:TEMP)
    $targetRoot = [System.IO.Path]::GetFullPath($StageDir)
    if (-not $targetRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Stage klasörü TEMP altında değil: $targetRoot"
    }

    if (Test-Path $targetRoot) {
        Remove-Item -LiteralPath $targetRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\"))
$calendarRoot = Join-Path $repoRoot "scrapers\calendar_scraper"
$newsRoot = Join-Path $repoRoot "scrapers\news_scraper"
$walletDir = Join-Path $newsRoot "oracle_wallet"
$stageDir = Join-Path $env:TEMP "evalon-calendar-cloudrun-build"

$gcloud = Get-GcloudPath
$calendarEnv = Read-DotEnv (Join-Path $calendarRoot ".env")
$newsEnv = Read-DotEnv (Join-Path $newsRoot ".env")

$dbUser = if ($env:ORACLE_DB_USER) { $env:ORACLE_DB_USER } elseif ($calendarEnv.ContainsKey("ORACLE_DB_USER")) { $calendarEnv["ORACLE_DB_USER"] } elseif ($newsEnv.ContainsKey("ORACLE_DB_USER")) { $newsEnv["ORACLE_DB_USER"] } else { "" }
$dbPassword = if ($env:ORACLE_DB_PASSWORD) { $env:ORACLE_DB_PASSWORD } elseif ($calendarEnv.ContainsKey("ORACLE_DB_PASSWORD")) { $calendarEnv["ORACLE_DB_PASSWORD"] } elseif ($newsEnv.ContainsKey("ORACLE_DB_PASSWORD")) { $newsEnv["ORACLE_DB_PASSWORD"] } else { "" }
$dbDsn = if ($env:ORACLE_DB_DSN) { $env:ORACLE_DB_DSN } elseif ($calendarEnv.ContainsKey("ORACLE_DB_DSN")) { $calendarEnv["ORACLE_DB_DSN"] } elseif ($newsEnv.ContainsKey("ORACLE_DB_DSN")) { $newsEnv["ORACLE_DB_DSN"] } else { "" }

if (-not $dbUser -or -not $dbPassword -or -not $dbDsn) {
    throw "Oracle env değerleri eksik. ORACLE_DB_USER / ORACLE_DB_PASSWORD / ORACLE_DB_DSN gerekli."
}

if (-not (Test-Path $walletDir)) {
    throw "Oracle wallet bulunamadı: $walletDir"
}

Write-Host "1. Cloud Run build context hazırlanıyor..." -ForegroundColor Cyan
Reset-StageDir $stageDir

New-Item -ItemType Directory -Force -Path (Join-Path $stageDir "scrapers") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stageDir "scrapers\news_scraper") | Out-Null

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Dockerfile") -Destination $stageDir -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "requirements.txt") -Destination $stageDir -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot ".gcloudignore") -Destination $stageDir -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "run_calendar_job.py") -Destination $stageDir -Force
Copy-Tree -Source $calendarRoot -Destination (Join-Path $stageDir "scrapers")
Copy-Item -LiteralPath (Join-Path $newsRoot "bist_tickers.json") -Destination (Join-Path $stageDir "scrapers\news_scraper\bist_tickers.json") -Force
Copy-Tree -Source $walletDir -Destination (Join-Path $stageDir "scrapers\news_scraper")

$setEnvVars = @(
    "ORACLE_DB_USER=$dbUser",
    "ORACLE_DB_PASSWORD=$dbPassword",
    "ORACLE_DB_DSN=$dbDsn",
    "ORACLE_WALLET_DIR=/app/scrapers/news_scraper/oracle_wallet",
    "CALENDAR_SOURCES=macro_tr",
    "REQUEST_DELAY=1.0"
) -join ","

Write-Host "2. Cloud Run Job deploy ediliyor..." -ForegroundColor Cyan
& $gcloud run jobs deploy $JobName `
    --source $stageDir `
    --region $Region `
    --command python `
    --args run_calendar_job.py `
    --memory 1024Mi `
    --cpu 1 `
    --max-retries 1 `
    --task-timeout 20m `
    --set-env-vars $setEnvVars `
    --quiet

if (-not $SkipExecuteTest) {
    Write-Host "3. Test için job execute ediliyor..." -ForegroundColor Cyan
    & $gcloud run jobs execute $JobName --region $Region --wait
}

if (-not $SkipScheduler) {
    $projectId = (& $gcloud config get-value project).Trim()
    $accountEmail = (& $gcloud config get-value account).Trim()
    $schedulerName = "$JobName-trigger"

    Write-Host "4. Scheduler güncelleniyor..." -ForegroundColor Cyan
    & $gcloud scheduler jobs delete $schedulerName --location $Region --quiet 2>$null

    & $gcloud scheduler jobs create http $schedulerName `
        --location $Region `
        --schedule $Schedule `
        --time-zone $TimeZone `
        --uri "https://$Region-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$projectId/jobs/$JobName:run" `
        --http-method POST `
        --oauth-service-account-email $accountEmail `
        --quiet
}

Write-Host "Tamamlandı." -ForegroundColor Green
Write-Host "Job: $JobName" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Green
Write-Host "Scheduler: $Schedule ($TimeZone)" -ForegroundColor Green
