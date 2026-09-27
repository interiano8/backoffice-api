export function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toNumber === 'function') return val.toNumber();
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    return parseFloat(cleaned) || 0;
  }
  return Number(val) || 0;
}

export function decodeBase64Decimal(b64: any): number {
  if (b64 === null || b64 === undefined) return 0;
  if (typeof b64 === 'number') return b64;
  try {
    let b64Str = b64;
    if (Buffer.isBuffer(b64)) b64Str = b64.toString('utf-8');
    if (typeof b64Str === 'string' && b64Str.includes(','))
      b64Str = b64Str.split(',')[0].trim();
    const directParse = parseFloat(b64Str);
    if (!isNaN(directParse) && /^-?\d+(\.\d+)?$/.test(b64Str))
      return directParse;
    if (typeof b64Str === 'string' && b64Str.length > 0) {
      const text = Buffer.from(b64Str, 'base64').toString('utf-8');
      const cleanText = text.replace(/\0/g, '').trim();
      const val = parseFloat(cleanText);
      if (!isNaN(val)) return val;
    }
    if (!isNaN(directParse)) return directParse;
    return 0;
  } catch {
    return 0;
  }
}

export function parseNumberOrThrow(val: any, fieldName: string): number {
  const n = toNum(val);
  if (isNaN(n)) throw new Error(`Invalid number for field: ${fieldName}`);
  return n;
}
