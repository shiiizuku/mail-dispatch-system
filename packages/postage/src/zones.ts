import type { ZoneCode } from './rate-card.js';

/**
 * Province → zone, keyed by province name, following PHLPost's regional columns. Where the office
 * pays a different price, that is a rate override, not a different zone.
 *
 * LAST_MILE (far-flung / remote / special areas) is set per recipient, not per province: PHLPost
 * draws it by municipality and barangay, and no province is wholly inside it.
 */
export type ProvinceZones = Record<string, ZoneCode>;

const zone = (code: ZoneCode, provinces: string[]): ProvinceZones =>
  Object.fromEntries(provinces.map((p) => [p, code]));

export const DEFAULT_PROVINCE_ZONES: ProvinceZones = {
  ...zone('NCR', ['Metro Manila']),
  ...zone('N_LUZON', [
    // Region III. The desk note prices these differently from the card; see `overrides`.
    'Aurora',
    'Bulacan',
    'Nueva Ecija',
    'Bataan',
    'Pampanga',
    'Tarlac',
    'Zambales',
    // CAR
    'Abra',
    'Apayao',
    'Benguet',
    'Ifugao',
    'Kalinga',
    'Mountain Province',
    // Region I
    'Ilocos Norte',
    'Ilocos Sur',
    'La Union',
    'Pangasinan',
    // Region II
    'Batanes',
    'Cagayan',
    'Isabela',
    'Nueva Vizcaya',
    'Quirino',
  ]),
  ...zone('S_LUZON', [
    // Region IV-A
    'Batangas',
    'Cavite',
    'Laguna',
    'Quezon',
    'Rizal',
    // MIMAROPA
    'Marinduque',
    'Occidental Mindoro',
    'Oriental Mindoro',
    'Palawan',
    'Romblon',
    // Region V
    'Albay',
    'Camarines Norte',
    'Camarines Sur',
    'Catanduanes',
    'Masbate',
    'Sorsogon',
  ]),
  ...zone('VISAYAS', [
    'Aklan',
    'Antique',
    'Capiz',
    'Guimaras',
    'Iloilo',
    'Negros Occidental',
    'Negros Oriental',
    'Siquijor',
    'Bohol',
    'Cebu',
    'Biliran',
    'Eastern Samar',
    'Leyte',
    'Northern Samar',
    'Samar',
    'Southern Leyte',
  ]),
  ...zone('MINDANAO', [
    'Zamboanga del Norte',
    'Zamboanga del Sur',
    'Zamboanga Sibugay',
    'Bukidnon',
    'Camiguin',
    'Lanao del Norte',
    'Misamis Occidental',
    'Misamis Oriental',
    'Davao de Oro',
    'Davao del Norte',
    'Davao del Sur',
    'Davao Occidental',
    'Davao Oriental',
    'Cotabato',
    'Sarangani',
    'South Cotabato',
    'Sultan Kudarat',
    'Agusan del Norte',
    'Agusan del Sur',
    'Dinagat Islands',
    'Surigao del Norte',
    'Surigao del Sur',
    'Basilan',
    'Lanao del Sur',
    'Maguindanao del Norte',
    'Maguindanao del Sur',
    'Sulu',
    'Tawi-Tawi',
  ]),
};

export const normalizeProvince = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function zoneForProvince(zones: ProvinceZones, province: string): ZoneCode {
  const wanted = normalizeProvince(province);
  for (const [name, code] of Object.entries(zones)) {
    if (normalizeProvince(name) === wanted) return code;
  }
  throw new Error(`No postage zone is set for province "${province.trim()}"`);
}
