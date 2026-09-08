/**
 * Tilanteen kokoaminen tietokannasta käyttöliittymälle.
 *
 * Pistelaskennan säännöt ovat scoring.ts:ssä; tämä moduuli vastaa vain
 * tietojen hakemisesta ja siitä että otteluiden määrä saadaan oikein
 * aikaväliltä.
 */

import {
  cumulativeSeries,
  flames,
  pointStreak,
  tallyTeam,
  type GameStat,
  type Position,
  type RosterEntry,
  type Swap,
} from './scoring';
import { fetchGames, goalsFromGame, statsFromGame, type LiigaGame } from './liiga';
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
  /** Peräkkäiset ottelut joissa pelaaja on tehnyt pisteitä. */
  streak: number;
  /** Liekkien määrä putkesta, 0–5. */
  flames: number;
}

export interface StandingsTeam {
  id: string;
  name: string;
  color: string;
  /** Tänään kesken olevista otteluista kertyneet pisteet, jo mukana summassa. */
  livePoints: number;
  /** Onko joukkueelle asetettu tunnussana. Ilman sitä vaihtoa ei voi tehdä. */
  hasPin: boolean;
  players: StandingsPlayer[];
  points: number;
  swapsLeft: { F: number; D: number };
  swaps: (Swap & { outName: string; inName: string })[];
  series: { date: string; points: number }[];
}

/** Yksi ottelu otteluohjelmassa. */
/** Yksi maali ottelutilanteessa. */
export interface ScheduleGoal {
  /** Peliaika muodossa MM:SS ottelun alusta. */
  time: string;
  period: number | null;
  team: string;
  scorer: string;
  assists: string[];
  /** Tilanne maalin jälkeen, esim. "1–2". */
  score: string;
  /** Maalin tyypit, esim. ylivoima. */
  types: string[];
}

export interface ScheduleGame {
  /** Alkamisaika Suomen aikaa, muodossa HH:MM. */
  time: string;
  homeTeam: string;
  awayTeam: string;
  started: boolean;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  goals: ScheduleGoal[];
}

export interface Schedule {
  date: string;
  isToday: boolean;
  games: ScheduleGame[];
}

/** Kesken olevien otteluiden tila. */
export interface Live {
  /** Onko juuri nyt ottelu käynnissä. */
  active: boolean;
  /** Päivä jolta live-pisteet ovat. */
  date: string;
  /** Montako ottelua on käynnissä. */
  games: number;
}

export interface Standings {
  seasonStart: string;
  updatedAt: string | null;
  warning: string | null;
  /** Päivän ottelut, tai seuraava pelipäivä jos tänään ei pelata. */
  schedule: Schedule | null;
  /** Kesken olevat ottelut, tai null jos mikään ei ole käynnissä. */
  live: Live | null;
  teams: StandingsTeam[];
}

export async function loadStandings(
  db: D1Database,
  season: string,
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
    all<PlayerInfo & { first_name: string; last_name: string; team_name: string | null }>(
      db, 'SELECT id, first_name, last_name, team, team_name FROM players',
    ),
    all<{ player_id: number; game_id: number; game_date: string; goals: number; assists: number }>(
      db,
      `SELECT s.player_id, s.game_id, s.game_date, s.goals, s.assists
         FROM player_game_stats s
         JOIN roster r ON r.player_id = s.player_id`,
    ),
    db.prepare('SELECT finished_at, message FROM sync_log WHERE ok = 1 ORDER BY id DESC LIMIT 1')
      .first<{ finished_at: string; message: string }>(),
  ]);

  const today = helsinkiDate(now);
  const liveData = await loadLive(db, season, today, now);

  // Live-suoritukset lisätään tietokannan rivien perään. Ne koskevat vain
  // tätä päivää eivätkä ole vielä tietokannassa, joten päällekkäisyyttä ei
  // synny.
  const liveByPlayer = new Map<number, number>();
  for (const stat of liveData?.stats ?? []) {
    stats.push({
      player_id: stat.playerId,
      game_id: stat.gameId,
      game_date: stat.gameDate,
      goals: stat.goals,
      assists: stat.assists,
    });
    liveByPlayer.set(
      stat.playerId,
      (liveByPlayer.get(stat.playerId) ?? 0) + stat.goals + stat.assists,
    );
  }

  const nameById = new Map(players.map((p) => [p.id, p]));
  const streaks = await loadStreaks(db, players, stats, liveData?.endedGames ?? [], today);
  const schedule = await loadSchedule(db, today, liveData?.liveGames ?? [], nameById);
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
        streak: streaks.get(p.playerId) ?? 0,
        flames: flames(streaks.get(p.playerId) ?? 0),
      };
    });

    // Live-pisteet lasketaan vain kokoonpanossa olevilta pelaajilta, samoin
    // kuin varsinainen saldo.
    const livePoints = tally.players
      .filter((p) => p.active)
      .reduce((sum, p) => sum + (liveByPlayer.get(p.playerId) ?? 0), 0);

    result.push({
      id: team.id,
      name: team.name,
      color: team.color,
      hasPin: team.has_pin === 1,
      livePoints,
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
    live: liveData ? { active: liveData.active, date: today, games: liveData.games } : null,
    teams: result,
  };
}

/**
 * Pelaajien pisteputket: montako peräkkäistä ottelua pisteitä on tullut.
 *
 * Putki lasketaan pelaajan seuran otteluista, koska rajapinta ei kerro
 * ottelukohtaisia kokoonpanoja. Väliin jäänyt ottelu katkaisee putken
 * samoin kuin pisteetön ottelu.
 *
 * Mukaan otetaan vain päättyneet ottelut. Kesken oleva ottelu katkaisisi
 * putken heti alkuhetkellä ja palauttaisi sen vasta ensimmäisestä pisteestä,
 * mikä näyttäisi rikkinäiseltä.
 */
async function loadStreaks(
  db: D1Database,
  players: { id: number; team_name: string | null }[],
  stats: { player_id: number; game_id: number }[],
  liveEnded: { id: number; homeTeam: string; awayTeam: string; date: string }[],
  today: string,
): Promise<Map<number, number>> {
  // Pisin mahdollinen putki on kuusi ottelua, joten muutaman viikon ikkuna
  // riittää eikä koko kauden otteluita tarvitse siirtää.
  const since = addDays(today, -60);
  const finished = await all<{ id: number; game_date: string; home_team: string; away_team: string }>(
    db,
    `SELECT id, game_date, home_team, away_team FROM games
      WHERE finished = 1 AND game_date >= ? ORDER BY game_date, id`,
    [since],
  );

  const all_ = [
    ...finished.map((g) => ({
      id: g.id,
      date: g.game_date,
      teams: [g.home_team, g.away_team],
    })),
    // Juuri päättyneet ottelut eivät ole vielä tietokannassa.
    ...liveEnded
      .filter((g) => !finished.some((f) => f.id === g.id))
      .map((g) => ({ id: g.id, date: g.date, teams: [g.homeTeam, g.awayTeam] })),
  ].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));

  const byClub = new Map<string, { id: number }[]>();
  for (const game of all_) {
    for (const team of game.teams) {
      const list = byClub.get(team) ?? [];
      list.push({ id: game.id });
      byClub.set(team, list);
    }
  }

  const scored = new Set(stats.map((s) => `${s.player_id}:${s.game_id}`));

  const result = new Map<number, number>();
  for (const player of players) {
    const clubGames = player.team_name ? (byClub.get(player.team_name) ?? []) : [];
    result.set(
      player.id,
      pointStreak(clubGames.map((g) => ({ points: scored.has(`${player.id}:${g.id}`) ? 1 : 0 }))),
    );
  }
  return result;
}

/**
 * Kesken olevien ja juuri päättyneiden otteluiden suoritukset.
 *
 * Tietokantaan kirjoitetaan vasta illan synkronoinnissa, joten päivän aikana
 * pisteet haetaan suoraan liiga.fi:stä. Mukaan otetaan myös jo päättyneet
 * ottelut, joita synkronointi ei ole vielä ehtinyt tallentaa — muuten
 * pisteet katoaisivat näkyvistä ottelun päätyttyä ja ilmestyisivät takaisin
 * vasta klo 21:30.
 *
 * Haku on ohitettavissa: jos liiga.fi ei vastaa, sivu näyttää tietokannan
 * tilanteen eikä kaadu.
 */
async function loadLive(
  db: D1Database,
  season: string,
  today: string,
  now: Date,
): Promise<{
  stats: ReturnType<typeof statsFromGame>;
  active: boolean;
  games: number;
  endedGames: { id: number; homeTeam: string; awayTeam: string; date: string }[];
  liveGames: LiigaGame[];
} | null> {
  // Haetaan vain jos päivän ottelu on jo ehtinyt alkaa eikä sitä ole vielä
  // merkitty päättyneeksi. Muuten sivu hakisi liiga.fi:tä turhaan koko päivän.
  const pending = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM games
        WHERE game_date = ? AND finished = 0 AND start_time IS NOT NULL AND start_time <= ?`,
    )
    .bind(today, now.toISOString())
    .first<{ n: number }>();
  if ((pending?.n ?? 0) === 0) return null;

  let games: LiigaGame[];
  try {
    games = await fetchGames(season);
  } catch {
    return null;
  }

  const storedFinished = new Set(
    (
      await all<{ id: number }>(db, 'SELECT id FROM games WHERE game_date = ? AND finished = 1', [
        today,
      ])
    ).map((r) => r.id),
  );

  const relevant = games.filter(
    (game) =>
      (!game.serie || game.serie === 'RUNKOSARJA') &&
      game.started &&
      !storedFinished.has(game.id) &&
      helsinkiDate(new Date(game.start)) === today,
  );
  if (relevant.length === 0) return null;

  return {
    stats: relevant.flatMap((game) => statsFromGame(game, today)),
    active: relevant.some((game) => !game.ended),
    games: relevant.filter((game) => !game.ended).length,
    endedGames: relevant
      .filter((game) => game.ended)
      .map((game) => ({
        id: game.id,
        homeTeam: game.homeTeam.teamName,
        awayTeam: game.awayTeam.teamName,
        date: today,
      })),
    liveGames: relevant,
  };
}

/**
 * Päivän ottelut, tai seuraava pelipäivä jos tänään ei pelata.
 *
 * Haetaan ensin lähin pelipäivä tästä päivästä eteenpäin ja sen jälkeen sen
 * päivän ottelut, jottei koko otteluohjelmaa tarvitse siirtää.
 */
async function loadSchedule(
  db: D1Database,
  today: string,
  liveGames: LiigaGame[],
  nameById: Map<number, { first_name: string; last_name: string }>,
): Promise<Schedule | null> {
  const next = await db
    .prepare('SELECT MIN(game_date) AS date FROM games WHERE game_date >= ?')
    .bind(today)
    .first<{ date: string | null }>();
  const date = next?.date;
  if (!date) return null;

  const rows = await all<{
    id: number;
    start_time: string | null;
    home_team: string;
    away_team: string;
    started: number;
    finished: number;
    home_goals: number | null;
    away_goals: number | null;
  }>(
    db,
    `SELECT id, start_time, home_team, away_team, started, finished, home_goals, away_goals
       FROM games WHERE game_date = ? ORDER BY start_time, home_team`,
    [date],
  );

  // Tallennetut maalit tälle päivälle.
  const stored = await all<{
    game_id: number;
    game_time: number | null;
    period: number | null;
    team: string;
    scorer_id: number;
    assist_ids: string | null;
    home_score: number | null;
    away_score: number | null;
    goal_types: string | null;
  }>(
    db,
    `SELECT e.game_id, e.game_time, e.period, e.team, e.scorer_id, e.assist_ids,
            e.home_score, e.away_score, e.goal_types
       FROM goal_events e
       JOIN games g ON g.id = e.game_id
      WHERE g.game_date = ?
      ORDER BY e.game_id, e.game_time`,
    [date],
  );

  const byGame = new Map<number, ScheduleGoal[]>();
  const name = (id: number) => {
    const p = nameById.get(id);
    return p ? `${p.first_name} ${p.last_name}` : `#${id}`;
  };
  for (const row of stored) {
    const list = byGame.get(row.game_id) ?? [];
    list.push({
      time: gameClock(row.game_time),
      period: row.period,
      team: row.team,
      scorer: name(row.scorer_id),
      assists: (row.assist_ids ?? '').split(',').filter(Boolean).map((id) => name(Number(id))),
      score: `${row.home_score ?? ''}–${row.away_score ?? ''}`,
      types: (row.goal_types ?? '').split(',').filter(Boolean),
    });
    byGame.set(row.game_id, list);
  }

  // Kesken olevat ja vasta päättyneet ottelut eivät ole vielä tietokannassa,
  // joten niiden maalit tulevat suoraan liiga.fi:n hausta.
  const live = new Map(liveGames.map((game) => [game.id, game]));
  for (const game of liveGames) {
    byGame.set(
      game.id,
      goalsFromGame(game).map((goal) => ({
        time: gameClock(goal.gameTime),
        period: goal.period,
        team: goal.team,
        scorer: name(goal.scorerId),
        assists: goal.assistIds.map(name),
        score: `${goal.homeScore ?? ''}–${goal.awayScore ?? ''}`,
        types: goal.goalTypes,
      })),
    );
  }

  return {
    date,
    isToday: date === today,
    games: rows.map((r) => {
      const liveGame = live.get(r.id);
      return {
        time: r.start_time ? helsinkiTime(new Date(r.start_time)) : '',
        homeTeam: r.home_team,
        awayTeam: r.away_team,
        started: liveGame ? Boolean(liveGame.started) : r.started === 1,
        finished: liveGame ? Boolean(liveGame.ended) : r.finished === 1,
        homeGoals: liveGame ? (liveGame.homeTeam.goals ?? null) : r.home_goals,
        awayGoals: liveGame ? (liveGame.awayTeam.goals ?? null) : r.away_goals,
        goals: byGame.get(r.id) ?? [],
      };
    }),
  };
}

/** Peliaika sekunneista muotoon MM:SS. */
function gameClock(seconds: number | null): string {
  if (seconds === null) return '';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
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
