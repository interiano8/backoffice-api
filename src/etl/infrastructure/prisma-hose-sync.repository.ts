import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DbExecutor } from '../../common/connections/db-executor.interface';

@Injectable()
export class PrismaHoseSyncRepository {
  private readonly logger = new Logger(PrismaHoseSyncRepository.name);

  constructor(private prisma: PrismaService) {}

  async getHoseConfiguration(storeCode: string) {
    try {
      const hoses = await this.prisma.boHose.findMany({ where: { storeCode } });
      const hoseMap: Record<
        string,
        { unit: string; grade: string; tankId: string; hoseId: number }
      > = {};
      const productMap: Record<string, { unit: string; standardName: string }> =
        {};

      hoses.forEach((h) => {
        const phyId =
          h.hosePhysicalId !== null && h.hosePhysicalId !== undefined
            ? h.hosePhysicalId
            : h.hoseId;
        hoseMap[`${h.pumpId}-${phyId}`] = {
          unit: h.unitOfMeasure || 'LT',
          grade: h.gradeName || 'Producto',
          tankId: h.tankId || '',
          hoseId: h.hoseId,
        };
        if (h.gradeName) {
          productMap[h.gradeName.toUpperCase().trim()] = {
            unit: h.unitOfMeasure || 'LT',
            standardName: h.gradeName,
          };
        }
        if (h.genericCode) {
          productMap[h.genericCode.toUpperCase().trim()] = {
            unit: h.unitOfMeasure || 'LT',
            standardName: h.gradeName || h.genericCode,
          };
        }
      });
      return { hoseMap, productMap };
    } catch (error: any) {
      this.logger.error('Error fetching Hose configuration:', error);
      return { hoseMap: {}, productMap: {} };
    }
  }

  async syncHoses(pool: DbExecutor, storeCode: string): Promise<void> {
    const result = await pool.query(
      `SELECT 
        id_manguera as "HoseID", 
        id_bomba as "PumpID", 
        numero_grado as "GradeNumber", 
        nombre_grado as "GradeName", 
        precio_unitario as "PricePerUnit", 
        ids_tanques as "TankIDs", 
        id_manguera_fisica as "HosePhysicalID", 
        codigo_pos as "CodigoPOS", 
        codigo_generico as "CodigoGenerico", 
        unidad_medida as "UnidadMedida", 
        visible as "EsVisible" 
      FROM mangueras`,
    );

    const newHoses = result.recordset.map((row: any) => ({
      storeCode,
      pumpId: row.PumpID ? parseInt(row.PumpID.toString(), 10) : 0,
      hoseId: Number(row.HoseID) || 0,
      gradeId: Number(row.GradeNumber) || 0,
      gradeName: row.CodigoGenerico || row.GradeName || 'Combustible',
      unitPrice: Number(row.PricePerUnit) || 0,
      tankId: row.TankIDs?.toString() || null,
      hosePhysicalId: row.HosePhysicalID != null ? Number(row.HosePhysicalID) : null,
      posCode: row.CodigoPOS || null,
      genericCode: row.CodigoGenerico || null,
      unitOfMeasure: row.UnidadMedida || 'LT',
      active: row.EsVisible === true || row.EsVisible === 1 || row.EsVisible == null,
    }));

    const existingHoses = await this.prisma.boHose.findMany({
      where: { storeCode },
      select: { pumpId: true, hoseId: true },
    });
    const existingSet = new Set(
      existingHoses.map((h) => `${h.pumpId}-${h.hoseId}`),
    );
    const toCreate = newHoses.filter(
      (h) => !existingSet.has(`${h.pumpId}-${h.hoseId}`),
    );

    if (toCreate.length > 0) {
      this.logger.log(`Migrating ${toCreate.length} new hoses...`);
      await this.prisma.boHose.createMany({ data: toCreate });
    }
    this.logger.log(
      `Synced ${result.recordset.length} hoses for store ${storeCode}`,
    );
  }
}
