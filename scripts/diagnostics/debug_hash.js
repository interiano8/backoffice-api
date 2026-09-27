const crypto = require('crypto');

const b64 = 'AQAAAAEAAYagAAAAEAAAACBEc1spy7cc/BcCaxfjGgRNQ4RtPD1S1AfxS2A1WIwLVZ9FZP1FcqGJoz7N85X8C7U=';
const password = '1234';

const decoded = Buffer.from(b64, 'base64');
console.log('Total Length:', decoded.length);
console.log('Hex:', decoded.toString('hex'));

// Parse Header
const version = decoded[0];
const prf = decoded.readUInt32BE(1);
const iterCount = decoded.readUInt32BE(5);
const saltSize = decoded.readUInt32BE(9);
const keySize = decoded.readUInt32BE(13);

console.log({ version, prf, iterCount, saltSize, keySize });

const salt = decoded.subarray(17, 17 + saltSize);
console.log('Salt Hex:', salt.toString('hex'));

const expectedKey = decoded.subarray(17 + saltSize);
console.log('Key Hex:', expectedKey.toString('hex'));
console.log('Expected Key Len:', expectedKey.length);

// Verify
const digest = prf === 1 ? 'sha256' : 'sha1';
console.log('Using digest:', digest);

crypto.pbkdf2(password, salt, iterCount, keySize, digest, (err, derivedKey) => {
    if (err) throw err;
    console.log('Derived Key Hex:', derivedKey.toString('hex'));
    console.log('Match:', derivedKey.equals(expectedKey));
});
