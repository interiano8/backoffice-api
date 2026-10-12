import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/department-category.dto';

@Controller(['departments', 'api/departments'])
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async listDepartments(@Query('activeOnly') activeOnly?: string) {
    return this.departmentsService.listDepartments(activeOnly === 'true');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.createDepartment(dto);
  }

  @Patch(':id')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.updateDepartment(id, dto);
  }

  @Patch(':id/toggle')
  async toggleDepartment(@Param('id') id: string) {
    return this.departmentsService.toggleDepartment(id);
  }

  // Rutas anidadas de categorías
  @Get('categories')
  async listCategories(
    @Query('departmentId') departmentId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.departmentsService.listCategories(
      departmentId,
      activeOnly === 'true',
    );
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.departmentsService.createCategory(dto);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.departmentsService.updateCategory(id, dto);
  }

  @Patch('categories/:id/toggle')
  async toggleCategory(@Param('id') id: string) {
    return this.departmentsService.toggleCategory(id);
  }
}
