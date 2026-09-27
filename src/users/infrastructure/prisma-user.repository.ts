import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UserRepository, UserEntity, UserAuthEntity } from '../domain/ports/user-repository.interface';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany();
    return users.map(u => ({
      id: u.id, username: u.username, name: u.name,
      email: u.email || undefined, role: u.role, isActive: u.isActive,
    }));
  }

  async findById(id: string): Promise<UserEntity | null> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return { id: u.id, username: u.username, name: u.name, email: u.email || undefined, role: u.role, isActive: u.isActive };
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) return null;
    return { id: u.id, username: u.username, name: u.name, email: u.email || undefined, role: u.role, isActive: u.isActive };
  }

  async findByUsernameWithPassword(username: string): Promise<UserAuthEntity | null> {
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) return null;
    return { id: u.id, username: u.username, name: u.name, email: u.email || undefined, role: u.role, isActive: u.isActive, password: u.password };
  }

  async create(data: any): Promise<UserEntity> {
    const u = await this.prisma.user.create({ data });
    return { id: u.id, username: u.username, name: u.name, email: u.email || undefined, role: u.role, isActive: u.isActive };
  }

  async update(id: string, data: any): Promise<UserEntity> {
    const u = await this.prisma.user.update({ where: { id }, data });
    return { id: u.id, username: u.username, name: u.name, email: u.email || undefined, role: u.role, isActive: u.isActive };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
