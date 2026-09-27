# 🚀 Guía de Despliegue Individual - BackOffice API

Esta guía detalla cómo desplegar únicamente el motor de la API en un servidor de producción.

## 📋 Requisitos Previos
*   **Node.js**: Versión 18 o superior instalada en el servidor.
*   **OpenSSL**: Necesario para la conexión encriptada con SQL Server.
*   **Base de Datos**: Acceso reachable desde el servidor a la instancia de SQL Server.

## ⚙️ Configuración (.env)
Crea un archivo `.env` en la raíz de la aplicación con las siguientes variables:

```ini
# --- RED Y PUERTOS ---
PORT=3000
# URLs de los Frontends permitidos (separados por coma)
ALLOWED_ORIGINS=https://tu-app-frontend.com,http://localhost:8080

# --- BASES DE DATOS ---
DATABASE_URL="sqlserver://IP;database=BO;user=sa;password=PASSWORD;encrypt=false;trustServerCertificate=true"
TPV_DATABASE_URL="sqlserver://IP;database=TPV;user=sa;password=PASSWORD;encrypt=false;trustServerCertificate=true"
FUSION_DATABASE_URL="sqlserver://IP;database=FusionController;user=sa;password=PASSWORD;encrypt=false;trustServerCertificate=true"

# --- SEGURIDAD ---
# Cambiar esto por una cadena aleatoria larga y segura
JWT_SECRET=tu_clave_secreta_pro_2026
```

## 🛠️ Comandos de Despliegue

### Paso 1: Preparar el paquete (Desde tu PC de desarrollo)
Ejecuta el script de automatización en PowerShell:
```powershell
./prepare-deploy.ps1
```
Esto generará el archivo `deploy-api.zip`.

### Paso 2: Ejecutar en el Servidor
Una vez descomprimido el contenido en `C:\SERVICIOS\api-BO`:

1. **Instalar dependencias de producción** (OBLIGATORIO):
   ```powershell
   npm install --omit=dev --legacy-peer-deps
   ```

2. **Ejecutar el servidor**:
   ```powershell
   npm run start:prod
   ```

### Paso 3: Mantenerlo siempre encendido (Recomendado)
Usa PM2 para que la API no se apague:
```bash
npm install -g pm2
pm2 start dist/main.js --name "backoffice-api"
```
