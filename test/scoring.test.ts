import { describe, expect, it } from 'vitest';
import {
  activeIntervals,
  cumulativeSeries,
  tallyTeam,
  validateSwap,
  type GameStat,
  type RosterEntry,
  type Swap,
} from '../src/scoring';

const SEASON_START = '2026-09-01';

// Apan kokoonpano: 3 hyökkääjää, 2 pakkia, varahyökkääjä ja varapakki.
const roster: RosterEntry[] = [
  { playerId: 1, position: 'F', isStarter: true, slotOrder: 1 },
  { playerId: 2, position: 'F', isStarter: true, slotOrder: 2 },
  { playerId: 3, position: 'F', isStarter: true, slotOrder: 3 },
  { playerId: 4, position: 'D', isStarter: true, slotOrder: 4 },
  { playerId: 5, position: 'D', isStarter: true, slotOrder: 5 },
  { playerId: 6, position: 'F', isStarter: false, slotOrder: 6 },
  { playerId: 7, position: 'D', isStarter: false, slotOrder: 7 },
];

function stat(playerId: number, gameDate: string, goals: number, assists: number): GameStat {
  return { playerId, gameDate, goals, assists };
}

describe('activeIntervals', () => {
  it('pitää avauspelaajan mukana kauden alusta loputtomiin ilman vaihtoja', () => {
    expect(activeIntervals(roster[0]!, [], SEASON_START)).toEqual([
      { from: SEASON_START, to: null },
    ]);
  });

  it('jättää varapelaajan kokonaan ulkopuolelle ennen vaihtoa', () => {
    expect(activeIntervals(roster[5]!, [], SEASON_START)).toEqual([]);
  });

  it('katkaisee ulos vaihdetun pelaajan vaihtopäivään', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 1, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    expect(activeIntervals(roster[0]!, swaps, SEASON_START)).toEqual([
      { from: SEASON_START, to: '2026-10-15' },
    ]);
    expect(activeIntervals(roster[5]!, swaps, SEASON_START)).toEqual([
      { from: '2026-10-15', to: null },
    ]);
  });
});

describe('tallyTeam', () => {
  it('laskee vain avauskokoonpanon pisteet kun vaihtoja ei ole tehty', () => {
    const stats = [
      stat(1, '2026-09-10', 1, 1), // avaus, lasketaan
      stat(4, '2026-09-10', 0, 2), // avaus, lasketaan
      stat(6, '2026-09-10', 3, 0), // varahyökkääjä penkillä, ei lasketa
    ];
    const team = tallyTeam('apa', roster, [], stats, SEASON_START);

    expect(team.points).toBe(4);
    const sub = team.players.find((p) => p.playerId === 6)!;
    expect(sub.counted.points).toBe(0);
    expect(sub.bench.points).toBe(3);
    expect(sub.season.points).toBe(3);
    expect(sub.active).toBe(false);
  });

  it('siirtää pisteytyksen vaihtopäivänä varapelaajalle mutta säilyttää vanhat pisteet', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 1, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    const stats = [
      stat(1, '2026-10-14', 1, 0), // ennen vaihtoa: lasketaan ulos jääneelle
      stat(1, '2026-10-15', 5, 5), // vaihtopäivänä: ei enää lasketa
      stat(6, '2026-10-14', 9, 9), // ennen vaihtoa: penkkipisteitä
      stat(6, '2026-10-15', 0, 2), // vaihtopäivästä: lasketaan
    ];
    const team = tallyTeam('apa', roster, swaps, stats, SEASON_START);

    const out = team.players.find((p) => p.playerId === 1)!;
    const inn = team.players.find((p) => p.playerId === 6)!;

    expect(out.counted.points).toBe(1);
    expect(out.bench.points).toBe(10);
    expect(inn.counted.points).toBe(2);
    expect(inn.bench.points).toBe(18);
    expect(team.points).toBe(3);
    expect(out.active).toBe(false);
    expect(inn.active).toBe(true);
  });

  it('laskee otteluiden määrän vain kokoonpanossa vietetyltä ajalta', () => {
    const swaps: Swap[] = [
      { position: 'D', outPlayerId: 4, inPlayerId: 7, effectiveDate: '2026-10-15' },
    ];
    const stats = [
      stat(4, '2026-10-13', 0, 0),
      stat(4, '2026-10-14', 0, 0),
      stat(4, '2026-10-16', 0, 0),
    ];
    const team = tallyTeam('apa', roster, swaps, stats, SEASON_START);
    const out = team.players.find((p) => p.playerId === 4)!;

    expect(out.counted.games).toBe(2);
    expect(out.bench.games).toBe(1);
    expect(out.season.games).toBe(3);
  });

  it('kertoo montako vaihtoa on jäljellä', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 2, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    const team = tallyTeam('apa', roster, swaps, [], SEASON_START);
    expect(team.swapsLeft).toEqual({ F: 0, D: 1 });
  });

  it('ohittaa rivit joiden pelaaja ei kuulu joukkueeseen', () => {
    const team = tallyTeam('apa', roster, [], [stat(999, '2026-09-10', 4, 4)], SEASON_START);
    expect(team.points).toBe(0);
  });
});

describe('cumulativeSeries', () => {
  it('kasvattaa käyrää vain lasketuista pisteistä', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 1, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    const stats = [
      stat(1, '2026-09-10', 1, 0),
      stat(6, '2026-09-10', 4, 0), // penkillä, ei näy käyrässä
      stat(1, '2026-10-20', 3, 0), // pois vaihdettu, ei näy käyrässä
      stat(6, '2026-10-20', 0, 2),
    ];
    expect(cumulativeSeries(roster, swaps, stats, SEASON_START)).toEqual([
      { date: SEASON_START, points: 0 },
      { date: '2026-09-10', points: 1 },
      { date: '2026-10-20', points: 3 },
    ]);
  });
});

describe('validateSwap', () => {
  it('tarjoaa oikean position varapelaajan', () => {
    const result = validateSwap(roster, [], 4);
    expect(result).toEqual({ ok: true, position: 'D', inPlayerId: 7 });
  });

  it('estää varapelaajan vaihtamisen pois', () => {
    const result = validateSwap(roster, [], 6);
    expect(result.ok).toBe(false);
  });

  it('estää toisen saman position vaihdon', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 1, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    const result = validateSwap(roster, swaps, 2);
    expect(result.ok).toBe(false);
  });

  it('sallii pakkivaihdon vaikka hyökkääjävaihto olisi käytetty', () => {
    const swaps: Swap[] = [
      { position: 'F', outPlayerId: 1, inPlayerId: 6, effectiveDate: '2026-10-15' },
    ];
    expect(validateSwap(roster, swaps, 5)).toEqual({ ok: true, position: 'D', inPlayerId: 7 });
  });

  it('torjuu vieraan pelaajan', () => {
    expect(validateSwap(roster, [], 999).ok).toBe(false);
  });
});
