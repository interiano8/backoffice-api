const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const ENV_FILE = path.join(__dirname, '../.env');
const ENC_FILE = path.join(__dirname, '../.env.enc');

const masterKey = process.argv[2] || process.env.MASTER_KEY;

if (!masterKey) {
  console.error('Error: Por favor provee la MASTER_KEY como argumento o variable de entorno.');
  process.exit(1);
}

// Generate 32 byte key from master password
const key = crypto.createHash('sha256').update(masterKey).digest();
const iv = crypto.randomBytes(16);

try {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('Error: No se encontro el archivo .env para encriptar.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(envContent, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const payload = iv.toString('hex') + ':' + encrypted;
  fs.writeFileSync(ENC_FILE, payload, 'utf8');
  console.log('Exito: .env encriptado correctamente en .env.enc');
} catch (error) {
  console.error('Error encriptando el archivo:', error.message);
  process.exit(1);
}
