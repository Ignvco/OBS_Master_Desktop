param(
    [Parameter(Mandatory=$false)]
    [long]$NotBeforeUnix = 0
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopRoot = Join-Path $projectRoot 'desktop-app'
$releaseFolder = Join-Path $desktopRoot 'release'
$manifestPath = Join-Path $releaseFolder 'MANIFIESTO-SHA256-UX-V42.txt'

try {
    $rootJson = Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
    $desktopJson = Get-Content (Join-Path $desktopRoot 'package.json') -Raw | ConvertFrom-Json

    if ($rootJson.version -ne $desktopJson.version) {
        throw "Las versiones de package.json y desktop-app/package.json no coinciden. No distribuir."
    }

    $version = [string]$desktopJson.version
    $expected = @(
        "STDQ-OBS-MASTER-Setup-$version.exe",
        "STDQ-OBS-MASTER-Portable-$version.exe"
    )

    if (-not (Test-Path -LiteralPath $releaseFolder -PathType Container)) {
        throw "No existe desktop-app/release. Ejecuta PREPARAR_CANDIDATO_UX_V42_WINDOWS.bat primero."
    }

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("OBS MASTER V4.2 UX - MANIFIESTO DE CANDIDATO, NO LANZAMIENTO")
    $lines.Add("Version de empaquetado: $version")
    $lines.Add("Fecha de verificacion UTC: $([DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss'))")
    $lines.Add("Estado: artefactos de ensayo; sin prueba de instalacion, OBS ni firma digital")
    $lines.Add("No instalar sobre la estacion de produccion ni operar dos copias a la vez.")
    $lines.Add("")

    foreach ($name in $expected) {
        $filePath = Join-Path $releaseFolder $name
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            throw "No se genero un artefacto obligatorio: $name"
        }
        $item = Get-Item -LiteralPath $filePath
        if ($item.Length -lt 1048576) {
            throw "El archivo $name tiene tamano anormal para Electron. No distribuir."
        }
        if ($NotBeforeUnix -gt 0) {
            $notBefore = [DateTimeOffset]::FromUnixTimeSeconds($NotBeforeUnix).UtcDateTime
            if ($item.LastWriteTimeUtc -lt $notBefore.AddSeconds(-5)) {
                throw "El artefacto $name parece ser de una compilacion anterior."
            }
        }
        $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash
        $sizeMb = [Math]::Round(($item.Length / 1MB), 2)
        $lines.Add("Archivo: $name")
        $lines.Add("Tamano MiB: $sizeMb")
        $lines.Add("SHA256: $hash")
        $lines.Add("")
        Write-Host "[OK] $name ($sizeMb MiB)" -ForegroundColor Green
    }

    $gitSha = (& git -C $projectRoot rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -eq 0) { $lines.Add("Commit de origen: $gitSha") }
    $lines.Add("Revision: cotejar pruebas Windows y OBS antes de cualquier instalacion.")
    Set-Content -LiteralPath $manifestPath -Value $lines -Encoding UTF8

    Write-Host ""
    Write-Host "Manifiesto de integridad generado:" -ForegroundColor Cyan
    Write-Host $manifestPath
    Write-Host "Los hashes permiten detectar cambios en los archivos; no equivalen a firma de codigo."
    exit 0
} catch {
    Write-Error "CANDIDATO NO VALIDADO: $($_.Exception.Message)"
    exit 1
}
