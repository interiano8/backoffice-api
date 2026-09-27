# Script para preparar el despliegue individual de BackOffice API (Version Windows)
# Generando paquete optimizado para NSSM

Write-Host "Iniciando preparacion del despliegue individual..." -ForegroundColor Cyan

# 1. Limpieza de versiones previas
Write-Host "Limpiando compilaciones anteriores..." -ForegroundColor Yellow
if (Test-Path dist) { Remove-Item -Recurse -Force dist }
if (Test-Path deploy-api) { Remove-Item -Recurse -Force deploy-api }

# 2. Instalacion y Generacion de Prisma
Write-Host "Instalando dependencias y generando Prisma Client..." -ForegroundColor Yellow
npm install --legacy-peer-deps
npx prisma generate

# 3. Compilacion de TypeScript
Write-Host "Compilando codigo..." -ForegroundColor Yellow
npm run build

# 4. Preparacion de la carpeta de despliegue
Write-Host "Creando carpeta de despliegue 'deploy-api'..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path deploy-api -Force

# 5. Copia de archivos esenciales
Write-Host "Copiando archivos esenciales..." -ForegroundColor Yellow
if (Test-Path dist) {
    Copy-Item -Path "dist\*" -Destination "deploy-api" -Recurse -Force
}
Copy-Item -Path "package.json" -Destination "deploy-api" -Force
if (Test-Path .env.enc) {
    Copy-Item -Path ".env.enc" -Destination "deploy-api" -Force
}
if (Test-Path scripts) {
    Copy-Item -Path "scripts" -Destination "deploy-api" -Recurse -Force
}
if (Test-Path prisma) {
    Copy-Item -Path "prisma" -Destination "deploy-api" -Recurse -Force
}

# 6. Creacion del archivo comprimido
Write-Host "Esperando a que se liberen los archivos..." -ForegroundColor Gray
Start-Sleep -Seconds 2
Write-Host "Creando archivo ZIP para transferencia (sin node_modules)..." -ForegroundColor Yellow
$zipFile = "deploy-api.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile }
Compress-Archive -Path "deploy-api\*" -DestinationPath $zipFile -Force

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "PROCESO COMPLETADO!" -ForegroundColor Green
Write-Host "Archivo generado: $zipFile" -ForegroundColor White
Write-Host "Descomprime este archivo en C:\SERVICIOS\api-BO del servidor." -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Green
