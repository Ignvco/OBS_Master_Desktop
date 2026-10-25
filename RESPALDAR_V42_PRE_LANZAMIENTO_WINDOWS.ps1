param()
$ErrorActionPreference = 'Stop'

# Back up the existing Electron userData directory without changing it.
# Run only after the app is completely closed (including its system tray icon).
$source = Join-Path $env:APPDATA 'STDQ OBS Master'
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    Write-Error "No se encontro la carpeta de datos: $source. No se creo ningun respaldo vacio."
    exit 1
}

Write-Host ""
Write-Host "OBS MASTER V4.2 - RESPALDO ANTES DE INSTALAR" -ForegroundColor Cyan
Write-Host "Origen: $source"
Write-Host "Cierra OBS MASTER por completo, tambien desde el icono de bandeja."
Write-Host "No hagas este proceso durante una transmision ni con el servidor abierto."
$confirmation = Read-Host 'Escribe RESPALDAR para copiar los datos sin modificarlos'
if ($confirmation -cne 'RESPALDAR') {
    Write-Host "Operación cancelada. La carpeta original no se modifico."
    exit 2
}

$backupBase = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'OBS_MASTER_Respaldos_PreLanzamiento'
$stamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
$destination = Join-Path $backupBase ("STDQ_OBS_Master_$stamp")
try {
    if (Test-Path -LiteralPath $destination) {
        throw "El destino ya existe. No se sobrescribira ningun respaldo."
    }
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    & robocopy.exe $source $destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ /NP /NFL /NDL
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -ge 8) {
        throw "Robocopy fallo con codigo $robocopyCode. El respaldo no es confiable."
    }

    $originalFiles = @(Get-ChildItem -LiteralPath $source -Recurse -Force -File)
    $copiedFiles = @(Get-ChildItem -LiteralPath $destination -Recurse -Force -File)
    if ($originalFiles.Count -eq 0 -or $copiedFiles.Count -lt $originalFiles.Count) {
        throw "La cantidad de archivos copiados no coincide. No instalar el candidato."
    }
    $criticalFiles = @('.stdq-runtime\station.json','.stdq-runtime\library.json','window-state.json')
    foreach ($relative in $criticalFiles) {
        $src = Join-Path $source $relative
        $dst = Join-Path $destination $relative
        if (Test-Path -LiteralPath $src -PathType Leaf) {
            if (-not (Test-Path -LiteralPath $dst -PathType Leaf)) { throw "Falta $relative en el respaldo." }
            $before = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
            $after = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
            if ($before -ne $after) { throw "No coincide SHA-256 de $relative." }
        }
    }

    $reportPath = Join-Path $backupBase ("RESGUARDO_$stamp.txt")
    @(
        "OBS MASTER V4.2 - RESPALDO PREVIO A ACTUALIZACION"
        "Fecha local: $([DateTime]::Now.ToString('s'))"
        "Carpeta original: $source"
        "Destino: $destination"
        "Archivos originales: $($originalFiles.Count)"
        "Archivos copiados: $($copiedFiles.Count)"
        "Robocopy codigo: $robocopyCode"
        "Los datos originales NO se modificaron."
        "Mantener este respaldo privado: puede contener datos y configuraciones del programa."
        "No restaurar mientras OBS MASTER este en ejecucion ni durante una transmision."
    ) | Set-Content -LiteralPath $reportPath -Encoding UTF8

    Write-Host ""
    Write-Host "RESPALDO LOCAL COMPLETADO" -ForegroundColor Green
    Write-Host "Copia: $destination"
    Write-Host "Comprobante: $reportPath"
    Write-Host "Conserva ambos en un lugar seguro. NO los subas a GitHub."
    exit 0
} catch {
    Write-Error "RESPALDO NO VALIDADO: $($_.Exception.Message)"
    Write-Host "La carpeta original no fue eliminada ni sobrescrita."
    exit 1
}
