import { execSync } from 'child_process';
import * as path from 'path';

// Desencriptar el .env de forma síncrona ANTES de que NestJS lea las configuraciones
if (process.env.MASTER_KEY) {
  try {
    // __dirname en producción será dist/, por lo que subimos un nivel para llegar a scripts/
    const decryptScript = path.join(__dirname, '..', 'scripts', 'decrypt.js');
    execSync(`node "${decryptScript}"`, { stdio: 'inherit' });
  } catch (err: any) {
    console.error('[CRITICAL] Fallo al desencriptar .env.enc:', err.message);
    process.exit(1);
  }
}

// OBLIGATORIO: Cargar el .env recién desencriptado en process.env inmediatamente
// Esto evita que módulos como AuthModule se inicialicen con variables undefined
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  console.warn('Advertencia: No se pudo cargar dotenv manualmente.');
}
