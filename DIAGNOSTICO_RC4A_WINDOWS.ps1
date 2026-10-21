# OBS MASTER v5-native - diagnóstico de solo lectura (Windows PowerShell 5.1+).
# Distingue SOURCE, build Vite, copia Electron y lo realmente SERVIDO en localhost:3000.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$marker = 'Preparar Preview'
Write-Host ''
Write-Host 'DIAGNOSTICO PREVIEW RC4A' -ForegroundColor Cyan
Write-Host "Repositorio: $root"
Write-Host ''
function Detect-Marker([string]$name,[string]$relative) {
  $path = Join-Path $root $relative
  if (-not (Test-Path $path)) {
    Write-Host "$name : NO EXISTE ($relative)" -ForegroundColor Red
    return
  }
  $files = if ((Get-Item $path).PSIsContainer) {
    @(Get-ChildItem $path -Recurse -Filter *.js -File)
  } else {
    @(Get-Item $path)
  }
  $found = $false
  foreach ($file in $files) {
    try {
      $body = [System.IO.File]::ReadAllText($file.FullName)
      if ($body.Contains($marker)) {$found = $true;break}
    } catch {
      Write-Warning "No pude leer $($file.Name): $_"
    }
  }
  Write-Host "$name : $(if($found){'RC4A PRESENTE'}else{'MARCADOR AUSENTE'})" -ForegroundColor $(if($found){'Green'}else{'Yellow'})
}

Detect-Marker 'FUENTE React' 'src\components\spaces\BroadcastControlSpace.tsx'
Detect-Marker 'BUILD Vite' 'dist\assets'
Detect-Marker 'COPIA Electron' 'desktop-app\dist\assets'
Write-Host ''

try {
  $connections = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop)
  foreach($entry in $connections) {
    $pidValue = $entry.OwningProcess
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction SilentlyContinue
    Write-Host "Puerto 3000: PID $pidValue, ejecutable $($process.ExecutablePath)"
  }
} catch {
  Write-Host 'No fue posible consultar los procesos del puerto 3000.' -ForegroundColor Yellow
}

try {
  $base='http://127.0.0.1:3000'
  $index = Invoke-WebRequest -UseBasicParsing -Uri "$base/" -TimeoutSec 6
  Write-Host "HTTP raiz: $($index.StatusCode)"
  $assetRefs = [regex]::Matches($index.Content,'src=["''](?<asset>/assets/[^"'']+\.js)["'']')
  $found = $false
  foreach($match in $assetRefs) {
    $file=$match.Groups['asset'].Value
    $asset=Invoke-WebRequest -UseBasicParsing -Uri "$base$file" -TimeoutSec 12
    if($asset.Content.Contains($marker)){$found=$true}
    Write-Host "JS servido: $file - contiene Preview RC4A: $($asset.Content.Contains($marker))"
  }
  Write-Host "INTERFAZ ACTIVA: $(if($found){'RC4A ACTUAL'}else{'NO SE DETECTA RC4A'})" -ForegroundColor $(if($found){'Green'}else{'Red'})
  try {
    $preview=Invoke-RestMethod -Uri "$base/api/direct/preview" -TimeoutSec 5
    Write-Host "Preview seleccionado: $($preview.preview.ids -join ', ') | revision: $($preview.preview.revision)"
  }catch{Write-Host "API Preview: $($_.Exception.Message)" -ForegroundColor Yellow}
}catch{
  Write-Host "El servidor no responde en localhost:3000: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ''
Write-Host 'Esta prueba no inicia ni detiene procesos, no cambia datos ni modifica la emisión.'
