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

/**
 * Ajaa wranglerin ja nostaa sen oman virheilmoituksen esiin.
 *
 * Ilman tätä epäonnistuminen näkyisi pelkkänä "Command failed" -rivinä, eikä
 * lokista näkisi onko kyse puuttuvasta oikeudesta vai jostain muusta.
 */
function wrangler(args) {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim();
    throw new Error(`wrangler ${args.join(' ')} epäonnistui:\n${output || error.message}`);
  }
}

/**
 * Listaa tilin tietokannat.
 *
 * Epäonnistunut listaus tarkoittaa käytännössä puuttuvaa tai riittämätöntä
 * API-tunnistetta, ei puuttuvaa tietokantaa. Siksi virhettä ei niellä: muuten
 * skripti yrittäisi luoda tietokannan ja kaatuisi harhaanjohtavasti siihen.
 */
function listDatabases() {
  const raw = wrangler(['d1', 'list', '--json']);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Tyhjällä tilillä wrangler tulostaa taulukon sijaan huomautuksen.
    return [];
  }
}

/** Wrangler on käyttänyt kenttänimeä sekä uuid että database_id. */
const idOf = (db) => db.uuid ?? db.database_id ?? null;

let id = idOf(listDatabases().find((db) => db.name === NAME) ?? {});
if (id) {
  console.log(`Tietokanta ${NAME} on jo olemassa.`);
} else {
  console.log(`Luodaan tietokanta ${NAME}.`);
  wrangler(['d1', 'create', NAME]);
  id = idOf(listDatabases().find((db) => db.name === NAME) ?? {});
  if (!id) throw new Error(`Tietokanta ${NAME} luotiin mutta sen tunnistetta ei löytynyt.`);
}

const config = readFileSync(CONFIG, 'utf8');
const updated = config.replace(/("database_id"\s*:\s*")[^"]*(")/, `$1${id}$2`);
if (updated === config) {
  throw new Error('wrangler.jsonc:stä ei löytynyt database_id-kenttää.');
}
writeFileSync(CONFIG, updated);
console.log(`database_id asetettu: ${id}`);
