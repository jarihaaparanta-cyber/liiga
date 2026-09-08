# Liigapörssi

Kaveriporukan oma pistepörssi SM-liigan runkosarjaan. Pisteet haetaan
liiga.fi:n tilastoista automaattisesti ja näytetään taulukkona sekä
kumulatiivisena pistekertymäkuvaajana.

## Säännöt

- Joukkueella on avauskokoonpano: **3 hyökkääjää + 2 pakkia**. Ne kerryttävät
  pisteitä runkosarjan alusta asti.
- Lisäksi **1 varahyökkääjä ja 1 varapakki**. Ne eivät kerrytä pisteitä ennen
  kuin ne vaihdetaan peliin, mutta niiden penkkipisteet näytetään tiedoksi.
- Vaihto pitää tehdä **ennen klo 14** Suomen aikaa. Sitä ennen tehty vaihto
  pätee jo saman päivän otteluihin, myöhemmin tehty vasta seuraavasta päivästä.
- Koko runkosarjassa saa tehdä **yhden hyökkääjävaihdon ja yhden pakkivaihdon**
  per joukkue. Ulos jäänyt pelaaja säilyttää siihen mennessä kerätyt pisteet.
- Vain runkosarja lasketaan, ei pudotuspelejä.

## Tekniikka

Yksi Cloudflare Worker tarjoilee sekä staattisen sivuston (`public/`) että
API:n, ja säilöö datan D1-tietokantaan. Cron-liipaisin päivittää pisteet
klo 21:30 Suomen aikaa, ja tekee yöllä korjausajon myöhään päättyneiden
otteluiden varalta.

Pisteet tallennetaan **ottelukohtaisesti**, koska joukkueen saldo riippuu
siitä minä päivinä kukin pelaaja on ollut kokoonpanossa. Kaikki summat
lasketaan tästä ajonaikaisesti.

## Käyttöönotto

```bash
npm install
npx wrangler d1 create liigaporssi     # kopioi tuloksena tuleva database_id wrangler.jsonc:hen
npm run db:remote                      # ajaa migraatiot
npm run deploy
```

Kehityksessä:

```bash
npm run db:local
npm run dev
npm test
```

## Hakemistot

| Polku | Sisältö |
| --- | --- |
| `src/scoring.ts` | Pistelaskenta ja vaihtosäännöt. Puhdasta logiikkaa, testattu. |
| `src/time.ts` | Suomen aikavyöhykkeen käsittely ja vaihdon takaraja. |
| `src/index.ts` | Workerin reitit ja cron-käsittelijä. |
| `migrations/` | D1-skeema. |
| `data/rosters.json` | Kauden lähtökokoonpanot. |
| `public/` | Selainkäyttöliittymä. |

## Tunnusluvut

Vaihdon tekeminen vaatii joukkueen tunnusluvun. Se asetetaan kerran:

```bash
node scripts/set-pin.mjs apa 1234
npx wrangler d1 execute liigaporssi --remote --command "<tulostettu lause>"
```

Tietokantaan tallentuu vain tiiviste. Jos tunnuslukua ei ole asetettu,
joukkueen vaihto on estetty.

## Ensimmäinen datan lataus

Kauden alussa tai tietokannan tyhjennyksen jälkeen koko runkosarja haetaan
kerralla:

```bash
npx wrangler secret put ADMIN_TOKEN
curl -X POST "https://<osoite>/api/sync?kind=backfill" -H "Authorization: Bearer <token>"
```

Sen jälkeen cron hoitaa päivitykset automaattisesti.
