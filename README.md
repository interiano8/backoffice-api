# BackOffice API - Documentación de Datos

Este documento describe la arquitectura de datos y el origen de la información utilizada en el sistema de BackOffice.

## Arquitectura de Datos

El sistema se conecta a tres fuentes de datos principales para consolidar la información de ventas, turnos y personal.

### 1. Base de Datos BackOffice (Local/Prisma)
Es la base de datos central del sistema, gestionada mediante **Prisma ORM**.
- **Tablas Principales:**
    - `BoStore`: Configuración de sucursales (Códigos, Nombres, IPs).
    - `BoShift`: Almacena los turnos sincronizados desde el TPV.
    - `BoSale`: Almacena el detalle de las ventas sincronizadas.
    - `BoSaleHeader`: Cabeceras de ventas consolidadas.
    - `BoPaymentMethod`: Métodos de pago registrados.
    - `BoHose`: Configuración de mangueras y productos.
- **Uso:** Almacenamiento persistente, reportes históricos y configuración del sistema.

### 2. Base de Datos TPV (Punto de Venta)
Base de datos externa (SQL Server) ubicada en cada sucursal. Se accede mediante el paquete `mssql`.
- **Tablas/Vistas Consultadas:**
    - `vw_POS_Sales_With_Turnos`: Vista principal que une ventas con información de turnos.
    - `Employee` / `Employee2`: Información del personal (Cajeros/Despachadores).
    - `TPV`: Tablas varias para transacciones y estados de turno.
- **Uso:** Fuente primaria de ventas transaccionales y validación de usuarios durante el login.

### 3. Base de Datos Fusion (Surtidores)
Base de datos SQL Server que gestiona la comunicación directa con los surtidores.
- **Procedimientos Almacenados:**
    - `sp_GetShiftDetails`: Obtiene lecturas de mangueras, volúmenes iniciales/finales y montos por surtidor.
- **Uso:** Conciliación de inventario combustible (Fusion vs TPV).

---

## Mecanismos de Conexión y Robustez

### Lógica de IP Override (Sobre-escritura de IP)
Dado que algunas sucursales tienen IPs locales (`192.168.x.x`) configuradas en la base de datos `BoStore`, el sistema implementa una lógica de seguridad en los servicios (`ShiftsService`, `AuthService`, `EtlService`):
1. Si la IP de la sucursal es local o `localhost`.
2. El sistema utiliza automáticamente la IP configurada en las variables de entorno (`TPV_DATABASE_URL` o `FUSION_DATABASE_URL`).
3. Esto permite que el servidor central se comunique con las sucursales a través de sus IPs públicas sin necesidad de alterar los registros locales de la DB.

### Fallback de Empleados (`Employee2`)
Debido a inconsistencias en el esquema de algunas sucursales (falta de columna `Perfil` en la tabla `Employee`), se ha implementado un sistema de respaldo:
- **Login:** Si la consulta a `Employee` falla o no encuentra al usuario, el sistema intenta automáticamente en la tabla `Employee2`.
- **Enriquecimiento de Turnos:** Para mostrar los nombres de los cajeros en los reportes, el sistema busca en el siguiente orden de prioridad:
    1. Tabla `Employee` (TPV sucursal).
    2. Tabla `Employee2` (TPV sucursal).
    3. Tabla `Usuario` (BackOffice central).
    4. Código de Usuario (como identificador final).

---

## Configuración y Despliegue

La conexión se configura mediante variables de entorno en el archivo `.env`:
- `DATABASE_URL`: Conexión de BackOffice (Prisma).
- `TPV_DATABASE_URL`: URL base para conexiones a sucursales (formato `sqlserver://user:pass@host:port/database`).
- `FUSION_DATABASE_URL`: URL base para conexiones a Fusion.

Para más detalles sobre la implementación técnica, consultar los servicios en `src/`.
