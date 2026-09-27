@echo off
SETLOCAL EnableDelayedExpansion

:: #######################################################################
:: #                      CONFIGURACIÓN DEL SERVICIO                     #
:: #######################################################################
SET SERVICE_NAME=BackofficeAPI_2026

:: Calcula automáticamente la ruta donde se encuentra este archivo .bat
SET STARTUP_DIR=%~dp0
:: Remueve la barra diagonal invertida al final de la ruta si existe
IF "%STARTUP_DIR:~-1%"=="\" SET STARTUP_DIR=%STARTUP_DIR:~0,-1%

SET NSSM_EXE="%STARTUP_DIR%\nssm.exe"

:: #######################################################################
:: #                      PASOS DE INSTALACIÓN                           #
:: #######################################################################

ECHO ==========================================================
ECHO INSTALADOR DEL SERVICIO BACKOFFICE API
ECHO ==========================================================
ECHO.
ECHO Directorio detectado: %STARTUP_DIR%
ECHO.

ECHO Verificando la existencia de NSSM...
IF NOT EXIST %NSSM_EXE% (
    ECHO ERROR: nssm.exe no se encontro en el directorio actual.
    ECHO Por favor, asegurate de que nssm.exe este junto a este script o modificalo para apuntar al NSSM correcto.
    GOTO :END
)

:: Pedir la llave maestra al administrador
ECHO.
SET /P MASTER_KEY="Por favor, ingresa la MASTER_KEY secreta para desencriptar la configuracion en produccion: "

IF "%MASTER_KEY%"=="" (
    ECHO ERROR: La llave maestra no puede estar vacia.
    GOTO :END
)

ECHO.
ECHO Instalando el servicio %SERVICE_NAME%...

:: 1. Instalar el servicio con la ruta y el directorio de inicio.
%NSSM_EXE% install "%SERVICE_NAME%" node "dist\main.js"
%NSSM_EXE% set "%SERVICE_NAME%" AppDirectory "%STARTUP_DIR%"
%NSSM_EXE% set "%SERVICE_NAME%" Description "Servicio Backend de Backoffice 2026"

:: 2. Configurar el reinicio automático en caso de fallo.
%NSSM_EXE% set "%SERVICE_NAME%" AppRestartDelay 5000
%NSSM_EXE% set "%SERVICE_NAME%" AppRestartThrottle 600000

:: 3. Inyectar la llave maestra segura en el registro de Windows usando AppEnvironmentExtra
%NSSM_EXE% set "%SERVICE_NAME%" AppEnvironmentExtra "MASTER_KEY=%MASTER_KEY%"

:: 4. Iniciar el servicio.
ECHO.
ECHO Iniciando el servicio %SERVICE_NAME%...
net start "%SERVICE_NAME%"

ECHO.
ECHO ==========================================================
ECHO El servicio %SERVICE_NAME% se instalo y se inicio con exito.
ECHO ==========================================================

GOTO :END

:END
ECHO.
pause
ENDLOCAL
