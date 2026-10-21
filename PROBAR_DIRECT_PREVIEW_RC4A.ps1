# RC4A — Preview real independiente de Program.
# Prueba local con OBS MASTER v5-native. No ejecutar durante emisión pública.
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3000'
$origin = @{ Origin = $base }
$ids = @('banner','lower-third')
$changed = $false

function Get-Preview {
  return (Invoke-RestMethod -Uri "$base/api/direct/preview" -Method Get).preview
}
function Set-Preview([string[]]$graphicIds,[long]$revision) {
  $json = @{ ids=$graphicIds; expectedRevision=$revision } | ConvertTo-Json -Depth 6 -Compress
  return (Invoke-RestMethod -Uri "$base/api/direct/preview" -Method Post -Headers $origin -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($json))).preview
}

$status = Invoke-RestMethod -Uri "$base/api/direct/status"
if ($status.state -ne 'running') {
  throw "Inicia Unity Camera desde la bandeja. Estado actual: $($status.state)"
}
$initial = Get-Preview
$state = (Invoke-RestMethod -Uri "$base/api/station/state").state
foreach ($id in $ids) {
  if (-not $state.components.PSObject.Properties[$id]) {
    throw "La grafica '$id' debe existir publicada antes de esta prueba."
  }
}
$programBefore = $state.components | ConvertTo-Json -Depth 100 -Compress
try {
  Write-Host "Preparando unicamente Preview: $($ids -join ', ')" -ForegroundColor Cyan
  $prepared = Set-Preview -graphicIds $ids -revision $initial.revision
  $changed = $true

  Write-Host "Revisa los monitores originales en En Vivo:" -ForegroundColor Green
  Write-Host "  PREVIEW: camara fisica + banner + lower third."
  Write-Host "  PROGRAM: debe conservar su composicion anterior."
  Write-Host "  STREAMYARD: debe conservar la misma imagen de PROGRAM."
  Read-Host 'Cuando compares Preview y Program, presiona ENTER para restaurar la preparacion'

  $programAfter = ((Invoke-RestMethod -Uri "$base/api/station/state").state.components | ConvertTo-Json -Depth 100 -Compress)
  if ($programAfter -cne $programBefore) {
    Write-Warning 'Program cambio durante la prueba. Investiga antes de transmitir.'
  } else {
    Write-Host 'Program no fue modificado por preparar Preview.' -ForegroundColor Green
  }
}
finally {
  if ($changed) {
    try {
      $latest = Get-Preview
      $restored = Set-Preview -graphicIds ([string[]]@($initial.ids)) -revision $latest.revision
      Write-Host "Preview restaurado, revision $($restored.revision)." -ForegroundColor Green
    } catch {
      Write-Warning "No se restauro automaticamente Preview: $_"
    }
  }
}
