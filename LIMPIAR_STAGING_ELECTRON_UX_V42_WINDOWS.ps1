# Limpieza acotada del directorio de extraccion de electron-builder.
# Se ejecuta solo para empaquetar un candidato de ensayo; no toca AppData,
# dist ni Setup/Portable anteriores. No finaliza procesos ni desactiva Defender.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = Join-Path $root 'desktop-app'
$release = Join-Path $desktop 'release'
$packageJson = Join-Path $desktop 'package.json'

try {
    if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) {
        throw "No se encontro desktop-app/package.json. Ejecuta este script desde el proyecto."
    }
    if (-not (Test-Path -LiteralPath $release -PathType Container)) {
        New-Item -ItemType Directory -Path $release -Force | Out-Null
    }

    $watchers = @(Get-Process -Name Code,Cursor -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique)
    if ($watchers.Count -gt 0) {
        Write-Host "AVISO: hay editores abiertos: $($watchers -join ', ')." -ForegroundColor Yellow
        Write-Host "Si aparece EPERM, cierra totalmente VS Code/Cursor y vuelve a intentar."
        Write-Host "La exclusion de vigilancia en .vscode/settings.json puede requerir reabrir el editor."
    }

    foreach ($name in @('win-unpacked.tmp','win-unpacked')) {
        $candidate = Join-Path $release $name
        if (Test-Path -LiteralPath $candidate) {
            $item = Get-Item -LiteralPath $candidate -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "La ruta temporal $name es un enlace/reparse point. Se rechaza borrarlo por seguridad."
            }
            Write-Host "Limpiando extraccion Electron anterior: $name" -ForegroundColor Cyan
            Remove-Item -LiteralPath $candidate -Recurse -Force -ErrorAction Stop
            if (Test-Path -LiteralPath $candidate) {
                throw "La carpeta $name sigue presente despues de intentar limpiarla."
            }
        }
    }

    Write-Host "Carpetas temporales de Electron listas; Setup, Portable y AppData permanecen intactos." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "ERROR: Windows mantiene bloqueada la carpeta temporal de Electron." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "1. No transmitas y cierra la app OBS MASTER, Electron, VS Code y Cursor."
    Write-Host "2. Cierra las ventanas de Explorador dentro de desktop-app/release."
    Write-Host "3. Comprueba Historial de proteccion de Seguridad de Windows."
    Write-Host "4. Si persiste, reinicia Windows o utiliza una copia de ensayo en C:\dev fuera de Desktop."
    Write-Host "NO borres AppData ni desactives el antivirus."
    exit 1
}
