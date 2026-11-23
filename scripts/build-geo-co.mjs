/**
 * Genera src/geo/data/co.json con los departamentos y municipios de Colombia
 * (DIVIPOLA del DANE, publicada en datos.gov.co, conjunto gdxc-w37w).
 * Ejecutar con `npm run geo:co` cuando el DANE publique cambios.
 */
import { writeFileSync } from 'node:fs';

const URL_DATASET = 'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=5000';

/** Palabras que van en minúscula dentro de un nombre propio. */
const SMALL = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en']);

/** "SAN JOSÉ DEL GUAVIARE" → "San José del Guaviare" */
function titleCase(text) {
  return text
    .toLowerCase()
    .split(/(\s+|-|\()/)
    .map((word, i) => (i > 0 && SMALL.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('')
    .replace(/\bD\.c\./i, 'D. C.');
}

/** Nombres oficiales largos que en el día a día se dicen distinto. */
const REGION_NAMES = {
  '11': 'Bogotá D. C.',
  '88': 'San Andrés y Providencia',
};

/** Ciudades cuyo nombre oficial no es el que usa la gente. El oficial queda para buscar. */
const CITY_NAMES = {
  '13001': 'Cartagena',
  '54001': 'Cúcuta',
  '76001': 'Cali',
  '76111': 'Buga',
};

const rows = await (await fetch(URL_DATASET)).json();
if (!Array.isArray(rows) || rows.length < 1000) throw new Error('Respuesta inesperada de datos.gov.co');

const regions = new Map();
for (const row of rows) {
  const code = row.cod_dpto.padStart(2, '0');
  if (!regions.has(code)) regions.set(code, { code, name: REGION_NAMES[code] ?? titleCase(row.dpto), cities: [] });
  const cityCode = row.cod_mpio.padStart(5, '0');
  const official = code === '11' ? 'Bogotá D. C.' : titleCase(row.nom_mpio);
  const name = CITY_NAMES[cityCode] ?? official;
  regions.get(code).cities.push({
    code: cityCode,
    name,
    ...(name !== official && { official }),
    lat: Number(String(row.latitud).replace(',', '.')),
    lng: Number(String(row.longitud).replace(',', '.')),
  });
}

const sorted = [...regions.values()]
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  .map((r) => ({ ...r, cities: r.cities.sort((a, b) => a.name.localeCompare(b.name, 'es')) }));

writeFileSync(
  new URL('../src/geo/data/co.json', import.meta.url),
  JSON.stringify({ source: 'DANE DIVIPOLA (datos.gov.co, gdxc-w37w)', regions: sorted }),
);
console.log(`${sorted.length} departamentos, ${rows.length} municipios`);
