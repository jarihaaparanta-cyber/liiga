/**
 * Liigapörssin Worker: staattinen sivusto, API ja ajastettu päivitys.
 */

import { loadStandings } from './standings';
import { sync, type SyncKind } from './sync';
import { helsinkiParts, swapEffectiveDate } from './time';
import { validateSwap, type Position, type RosterEntry, type Swap } from './scoring';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SEASON: string;
  SEASON_START: string;
  /** Salasana käsin käynnistettävälle päivitykselle. Asetetaan secretinä. */
  ADMIN_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await route(request, env, url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, 500);
    }
  },

  /**
   * Cronit on ajastettu sekä kesä- että talviajan mukaan, joten sama
   * kellonaika osuu kahteen UTC-hetkeen. Suomen paikallinen tunti ratkaisee
   * kumpi niistä oikeasti ajaa.
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date(event.scheduledTime);
    const { hour } = helsinkiParts(now);

    let kind: SyncKind | null = null;
    if (hour === 21) kind = 'nightly';
    else if (hour === 4) kind = 'correction';
    if (!kind) return;

    ctx.waitUntil(sync(env.DB, env.SEASON, kind, now));
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === '/api/standings' && request.method === 'GET') {
    return json(await loadStandings(env.DB, env.SEASON_START));
  }

  if (url.pathname === '/api/swap' && request.method === 'POST') {
    return handleSwap(request, env);
  }

  if (url.pathname === '/api/sync' && request.method === 'POST') {
    if (!env.ADMIN_TOKEN || request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
      return json({ error: 'Ei oikeuksia.' }, 401);
    }
    const kind = (url.searchParams.get('kind') ?? 'manual') as SyncKind;
    return json(await sync(env.DB, env.SEASON, kind));
  }

  return json({ error: 'Tuntematon osoite.' }, 404);
}

interface SwapRequest {
  teamId?: string;
  outPlayerId?: number;
  pin?: string;
}

async function handleSwap(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as SwapRequest;
  const { teamId, outPlayerId, pin } = body;
  if (!teamId || typeof outPlayerId !== 'number') {
    return json({ error: 'Puuttuva joukkue tai pelaaja.' }, 400);
  }

  const team = await env.DB.prepare('SELECT id, name, pin_hash FROM fantasy_teams WHERE id = ?')
    .bind(teamId)
    .first<{ id: string; name: string; pin_hash: string | null }>();
  if (!team) return json({ error: 'Tuntematon joukkue.' }, 404);

  if (!team.pin_hash) {
    return json({ error: 'Joukkueelle ei ole asetettu tunnussanaa, joten vaihtoa ei voi tehdä.' }, 403);
  }
  if (!pin || (await hashPin(teamId, pin)) !== team.pin_hash) {
    return json({ error: 'Väärä tunnussana.' }, 403);
  }

  const rosterRows = await env.DB.prepare(
    'SELECT player_id, position, is_starter, slot_order FROM roster WHERE team_id = ?',
  )
    .bind(teamId)
    .all<{ player_id: number; position: Position; is_starter: number; slot_order: number }>();
  const roster: RosterEntry[] = (rosterRows.results ?? []).map((r) => ({
    playerId: r.player_id,
    position: r.position,
    isStarter: r.is_starter === 1,
    slotOrder: r.slot_order,
  }));

  const swapRows = await env.DB.prepare(
    'SELECT position, out_player_id, in_player_id, effective_date FROM swaps WHERE team_id = ?',
  )
    .bind(teamId)
    .all<{ position: Position; out_player_id: number; in_player_id: number; effective_date: string }>();
  const existing: Swap[] = (swapRows.results ?? []).map((s) => ({
    position: s.position,
    outPlayerId: s.out_player_id,
    inPlayerId: s.in_player_id,
    effectiveDate: s.effective_date,
  }));

  const check = validateSwap(roster, existing, outPlayerId);
  if (!check.ok) return json({ error: check.reason }, 400);

  const effectiveDate = swapEffectiveDate(new Date());

  // Uniikki indeksi (team_id, position) on varsinainen tae siitä ettei
  // samaa vaihtoa tehdä kahdesti, esimerkiksi tuplaklikkauksella.
  try {
    await env.DB.prepare(
      `INSERT INTO swaps (team_id, position, out_player_id, in_player_id, effective_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(teamId, check.position, outPlayerId, check.inPlayerId, effectiveDate, new Date().toISOString())
      .run();
  } catch {
    return json({ error: 'Vaihto on jo tehty.' }, 409);
  }

  return json({ ok: true, position: check.position, inPlayerId: check.inPlayerId, effectiveDate });
}

/** Tunnussanan tiiviste. Joukkueen tunnus on suolana. */
export async function hashPin(teamId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`liigaporssi:${teamId}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
