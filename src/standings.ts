/**
 * Tilanteen kokoaminen tietokannasta käyttöliittymälle.
 *
 * Pistelaskennan säännöt ovat scoring.ts:ssä; tämä moduuli vastaa vain
 * tietojen hakemisesta ja siitä että otteluiden määrä saadaan oikein
 * aikaväliltä.
 */

import {
  cumulativeSeries,
  tallyTeam,
  type GameStat,
  type Position,
  type RosterEntry,
  type Swap,
} from './scoring';
import { addDays, helsinkiDate, helsinkiTime } from './time';

export interface TeamRow {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface PlayerInfo {
  id: number;
  firstName: string;
  lastName: string;
  team: string;
}

export interface StandingsPlayer {
  playerId: number;
  name: string;
  club: string;
  position: Position;
  isStarter: boolean;
  active: boolean;
  /** Ottelut siltä ajalta jona pelaaja on ollut kokoonpanossa. */
  games: number;
  goals: number;
  assists: number;
  points: number;
  /** Kokoonpanon ulkopuolella kertyneet pisteet. Näytetään harmaana. */
  benchPoints: number;
}

export interface StandingsTeam {
  id: string;
  name: string;
  color: string;
  /** Onko joukkueelle asetettu tunnussana. Ilman sitä vaihtoa ei voi tehdä. */
  hasPin: boolean;
  players: StandingsPlayer[];
  points: number;
  swapsLeft: { F: number; D: number };
  swaps: (Swap & { outName: string; inName: string })[];
  series: { date: string; points: number }[];
}

/** Yksi ottelu otteluohjelmassa. */
export interface ScheduleGame {
  /** Alkamisaika Suomen aikaa, muodossa HH:MM. */
  time: string;
  homeTeam: string;
  awayTeam: string;
  started: boolean;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface Schedule {
  date: string;
  isToday: boolean;
  games: ScheduleGame[];
}

export interface Standings {
  seasonStart: string;
  updatedAt: string | null;
  warning: string | null;
  /** Päivän ottelut, tai seuraava pelipäivä jos tänään ei pelata. */
  schedule: Schedule | null;
  teams: StandingsTeam[];
}

export async function loadStandings(
  db: D1Database,
  seasonStart: string,
  now: Date = new Date(),
): Promise<Standings> {
  const [teams, roster, swaps, players, stats, lastSync] = await Promise.all([
    all<TeamRow & { sort_order: number; has_pin: number }>(
      db,
      `SELECT id, name, color, sort_order,
              CASE WHEN pin_hash IS NULL OR pin_hash = '' THEN 0 ELSE 1 END AS has_pin
         FROM fantasy_teams ORDER BY sort_order`,
    ),
    all<{ team_id: string; player_id: number; position: Position; is_starter: number; slot_order: number }>(
      db, 'SELECT team_id, player_id, position, is_starter, slot_order FROM roster',
    ),
    all<{ team_id: string; position: Position; out_player_id: number; in_player_id: number; effective_date: string }>(
      db, 'SELECT team_id, position, out_player_id, in_player_id, effective_date FROM swaps',
    ),
    all<PlayerInfo & { first_name: string; last_name: string }>(
      db, 'SELECT id, first_name, last_name, team FROM players',
    ),
    all<{ player_id: number; game_date: string; goals: number; assists: number }>(
      db,
      `SELECT s.player_id, s.game_date, s.goals, s.assists
         FROM player_game_stats s
         JOIN roster r ON r.player_id = s.player_id`,
    ),
    db.prepare('SELECT finished_at, message FROM sync_log WHERE ok = 1 ORDER BY id DESC LIMIT 1')
      .first<{ finished_at: string; message: string }>(),
  ]);

  const schedule = await loadSchedule(db, helsinkiDate(now));

  const nameById = new Map(players.map((p) => [p.id, p]));
  const rosterIds = [...new Set(roster.map((r) => r.player_id))];

  // Otteluiden määrä aikavälille saadaan tilannekuvien erotuksena. Rajapäiviä
  // on korkeintaan muutama, joten haetaan vain ne.
  const boundaries = new Set<string>();
  for (const s of swaps) boundaries.add(addDays(s.effective_date, -1));
  const gamesAt = new Map<string, Map<number, number>>();
  for (const date of boundaries) {
    gamesAt.set(date, await gamesPlayedAsOf(db, rosterIds, date));
  }
  const gamesNow = await gamesPlayedAsOf(db, rosterIds, '9999-12-31');

  const statsByTeam = new Map<string, GameStat[]>();
  const rosterByTeam = new Map<string, RosterEntry[]>();
  const playerToTeams = new Map<number, string[]>();
  for (const r of roster) {
    const entries = rosterByTeam.get(r.team_id) ?? [];
    entries.push({
      playerId: r.player_id,
      position: r.position,
      isStarter: r.is_starter === 1,
      slotOrder: r.slot_order,
    });
    rosterByTeam.set(r.team_id, entries);
    playerToTeams.set(r.player_id, [...(playerToTeams.get(r.player_id) ?? []), r.team_id]);
  }
  for (const s of stats) {
    for (const teamId of playerToTeams.get(s.player_id) ?? []) {
      const list = statsByTeam.get(teamId) ?? [];
      list.push({ playerId: s.player_id, gameDate: s.game_date, goals: s.goals, assists: s.assists });
      statsByTeam.set(teamId, list);
    }
  }

  const result: StandingsTeam[] = [];
  for (const team of teams) {
    const entries = rosterByTeam.get(team.id) ?? [];
    const teamSwaps: Swap[] = swaps
      .filter((s) => s.team_id === team.id)
      .map((s) => ({
        position: s.position,
        outPlayerId: s.out_player_id,
        inPlayerId: s.in_player_id,
        effectiveDate: s.effective_date,
      }));
    const teamStats = statsByTeam.get(team.id) ?? [];
    const tally = tallyTeam(team.id, entries, teamSwaps, teamStats, seasonStart);

    const players: StandingsPlayer[] = tally.players.map((p) => {
      const info = nameById.get(p.playerId);
      return {
        playerId: p.playerId,
        name: info ? `${info.first_name} ${info.last_name}` : `#${p.playerId}`,
        club: info?.team ?? '',
        position: p.position,
        isStarter: p.isStarter,
        active: p.active,
        games: countGames(p.intervals, p.playerId, gamesAt, gamesNow),
        goals: p.counted.goals,
        assists: p.counted.assists,
        points: p.counted.points,
        benchPoints: p.bench.points,
      };
    });

    result.push({
      id: team.id,
      name: team.name,
      color: team.color,
      hasPin: team.has_pin === 1,
      players,
      points: tally.points,
      swapsLeft: tally.swapsLeft,
      swaps: teamSwaps.map((s) => ({
        ...s,
        outName: displayName(nameById.get(s.outPlayerId)),
        inName: displayName(nameById.get(s.inPlayerId)),
      })),
      series: cumulativeSeries(entries, teamSwaps, teamStats, seasonStart),
    });
  }

  const mismatch = lastSync?.message && lastSync.message !== 'ok' ? lastSync.message : null;
  return {
    seasonStart,
    updatedAt: lastSync?.finished_at ?? null,
    warning: mismatch,
    schedule,
    teams: result,
  };
}

/**
 * Päivän ottelut, tai seuraava pelipäivä jos tänään ei pelata.
 *
 * Haetaan ensin lähin pelipäivä tästä päivästä eteenpäin ja sen jälkeen sen
 * päivän ottelut, jottei koko otteluohjelmaa tarvitse siirtää.
 */
async function loadSchedule(db: D1Database, today: string): Promise<Schedule | null> {
  const next = await db
    .prepare('SELECT MIN(game_date) AS date FROM games WHERE game_date >= ?')
    .bind(today)
    .first<{ date: string | null }>();
  const date = next?.date;
  if (!date) return null;

  const rows = await all<{
    start_time: string | null;
    home_team: string;
    away_team: string;
    started: number;
    finished: number;
    home_goals: number | null;
    away_goals: number | null;
  }>(
    db,
    `SELECT start_time, home_team, away_team, started, finished, home_goals, away_goals
       FROM games WHERE game_date = ? ORDER BY start_time, home_team`,
    [date],
  );

  return {
    date,
    isToday: date === today,
    games: rows.map((r) => ({
      time: r.start_time ? helsinkiTime(new Date(r.start_time)) : '',
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      started: r.started === 1,
      finished: r.finished === 1,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
    })),
  };
}

/**
 * Otteluiden määrä kokoonpanossa vietetyiltä aikaväleiltä.
 *
 * Tilannekuva päivältä D kertoo pelaajan kauden otteluiden määrän illan
 * pelien jälkeen, joten aikavälin [from, to) ottelut ovat
 * `games(to - 1 pv) - games(from - 1 pv)`.
 */
function countGames(
  intervals: { from: string; to: string | null }[],
  playerId: number,
  gamesAt: Map<string, Map<number, number>>,
  gamesNow: Map<number, number>,
): number {
  let total = 0;
  for (const interval of intervals) {
    const before = gamesAt.get(addDays(interval.from, -1))?.get(playerId) ?? 0;
    const until =
      interval.to === null
        ? (gamesNow.get(playerId) ?? 0)
        : (gamesAt.get(addDays(interval.to, -1))?.get(playerId) ?? 0);
    total += Math.max(0, until - before);
  }
  return total;
}

/** Pelaajan kauden otteluiden määrä annettuun päivään mennessä. */
async function gamesPlayedAsOf(
  db: D1Database,
  playerIds: number[],
  date: string,
): Promise<Map<number, number>> {
  if (playerIds.length === 0) return new Map();
  const placeholders = playerIds.map(() => '?').join(',');
  const rows = await all<{ player_id: number; games: number }>(
    db,
    `SELECT player_id, games, MAX(date) AS date
       FROM player_daily
      WHERE player_id IN (${placeholders}) AND date <= ?
      GROUP BY player_id`,
    [...playerIds, date],
  );
  return new Map(rows.map((r) => [r.player_id, r.games]));
}

function displayName(info: { first_name: string; last_name: string } | undefined): string {
  return info ? `${info.first_name} ${info.last_name}` : '';
}

async function all<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const { results } = await stmt.all<T>();
  return results ?? [];
}
