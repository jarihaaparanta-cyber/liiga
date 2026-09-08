/**
 * Varmistaa että D1-tietokanta on olemassa ja kirjoittaa sen tunnisteen
 * wrangler.jsonc:hen.
 *
 *   node scripts/ensure-d1.mjs
 *
 * Tarkoitettu ajettavaksi julkaisuputkessa, jotta tietokantaa ei tarvitse
 * luoda käsin eikä tunnistetta kopioida tiedostoon. Muutos jää työhakemistoon
 * eikä sitä commitoida: tunniste on tilikohtainen.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NAME = 'liigaporssi';
const CONFIG = new URL('../wrangler.jsonc', import.meta.url);

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Etsii tietokannan tunnisteen nimen perusteella, tai null jos sitä ei ole. */
function findDatabase() {
  let listed;
  try {
    listed = JSON.parse(wrangler(['d1', 'list', '--json']));
  } catch {
    return null;
  }
  const match = (Array.isArray(listed) ? listed : []).find((db) => db.name === NAME);
  // Wrangler on käyttänyt kenttänimeä sekä uuid että database_id.
  return match ? (match.uuid ?? match.database_id ?? null) : null;
}

let id = findDatabase();
if (id) {
  console.log(`Tietokanta ${NAME} on jo olemassa.`);
} else {
  console.log(`Luodaan tietokanta ${NAME}.`);
  wrangler(['d1', 'create', NAME]);
  id = findDatabase();
  if (!id) throw new Error(`Tietokanta ${NAME} luotiin mutta sen tunnistetta ei löytynyt.`);
}

const config = readFileSync(CONFIG, 'utf8');
const updated = config.replace(
  /("database_id"\s*:\s*")[^"]*(")/,
  (_, before, after) => `${before}${id}${after}`,
);
if (updated === config) {
  throw new Error('wrangler.jsonc:stä ei löytynyt database_id-kenttää.');
}
writeFileSync(CONFIG, updated);
console.log(`database_id asetettu: ${id}`);
