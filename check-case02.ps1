param(
  [string]$CaseSrc  = "data\case-02-kamchatka\case-02.json",
  [string]$IndexSrc = "data\index.json"
)
$ErrorActionPreference = 'Stop'
$rx = '\b(volcan\w*|caldera|cones?|twin-coned|crater|summit|vent|lava|ash|tephra|erupt\w*|eruption|magma|lahar|krasheninnikov)\b'

function Load-Json($src) {
  if ($src -match '^https?://') { $r = Invoke-RestMethod $src; if ($r -is [string]) { $r | ConvertFrom-Json } else { $r } }
  else { if (-not (Test-Path $src)) { throw "File not found: $src" }; Get-Content $src -Raw -Encoding UTF8 | ConvertFrom-Json }
}
function Get-Strings($o, $path) {
  if ($o -is [string]) { [pscustomobject]@{ Path = $path; Text = $o } }
  elseif ($o -is [System.Collections.IEnumerable]) { $i = 0; foreach ($x in $o) { Get-Strings $x "$path[$i]"; $i++ } }
  elseif ($null -ne $o) { foreach ($p in $o.PSObject.Properties) { Get-Strings $p.Value "$path.$($p.Name)" } }
}

$c  = Load-Json $CaseSrc
$ix = Load-Json $IndexSrc
if (-not $c.id) { throw "case file loaded but empty/invalid" }

$scope  = @()
$scope += Get-Strings $c.title "title"
$scope += Get-Strings $c.subtitle "subtitle"
$scope += Get-Strings $c.location.name "location.name"
$scope += Get-Strings ($c.experiences | Where-Object { $_.step -le 2 }) "experiences"
$scope += Get-Strings ($ix.cases | Where-Object { $_.id -eq 'case-02' }) "index"

$hits = $scope | Where-Object { $_.Path -notmatch 'granule_id|images|event_type' } | ForEach-Object {
  foreach ($m in [regex]::Matches($_.Text, $rx, 'IgnoreCase')) { [pscustomobject]@{ Where = $_.Path; Word = $m.Value } } }
if ($hits) { Write-Host "SPOILER FAIL:" -ForegroundColor Red; $hits | Format-Table -AutoSize }
else { Write-Host "SPOILER PASS (0 hits)" -ForegroundColor Green }

$ids = @($c.sources | ForEach-Object { $_.id })
$bad = Get-Strings $c "case" | Where-Object { $_.Path -match 'source_id$' } | ForEach-Object {
  $p = $_.Path; ($_.Text -split '\s*,\s*') | Where-Object { $_ -notin $ids } | ForEach-Object { "$p -> $_" } }
if ($bad) { Write-Host "SOURCE_ID FAIL:" -ForegroundColor Red; $bad } else { Write-Host "SOURCE_ID PASS ($($ids -join ', '))" -ForegroundColor Green }

$s3 = $c.experiences | Where-Object { $_.step -eq 3 }
if ($s3.options.Count -eq 4 -and $s3.correct_index -lt 4) { Write-Host "STEP3 PASS" -ForegroundColor Green } else { Write-Host "STEP3 FAIL" -ForegroundColor Red }
Write-Host "NOTE: event_type = '$($c.event_type)' (make sure the UI does not show it)" -ForegroundColor Yellow
