/**
 * liiga.fi:n rajapinnan asiakas.
 *
 * Rajapinta on dokumentoimaton mutta julkinen; ks. docs/liiga-api.md
 * kenttien merkityksistä ja siitä miten alla oleva suodatussääntö on
 * todennettu oikeaa dataa vasten.
 */

import { helsinkiDate } from './time';

const BASE = 'https://liiga.fi/api/v2';

export interface GoalEvent {
  scorerPlayerId: number;
  assistantPlayerIds: number[] | null;
  goalTypes: string[] | null;
  goalsSoFarInSeason?: number;
}

export interface LiigaTeam {
  teamName: string;
  goals?: number;
  goalEvents: GoalEvent[] | null;
}

export interface LiigaGame {
  id: number;
  start: string;
  started?: boolean;
  ended: boolean;
  serie: string;
  homeTeam: LiigaTeam;
  awayTeam: LiigaTeam;
}

export interface SummedPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  teamShortName: string;
  teamName: string;
  role: string;
  games: number;
  goals: number;
  assists: number;
}

/** Ottelu tietokantaan tallennettavassa muodossa. */
export interface GameRow {
  id: number;
  gameDate: string;
  /** Alkuaika UTC:nä sellaisenaan; muunnetaan Suomen aikaan näytettäessä. */
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  started: boolean;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

/** Yhden pelaajan suoritus yhdessä ottelussa. */
export interface StatRow {
  playerId: number;
  gameId: number;
  gameDate: string;
  goals: number;
  assists: number;
}

/**
 * Maalityypit jotka eivät kerrytä pelaajatilastoja.
 *
 * `VL`  = voittolaukaus: ratkaisee ottelun mutta ei ole pelaajan maali.
 * `RL0` = rangaistuslaukaus josta ei tullut maalia.
 *
 * Huomaa ettei "nollaan päättyvä koodi" ole yleissääntö: `VT0` lasketaan
 * normaalisti mukaan.
 */
export const NON_SCORING_GOAL_TYPES = new Set(['VL', 'RL0']);

/**
 * Kerryttääkö maalitapahtuma pelaajan pisteitä.
 *
 * Kaksi toisistaan riippumatonta tuntomerkkiä, jotta yksittäisen uuden
 * tyyppikoodin ilmestyminen ei riko laskentaa: tyyppikoodi ja pelaajan
 * kauden maalimäärä tapahtuman jälkeen, joka on aidolla maalilla aina
 * vähintään yksi.
 */
export function countsAsScoring(event: GoalEvent): boolean {
  for (const type of event.goalTypes ?? []) {
    if (NON_SCORING_GOAL_TYPES.has(type)) return false;
  }
  return event.goalsSoFarInSeason !== 0;
}

/**
 * Muuntaa otteluluettelon tietokantariveiksi.
 *
 * Vain päättyneet runkosarjaotteluiden tapahtumat lasketaan. Kesken oleva
 * ottelu palautetaan `finished: false` -rivinä, jotta se haetaan uudelleen
 * seuraavassa ajossa.
 */
export function extractStats(games: LiigaGame[]): { games: GameRow[]; stats: StatRow[] } {
  const gameRows: GameRow[] = [];
  const stats: StatRow[] = [];

  for (const game of games) {
    if (game.serie && game.serie !== 'RUNKOSARJA') continue;

    // Ottelupäivä on Suomen paikallinen kalenteripäivä, ei UTC-päivä.
    const gameDate = helsinkiDate(new Date(game.start));
    gameRows.push({
      id: game.id,
      gameDate,
      startTime: game.start,
      homeTeam: game.homeTeam.teamName,
      awayTeam: game.awayTeam.teamName,
      started: Boolean(game.started),
      finished: Boolean(game.ended),
      homeGoals: game.homeTeam.goals ?? null,
      awayGoals: game.awayTeam.goals ?? null,
    });
    if (!game.ended) continue;
    stats.push(...statsFromGame(game, gameDate));
  }

  return { games: gameRows, stats };
}

/**
 * Yhden ottelun suoritukset pelaajittain.
 *
 * Toimii myös kesken olevalle ottelulle: `goalEvents` sisältää siihenastiset
 * maalit. Kutsuja päättää otetaanko keskeneräinen ottelu mukaan.
 */
export function statsFromGame(game: LiigaGame, gameDate: string): StatRow[] {
  // Kootaan per pelaaja, jotta usean maalin ottelusta tulee yksi rivi.
  const perPlayer = new Map<number, { goals: number; assists: number }>();
  const bump = (playerId: number, field: 'goals' | 'assists') => {
    const row = perPlayer.get(playerId) ?? { goals: 0, assists: 0 };
    row[field] += 1;
    perPlayer.set(playerId, row);
  };

  for (const team of [game.homeTeam, game.awayTeam]) {
    for (const event of team.goalEvents ?? []) {
      if (!countsAsScoring(event)) continue;
      bump(event.scorerPlayerId, 'goals');
      for (const assistantId of event.assistantPlayerIds ?? []) {
        bump(assistantId, 'assists');
      }
    }
  }

  return [...perPlayer].map(([playerId, row]) => ({
    playerId,
    gameId: game.id,
    gameDate,
    goals: row.goals,
    assists: row.assists,
  }));
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    // Liiga.fi:n vastaukset ovat isoja; välimuisti pidetään lyhyenä jotta
    // kesken olevan ottelun tilanne ei jää jumiin.
    cf: { cacheTtl: 60, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) {
    throw new Error(`liiga.fi ${url} vastasi ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Hakee koko kauden otteluluettelon tapahtumineen yhdellä pyynnöllä. */
export function fetchGames(season: string): Promise<LiigaGame[]> {
  return getJson<LiigaGame[]>(`${BASE}/games?tournament=runkosarja&season=${season}`);
}

/** Hakee pelaajien kausikoosteet: otteluiden määrä ja viralliset pistesummat. */
export function fetchSummedStats(season: string): Promise<SummedPlayer[]> {
  return getJson<SummedPlayer[]>(
    `${BASE}/players/stats/summed/${season}/${season}/runkosarja/true`,
  );
}

/** Rajapinnan roolikoodi liigapörssin positioksi. */
export function toPosition(role: string): 'F' | 'D' | 'G' {
  if (role === 'P') return 'D';
  if (role === 'MV') return 'G';
  return 'F';
}
