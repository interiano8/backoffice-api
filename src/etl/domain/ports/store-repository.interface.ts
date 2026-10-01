export const STORE_REPOSITORY = 'StoreRepository';

export interface StoreRepository {
  findByCode(
    code: string,
  ): Promise<{
    id: string;
    code: string;
    ip: string;
    name?: string;
    apiUrl?: string;
    lanUrl?: string;
  } | null>;
}
