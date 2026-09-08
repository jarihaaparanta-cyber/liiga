/**
 * Tulostaa SQL-lauseen jolla joukkueen tunnussana asetetaan.
 *
 *   node scripts/set-pin.mjs apa 1234
 *
 * Tunnussana itse ei päädy tietokantaan, vain sen tiiviste. Aja tulostettu
 * lause komennolla:
 *
 *   npx wrangler d1 execute liigaporssi --remote --command "<lause>"
 */
import { createHash } from 'node:crypto';

const [teamId, pin] = process.argv.slice(2);
if (!teamId || !pin) {
  console.error('Käyttö: node scripts/set-pin.mjs <joukkue> <tunnussana>');
  process.exit(1);
}

// Sama tiiviste kuin src/index.ts:n hashPin.
const hash = createHash('sha256').update(`liigaporssi:${teamId}:${pin}`).digest('hex');
console.log(`UPDATE fantasy_teams SET pin_hash = '${hash}' WHERE id = '${teamId}';`);
