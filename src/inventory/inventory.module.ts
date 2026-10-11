import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryCountService } from './inventory-count.service';
import { InventoryController } from './inventory.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryCountService],
  exports: [InventoryService, InventoryCountService],
})
export class InventoryModule {}

