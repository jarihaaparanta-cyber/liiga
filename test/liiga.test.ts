import { describe, expect, it } from 'vitest';
import {
  countsAsScoring,
  extractStats,
  goalsFromGame,
  statsFromGame,
  toPosition,
  type LiigaGame,
} from '../src/liiga';
import { playersInLiveGames, summaryCutoff, verify } from '../src/sync';
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

describe('statsFromGame', () => {
  it('laskee myös kesken olevan ottelun siihenastiset pisteet', () => {
    const kesken = {
      id: 99,
      start: '2026-09-08T15:30:00Z',
      started: true,
      ended: false,
      serie: 'RUNKOSARJA',
      homeTeam: { teamName: 'HPK', goalEvents: [] },
      awayTeam: {
        teamName: 'Ilves',
        goalEvents: [
          { scorerPlayerId: 7, assistantPlayerIds: [8], goalTypes: [], goalsSoFarInSeason: 2 },
          { scorerPlayerId: 7, assistantPlayerIds: [], goalTypes: ['YV'], goalsSoFarInSeason: 3 },
        ],
      },
    } as unknown as LiigaGame;

    expect(statsFromGame(kesken, '2026-09-08')).toEqual([
      { playerId: 7, gameId: 99, gameDate: '2026-09-08', goals: 2, assists: 0 },
      { playerId: 8, gameId: 99, gameDate: '2026-09-08', goals: 0, assists: 1 },
    ]);
  });

  it('jättää voittolaukauksen pois myös kesken ottelun', () => {
    const kesken = {
      id: 98,
      homeTeam: {
        teamName: 'HPK',
        goalEvents: [
          { scorerPlayerId: 5, assistantPlayerIds: [], goalTypes: ['VL'], goalsSoFarInSeason: 0 },
        ],
      },
      awayTeam: { teamName: 'Ilves', goalEvents: [] },
    } as unknown as LiigaGame;

    expect(statsFromGame(kesken, '2026-09-08')).toEqual([]);
  });
});

describe('goalsFromGame', () => {
  const peli = games.find((g) => g.id === 2701280)!;

  it('jättää voittolaukauksen pois myös tapahtumalistalta', () => {
    const maalit = goalsFromGame(peli);
    // Ottelussa oli 9 maalitapahtumaa, joista yksi voittolaukaus.
    expect(maalit).toHaveLength(8);
  });

  it('palauttaa maalit peliajan mukaisessa järjestyksessä', () => {
    const ajat = goalsFromGame(peli).map((g) => g.gameTime ?? 0);
    expect(ajat).toEqual([...ajat].sort((a, b) => a - b));
  });

  it('antaa kotijoukkueen ja vierasjoukkueen maaleille eri tunnisteet', () => {
    const ids = goalsFromGame(peli).map((g) => g.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('poimii maalintekijän ja syöttäjät', () => {
    const maali = goalsFromGame(peli).find((g) => g.assistIds.length > 0)!;
    expect(maali.scorerId).toBeGreaterThan(0);
    expect(maali.assistIds.length).toBeGreaterThan(0);
    expect(maali.team).toBeTruthy();
  });
});

describe('verify', () => {
  const today = '2026-09-21';
  const stat = (playerId: number, gameDate: string, goals: number, assists: number) => ({
    playerId,
    gameId: Number(gameDate.replaceAll('-', '')),
    gameDate,
    goals,
    assists,
  });
  const official = (playerId: number, goals: number, assists: number) => ({
    playerId,
    firstName: 'Testi',
    lastName: `Pelaaja${playerId}`,
    goals,
    assists,
  });

  it('ei raportoi mitään kun luvut täsmäävät', () => {
    const stats = [stat(1, '2026-09-01', 1, 0), stat(1, '2026-09-19', 0, 1)];
    expect(verify(stats, [official(1, 1, 1)], new Set(), today)).toEqual([]);
  });

  it('vaikenee kun kooste laahaa tuoreiden otteluiden verran jäljessä', () => {
    // Kooste ei vielä tunne 19.9. pelattua ottelua.
    const stats = [stat(1, '2026-09-01', 1, 0), stat(1, '2026-09-19', 1, 1)];
    expect(verify(stats, [official(1, 1, 0)], new Set(), today)).toEqual([]);
  });

  it('raportoi eron joka ei mahdu tuoreisiin otteluihin', () => {
    // Tuoreessa ottelussa vain yksi maali, mutta ero on kaksi.
    const stats = [stat(1, '2026-09-01', 1, 0), stat(1, '2026-09-19', 1, 0)];
    expect(verify(stats, [official(1, 0, 0)], new Set(), today)).toHaveLength(1);
  });

  it('raportoi eron vanhoissa otteluissa', () => {
    const stats = [stat(1, '2026-09-01', 2, 0)];
    expect(verify(stats, [official(1, 1, 0)], new Set(), today)).toEqual([
      'Testi Pelaaja1: virallinen 1+0, laskettu 2+0',
    ]);
  });

  it('raportoi kun kooste on omaa laskentaa edellä', () => {
    const stats = [stat(1, '2026-09-19', 1, 0)];
    expect(verify(stats, [official(1, 2, 0)], new Set(), today)).toHaveLength(1);
  });

  it('ohittaa erikseen ohitettavat pelaajat', () => {
    const stats = [stat(1, '2026-09-01', 2, 0)];
    expect(verify(stats, [official(1, 1, 0)], new Set([1]), today)).toEqual([]);
  });

  describe('viikkoja jumissa oleva kooste', () => {
    const late = '2026-11-14';
    // Kooste tuntee vain 24.10. asti pelatut ottelut.
    const stats = [
      stat(1, '2026-10-01', 1, 0),
      stat(2, '2026-10-24', 0, 1),
      stat(1, '2026-10-30', 2, 1),
      stat(2, '2026-11-11', 1, 0),
      // Muiden pelaajien pisteitä koosteen jälkeen: kooste on selvästi jäljessä.
      stat(4, '2026-11-13', 10, 10),
    ];
    const summed = [official(1, 1, 0), official(2, 0, 1), official(4, 0, 0)];

    it('päättelee mihin asti kooste on päivitetty', () => {
      expect(summaryCutoff(stats, summed)).toBe('2026-10-24');
    });

    it('vaikenee kun ero mahtuu koosteen jälkeen pelattuihin otteluihin', () => {
      expect(verify(stats, summed, new Set(), late)).toEqual([]);
    });

    it('raportoi silti eron koosteen tuntemissa otteluissa', () => {
      // Pelaaja 3:n maali on 15.9., selvästi ennen koosteen rajapäivää.
      const withError = [...stats, stat(3, '2026-09-15', 1, 0)];
      const summedWithError = [...summed, official(3, 0, 0)];
      expect(verify(withError, summedWithError, new Set(), late)).toEqual([
        'Testi Pelaaja3: virallinen 0+0, laskettu 1+0',
      ]);
    });

    it('ei palauta päivää kun kooste on ajan tasalla', () => {
      const fresh = [official(1, 3, 1), official(2, 1, 1), official(4, 10, 10)];
      expect(summaryCutoff(stats, fresh)).toBeNull();
    });

    it('ei tulkitse pientä eroa jumiutumiseksi', () => {
      const almost = [official(1, 3, 1), official(2, 1, 1), official(4, 5, 5)];
      expect(summaryCutoff(stats, almost)).toBeNull();
    });
  });
});
