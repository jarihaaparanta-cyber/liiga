/**
 * Muodostaa migrations/0002_seed.sql tiedostosta data/rosters.json.
 *
 *   node scripts/generate-seed.mjs
 *
 * Aja uudelleen jos kokoonpanot muuttuvat ennen kauden alkua. Kesken kauden
 * kokoonpanoa ei muuteta siemenmigraatiolla vaan vaihtotoiminnolla.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/rosters.json', import.meta.url), 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const lines = [
  '-- Muodostettu automaattisesti: node scripts/generate-seed.mjs',
  '-- Lähde: data/rosters.json',
  '',
];

for (const team of data.teams) {
  lines.push(
    `INSERT INTO fantasy_teams (id, name, color, sort_order) VALUES (${q(team.id)}, ${q(team.name)}, ${q(team.color)}, ${team.sort_order});`,
  );
}
lines.push('');

for (const team of data.teams) {
  lines.push(`-- ${team.name}`);
  team.roster.forEach((p, index) => {
    if (!p.player_id) {
      throw new Error(`${p.name}: player_id puuttuu. Aja ensin scripts/resolve-players.mjs.`);
    }
    lines.push(
      `INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) ` +
        `VALUES (${q(team.id)}, ${p.player_id}, ${q(p.position)}, ${p.starter ? 1 : 0}, ${index + 1}); ` +
        `-- ${p.name} (${p.club})`,
    );
  });
  lines.push('');
}

writeFileSync(new URL('../migrations/0002_seed.sql', import.meta.url), lines.join('\n'));
console.log(`Kirjoitettu migrations/0002_seed.sql (${data.teams.length} joukkuetta).`);
