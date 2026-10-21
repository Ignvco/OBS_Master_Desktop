# Read-only verification. No credentials or episode texts are printed.
$ErrorActionPreference = 'Stop'
$root='http://127.0.0.1:3000'
Write-Host 'OBS MASTER 4.1 — Diagnóstico de solo lectura' -ForegroundColor Cyan
try {
  $health=Invoke-RestMethod -Uri "$root/api/station/health" -Method Get -TimeoutSec 5
  if (!$health.ok -or $health.version -ne '4.1.0-rc.1') { throw 'La app no ejecuta el servidor esperado V4.1' }
  Write-Host "[OK] Servidor $($health.version), modo $($health.mode)"
  $response=Invoke-RestMethod -Uri "$root/api/station/state" -Method Get -TimeoutSec 5
  $s=$response.state
  if ($null -eq $s) { Write-Host '[INFO] Estación nueva; aún no hay estado guardado.' }
  else {
    Write-Host "[OK] Producción: $(@($s.components.PSObject.Properties).Count) tipos"
    Write-Host "[OK] Borradores: $(@($s.draftComponents.PSObject.Properties).Count) tipos"
    Write-Host "[OK] Gráficas independientes: $(@($s.customComponents.PSObject.Properties).Count)"
    Write-Host "[OK] Gráficas en historial: $(@($s.publicationHistory.PSObject.Properties).Count)"
  }
  $response=Invoke-WebRequest -Uri "$root/?overlay=lower-third" -Method Get -TimeoutSec 5 -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw 'La Browser Source no responde.' }
  Write-Host '[OK] Ruta Browser Source conservada' -ForegroundColor Green
  Write-Host 'PENDIENTE: valida el bloqueo AL AIRE y las animaciones con OBS real.' -ForegroundColor Yellow
} catch {
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
