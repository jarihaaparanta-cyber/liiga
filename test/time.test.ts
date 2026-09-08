import { describe, expect, it } from 'vitest';
import { addDays, helsinkiDate, helsinkiTime, swapEffectiveDate } from '../src/time';

describe('helsinkiDate', () => {
  it('käyttää Suomen paikallista päivää eikä UTC-päivää', () => {
    // 21:30 Suomen kesäaikaa on 18:30 UTC samana päivänä.
    expect(helsinkiDate(new Date('2026-10-15T18:30:00Z'))).toBe('2026-10-15');
    // Keskiyön jälkeen Suomessa on jo seuraava päivä vaikka UTC on edellisessä.
    expect(helsinkiDate(new Date('2026-10-15T22:30:00Z'))).toBe('2026-10-16');
  });

  it('toimii myös talviajalla', () => {
    expect(helsinkiDate(new Date('2026-12-15T22:30:00Z'))).toBe('2026-12-16');
    expect(helsinkiDate(new Date('2026-12-15T21:30:00Z'))).toBe('2026-12-15');
  });
});

describe('addDays', () => {
  it('siirtyy kuukauden ja vuoden yli', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });
});

describe('swapEffectiveDate', () => {
  it('pätee samana päivänä kun vaihto tehdään ennen klo 14', () => {
    // 10:00 Suomen kesäaikaa = 07:00 UTC
    expect(swapEffectiveDate(new Date('2026-10-15T07:00:00Z'))).toBe('2026-10-15');
  });

  it('siirtyy seuraavaan päivään kun vaihto tehdään klo 14 jälkeen', () => {
    // 14:00 Suomen kesäaikaa = 11:00 UTC
    expect(swapEffectiveDate(new Date('2026-10-15T11:00:00Z'))).toBe('2026-10-16');
    expect(swapEffectiveDate(new Date('2026-10-15T18:00:00Z'))).toBe('2026-10-16');
  });

  it('käsittelee talviajan rajan oikein', () => {
    // Talvella 13:59 Suomen aikaa = 11:59 UTC
    expect(swapEffectiveDate(new Date('2026-12-15T11:59:00Z'))).toBe('2026-12-15');
    expect(swapEffectiveDate(new Date('2026-12-15T12:00:00Z'))).toBe('2026-12-16');
  });
});

describe('helsinkiTime', () => {
  it('muuntaa UTC-ajan Suomen kellonajaksi kesällä', () => {
    expect(helsinkiTime(new Date('2026-09-08T15:30:00Z'))).toBe('18:30');
  });

  it('toimii myös talviajalla', () => {
    expect(helsinkiTime(new Date('2026-12-15T15:30:00Z'))).toBe('17:30');
  });

  it('näyttää keskiyön muodossa 00:00', () => {
    expect(helsinkiTime(new Date('2026-09-08T21:00:00Z'))).toBe('00:00');
  });
});
