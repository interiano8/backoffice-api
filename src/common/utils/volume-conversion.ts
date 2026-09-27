/**
 * Utilidades para conversión de unidades de volumen
 * Factor de conversión: 1 galón (GL) = 3.78541 litros (LT)
 */

export const GALLON_TO_LITER_FACTOR = 3.78541;
export const LITER_TO_GALLON_FACTOR = 1 / 3.78541;

/**
 * Convierte galones a litros
 */
export function gallonsToLiters(gallons: number): number {
  return gallons * GALLON_TO_LITER_FACTOR;
}

/**
 * Convierte litros a galones
 */
export function litersToGallons(liters: number): number {
  return liters * LITER_TO_GALLON_FACTOR;
}

/**
 * Convierte volumen entre unidades según la unidad de origen
 * @param volume - El valor del volumen
 * @param fromUnit - La unidad de origen ('GL', 'GALON', 'LT', 'LITRO', 'L')
 * @returns Objeto con ambas unidades: { volumeLT, volumeGL }
 */
export function convertVolume(
  volume: number,
  fromUnit?: string,
): { volumeLT: number; volumeGL: number } {
  const vol = Number(volume) || 0;
  const unit = (fromUnit || 'LT').toUpperCase().trim();

  if (unit === 'GL' || unit === 'GALON' || unit === 'GALONES') {
    return {
      volumeGL: vol,
      volumeLT: gallonsToLiters(vol),
    };
  } else if (
    unit === 'LT' ||
    unit === 'LITRO' ||
    unit === 'LITROS' ||
    unit === 'L'
  ) {
    return {
      volumeLT: vol,
      volumeGL: litersToGallons(vol),
    };
  } else {
    // Por defecto asumimos litros si la unidad es desconocida
    return {
      volumeLT: vol,
      volumeGL: litersToGallons(vol),
    };
  }
}

/**
 * Formatea un número de volumen con decimales consistentes
 */
export function formatVolume(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
}

/**
 * Interface para objetos que contienen volumen en ambas unidades
 */
export interface VolumeBothUnits {
  volumeLT: number;
  volumeGL: number;
}
