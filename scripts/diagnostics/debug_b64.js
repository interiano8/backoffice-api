
const b64 = "MjgwMC4wMDAwMDAwMDAwMDAwMDAwMDAwMA==";
const buf = Buffer.from(b64, 'base64');
const textUtf8 = buf.toString('utf-8');
const textUtf16 = buf.toString('utf16le');
const valUtf8 = parseFloat(textUtf8);
const valUtf16 = parseFloat(textUtf16);

console.log('Original Base64:', b64);
console.log('Decoded UTF-8:', textUtf8);
console.log('Val UTF-8:', valUtf8);
console.log('Decoded UTF-16LE:', textUtf16);
console.log('Val UTF-16LE:', valUtf16);
