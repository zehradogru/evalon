param(
    [string]$InputPath = "data.csv",
    [string]$OutputPath = "data.csv"
)

$ErrorActionPreference = "Stop"

$rows = Import-Csv -Path $InputPath -Delimiter '|' -Header text,sentiment

$beforeRows = $rows.Count
$beforeUniqueExact = ($rows | Group-Object text, sentiment).Count
$beforeUniqueText = ($rows | Group-Object text).Count

$firstSeen = @{}
$lineOrder = 0

foreach ($row in $rows) {
    $text = [string]$row.text
    if (-not $firstSeen.ContainsKey($text)) {
        $firstSeen[$text] = $lineOrder
        $lineOrder++
    }
}

$deduped = foreach ($group in ($rows | Group-Object text)) {
    $winningSentiment = $group.Group |
        Group-Object sentiment |
        Sort-Object -Property @{Expression = "Count"; Descending = $true}, @{Expression = "Name"; Descending = $false} |
        Select-Object -First 1

    [PSCustomObject]@{
        text = $group.Name
        sentiment = $winningSentiment.Name
        first_seen = $firstSeen[$group.Name]
    }
}

$deduped = $deduped | Sort-Object first_seen

$outputDir = Split-Path -Parent $OutputPath
if ([string]::IsNullOrWhiteSpace($outputDir)) {
    $outputDir = (Get-Location).Path
}
$outputFile = Join-Path $outputDir (Split-Path -Leaf $OutputPath)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$lines = foreach ($row in $deduped) {
    $safeText = '"' + (([string]$row.text).Replace('"', '""')) + '"'
    $safeSentiment = '"' + (([string]$row.sentiment).Replace('"', '""')) + '"'
    "$safeText|$safeSentiment"
}

[System.IO.File]::WriteAllLines($outputFile, $lines, $utf8NoBom)

$afterRows = $deduped.Count
$removedRows = $beforeRows - $afterRows

Write-Output "before_rows=$beforeRows"
Write-Output "before_unique_exact=$beforeUniqueExact"
Write-Output "before_unique_text=$beforeUniqueText"
Write-Output "after_rows=$afterRows"
Write-Output "removed_rows=$removedRows"
