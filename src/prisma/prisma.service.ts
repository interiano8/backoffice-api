import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!url) {
      throw new Error('DATABASE_URL is not defined anywhere.');
    }

    super({
      datasources: {
        db: { url },
      },
    });

    this.logger.log('PrismaService initialized with DATABASE_URL');
  }

  async onModuleInit() {
    this.$connect()
      .then(() => {
        this.logger.log('Successfully connected to the database via Prisma.');
      })
      .catch((error) => {
        this.logger.error(
          'Error connecting to the database during init:',
          error.message,
        );
      });
  }
}
