import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductPricesController } from './product-prices.controller';
import { ProductPricesService } from './product-prices.service';
import { UnitsOfMeasureController } from './units-of-measure.controller';
import { UnitsOfMeasureService } from './units-of-measure.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    DepartmentsController,
    SuppliersController,
    ProductsController,
    ProductPricesController,
    UnitsOfMeasureController,
  ],
  providers: [
    DepartmentsService,
    SuppliersService,
    ProductsService,
    ProductPricesService,
    UnitsOfMeasureService,
  ],
  exports: [
    DepartmentsService,
    SuppliersService,
    ProductsService,
    ProductPricesService,
    UnitsOfMeasureService,
  ],
})
export class ProductsCatalogModule {}

