import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { IDocsUseCase } from '../../domain/ports/in/docs.use-case.port';
import type { DocRepository } from '../../domain/ports/doc-repository.interface';
import { DOC_REPOSITORY } from '../../documents.tokens';

@Injectable()
export class DocsUseCase implements IDocsUseCase {
  private readonly logger = new Logger(DocsUseCase.name);
  private chargeMethodsCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    @Inject(DOC_REPOSITORY) private readonly docRepo: DocRepository,
  ) {}

  async getRecentDocuments(storeCode: string, filters: any) {
    try {
      return await this.docRepo.getRecentDocuments(storeCode, filters);
    } catch (error: any) {
      this.logger.error(`Error in getRecentDocuments: ${error.message}`);
      throw new BadRequestException(
        `Could not fetch documents: ${error.message}`,
      );
    }
  }

  async getLealDocuments(storeCode: string, filters: any) {
    try {
      return await this.docRepo.getLealDocuments(storeCode, filters);
    } catch (error: any) {
      this.logger.error(`Error in getLealDocuments: ${error.message}`);
      throw new BadRequestException(
        `Could not fetch Leal documents: ${error.message}`,
      );
    }
  }

  async getCustomers(storeCode: string, search: string) {
    return this.docRepo.getCustomers(storeCode, search);
  }

  async getChargeMethods(storeCode: string) {
    const cached = this.chargeMethodsCache.get(storeCode);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    const data = await this.docRepo.getChargeMethods(storeCode);
    this.chargeMethodsCache.set(storeCode, { data, timestamp: Date.now() });
    return data;
  }

  async getPosCodes(storeCode: string) {
    return this.docRepo.getPosCodes(storeCode);
  }

  async getUsers(storeCode: string) {
    return this.docRepo.getUsers(storeCode);
  }

  async getShiftCount(storeCode: string) {
    return this.docRepo.getShiftCount(storeCode);
  }

  async updateDocument(storeCode: string, transactionId: string, data: any) {
    try {
      return await this.docRepo.updateDocument(storeCode, transactionId, data);
    } catch (error: any) {
      this.logger.error(`Error in updateDocument: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Could not update document: ${error.message}`,
      );
    }
  }
}
