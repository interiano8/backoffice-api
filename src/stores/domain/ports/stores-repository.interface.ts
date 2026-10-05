export interface StoreEntity {
  id: string;
  code: string;
  name: string;
  titulo?: string;
  RTN?: string;
  address?: string;
  ip: string;
  dbPort?: number;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  dbSsl?: boolean;
  apiUrl?: string;
  lanUrl?: string;
  logoUrl?: string;
  isActive?: boolean;
  moduleCustomers?: number;
  moduleAccounting?: number;
  printCreditInvoices?: boolean;
  SyncMinutes?: number;
  PresentationMinutes?: number;
  hasDbPassword?: boolean;
  ipFusion?: string | null;
  urlControlador?: string | null;
  claveControlador?: string | null;
  esControladorGas?: boolean | null;
  emisor?: string | null;
  moneda?: string | null;
  codigoMoneda?: string | null;
  telefono?: string | null;
  correo?: string | null;
  validarSaldoCredito?: boolean | null;
  posConfig?: any | null;
  configVersion?: number;
  configUpdatedAt?: Date;
}

export type CreateStoreData = Omit<StoreEntity, 'id'>;

export interface StoresRepository {
  findAll(): Promise<StoreEntity[]>;
  findAllBasic(): Promise<Partial<StoreEntity>[]>;
  findOne(id: string): Promise<StoreEntity | null>;
  findByCode(code: string): Promise<StoreEntity | null>;
  create(data: CreateStoreData): Promise<StoreEntity>;
  update(id: string, data: Partial<StoreEntity>): Promise<StoreEntity>;
  remove(id: string): Promise<void>;
  testConnection(config: any): Promise<{ success: boolean; message?: string; error?: string }>;
}
