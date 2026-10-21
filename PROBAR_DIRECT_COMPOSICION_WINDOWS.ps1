# OBS MASTER V5 Native — test de composición publicada
# Ejecutar solo con Electron V5 Native Dev y la cámara Unity en marcha.
# No edites/publicar simultáneamente en Content Studio mientras dure esta prueba.
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3000'
$ids = @('lower-third','banner')
$previous = @{}
$changed = $false

function Publish-Operations([object]$components) {
  $payload = @{ components = $components } | ConvertTo-Json -Depth 100 -Compress
  Invoke-RestMethod -Uri "$base/api/station/state" -Method Patch -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) | Out-Null
}

try {
  $health = Invoke-RestMethod -Uri "$base/api/direct/status"
  if ($health.state -ne 'running') {
    throw "Unity Camera no está activa (estado: $($health.state)). Iníciala desde la bandeja de OBS MASTER."
  }
  $snapshot = Invoke-RestMethod -Uri "$base/api/station/state"
  if (-not $snapshot.state -or -not $snapshot.state.components) {
    throw 'No existe estado publicado. Abre OBS MASTER V5 Native y espera a que inicialice.'
  }
  foreach ($id in $ids) {
    $graphic = $snapshot.state.components.PSObject.Properties[$id]
    if (-not $graphic) { throw "No existe el componente publicado $id." }
    $previous[$id] = [bool]$graphic.Value.visibleInOBS
    $graphic.Value.visibleInOBS = $true
  }

  Write-Host "Activando simultáneamente: $($ids -join ', ')" -ForegroundColor Cyan
  Publish-Operations $snapshot.state.components
  $changed = $true
  Write-Host 'Revisa Unity Video Capture en StreamYard. Deben verse las dos gráficas encima de la cámara.' -ForegroundColor Green
  Read-Host 'Cuando termines la prueba, presiona ENTER para restaurar la visibilidad anterior'
}
finally {
  if ($changed) {
    try {
      $latest = Invoke-RestMethod -Uri "$base/api/station/state"
      foreach ($id in $ids) {
        $graphic = $latest.state.components.PSObject.Properties[$id]
        if ($graphic) { $graphic.Value.visibleInOBS = $previous[$id] }
      }
      Publish-Operations $latest.state.components
      Write-Host 'Visibilidad anterior restaurada.' -ForegroundColor Green
    }
    catch {
      Write-Warning "No se pudo restaurar automáticamente el estado: $_"
      Write-Warning 'Oculta manualmente las gráficas antes de transmitir.'
    }
  }
}
