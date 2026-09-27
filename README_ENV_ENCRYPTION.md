# 🔐 Guía de Encriptación del Entorno (.env)

Esta guía explica cómo funciona el sistema de encriptación para el archivo `.env` del backend y cómo gestionarlo tanto en desarrollo como en producción.

## 1. ¿Por qué encriptar el `.env`?
El archivo `.env` contiene credenciales sensibles (conexión a base de datos, secretos de JWT, tokens, etc.). Para evitar que estas credenciales queden expuestas en texto plano si se comparte el código o se sube por error a un repositorio, hemos implementado un sistema de encriptación que genera un archivo seguro llamado `.env.enc`.

## 2. ¿Cómo funciona?
1. **El archivo seguro (`.env.enc`)**: Es el resultado de aplicar una encriptación AES-256-CBC al archivo `.env` original. Este archivo sí puede ser almacenado o subido a control de versiones.
2. **La Llave Maestra (`MASTER_KEY`)**: Es una contraseña secreta que solo tú conoces. Se usa tanto para encriptar como para desencriptar.
3. **Auto-Desencriptación en Producción**: El archivo principal de la API (`src/main.ts`) está programado para revisar si existe la variable de entorno `MASTER_KEY` cuando el servidor arranca. Si la encuentra, genera automáticamente el `.env` original de forma interna antes de que el servidor termine de inicializarse.

---

## 3. Comandos Disponibles (Desarrollo)

Para gestionar tu `.env` de forma local, en la carpeta `backoffice-api` tienes disponibles los siguientes scripts en tu `package.json`:

### Encriptar tu configuración actual
Si has hecho cambios en tu `.env` y quieres actualizar la versión segura `.env.enc`:
```bash
npm run env:encrypt -- "TU_SUPER_SECRETO"
```
*(Esto leerá tu `.env` y sobrescribirá el `.env.enc` con los nuevos datos)*

### Desencriptar la configuración
Si acabas de descargar el proyecto y solo tienes el `.env.enc`, puedes recuperar el original así:
```bash
npm run env:decrypt -- "TU_SUPER_SECRETO"
```

---

## 4. Despliegue en Producción (Windows)

Para que el servidor se auto-desencripte en producción (ej. en el servidor físico donde está instalado), hemos creado el instalador **`install-service.bat`**.

Cuando ejecutes el instalador:
1. Te pedirá por consola: `Por favor, ingresa la MASTER_KEY secreta...`
2. El script inyectará esta contraseña de forma segura directamente en el Registro de Windows del servicio (`AppEnvironmentExtra` de NSSM).
3. Cada vez que el servicio de Windows arranque, le pasará la llave al backend.
4. El backend creará automáticamente el `.env` real y se conectará a la base de datos sin necesidad de que el `.env` en texto plano exista previamente en el servidor.

> **Importante:** Asegúrate de ejecutar el `install-service.bat` como Administrador para que NSSM tenga permisos de guardar la llave en el servicio.

---

## 5. Probar en Producción (Sin Instalar el Servicio)

Si quieres probar que la auto-desencriptación funciona correctamente en un entorno de pruebas o simulando producción, pero sin necesidad de crear e instalar el servicio de Windows aún, puedes hacerlo inyectando la variable de entorno directamente en tu terminal.

Sigue estos pasos:
1. Elimina temporalmente o renombra tu archivo `.env` original (asegúrate de que exista `.env.enc`).
2. Abre tu terminal e inyecta la llave maestra antes de iniciar la app.

### En Windows (PowerShell)
Para evitar que tu contraseña quede guardada en el historial de comandos de PowerShell (flecha arriba), lo más seguro es pedirla mediante un prompt:

```powershell
$env:MASTER_KEY = Read-Host "Ingresa tu MASTER_KEY"
# Al darle enter, la consola te pedirá que escribas la clave (no se guardará en el historial)

npm run start:prod
# O usando node: node dist/main.js
```

### En Windows (CMD clásico)
```cmd
set MASTER_KEY=TU_SUPER_SECRETO
npm run start:prod
```

### En Linux / Mac
```bash
MASTER_KEY="TU_SUPER_SECRETO" npm run start:prod
```

Al ejecutar este comando, observarás que el servidor arranca de forma normal: lee la `MASTER_KEY` de tu terminal, desencripta al vuelo el archivo `.env.enc` guardándolo como `.env` internamente, y la aplicación continúa como si el `.env` siempre hubiese estado ahí.


Tienes toda la razón, es una excelente observación de seguridad. Si escribes la contraseña directamente en el comando, quedará grabada en el historial de comandos (cuando presionas la flecha hacia arriba o ves el archivo de historial).

Ya he actualizado el archivo README_ENV_ENCRYPTION.md con la mejor práctica.

Para evitar que se guarde a partir de ahora, en lugar de declararla de un solo golpe en PowerShell, pide que te la pregunte de esta forma:

powershell
$env:MASTER_KEY = Read-Host "Ingresa tu MASTER_KEY"
# Le das enter, te preguntará la clave. La escribes, le das enter y listo.
npm run start:prod
Como se la entregaste a la consola de forma interactiva (prompt), no se guarda en el historial de comandos. (Recuerda que el instalador install-service.bat que te hice ya utiliza este mismo método seguro y no deja rastro).

🧹 Si ya la escribiste y quieres borrar el historial actual:
Si ya usaste comandos como $env:MASTER_KEY="..." o npm run env:encrypt -- "...", puedes limpiar tu rastro en esa computadora ejecutando estos dos comandos en PowerShell:

Limpia el historial de la sesión actual:
powershell
Clear-History
Borra el archivo de texto donde Windows guarda el historial persistente entre reinicios:
powershell
Remove-Item (Get-PSReadLineOption).HistorySavePath
¡Con eso la computadora quedará totalmente limpia de tu llave maestra!