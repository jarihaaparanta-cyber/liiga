/**
 * Liigapörssin pistelaskenta.
 *
 * Säännöt:
 *  - Avauskokoonpanoon kuuluu 3 hyökkääjää ja 2 pakkia. Ne kerryttävät
 *    pisteitä runkosarjan alusta asti.
 *  - Lisäksi joukkueella on yksi varahyökkääjä ja yksi varapakki. Ne eivät
 *    kerrytä pisteitä ennen kuin ne on vaihdettu peliin.
 *  - Vaihto tehdään ennen kierroksen alkua eli ennen klo 14 Suomen aikaa.
 *    Vaihtopäivästä alkaen sisään tullut pelaaja kerryttää pisteitä ja ulos
 *    jäänyt ei enää. Ulos jäänyt säilyttää siihen asti kerätyt pisteet.
 *  - Vaihtoja on koko runkosarjassa kaksi: yksi hyökkääjä ja yksi pakki.
 *  - Vain runkosarja lasketaan; pudotuspelit jätetään datan ulkopuolelle.
 */

import { addDays } from './time';

export type Position = 'F' | 'D';

export interface RosterEntry {
  playerId: number;
  position: Position;
  /** Kuului avauskokoonpanoon kauden alussa. */
  isStarter: boolean;
  slotOrder: number;
}

export interface Swap {
  position: Position;
  outPlayerId: number;
  inPlayerId: number;
  /** Ensimmäinen päivä (YYYY-MM-DD) jolta sisään tullut kerryttää pisteitä. */
  effectiveDate: string;
}

export interface GameStat {
  playerId: number;
  gameDate: string;
  goals: number;
  assists: number;
}

/** Puoliavoin aikaväli [from, to). `to === null` tarkoittaa kauden loppuun. */
export interface Interval {
  from: string;
  to: string | null;
}

export interface PlayerTally {
  playerId: number;
  position: Position;
  isStarter: boolean;
  slotOrder: number;
  /** Onko pelaaja tällä hetkellä pisteitä kerryttävässä kokoonpanossa. */
  active: boolean;
  /** Kokoonpanossa vietetyt aikavälit. Tyhjä = ei ole ollut mukana lainkaan. */
  intervals: Interval[];
  /** Joukkueen saldoon laskettavat suoritukset. */
  counted: StatLine;
  /** Kokoonpanon ulkopuolella kertyneet suoritukset. Vain tiedoksi. */
  bench: StatLine;
  /** Koko runkosarja riippumatta kokoonpanosta. Vain tiedoksi. */
  season: StatLine;
}

export interface StatLine {
  /**
   * Ottelut joissa pelaaja sai pisteitä. EI sama kuin pelatut ottelut:
   * rajapinta ei kerro kokoonpanoja, joten pisteetön ottelu ei näy tässä.
   * Varsinainen otteluiden määrä lasketaan player_daily-tilannekuvista.
   */
  scoringGames: number;
  goals: number;
  assists: number;
  points: number;
}

export interface TeamTally {
  teamId: string;
  players: PlayerTally[];
  /** Joukkueen yhteispisteet eli summa lasketuista pisteistä. */
  points: number;
  goals: number;
  assists: number;
  /** Vaihdot jäljellä positioittain. */
  swapsLeft: { F: number; D: number };
}

const EMPTY: StatLine = { scoringGames: 0, goals: 0, assists: 0, points: 0 };

/**
 * Laskee milloin pelaaja on ollut pisteitä kerryttävässä kokoonpanossa.
 *
 * Vaihtoja on korkeintaan yksi per positio, joten jokaiselle pelaajalle tulee
 * enintään yksi aikaväli. Funktio on silti kirjoitettu listana, jotta
 * useamman vaihdon salliminen myöhemmin ei riko rajapintaa.
 */
export function activeIntervals(
  entry: RosterEntry,
  swaps: Swap[],
  seasonStart: string,
): Interval[] {
  const swappedOut = swaps.find((s) => s.outPlayerId === entry.playerId);
  const swappedIn = swaps.find((s) => s.inPlayerId === entry.playerId);

  if (entry.isStarter) {
    // Avauspelaaja on mukana kauden alusta, kunnes hänet mahdollisesti
    // vaihdetaan pois.
    return [{ from: seasonStart, to: swappedOut ? swappedOut.effectiveDate : null }];
  }
  // Varapelaaja on mukana vasta vaihdosta eteenpäin.
  return swappedIn ? [{ from: swappedIn.effectiveDate, to: null }] : [];
}

function inIntervals(date: string, intervals: Interval[]): boolean {
  return intervals.some((iv) => date >= iv.from && (iv.to === null || date < iv.to));
}

function accumulate(target: StatLine, stat: GameStat): void {
  target.scoringGames += 1;
  target.goals += stat.goals;
  target.assists += stat.assists;
  target.points += stat.goals + stat.assists;
}

/**
 * Laskee yhden joukkueen tilanteen.
 *
 * `stats` saa sisältää minkä tahansa joukon ottelurivejä; vain tämän joukkueen
 * pelaajia koskevat rivit huomioidaan.
 */
export function tallyTeam(
  teamId: string,
  roster: RosterEntry[],
  swaps: Swap[],
  stats: GameStat[],
  seasonStart: string,
): TeamTally {
  const tallies = new Map<number, PlayerTally>();
  for (const entry of roster) {
    const intervals = activeIntervals(entry, swaps, seasonStart);
    tallies.set(entry.playerId, {
      playerId: entry.playerId,
      position: entry.position,
      isStarter: entry.isStarter,
      slotOrder: entry.slotOrder,
      active: intervals.some((iv) => iv.to === null),
      intervals,
      counted: { ...EMPTY },
      bench: { ...EMPTY },
      season: { ...EMPTY },
    });
  }

  for (const stat of stats) {
    const tally = tallies.get(stat.playerId);
    if (!tally) continue;
    accumulate(tally.season, stat);
    if (inIntervals(stat.gameDate, tally.intervals)) {
      accumulate(tally.counted, stat);
    } else {
      accumulate(tally.bench, stat);
    }
  }

  const players = [...tallies.values()].sort(
    (a, b) => Number(a.isStarter === b.isStarter ? 0 : a.isStarter ? -1 : 1) || a.slotOrder - b.slotOrder,
  );

  let points = 0;
  let goals = 0;
  let assists = 0;
  for (const p of players) {
    points += p.counted.points;
    goals += p.counted.goals;
    assists += p.counted.assists;
  }

  return {
    teamId,
    players,
    points,
    goals,
    assists,
    swapsLeft: {
      F: swaps.some((s) => s.position === 'F') ? 0 : 1,
      D: swaps.some((s) => s.position === 'D') ? 0 : 1,
    },
  };
}

/**
 * Kumulatiivinen pistekertymä päivittäin aikajanakuvaajaa varten.
 *
 * Palauttaa rivin jokaiselle päivälle jolta joukkueella on otteluita, sekä
 * kauden alun nollapisteen. Päivät ovat nousevassa järjestyksessä.
 */
export function cumulativeSeries(
  roster: RosterEntry[],
  swaps: Swap[],
  stats: GameStat[],
  seasonStart: string,
): { date: string; points: number }[] {
  const intervalsByPlayer = new Map<number, Interval[]>();
  for (const entry of roster) {
    intervalsByPlayer.set(entry.playerId, activeIntervals(entry, swaps, seasonStart));
  }

  const perDay = new Map<string, number>();
  for (const stat of stats) {
    const intervals = intervalsByPlayer.get(stat.playerId);
    if (!intervals || !inIntervals(stat.gameDate, intervals)) continue;
    const pts = stat.goals + stat.assists;
    if (pts === 0) continue;
    perDay.set(stat.gameDate, (perDay.get(stat.gameDate) ?? 0) + pts);
  }

  // Nollapiste ankkuroidaan kauden alkua edeltävään päivään, jottei
  // avauspäivänä tule kahta pistettä samalle päivämäärälle.
  const series: { date: string; points: number }[] = [
    { date: addDays(seasonStart, -1), points: 0 },
  ];
  let running = 0;
  for (const date of [...perDay.keys()].sort()) {
    running += perDay.get(date)!;
    series.push({ date, points: running });
  }
  return series;
}

/** Tarkistaa onko vaihto sallittu, ja kertoo syyn jos ei ole. */
export function validateSwap(
  roster: RosterEntry[],
  existingSwaps: Swap[],
  outPlayerId: number,
): { ok: true; position: Position; inPlayerId: number } | { ok: false; reason: string } {
  const out = roster.find((r) => r.playerId === outPlayerId);
  if (!out) return { ok: false, reason: 'Pelaaja ei ole tämän joukkueen kokoonpanossa.' };
  if (!out.isStarter) return { ok: false, reason: 'Varapelaajaa ei voi vaihtaa pois.' };

  const position = out.position;
  if (existingSwaps.some((s) => s.position === position)) {
    return {
      ok: false,
      reason:
        position === 'F'
          ? 'Hyökkääjävaihto on jo käytetty tällä kaudella.'
          : 'Pakkivaihto on jo käytetty tällä kaudella.',
    };
  }

  const sub = roster.find((r) => !r.isStarter && r.position === position);
  if (!sub) return { ok: false, reason: 'Vapaata varapelaajaa ei löydy.' };

  return { ok: true, position, inPlayerId: sub.playerId };
}
