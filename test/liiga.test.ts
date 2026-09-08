import { describe, expect, it } from 'vitest';
import { countsAsScoring, extractStats, toPosition, type LiigaGame } from '../src/liiga';
import { playersInLiveGames } from '../src/sync';
import fixture from './fixtures/games.json';

// Oikeaa liiga.fi-dataa kaudelta 2026-27: kolme päättynyttä ottelua ja yksi
// alkamaton. Mukana sekä voittolaukaus (VL) että maaliton rangaistuslaukaus
// (RL0), jotka eivät saa näkyä pisteinä.
const games = fixture as unknown as LiigaGame[];

describe('countsAsScoring', () => {
  it('hyväksyy tavallisen maalin', () => {
    expect(countsAsScoring({ scorerPlayerId: 1, assistantPlayerIds: [], goalTypes: [], goalsSoFarInSeason: 3 })).toBe(true);
  });

  it('hyväksyy ylivoima-, alivoima- ja tyhjän maalin', () => {
    for (const type of ['YV', 'AV', 'TM', 'IM', 'VT0', 'SR']) {
      expect(
        countsAsScoring({ scorerPlayerId: 1, assistantPlayerIds: [], goalTypes: [type], goalsSoFarInSeason: 1 }),
      ).toBe(true);
    }
  });

  it('hylkää voittolaukauksen ja maalittoman rangaistuslaukauksen', () => {
    for (const type of ['VL', 'RL0']) {
      expect(
        countsAsScoring({ scorerPlayerId: 1, assistantPlayerIds: [], goalTypes: [type], goalsSoFarInSeason: 0 }),
      ).toBe(false);
    }
  });

  it('hylkää tapahtuman jossa kauden maalimäärä on nolla vaikka tyyppi olisi tuntematon', () => {
    expect(
      countsAsScoring({ scorerPlayerId: 1, assistantPlayerIds: [], goalTypes: ['UUSI'], goalsSoFarInSeason: 0 }),
    ).toBe(false);
  });

  it('ei kaadu puuttuviin kenttiin', () => {
    expect(countsAsScoring({ scorerPlayerId: 1, assistantPlayerIds: null, goalTypes: null })).toBe(true);
  });
});

describe('extractStats', () => {
  const { games: rows, stats } = extractStats(games);

  it('palauttaa rivin jokaisesta ottelusta ja merkitsee keskeneräiset', () => {
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.finished)).toHaveLength(3);
  });

  it('käyttää Suomen paikallista ottelupäivää', () => {
    // start "2026-09-01T15:30:00Z" on Suomessa 1.9. klo 18:30.
    expect(rows.find((r) => r.id === 2701274)!.gameDate).toBe('2026-09-01');
    expect(rows.find((r) => r.id === 2701286)!.gameDate).toBe('2026-09-05');
  });

  it('ei tuota suorituksia keskeneräisestä ottelusta', () => {
    expect(stats.some((s) => s.gameId === 2701291)).toBe(false);
  });

  it('jättää voittolaukausmaalin pois', () => {
    // George Diaco teki ottelussa 2701280 kaksi maalia ja lisäksi
    // voittolaukauksen, joka ei ole pelaajan maali.
    const diaco = stats.find((s) => s.playerId === 61073932 && s.gameId === 2701280);
    expect(diaco).toBeDefined();
    expect(diaco!.goals).toBe(2); // ei 3, vaikka tapahtumia on kolme

    // Ottelussa oli 9 maalitapahtumaa, joista yksi VL.
    const totalGoals = stats.filter((s) => s.gameId === 2701280).reduce((n, s) => n + s.goals, 0);
    expect(totalGoals).toBe(8);
  });

  it('jättää maalittoman rangaistuslaukauksen pois', () => {
    // Ottelussa 2701286 oli 5 maalitapahtumaa, joista yksi RL0.
    const totalGoals = stats.filter((s) => s.gameId === 2701286).reduce((n, s) => n + s.goals, 0);
    expect(totalGoals).toBe(4);
  });

  it('kokoaa saman pelaajan useat maalit yhdeksi riviksi per ottelu', () => {
    const keys = stats.map((s) => `${s.playerId}:${s.gameId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('kirjaa syötöt maalintekijän lisäksi', () => {
    const withAssists = stats.filter((s) => s.assists > 0);
    expect(withAssists.length).toBeGreaterThan(0);
  });

  it('ohittaa muut kuin runkosarjaottelut', () => {
    const playoff = [{ ...games[0]!, id: 999, serie: 'PLAYOFFS' }];
    expect(extractStats(playoff).games).toHaveLength(0);
  });
});

describe('toPosition', () => {
  it('kääntää rajapinnan roolikoodit', () => {
    expect(toPosition('H')).toBe('F');
    expect(toPosition('P')).toBe('D');
    expect(toPosition('MV')).toBe('G');
  });
});

describe('playersInLiveGames', () => {
  const live = (over: Partial<LiigaGame> = {}): LiigaGame =>
    ({
      id: 1,
      start: '2026-09-08T15:30:00Z',
      started: true,
      ended: false,
      serie: 'RUNKOSARJA',
      homeTeam: {
        teamName: 'HPK',
        goalEvents: [
          { scorerPlayerId: 11, assistantPlayerIds: [22, 33], goalTypes: [], goalsSoFarInSeason: 1 },
        ],
      },
      awayTeam: { teamName: 'Ilves', goalEvents: [] },
      ...over,
    }) as LiigaGame;

  it('kerää maalintekijät ja syöttäjät käynnissä olevasta ottelusta', () => {
    expect([...playersInLiveGames([live()])].sort((a, b) => a - b)).toEqual([11, 22, 33]);
  });

  it('ohittaa päättyneen ottelun', () => {
    expect(playersInLiveGames([live({ ended: true })]).size).toBe(0);
  });

  it('ohittaa alkamattoman ottelun', () => {
    expect(playersInLiveGames([live({ started: false })]).size).toBe(0);
  });
});
