import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles:manage')
  async listRoles() {
    return this.rbacService.listRoles();
  }

  @Post('roles')
  @RequirePermissions('roles:manage')
  async createRole(
    @Body() body: { id: string; name: string; description?: string; permissionIds: string[] },
  ) {
    return this.rbacService.createCustomRole(body);
  }

  @Patch('roles/:id')
  @RequirePermissions('roles:manage')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; permissionIds?: string[]; isActive?: boolean },
  ) {
    return this.rbacService.updateCustomRole(id, body);
  }

  @Delete('roles/:id')
  @RequirePermissions('roles:manage')
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteCustomRole(id);
  }

  @Get('permissions')
  @RequirePermissions('roles:manage')
  async listPermissions() {
    return this.rbacService.listPermissions();
  }

  @Post('users/:id/roles')
  @RequirePermissions('users:manage')
  async assignRoles(
    @Param('id') id: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.rbacService.assignRolesToUser(id, body.roleIds);
  }

  @Get('users/:id/roles')
  @RequirePermissions('users:manage')
  async getUserRoles(@Param('id') id: string) {
    return this.rbacService.getUserRolesAndPermissions(id);
  }
}
