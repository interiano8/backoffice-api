import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

describe('Auth & Shifts Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /stores/public should return list of public stores without auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/stores/public')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('POST /auth/login with missing fields should reject with 400 or 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'nonexistent_user', password: 'wrong_password' })
      .expect(401);
  });

  it('GET /shifts without JWT token should reject with 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/shifts')
      .set('x-store-code', 'STORE01')
      .expect(401);
  });

  it('GET /shifts/dates without JWT token should reject with 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/shifts/dates')
      .expect(401);
  });
});
