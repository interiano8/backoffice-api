import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { LICENSE_PUBLIC_KEY } from './public-key';

const PRODUCT = 'BACKOFFICE';

/** URL por defecto del servicio de licencias (fallback si no hay env en producción). */
const DEFAULT_SERVER_URL = 'https://licencias-api.prismapos.site';

/** Ejecuta un comando y devuelve su salida (o null). */
function cmdOut(cmd: string): string | null {
  try {
    return require('child_process')
      .execSync(cmd, { encoding: 'utf8', windowsHide: true, timeout: 4000 })
      .trim();
  } catch {
    return null;
  }
}

function boardUuid(): string | null {
  try {
    if (process.platform === 'win32') {
      const out = cmdOut('wmic csproduct get uuid /value');
      const m = /UUID=([0-9A-Fa-f-]{36})/.exec(out ?? '');
      return m ? m[1].toUpperCase() : null;
    }
    for (const f of ['/sys/class/dmi/id/product_uuid', '/sys/class/dmi/id/board_serial']) {
      if (fs.existsSync(f)) {
        const v = fs.readFileSync(f, 'utf8').trim();
        if (v) return v;
      }
    }
    return null;
  } catch {
    return null;
  }
}

let cachedRaw: string | null = null;
function rawFingerprint(): string {
  if (cachedRaw) return cachedRaw;
  const parts = [osMachineId(), boardUuid()].filter(
    (v): v is string => !!v,
  );
  cachedRaw = parts.length > 0
    ? parts.join('|')
    : `${os.hostname()}|${os.platform()}|${os.arch()}`;
  return cachedRaw;
}

function osMachineId(): string | null {
  try {
    if (process.platform === 'win32') {
      const reg = cmdOut(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      );
      const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(reg ?? '');
      if (m) return m[1];
      return null;
    }
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      if (fs.existsSync(f)) {
        const v = fs.readFileSync(f, 'utf8').trim();
        if (v) return v;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Fingerprint de la máquina con scope de producto. Resiste clonado (MAC+UUID). */
export function getMachineId(): string {
  const hex = crypto
    .createHash('sha256')
    .update(`${rawFingerprint()}|${PRODUCT}`)
    .digest('hex');
  const clean = hex.slice(0, 16).toUpperCase();
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

function licenseDir(): string {
  return process.env.LICENSING_DIR || process.cwd();
}
function paths() {
  return {
    license: path.join(licenseDir(), 'license.key'),
    deviceKey: path.join(licenseDir(), 'device.key'),
    devicePub: path.join(licenseDir(), 'device.pub'),
    machineId: path.join(licenseDir(), 'machine-id.txt'),
  };
}

/** Genera (una vez) el par de llaves del dispositivo y devuelve la pública (PEM SPKI). */
function ensureDeviceKeypair(p: ReturnType<typeof paths>): string {
  if (fs.existsSync(p.deviceKey) && fs.existsSync(p.devicePub)) {
    return fs.readFileSync(p.devicePub, 'utf8');
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(p.deviceKey, privateKey, { mode: 0o600 });
  fs.writeFileSync(p.devicePub, publicKey);
  return publicKey;
}
function serverUrl(): string {
  const v = (process.env.LICENSING_SERVER_URL ?? '').trim().replace(/\/+$/, '');
  if (v) return v;
  // Modo offline solo si se fuerza explícitamente.
  return process.env.LICENSING_OFFLINE === '1'
    ? ''
    : DEFAULT_SERVER_URL.replace(/\/+$/, '');
}
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
function heartbeatSeconds(): number {
  const v = Number(process.env.LICENSE_HEARTBEAT_SECONDS ?? 18000);
  return Number.isFinite(v) && v > 0 ? v : 18000;
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LicenseResult {
  ok: boolean;
  machineId: string;
  error: string;
}

export function validateLicense(licensePath: string): LicenseResult {
  const machineId = getMachineId();
  if (!fs.existsSync(licensePath)) {
    return { ok: false, machineId, error: 'No se encontró license.key.' };
  }
  let payload: { machineId?: string; issuedTo?: string; expiresUtc?: string; signature?: string };
  try {
    payload = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
  } catch (err) {
    return { ok: false, machineId, error: `license.key inválido: ${(err as Error).message}` };
  }
  if (!payload.machineId || !payload.signature) {
    return { ok: false, machineId, error: 'license.key incompleto.' };
  }
  if (payload.machineId.toUpperCase() !== machineId) {
    return { ok: false, machineId, error: `Licencia de otra máquina (esta: ${machineId}).` };
  }
  if (payload.expiresUtc && new Date(payload.expiresUtc).getTime() < Date.now()) {
    return { ok: false, machineId, error: 'Licencia vencida.' };
  }
  try {
    const data = Buffer.from(
      `${payload.machineId}|${payload.issuedTo ?? ''}|${payload.expiresUtc ?? ''}`,
      'utf8',
    );
    const ok = crypto.verify(
      'RSA-SHA256',
      data,
      LICENSE_PUBLIC_KEY,
      Buffer.from(payload.signature, 'base64'),
    );
    if (!ok) return { ok: false, machineId, error: 'Firma inválida.' };
  } catch (err) {
    return { ok: false, machineId, error: `Firma: ${(err as Error).message}` };
  }
  return { ok: true, machineId, error: '' };
}

function fail(error: string): void {
  try {
    fs.writeFileSync(paths().machineId, getMachineId());
  } catch {
    /* best-effort */
  }
  const msg =
    `${error} Machine ID: ${getMachineId()}. ` +
    'El backoffice NO puede iniciar sin licencia válida. ' +
    'Revise license.log y el panel de licencias.';
  licLog(`FALLO DE LICENCIA: ${msg}`);
  console.error(`[LICENSE] ${msg}`);
  process.exit(1);
}

function block(reason: string): never {
  licLog(`BLOQUEO: ${reason}. El backoffice se detendrá.`);
  console.error(`[LICENSE] ${reason} El backoffice se detendrá.`);
  process.exit(1);
  throw new Error(reason);
}

/** Escribe una línea en license.log (diagnóstico). */
function licLog(msg: string): void {
  try {
    fs.appendFileSync(
      path.join(licenseDir(), 'license.log'),
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    /* best-effort */
  }
}

export interface StoreContext {
  storeId: string | null;
  storeName: string | null;
  clientCode: string | null;
}

/**
 * Lee el contexto (tienda) de la BD del backoffice (`bo_store`) para el
 * enrolamiento. El `clientCode` no existe en el backoffice → viene de env.
 * Si la BD no responde, cae a las variables de entorno.
 */
export async function readStoreContext(): Promise<StoreContext> {
  const fallback: StoreContext = {
    storeId: process.env.STORE_ID ?? null,
    storeName: process.env.STORE_NAME ?? null,
    clientCode:
      process.env.LICENSING_CLIENT_CODE ?? process.env.CLIENT_CODE ?? null,
  };
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const sel = process.env.STORE_ID;
      const store = sel
        ? await prisma.boStore.findUnique({ where: { code: sel } })
        : await prisma.boStore.findFirst({
            where: { isActive: true },
            orderBy: { code: 'asc' },
          });
      if (!store) return fallback;
      return {
        storeId: store.code ?? fallback.storeId,
        storeName: store.name ?? fallback.storeName,
        clientCode: fallback.clientCode,
      };
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch {
    return fallback;
  }
}

async function enroll(server: string): Promise<void> {
  const machineId = getMachineId();
  const ctx = await readStoreContext();
  let ok = false;
  try {
    const res = await fetch(`${server}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineId,
        publicKey: ensureDeviceKeypair(paths()),
        product: PRODUCT,
        clientCode: ctx.clientCode,
        storeName: ctx.storeName,
        storeId: ctx.storeId,
        posNo: process.env.POS_NO ?? null,
      }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  if (!ok) {
    licLog(
      `ENROLAMIENTO FALLIDO: no se pudo contactar el servidor de licencias. URL: ${server}. Machine ID: ${machineId}.`,
    );
    fail('Se requiere internet para activar el backoffice (enrolamiento en la nube).');
    return;
  }
  licLog(
    `Solicitud de activación enviada (machine ${machineId}). Pendiente de aprobación.`,
  );
  console.log('[LICENSE] Solicitud de activación enviada. Pendiente de aprobación.');

  const pollMs = Math.max(1000, Number(process.env.LICENSING_POLL_MS ?? 10000));
  const maxAttempts = Number(process.env.LICENSING_ENROLL_MAX_ATTEMPTS ?? 0);
  for (let i = 0; maxAttempts === 0 || i < maxAttempts; i++) {
    await delay(pollMs);
    try {
      const res = await fetch(`${server}/license?machineId=${encodeURIComponent(machineId)}`);
      if (res.ok) {
        const data = (await res.json()) as { license?: unknown; revoked?: boolean; suspended?: boolean };
        if (data?.revoked) return fail('La activación fue rechazada.');
        if (data?.suspended) return fail('La activación está suspendida.');
        if (data?.license) {
          fs.writeFileSync(paths().license, JSON.stringify(data.license));
          licLog('Licencia recibida y guardada.');
          console.log('[LICENSE] Licencia recibida y guardada.');
          return;
        }
      }
    } catch {
      /* reintentar */
    }
    console.log('[LICENSE] Pendiente de aprobación...');
  }
  fail('La activación no fue aprobada a tiempo.');
}

async function phoneHome(
  server: string,
): Promise<{ verdict: 'ok' | 'suspended' | 'revoked' | 'notFound' | 'unreachable'; next?: number }> {
  try {
    const license = JSON.parse(fs.readFileSync(paths().license, 'utf8'));
    const res = await fetch(`${server}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId: getMachineId(), license }),
    });
    if (!res.ok) return { verdict: 'unreachable' };
    const data = (await res.json()) as { ok?: boolean; revoked?: boolean; suspended?: boolean; notFound?: boolean; nextRevalidateSeconds?: number };
    if (data?.revoked) return { verdict: 'revoked' };
    if (data?.suspended) return { verdict: 'suspended' };
    if (data?.notFound) return { verdict: 'notFound' };
    if (data?.ok) return { verdict: 'ok', next: data.nextRevalidateSeconds };
    return { verdict: 'unreachable' };
  } catch {
    return { verdict: 'unreachable' };
  }
}

/** Re-enrola como la primera vez si la licencia fue eliminada en la nube. */
async function reEnroll(server: string): Promise<void> {
  licLog('La licencia ya no existe en la nube; re-enrolamiento como la primera vez.');
  console.warn('[LICENSE] La licencia ya no existe en la nube. Re-enrolamiento como la primera vez...');
  try {
    fs.unlinkSync(paths().license);
  } catch {
    // sin archivo
  }
  await enroll(server);
}

function startRevalidation(server: string): void {
  const schedule = (seconds: number) => {
    const timer = setTimeout(async () => {
      const r = await phoneHome(server);
      if (r.verdict === 'revoked') block('Licencia revocada por el servidor.');
      if (r.verdict === 'suspended') block('Licencia suspendida por el servidor.');
      if (r.verdict === 'notFound') await reEnroll(server);
      schedule(r.next && r.next > 0 ? r.next : seconds);
    }, Math.max(5, seconds) * 1000);
    timer.unref?.();
  };
  schedule(heartbeatSeconds());
}

/** Gate de arranque: enrola (si hay servidor) y valida; suspensión/revocación bloquean. */
export async function ensureLicense(): Promise<void> {
  if (!isProduction() && process.env.WAYNE_SKIP_LICENSE === '1') {
    console.warn('[LICENSE] Bypass de desarrollo activo (WAYNE_SKIP_LICENSE=1).');
    return;
  }
  const p = paths();
  const server = serverUrl();
  licLog(
    `--- Inicio de validación de licencia (servidor: ${server || '(sin servidor)'}) ---`,
  );

  if (!fs.existsSync(p.license)) {
    if (server) await enroll(server);
    else {
      fail('No se encontró el archivo de licencia (license.key).');
      return;
    }
  }
  if (!fs.existsSync(p.license)) return;

  const result = validateLicense(p.license);
  if (!result.ok) {
    licLog(`VALIDACIÓN LOCAL FALLÓ: ${result.error}`);
    fail(result.error);
    return;
  }
  licLog(`Licencia válida para ${result.machineId}.`);
  console.log(`[LICENSE] Licencia válida para ${result.machineId} (server=${server ? 'on' : 'off'}).`);

  if (server) {
    const r = await phoneHome(server);
    if (r.verdict === 'revoked') block('Licencia revocada por el servidor.');
    if (r.verdict === 'suspended') block('Licencia suspendida por el servidor.');
    if (r.verdict === 'notFound') await reEnroll(server);
    startRevalidation(server);
  }
}
