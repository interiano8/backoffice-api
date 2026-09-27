export const ROLES = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  OPERATOR: 'OPERATOR',
  AUDITOR: 'AUDITOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS: Record<string, Role[]> = {
  'users.manage': ['ADMIN'],
  'stores.manage': ['ADMIN'],
  'hoses.manage': ['ADMIN', 'SUPERVISOR'],
  'reports.view': ['ADMIN', 'SUPERVISOR', 'AUDITOR'],
  'reconciliation.view': ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  'reconciliation.manage': ['ADMIN', 'SUPERVISOR'],
  'documents.edit': ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  'customers.manage': ['ADMIN', 'SUPERVISOR', 'OPERATOR'],
  'sync.run': ['ADMIN', 'SUPERVISOR'],
  'audit.view': ['ADMIN', 'AUDITOR'],
};
