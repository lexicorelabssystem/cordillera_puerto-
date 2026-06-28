param(
  [string]$LogPath = "backend/local-backend.out.log",
  [int]$SlowMs = 2000,
  [int]$VerySlowMs = 5000
)

if (-not (Test-Path -LiteralPath $LogPath)) {
  Write-Error "Log file not found: $LogPath"
  exit 1
}

$pattern = '(?<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(?<path>/api/[^\s]+)\s+.*?\s+(?<status>\d{3})\s+\((?<ms>\d+)ms\)'
$rows = Get-Content -LiteralPath $LogPath | ForEach-Object {
  $m = [regex]::Match($_, $pattern)
  if ($m.Success) {
    [pscustomobject]@{
      Method = $m.Groups['method'].Value
      Path = $m.Groups['path'].Value
      Status = [int]$m.Groups['status'].Value
      Ms = [int]$m.Groups['ms'].Value
      Line = $_
    }
  }
}

if (-not $rows) {
  Write-Host "No HTTP timing lines found in $LogPath"
  exit 0
}

$slow = $rows | Where-Object { $_.Ms -ge $SlowMs } | Sort-Object Ms -Descending
$grouped = $rows | Group-Object Method,Path | ForEach-Object {
  $items = $_.Group
  $avg = ($items | Measure-Object Ms -Average).Average
  $max = ($items | Measure-Object Ms -Maximum).Maximum
  [pscustomobject]@{
    Count = $items.Count
    AvgMs = [math]::Round($avg, 0)
    MaxMs = $max
    SlowCount = @($items | Where-Object { $_.Ms -ge $SlowMs }).Count
    VerySlowCount = @($items | Where-Object { $_.Ms -ge $VerySlowMs }).Count
    Endpoint = $_.Name
  }
} | Sort-Object MaxMs -Descending

Write-Host "Backend latency summary for $LogPath"
Write-Host "Total requests: $($rows.Count) | Slow >= ${SlowMs}ms: $(@($slow).Count) | Very slow >= ${VerySlowMs}ms: $(@($rows | Where-Object { $_.Ms -ge $VerySlowMs }).Count)"
Write-Host ""
Write-Host "Slowest individual requests"
$slow | Select-Object -First 25 Method,Path,Status,Ms | Format-Table -AutoSize
Write-Host ""
Write-Host "Slowest endpoints by max duration"
$grouped | Select-Object -First 25 Count,AvgMs,MaxMs,SlowCount,VerySlowCount,Endpoint | Format-Table -AutoSize