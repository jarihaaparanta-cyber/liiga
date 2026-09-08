/*
 * Stiga Pörssi -käyttöliittymä.
 *
 * Ei riippuvuuksia: kuvaaja piirretään SVG:nä käsin, jolloin sivu latautuu
 * yhdellä pyynnöllä eikä ulkoisia skriptejä tarvita.
 */

const NBSP = ' ';

/*
 * Joukkueen tunniste -> pelaajan kasvot bannerista.
 *
 * Kasvot viivan kärjessä tunnistavat joukkueen ilman väriä, joten
 * viivakuvioita ja erilaisia merkkimuotoja ei tarvita. Sama kuva toistuu
 * selitteessä.
 */
const HEADS = {
  apa: 'img/head-apa.webp',
  jarde: 'img/head-jarde.webp',
  borje: 'img/head-borje.webp',
  niksu: 'img/head-niksu.webp',
};

/** Vaaka-akselin merkintöjen määrä. */
const TICK_COUNT = 4;

const state = { data: null, view: 'chart', swap: null };

init();

async function init() {
  handleMissingImages();
  wireViewToggle();
  wireDialog();
  await load();
  window.addEventListener('resize', debounce(() => renderChart(), 150));
}

async function load() {
  try {
    const response = await fetch('/api/standings');
    if (!response.ok) throw new Error(`Palvelin vastasi ${response.status}`);
    state.data = await response.json();
  } catch (error) {
    document.getElementById('leaderboard').innerHTML =
      `<li class="notice">Tilanteen haku epäonnistui: ${escapeHtml(String(error.message ?? error))}</li>`;
    return;
  }
  renderAll();
}

function renderAll() {
  renderNotice();
  renderLeaderboard();
  renderChart();
  renderChartTable();
  renderTeams();
  renderSchedule();
  renderUpdated();
}

/* ---------------- Kärkitilanne ---------------- */

function renderLeaderboard() {
  const teams = [...state.data.teams].sort((a, b) => b.points - a.points);
  const list = document.getElementById('leaderboard');
  list.innerHTML = teams
    .map((team, index) => {
      const place = index + 1;
      // Tasapisteissä ei jaeta eri sijoja.
      const shared = teams.filter((t) => t.points === team.points).length > 1;
      return `
        <li class="rank" style="--team:${escapeAttr(team.color)}">
          <span class="rank__place">${shared ? `jaettu ${place}.` : `${place}.`}</span>
          <span class="rank__name">${escapeHtml(team.name)}</span>
          <span class="rank__points">${team.points}</span>
          <span class="rank__unit">pistettä</span>
        </li>`;
    })
    .join('');
}

function renderNotice() {
  const { warning } = state.data;
  const existing = document.querySelector('.notice.js-sync');
  if (existing) existing.remove();
  if (!warning) return;
  const el = document.createElement('p');
  el.className = 'notice js-sync';
  el.textContent =
    'Huomio: laskennassa on poikkeama liiga.fi:n virallisiin lukuihin verrattuna. ' +
    warning;
  document.getElementById('tilanne').prepend(el);
}

function renderUpdated() {
  const el = document.getElementById('updated');
  if (!state.data.updatedAt) {
    el.textContent = 'Pisteitä ei ole vielä haettu.';
    return;
  }
  const when = new Date(state.data.updatedAt);
  el.textContent = `Päivitetty ${when.toLocaleString('fi-FI', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Helsinki',
  })}.`;
}

/* ---------------- Kuvaaja ---------------- */

function wireViewToggle() {
  for (const button of document.querySelectorAll('.toggle__btn')) {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      for (const other of document.querySelectorAll('.toggle__btn')) {
        const on = other === button;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-pressed', String(on));
      }
      document.getElementById('chart-figure').hidden = state.view !== 'chart';
      document.getElementById('chart-table').hidden = state.view !== 'table';
      if (state.view === 'chart') renderChart();
    });
  }
}

/** Joukkueen pistesaldo annettuna päivänä: viimeisin arvo joka on <= päivä. */
function valueAt(series, date) {
  let value = 0;
  for (const point of series) {
    if (point.date > date) break;
    value = point.points;
  }
  return value;
}

function renderChart() {
  const host = document.getElementById('chart');
  const teams = state.data?.teams ?? [];
  const dates = [...new Set(teams.flatMap((t) => t.series.map((p) => p.date)))].sort();

  if (dates.length < 2) {
    host.innerHTML = '<p class="chart__caption">Kuvaaja piirtyy kun otteluita on pelattu.</p>';
    return;
  }

  // Piirretään säiliön todelliselle leveydelle: kiinteä viewBox pienensi
  // tekstit lukukelvottomiksi kapealla näytöllä ja pakotti vierittämään.
  const available = Math.floor(host.clientWidth || host.parentElement?.clientWidth || 900);
  if (available < 40) return; // säiliö on piilossa, piirretään kun se näkyy
  const W = Math.max(280, available);
  const narrow = W < 560;

  // Kapealla näytöllä nimeä ja pistelukua ei mahdu viivan viereen, joten
  // kärjessä on pelkkä kasvokuva. Nimet näkyvät selitteessä ja pisteet
  // kuvaajan yläpuolisissa korteissa.
  const H = narrow ? 260 : 360;
  const headR = narrow ? 11 : 15;
  const M = {
    top: 14,
    right: narrow ? headR * 2 + 8 : 128,
    bottom: narrow ? 28 : 34,
    left: narrow ? 30 : 44,
  };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const t0 = Date.parse(dates[0]);
  const t1 = Date.parse(dates[dates.length - 1]);
  const span = Math.max(1, t1 - t0);
  const maxPoints = Math.max(4, ...teams.map((t) => Math.max(...t.series.map((p) => p.points))));
  const yTop = niceCeil(maxPoints);

  const x = (date) => M.left + ((Date.parse(date) - t0) / span) * plotW;
  const y = (points) => M.top + plotH - (points / yTop) * plotH;

  const ticks = axisTicks(yTop);
  const gridlines = ticks
    .map(
      (value) =>
        `<line class="grid-line" x1="${M.left}" y1="${y(value)}" x2="${M.left + plotW}" y2="${y(value)}"/>` +
        `<text class="axis-text" x="${M.left - 8}" y="${y(value) + 4}" text-anchor="end">${value}</text>`,
    )
    .join('');

  const dateTicks = pickDateTicks(dates, narrow ? 3 : 6);
  const xLabels = dateTicks
    .map(
      (date) =>
        `<text class="axis-text" x="${x(date)}" y="${H - 12}" text-anchor="middle">${shortDate(date)}</text>`,
    )
    .join('');

  // Kärkimerkinnät sijoitetaan ensin oikeille korkeuksilleen ja siirretään
  // sitten erilleen, jottei tasapisteissä oleva kasvokuva peitä toista.
  const ends = layoutEndLabels(
    teams.map((team) => {
      const last = team.series[team.series.length - 1];
      return { team, points: last.points, valueY: y(last.points) };
    }),
    M.top + headR,
    M.top + plotH - headR,
    headR * 2 + 4,
  );

  const headX = M.left + plotW + headR + 4;
  const series = ends
    .map(({ team, points, valueY, labelY }) => {
      // Viisto viiva pisteestä pisteeseen. Viimeisestä ottelupäivästä
      // oikeaan reunaan viiva jatkuu vaakasuorana, koska uusia pisteitä ei
      // ole vielä tullut.
      let d = '';
      team.series.forEach((point, index) => {
        d += `${index === 0 ? 'M' : ' L'}${x(point.date)} ${y(point.points)}`;
      });
      d += ` L${M.left + plotW} ${valueY}`;

      const dots = team.series
        .slice(1)
        .map(
          (point) =>
            `<circle class="series-dot" cx="${x(point.date)}" cy="${y(point.points)}" r="${narrow ? 2.5 : 3.5}" ` +
            `fill="${escapeAttr(team.color)}"/>`,
        )
        .join('');

      return (
        `<path class="series-line" d="${d}" stroke="${escapeAttr(team.color)}"/>${dots}` +
        // Ohut yhdysviiva viivan päästä kasvokuvaan, kun merkintää on jouduttu siirtämään.
        `<path class="series-leader" d="M${M.left + plotW} ${valueY} L${headX - headR} ${labelY}" ` +
        `stroke="${escapeAttr(team.color)}"/>` +
        headBadge(team, headX, labelY, headR) +
        (narrow
          ? ''
          : `<text class="series-label" x="${headX + headR + 6}" y="${labelY + 4}" ` +
            `fill="${escapeAttr(team.color)}">${escapeHtml(team.name)} ${points}</text>`)
      );
    })
    .join('');

  host.innerHTML =
    renderLegend(teams) +
    `<div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Joukkueiden pistekertymä runkosarjan aikana">
        ${gridlines}${xLabels}${series}
        <line class="crosshair" id="crosshair" x1="0" y1="${M.top}" x2="0" y2="${M.top + plotH}" style="display:none"/>
        <rect id="hit" x="${M.left}" y="${M.top}" width="${plotW}" height="${plotH}" fill="transparent"/>
      </svg>
    </div>`;

  wireHover(host, { M, plotW, plotH, t0, span, dates });
}

function renderLegend(teams) {
  const items = teams
    .map(
      (team) => `<li>
        <span class="legend-head" style="--team:${escapeAttr(team.color)}">
          <img src="${escapeAttr(HEADS[team.id] ?? '')}" alt="" width="22" height="22">
        </span>
        <span>${escapeHtml(team.name)}</span>
      </li>`,
    )
    .join('');
  return `<ul class="legend">${items}</ul>`;
}

/** Pyöreäksi rajattu kasvokuva joukkueen värisellä kehyksellä. */
function headBadge(team, cx, cy, r) {
  const src = HEADS[team.id];
  if (!src) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${escapeAttr(team.color)}"/>`;
  }
  const id = `head-${escapeAttr(team.id)}`;
  return (
    `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>` +
    `<image href="${escapeAttr(src)}" x="${cx - r}" y="${cy - r}" ` +
    `width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ` +
    `stroke="${escapeAttr(team.color)}" stroke-width="2.5"/>`
  );
}

/**
 * Siirtää kärkimerkinnät erilleen niin etteivät kasvokuvat mene päällekkäin.
 *
 * Merkinnät järjestetään ylhäältä alas, työnnetään alaspäin kunnes väli
 * riittää, ja lopuksi koko rypäs nostetaan takaisin alueen sisään jos se
 * valui alareunan yli.
 */
function layoutEndLabels(entries, minY, maxY, gap) {
  const sorted = [...entries].sort((a, b) => a.valueY - b.valueY);

  let previous = -Infinity;
  for (const entry of sorted) {
    entry.labelY = Math.max(entry.valueY, previous + gap, minY);
    previous = entry.labelY;
  }

  const overflow = previous - maxY;
  if (overflow > 0) {
    // Nosta ylöspäin, mutta älä työnnä ylimmäistä alueen ulkopuolelle.
    const shift = Math.min(overflow, sorted[0].labelY - minY);
    for (const entry of sorted) entry.labelY -= shift;
  }
  return sorted;
}

function wireHover(host, geo) {
  const wrap = host.querySelector('.chart-wrap');
  const svg = wrap.querySelector('svg');
  const hit = svg.querySelector('#hit');
  const crosshair = svg.querySelector('#crosshair');
  let tip = null;

  const hide = () => {
    crosshair.style.display = 'none';
    tip?.remove();
    tip = null;
  };

  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    // Muunnetaan hiiren sijainti SVG:n omaan koordinaatistoon.
    const viewWidth = geo.plotW + geo.M.left + geo.M.right;
    const svgX = ((event.clientX - box.left) / box.width) * viewWidth;
    const ratio = clamp((svgX - geo.M.left) / geo.plotW, 0, 1);
    const time = geo.t0 + ratio * geo.span;
    const date = nearestDate(geo.dates, time);

    const px = geo.M.left + ((Date.parse(date) - geo.t0) / geo.span) * geo.plotW;
    crosshair.setAttribute('x1', px);
    crosshair.setAttribute('x2', px);
    crosshair.style.display = '';

    const rows = [...state.data.teams]
      .map((team) => ({ team, value: valueAt(team.series, date) }))
      .sort((a, b) => b.value - a.value)
      .map(
        ({ team, value }) =>
          `<div class="tip__row">
             <span class="tip__swatch" style="background:${escapeAttr(team.color)}"></span>
             <span>${escapeHtml(team.name)}</span>
             <span class="tip__value">${value}</span>
           </div>`,
      )
      .join('');

    tip?.remove();
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.innerHTML = `<div class="tip__date">${longDate(date)}</div>${rows}`;
    wrap.appendChild(tip);

    const left = (px / viewWidth) * box.width;
    const flip = left > box.width - tip.offsetWidth - 24;
    tip.style.left = `${flip ? left - tip.offsetWidth - 12 : left + 12}px`;
    tip.style.top = `8px`;
  });
}

function renderChartTable() {
  const teams = state.data.teams;
  // Kauden alkua edeltävä nollapiste on kuvaajan lähtökohta, ei havainto.
  const dates = [...new Set(teams.flatMap((t) => t.series.map((p) => p.date)))]
    .sort()
    .filter((date) => date >= state.data.seasonStart);
  const head = teams.map((t) => `<th scope="col">${escapeHtml(t.name)}</th>`).join('');
  const rows = dates
    .map(
      (date) =>
        `<tr><td>${longDate(date)}</td>${teams
          .map((t) => `<td class="num">${valueAt(t.series, date)}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  document.getElementById('chart-table').innerHTML =
    `<table><caption class="chart__caption">Yhteispisteet päivittäin.</caption>
      <thead><tr><th scope="col">Päivä</th>${head}</tr></thead>
      <tbody>${rows}</tbody></table>`;
}

/* ---------------- Joukkuetaulukot ---------------- */

function renderTeams() {
  document.getElementById('teams').innerHTML = state.data.teams.map(teamCard).join('');
  for (const button of document.querySelectorAll('[data-swap-team]')) {
    button.addEventListener('click', () => openSwap(button.dataset.swapTeam));
  }
}

function teamCard(team) {
  const rows = team.players.map((player) => playerRow(player, team)).join('');
  const swapsLeft = team.swapsLeft.F + team.swapsLeft.D;
  // Ilman tunnussanaa vaihtoa ei voi vahvistaa, joten se kerrotaan tässä
  // eikä vasta silloin kun nappia on painettu.
  const locked = !team.hasPin;
  const log = team.swaps.length
    ? `<p class="team__swap-log">${team.swaps
        .map(
          (s) =>
            `${escapeHtml(s.outName)} ${NBSP}→${NBSP} ${escapeHtml(s.inName)} (${longDate(s.effectiveDate)} alkaen)`,
        )
        .join('<br>')}</p>`
    : '';

  return `
    <article class="team" style="--team:${escapeAttr(team.color)};--team-ink:${inkOn(team.color)}">
      <header class="team__head">
        <span class="team__name">${escapeHtml(team.name)}</span>
        <span class="team__swaps">${swapsLabel(swapsLeft)}</span>
      </header>
      <table>
        <colgroup>
          <col class="c-role"><col><col class="c-club">
          <col class="c-num"><col class="c-num"><col class="c-num"><col class="c-points">
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Rooli</th>
            <th scope="col">Pelaaja</th>
            <th scope="col">Seura</th>
            <th scope="col" title="Ottelut">O</th>
            <th scope="col" title="Maalit">M</th>
            <th scope="col" title="Syötöt">S</th>
            <th scope="col" title="Pisteet">P</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="team__total">
        <span class="team__total-label">Avauskokoonpanon yhteispisteet</span>
        <span class="team__total-value">${team.points}</span>
      </div>
      <div class="team__foot">
        ${log}
        <button type="button" class="btn btn--block" data-swap-team="${escapeAttr(team.id)}"
          ${swapsLeft === 0 || locked ? 'disabled' : ''}>${
            locked ? 'Tunnussana puuttuu' : 'Tee vaihto'
          }</button>
      </div>
    </article>`;
}

function swapsLabel(count) {
  if (count === 0) return 'vaihdot käytetty';
  return count === 1 ? '1 vaihto jäljellä' : `${count} vaihtoa jäljellä`;
}

function playerRow(player, team) {
  const classes = [];
  // Kursiivi merkitsee pelaajaa joka ei kerrytä pisteitä. Peliin vaihdettu
  // varapelaaja ei siis enää ole kursiivilla.
  if (!player.isStarter && !player.active) classes.push('row-sub');
  if (player.isStarter && !player.active) classes.push('row-swapped-out');

  const bench =
    !player.active && player.benchPoints > 0
      ? `<br><span class="bench-note">${player.benchPoints} p penkiltä</span>`
      : '';

  return `<tr class="${classes.join(' ')}">
    <td class="col-role">${roleLabel(player)}</td>
    <td class="col-player">${escapeHtml(player.name)}${bench}</td>
    <td class="col-club">${escapeHtml(player.club)}</td>
    <td class="num">${player.games}</td>
    <td class="num">${player.goals}</td>
    <td class="num">${player.assists}</td>
    <td class="num col-points">${player.points}</td>
  </tr>`;
}

/**
 * Rooli kahtena mittana: koko sana leveälle näytölle ja lyhenne kapealle.
 * Kapealla näytöllä "Varahyökkääjä" veisi tilan pelaajan nimeltä.
 */
function roleLabel(player) {
  const isForward = player.position === 'F';
  const base = isForward ? 'Hyökkääjä' : 'Pakki';
  const abbr = isForward ? 'HYÖ' : 'PAK';

  let long;
  let short;
  if (player.isStarter) {
    long = player.active ? base : `${base} · pois`;
    short = player.active ? abbr : `${abbr}·pois`;
  } else if (player.active) {
    long = `${base} · sisään`;
    short = `${abbr}·sis.`;
  } else {
    long = `Vara${base.toLowerCase()}`;
    short = `V-${abbr}`;
  }
  return `<span class="role-long">${long}</span><span class="role-short" title="${long}">${short}</span>`;
}

/* ---------------- Päivän ottelut ---------------- */

function renderSchedule() {
  const panel = document.getElementById('ottelut-panel');
  const schedule = state.data.schedule;
  if (!schedule || schedule.games.length === 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  document.getElementById('ottelut-paiva').textContent = schedule.isToday
    ? `Tänään ${longDate(schedule.date)}`
    : `Seuraava pelipäivä ${weekday(schedule.date)} ${longDate(schedule.date)}`;

  document.getElementById('ottelut').innerHTML = schedule.games
    .map((game) => {
      const live = game.started && !game.finished;
      const score =
        game.homeGoals === null || game.awayGoals === null || !game.started
          ? ''
          : `${game.homeGoals}–${game.awayGoals}`;
      return `<li class="game ${game.started ? '' : 'game--upcoming'}">
        <span class="game__time">${escapeHtml(game.time)}</span>
        <span class="game__teams">${escapeHtml(game.homeTeam)}<span class="game__vs">–</span>${escapeHtml(game.awayTeam)}</span>
        ${live ? '<span class="game__live">Käynnissä</span>' : `<span class="game__score">${score}</span>`}
      </li>`;
    })
    .join('');
}

const WEEKDAYS = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

function weekday(date) {
  const [year, month, day] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/* ---------------- Vaihto ---------------- */

function wireDialog() {
  document.getElementById('swap-cancel').addEventListener('click', () => {
    document.getElementById('swap-dialog').close();
  });
  document.getElementById('swap-confirm').addEventListener('click', submitSwap);
  document.getElementById('swap-pin').addEventListener('input', updateConfirmState);
}

function openSwap(teamId) {
  const team = state.data.teams.find((t) => t.id === teamId);
  if (!team) return;
  state.swap = { teamId, outPlayerId: null };

  document.getElementById('swap-title').textContent = `${team.name} — vaihto`;
  document.getElementById('swap-pin').value = '';
  hide('swap-error');
  hide('swap-result');

  const choices = team.players
    .filter((p) => p.isStarter && p.active)
    .map((player) => {
      const used = team.swapsLeft[player.position] === 0;
      return `<button type="button" class="choice" aria-pressed="false"
        data-player="${player.playerId}" data-position="${player.position}" ${used ? 'disabled' : ''}>
        <span class="choice__role">${player.position === 'F' ? 'HYÖ' : 'PAK'}</span>
        <span>${escapeHtml(player.name)}</span>
        <span class="choice__points">${player.points} p${used ? ' · vaihto käytetty' : ''}</span>
      </button>`;
    })
    .join('');

  const host = document.getElementById('swap-choices');
  host.innerHTML = choices;
  for (const button of host.querySelectorAll('.choice')) {
    button.addEventListener('click', () => selectOut(team, button));
  }

  updateConfirmState();
  document.getElementById('swap-dialog').showModal();
}

function selectOut(team, button) {
  for (const other of document.querySelectorAll('.choice')) {
    other.setAttribute('aria-pressed', String(other === button));
  }
  const playerId = Number(button.dataset.player);
  const position = button.dataset.position;
  state.swap.outPlayerId = playerId;

  // Tilalle tulee automaattisesti saman position varapelaaja.
  const sub = team.players.find((p) => !p.isStarter && p.position === position);
  const out = team.players.find((p) => p.playerId === playerId);
  const result = document.getElementById('swap-result');
  result.innerHTML = sub
    ? `<strong>${escapeHtml(out.name)}</strong> pois, tilalle <strong>${escapeHtml(sub.name)}</strong>
       (${escapeHtml(sub.club)}). Vaihto pätee tämän päivän otteluihin, jos kello on alle 14 —
       muuten huomisesta alkaen.`
    : 'Varapelaajaa ei löytynyt.';
  result.hidden = false;
  updateConfirmState();
}

function updateConfirmState() {
  const pin = document.getElementById('swap-pin').value.trim();
  document.getElementById('swap-confirm').disabled = !state.swap?.outPlayerId || pin.length < 3;
}

async function submitSwap() {
  const button = document.getElementById('swap-confirm');
  const pin = document.getElementById('swap-pin').value.trim();
  const out = state.data.teams
    .find((t) => t.id === state.swap.teamId)
    .players.find((p) => p.playerId === state.swap.outPlayerId);

  if (!window.confirm(`Vahvistetaanko: ${out.name} pois kokoonpanosta? Tätä ei voi perua.`)) return;

  button.disabled = true;
  hide('swap-error');
  try {
    const response = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId: state.swap.teamId, outPlayerId: state.swap.outPlayerId, pin }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `Palvelin vastasi ${response.status}`);
    document.getElementById('swap-dialog').close();
    await load();
  } catch (error) {
    const el = document.getElementById('swap-error');
    el.textContent = String(error.message ?? error);
    el.hidden = false;
    button.disabled = false;
  }
}

/* ---------------- Apurit ---------------- */

/** Näyttää paikkamerkin jos kuvatiedostoa ei ole vielä lisätty repoon. */
function handleMissingImages() {
  const replace = (img) => {
    const placeholder = document.createElement('div');
    placeholder.className = 'is-missing';
    placeholder.textContent = `Kuva puuttuu: ${img.getAttribute('src')}`;
    img.replaceWith(placeholder);
  };
  for (const img of document.querySelectorAll('img')) {
    img.addEventListener('error', () => replace(img));
    // Moduuliskripti suoritetaan vasta sivun jäsentämisen jälkeen, joten
    // osa kuvista on voinut epäonnistua jo ennen kuuntelijan liittämistä.
    if (img.complete && img.naturalWidth === 0) replace(img);
  }
}

/**
 * Yläraja joka on jaollinen akselimerkintöjen määrällä, jotta akselille
 * tulee pyöreitä lukuja eikä esimerkiksi 15 / 11 / 8 / 4.
 */
function niceCeil(value) {
  const step = value <= 20 ? 5 : value <= 60 ? 10 : value <= 150 ? 25 : 50;
  const unit = step * TICK_COUNT;
  return Math.max(unit, Math.ceil(value / unit) * unit);
}

function axisTicks(top) {
  return Array.from({ length: TICK_COUNT + 1 }, (_, i) => (top / TICK_COUNT) * i);
}

/** Rajaa päivämäärämerkintöjen määrän, jotteivät ne mene päällekkäin. */
function pickDateTicks(dates, max) {
  if (dates.length <= max) return dates;
  const step = Math.ceil(dates.length / max);
  const picked = dates.filter((_, i) => i % step === 0);
  if (picked[picked.length - 1] !== dates[dates.length - 1]) picked.push(dates[dates.length - 1]);
  return picked;
}

function nearestDate(dates, time) {
  let best = dates[0];
  let bestGap = Infinity;
  for (const date of dates) {
    const gap = Math.abs(Date.parse(date) - time);
    if (gap < bestGap) {
      bestGap = gap;
      best = date;
    }
  }
  return best;
}

function shortDate(date) {
  const [, month, day] = date.split('-');
  return `${Number(day)}.${Number(month)}.`;
}

function longDate(date) {
  const [year, month, day] = date.split('-');
  return `${Number(day)}.${Number(month)}.${year}`;
}

/** Musta vai valkoinen teksti värin päällä. */
function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.42 ? '#15161a' : '#ffffff';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hide(id) {
  document.getElementById(id).hidden = true;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function escapeAttr(value) {
  return escapeHtml(value);
}
