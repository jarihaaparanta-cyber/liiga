/**
 * Selvittää data/rosters.json:in pelaajille liiga.fi:n pelaaja-ID:t.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/resolve-players.mjs [kausi]
 *
 * Kirjoittaa tuloksen takaisin rosters.json:iin ja raportoi epäselvät.
 * Ajetaan käsin kauden alussa, ei osana sovellusta.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SEASON = process.argv[2] ?? '2027';
const ROSTERS = new URL('../data/rosters.json', import.meta.url);

/** Seuran nimi kokoonpanotiedostossa -> liiga.fi:n lyhenne. */
const CLUBS = {
  HPK: 'HPK', HIFK: 'IFK', Ilves: 'ILV', Jokerit: 'JOK', Jukurit: 'JUK',
  JYP: 'JYP', KalPa: 'KAL', 'K-Espoo': 'KES', KooKoo: 'KOO', Kärpät: 'KÄR',
  Lukko: 'LUK', Pelicans: 'PEL', SaiPa: 'SAI', Sport: 'SPO', Tappara: 'TAP',
  TPS: 'TPS', Ässät: 'ÄSS',
};

/** Poistaa diakriitit ja pienentää: "Ticháček" -> "tichacek". */
function normalize(name) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const url = `https://liiga.fi/api/v2/players/stats/summed/${SEASON}/${SEASON}/runkosarja/true`;
const response = await fetch(url);
if (!response.ok) throw new Error(`liiga.fi vastasi ${response.status}`);
const official = await response.json();

const data = JSON.parse(readFileSync(ROSTERS, 'utf8'));
const problems = [];

for (const team of data.teams) {
  for (const player of team.roster) {
    const short = CLUBS[player.club];
    if (!short) {
      problems.push(`${player.name}: tuntematon seura "${player.club}"`);
      continue;
    }
    const [first, ...rest] = player.name.split(' ');
    const last = normalize(rest.join(' '));

    // Ensisijaisesti sukunimi + seura. Etunimi vaihtelee (Matt/Matthew),
    // joten sitä käytetään vain erottelemaan samannimiset.
    let matches = official.filter(
      (p) => normalize(p.lastName) === last && p.teamShortName === short,
    );
    if (matches.length > 1) {
      const byFirst = matches.filter((p) => normalize(p.firstName).startsWith(normalize(first).slice(0, 3)));
      if (byFirst.length === 1) matches = byFirst;
    }

    if (matches.length === 1) {
      const m = matches[0];
      player.player_id = m.playerId;
      player.official_name = `${m.firstName} ${m.lastName}`;
      const expected = player.position === 'F' ? 'H' : 'P';
      if (m.role !== expected) {
        problems.push(
          `${player.name}: rooli rajapinnassa "${m.role}" mutta kokoonpanossa "${player.position}"`,
        );
      }
    } else {
      delete player.player_id;
      problems.push(
        matches.length === 0
          ? `${player.name} (${player.club}): ei osumaa`
          : `${player.name} (${player.club}): ${matches.length} osumaa`,
      );
    }
  }
}

writeFileSync(ROSTERS, JSON.stringify(data, null, 2) + '\n');

const total = data.teams.reduce((n, t) => n + t.roster.length, 0);
const resolved = data.teams.reduce((n, t) => n + t.roster.filter((p) => p.player_id).length, 0);
console.log(`Selvitetty ${resolved}/${total} pelaajaa kaudelle ${SEASON}.`);
if (problems.length) {
  console.log('\nTarkistettavaa:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
