import './crypto-env'; // ESTO DEBE IR PRIMERO, ANTES DE CUALQUIER OTRO IMPORT
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

import helmet from 'helmet';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { ensureLicense } from './licensing/license';

async function bootstrap() {
  // Licencia: enrolamiento en la nube + validación (suspensión/revocación bloquean).
  await ensureLicense();

  const app = await NestFactory.create(AppModule);

  // 0. Seguridad HTTP: Helmet
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  // 0.1 Configurar límites de tamaño del cuerpo ANTES de otros middlewares
  const bodyLimit = process.env.CLIENT_MAX_BODY_SIZE || '50mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));

  // 1. Prioridad Máxima: Middleware Seguro de CORS con Whitelist Estricta
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
      const isAllowed =
        allowedOrigins.includes(origin) ||
        (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else {
        if (req.method === 'OPTIONS') {
          return res.status(403).json({ message: 'CORS Origin not allowed' });
        }
      }
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-Requested-With, Content-Type, Accept, Authorization, x-store-code',
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas de cache para preflight

    // Responder OK de inmediato a peticiones preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // 2. Logger global para diagnóstico de peticiones
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      console.log(
        `[PREFLIGHT] ${req.method} ${req.url} from ${req.headers.origin}`,
      );
    } else {
      console.log(`[REQUEST] ${req.method} ${req.url}`);
    }
    next();
  });

  // 3. Pipes y validaciones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 4. Filtro global de Excepciones de Dominio (Hexagonal)
  app.useGlobalFilters(new DomainExceptionFilter());

  const port = process.env.PORT || 3000;
  console.log(`[API] Arrancando en puerto ${port}...`);
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('[CRITICAL ERROR] Error al arrancar la API:', err);
});
