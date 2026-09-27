export interface PermissionDefinition {
  id: string;
  name: string;
  module: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Ventas (POS)
  { id: 'sales:create', name: 'Emitir Facturas y Tickets', module: 'Ventas', description: 'Permite registrar y cobrar ventas' },
  { id: 'sales:cancel', name: 'Anular Facturas', module: 'Ventas', description: 'Permite anular ventas emitidas' },
  { id: 'sales:reprint', name: 'Reimprimir Comprobantes', module: 'Ventas', description: 'Permite reimprimir tickets de venta' },
  { id: 'discounts:apply', name: 'Aplicar Descuentos en Venta', module: 'Ventas', description: 'Permite aplicar reglas de descuento en caja' },

  // Turnos & Arqueo
  { id: 'shifts:open', name: 'Abrir Turno', module: 'Turnos', description: 'Permite iniciar un turno operativo' },
  { id: 'shifts:close', name: 'Cerrar Turno y Arqueo', module: 'Turnos', description: 'Permite realizar pre-cierre y cierre de turno con conteo de valores' },
  { id: 'shifts:reconcile', name: 'Reconciliación de Turnos', module: 'Turnos', description: 'Permite conciliar diferencias de turnos en Backoffice' },
  { id: 'shifts:view', name: 'Consultar Historial de Turnos', module: 'Turnos', description: 'Permite ver turnos cerrados e históricos' },

  // Combustible & Bombas
  { id: 'pumps:control', name: 'Control de Bombas', module: 'Combustible', description: 'Permite pausar, reanudar y autorizar caras de despacho' },
  { id: 'prices:schedule', name: 'Programar Precios en la Nube', module: 'Combustible', description: 'Permite crear directivas de precios programadas' },
  { id: 'prices:override', name: 'Cambio de Precio de Emergencia', module: 'Combustible', description: 'Permite cambiar precios localmente en emergencia' },

  // Catálogos Maestros
  { id: 'products:manage', name: 'Gestionar Productos', module: 'Maestros', description: 'Creación y edición de productos y categorías' },
  { id: 'discounts:manage', name: 'Gestionar Reglas de Descuento', module: 'Maestros', description: 'Creación de promociones y descuentos por cliente/volumen' },
  { id: 'customers:manage', name: 'Gestionar Clientes', module: 'Maestros', description: 'Creación y actualización de clientes y RTN' },
  { id: 'customers:credit', name: 'Gestionar Límites de Crédito', module: 'Maestros', description: 'Aprobación de créditos y desbloqueo de clientes' },

  // Red, Tiendas y Sincronización
  { id: 'stores:manage', name: 'Gestionar Tiendas y Red', module: 'Red y Sistema', description: 'Configuración de tiendas y conexiones' },
  { id: 'sync:trigger', name: 'Forzar Sincronización Manual', module: 'Red y Sistema', description: 'Disparar subida o bajada de datos inmediata' },

  // Seguridad, Usuarios y Auditoría
  { id: 'users:manage', name: 'Gestionar Usuarios', module: 'Seguridad', description: 'Crear, editar y activar usuarios' },
  { id: 'roles:manage', name: 'Gestionar Roles y Permisos', module: 'Seguridad', description: 'Administrar catálogo de roles y permisos' },
  { id: 'audit:view', name: 'Consultar Logs de Auditoría', module: 'Seguridad', description: 'Inspeccionar actividad del sistema' },

  // Reportes y Analítica
  { id: 'reports:view', name: 'Ver Reportes Operativos', module: 'Reportes', description: 'Consulta de ventas, combustible y mangueras' },
  { id: 'reports:financial', name: 'Exportar Reportes Financieros', module: 'Reportes', description: 'Exportar declaraciones fiscales y estados de cuenta' },
];

export interface SystemRoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrador',
    description: 'Acceso total irrestricto a todas las funciones del sistema',
    permissions: SYSTEM_PERMISSIONS.map(p => p.id),
  },
  {
    id: 'ADMIN',
    name: 'Administrador',
    description: 'Gestión comercial, operativa, usuarios y tiendas',
    permissions: SYSTEM_PERMISSIONS.map(p => p.id),
  },
  {
    id: 'SUPERVISOR',
    name: 'Supervisor',
    description: 'Gestión de turnos, arqueos, reconciliación y supervisión de pista',
    permissions: [
      'sales:create',
      'sales:cancel',
      'sales:reprint',
      'discounts:apply',
      'shifts:open',
      'shifts:close',
      'shifts:reconcile',
      'shifts:view',
      'pumps:control',
      'prices:schedule',
      'products:manage',
      'customers:manage',
      'reports:view',
      'sync:trigger',
    ],
  },
  {
    id: 'CAJERO',
    name: 'Cajero',
    description: 'Ventas en mostrador/caja, cobros y registro rápido de clientes',
    permissions: [
      'sales:create',
      'sales:reprint',
      'discounts:apply',
      'shifts:open',
      'shifts:close',
      'customers:manage',
    ],
  },
  {
    id: 'BOMBERO',
    name: 'Despachador / Bombero',
    description: 'Despacho de combustible en pista y turnos de manguera',
    permissions: [
      'sales:create',
      'sales:reprint',
      'pumps:control',
      'shifts:open',
      'shifts:close',
    ],
  },
  {
    id: 'AUDITOR',
    name: 'Auditor Financiero',
    description: 'Auditoría, consulta de reportes y conciliaciones contables',
    permissions: [
      'reports:view',
      'reports:financial',
      'shifts:view',
      'audit:view',
    ],
  },
  {
    id: 'GESTOR_COMERCIAL',
    name: 'Gestor Comercial',
    description: 'Administración de precios, reglas de descuento y clientes con crédito',
    permissions: [
      'prices:schedule',
      'products:manage',
      'discounts:manage',
      'customers:manage',
      'customers:credit',
      'reports:view',
    ],
  },
];
