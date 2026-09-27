const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const ENV_FILE = path.join(__dirname, '../.env');
const ENC_FILE = path.join(__dirname, '../.env.enc');

const masterKey = process.argv[2] || process.env.MASTER_KEY;

if (!masterKey) {
  console.error('Error: Por favor provee la MASTER_KEY como argumento o variable de entorno para desencriptar.');
  process.exit(1);
}

try {
  if (!fs.existsSync(ENC_FILE)) {
      console.log('No se encontro .env.enc, se asume que no hay nada que desencriptar.');
      process.exit(0);
  }

  const payload = fs.readFileSync(ENC_FILE, 'utf8');
  const parts = payload.split(':');
  
  if (parts.length !== 2) {
      throw new Error('El archivo .env.enc tiene un formato invalido.');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const key = crypto.createHash('sha256').update(masterKey).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  fs.writeFileSync(ENV_FILE, decrypted, 'utf8');
  console.log('Exito: .env.enc desencriptado y guardado como .env');
} catch (error) {
  console.error('Error desencriptando el archivo:', error.message);
  process.exit(1);
}
