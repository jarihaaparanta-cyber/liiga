/**
 * liiga.fi-datan nouto tietokantaan.
 *
 * Koko kauden otteluluettelo tulee yhdellä pyynnöllä, joten myös
 * takautuva täyttö on halpa. Illan ajossa käsitellään vain viime päivien
 * ottelut, jotta kirjoituksia ei tehdä turhaan.
 */

import {
  extractStats,
  fetchGames,
  fetchSummedStats,
  toPosition,
  type LiigaGame,
  type StatRow,
} from './liiga';
import { addDays, helsinkiDate } from './time';

export type SyncKind = 'backfill' | 'nightly' | 'correction' | 'manual';

export interface SyncResult {
  kind: SyncKind;
  gamesSynced: number;
  statRows: number;
  /** Pelaajat joiden laskettu pistesumma poikkeaa liiga.fi:n virallisesta. */
  mismatches: string[];
}

/** Montako päivää taaksepäin illan ajo tarkistaa. */
const NIGHTLY_WINDOW_DAYS = 3;

/**
 * Montako päivää eteenpäin otteluohjelma tallennetaan.
 *
 * Sivu näyttää päivän ottelut, joten tulevat ottelut on oltava kannassa jo
 * ennen kuin ne pelataan. Ilman tätä aamulla avattu sivu ei tietäisi illan
 * otteluista, koska edellinen ajo oli eilen illalla.
 */
const SCHEDULE_AHEAD_DAYS = 10;

/** D1 rajoittaa yhden batchin kokoa, joten kirjoitukset paloitellaan. */
const BATCH_SIZE = 100;

async function runBatched(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE));
  }
}

export async function sync(
  db: D1Database,
  season: string,
  kind: SyncKind,
  now: Date = new Date(),
): Promise<SyncResult> {
  const startedAt = new Date().toISOString();

  // Tyhjä tietokanta täytetään aina koko kaudelta riippumatta siitä mikä ajo
  // sattuu olemaan ensimmäinen. Muuten käyttöönoton jälkeinen ensimmäinen
  // iltapäivitys jättäisi jo pelatut kierrokset kokonaan puuttumaan.
  const known = await db.prepare('SELECT COUNT(*) AS n FROM games').first<{ n: number }>();
  const effectiveKind: SyncKind = (known?.n ?? 0) === 0 ? 'backfill' : kind;

  const logId = await beginLog(db, startedAt, effectiveKind);

  try {
    const today = helsinkiDate(now);
    const allGames = await fetchGames(season);
    const { games, stats } = extractStats(allGames);

    // Takautuvassa täytössä käydään koko kausi; muuten vain tuore ikkuna,
    // johon myöhään päättyneet ja jälkikäteen korjatut ottelut osuvat.
    const since =
      effectiveKind === 'backfill' ? '0000-00-00' : addDays(today, -NIGHTLY_WINDOW_DAYS);
    const until = addDays(today, SCHEDULE_AHEAD_DAYS);
    const relevant = games.filter((g) => g.gameDate >= since && g.gameDate <= until);
    const relevantIds = new Set(relevant.map((g) => g.id));
    const relevantStats = stats.filter((s) => relevantIds.has(s.gameId));

    const writes: D1PreparedStatement[] = [];
    for (const game of relevant) {
      writes.push(
        db
          .prepare(
            `INSERT INTO games (id, game_date, season, home_team, away_team, finished,
                                start_time, started, home_goals, away_goals, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               game_date  = excluded.game_date,
               finished   = excluded.finished,
               start_time = excluded.start_time,
               started    = excluded.started,
               home_goals = excluded.home_goals,
               away_goals = excluded.away_goals,
               synced_at  = excluded.synced_at`,
          )
          .bind(
            game.id,
            game.gameDate,
            season,
            game.homeTeam,
            game.awayTeam,
            game.finished ? 1 : 0,
            game.startTime,
            game.started ? 1 : 0,
            game.homeGoals,
            game.awayGoals,
            startedAt,
          ),
      );
      // Pelatun ottelun rivit kirjoitetaan aina uusiksi, jotta jälkikäteen
      // korjattu maalikirjaus ei jätä vanhaa riviä roikkumaan. Pelaamattomalle
      // ottelulle ei ole rivejä eikä niitä siksi poisteta.
      if (game.finished) {
        writes.push(db.prepare('DELETE FROM player_game_stats WHERE game_id = ?').bind(game.id));
      }
    }
    for (const stat of relevantStats) {
      writes.push(
        db
          .prepare(
            `INSERT INTO player_game_stats (player_id, game_id, game_date, goals, assists)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(stat.playerId, stat.gameId, stat.gameDate, stat.goals, stat.assists),
      );
    }
    await runBatched(db, writes);

    // Kausikoosteet: pelaajien perustiedot, päivän tilannekuva ja tarkistus.
    const summed = await fetchSummedStats(season);
    const playerWrites: D1PreparedStatement[] = [];
    for (const p of summed) {
      playerWrites.push(
        db
          .prepare(
            `INSERT INTO players (id, first_name, last_name, team, team_name, position, jersey, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               first_name = excluded.first_name,
               last_name  = excluded.last_name,
               team       = excluded.team,
               team_name  = excluded.team_name,
               position   = excluded.position,
               updated_at = excluded.updated_at`,
          )
          .bind(
            p.playerId,
            p.firstName,
            p.lastName,
            p.teamShortName,
            p.teamName,
            toPosition(p.role),
            null,
            startedAt,
          ),
      );
      playerWrites.push(
        db
          .prepare(
            `INSERT INTO player_daily (player_id, date, games, goals, assists)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(player_id, date) DO UPDATE SET
               games   = excluded.games,
               goals   = excluded.goals,
               assists = excluded.assists`,
          )
          .bind(p.playerId, today, p.games, p.goals, p.assists),
      );
    }
    await runBatched(db, playerWrites);

    // Käynnissä olevan ottelun pisteet näkyvät jo liiga.fi:n koosteessa,
    // mutta omaan laskentaan ne tulevat vasta ottelun päätyttyä. Ilman tätä
    // jokainen illan ottelu näyttäisi virheeltä.
    const mismatches = verify(stats, summed, playersInLiveGames(allGames));

    await finishLog(db, logId, true, relevant.length, describe(mismatches));
    return {
      kind: effectiveKind,
      gamesSynced: relevant.length,
      statRows: relevantStats.length,
      mismatches,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishLog(db, logId, false, 0, message);
    throw error;
  }
}

/**
 * Vertaa maalitapahtumista laskettuja summia liiga.fi:n virallisiin.
 *
 * Näiden pitää täsmätä pelaaja pelaajalta; ero tarkoittaa että jokin
 * rajapinnassa on muuttunut. Vertailu tehdään aina koko kaudelta.
 */
function verify(
  stats: StatRow[],
  summed: { playerId: number; firstName: string; lastName: string; goals: number; assists: number }[],
  skip: Set<number>,
): string[] {
  const computed = new Map<number, { goals: number; assists: number }>();
  for (const s of stats) {
    const row = computed.get(s.playerId) ?? { goals: 0, assists: 0 };
    row.goals += s.goals;
    row.assists += s.assists;
    computed.set(s.playerId, row);
  }

  const mismatches: string[] = [];
  for (const p of summed) {
    if (skip.has(p.playerId)) continue;
    const c = computed.get(p.playerId) ?? { goals: 0, assists: 0 };
    if (c.goals !== p.goals || c.assists !== p.assists) {
      mismatches.push(
        `${p.firstName} ${p.lastName}: virallinen ${p.goals}+${p.assists}, laskettu ${c.goals}+${c.assists}`,
      );
    }
  }
  return mismatches;
}

function describe(mismatches: string[]): string {
  if (mismatches.length === 0) return 'ok';
  return `${mismatches.length} poikkeamaa: ${mismatches.slice(0, 5).join('; ')}`;
}

/**
 * Pelaajat, jotka ovat tehneet pisteitä parhaillaan käynnissä olevassa
 * ottelussa.
 *
 * Heidän kohdallaan liiga.fi:n kausikooste on jo edellä omaa laskentaamme,
 * joten vertailu antaisi virheellisen poikkeaman. Ottelun päätyttyä luvut
 * täsmäävät jälleen.
 */
export function playersInLiveGames(games: LiigaGame[]): Set<number> {
  const ids = new Set<number>();
  for (const game of games) {
    if (!game.started || game.ended) continue;
    for (const team of [game.homeTeam, game.awayTeam]) {
      for (const event of team.goalEvents ?? []) {
        ids.add(event.scorerPlayerId);
        for (const assistantId of event.assistantPlayerIds ?? []) ids.add(assistantId);
      }
    }
  }
  return ids;
}

async function beginLog(db: D1Database, startedAt: string, kind: SyncKind): Promise<number> {
  const row = await db
    .prepare('INSERT INTO sync_log (started_at, kind) VALUES (?, ?) RETURNING id')
    .bind(startedAt, kind)
    .first<{ id: number }>();
  return row?.id ?? 0;
}

async function finishLog(
  db: D1Database,
  id: number,
  ok: boolean,
  gamesSynced: number,
  message: string,
): Promise<void> {
  await db
    .prepare('UPDATE sync_log SET finished_at = ?, ok = ?, games_synced = ?, message = ? WHERE id = ?')
    .bind(new Date().toISOString(), ok ? 1 : 0, gamesSynced, message, id)
    .run();
}
