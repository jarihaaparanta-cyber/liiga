/**
 * Aikavyöhykeapurit. Kaikki liigapörssin päivämäärät ovat Suomen
 * paikallisia kalenteripäiviä, eivät UTC-päiviä: ottelu joka päättyy
 * klo 21:45 Suomen aikaa kuuluu sen päivän saldoon vaikka UTC:ssä
 * kello olisi jo 18:45 samana päivänä tai talvella 19:45.
 */

export const HELSINKI = 'Europe/Helsinki';

/** Vaihdon takaraja: vaihto pitää tehdä ennen tätä kelloaikaa. */
export const SWAP_DEADLINE_HOUR = 14;

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HELSINKI,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Purkaa hetken Suomen paikallisajan osiin. */
export function helsinkiParts(at: Date): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // 'en-CA' palauttaa keskiyön muodossa "24" osalla ajoympäristöistä.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** Suomen paikallinen kalenteripäivä muodossa YYYY-MM-DD. */
export function helsinkiDate(at: Date): string {
  const { year, month, day } = helsinkiParts(at);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Lisää päivämäärään päiviä. Toimii pelkillä kalenteripäivillä. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) + days * 86_400_000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Milloin nyt tehty vaihto astuu voimaan.
 *
 * Sääntö: vaihto pitää tehdä ennen kierroksen alkua eli ennen klo 14.
 * Ennen klo 14 tehty vaihto pätee jo saman päivän otteluihin; sen jälkeen
 * tehty vasta seuraavasta päivästä.
 */
export function swapEffectiveDate(now: Date): string {
  const { hour } = helsinkiParts(now);
  const today = helsinkiDate(now);
  return hour < SWAP_DEADLINE_HOUR ? today : addDays(today, 1);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
