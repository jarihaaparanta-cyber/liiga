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

## Käyttöönotto ilman tietokonetta

Julkaisu tapahtuu GitHubin kautta, joten se onnistuu pelkällä puhelimella.
Tietokantaa ei tarvitse luoda käsin — työnkulku luo sen ensimmäisellä
ajokerralla.

**1. Luo Cloudflaren API-tunniste.** Kirjaudu osoitteessa dash.cloudflare.com
ja mene *My Profile → API Tokens → Create Token → Create Custom Token*.
Anna sille oikeudet:

| Tyyppi | Kohde | Oikeus |
| --- | --- | --- |
| Account | Workers Scripts | Edit |
| Account | D1 | Edit |

Kopioi tunniste talteen heti; sitä ei näytetä uudelleen.

**2. Ota tilin tunniste talteen.** Se näkyy Cloudflaren osoiterivillä:
`dash.cloudflare.com/<tilin tunniste>`. Löytyy myös Workers-sivun oikeasta
laidasta kohdasta *Account ID*.

**3. Lisää salaisuudet GitHubiin.** Repositorion sivulla
*Settings → Secrets and variables → Actions → New repository secret*:

| Nimi | Arvo |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | vaiheen 1 tunniste |
| `CLOUDFLARE_ACCOUNT_ID` | vaiheen 2 tunniste |
| `ADMIN_TOKEN` | itse keksitty pitkä merkkijono |

**4. Käynnistä julkaisu.** *Actions → Julkaise → Run workflow*. Työnkulku
luo tietokannan, ajaa migraatiot, julkaisee sivuston ja hakee koko kauden
pisteet. Osoite näkyy ajon yhteenvedossa.

Tämän jälkeen jokainen branchiin tuleva muutos julkaistaan automaattisesti.

**5. Aseta tunnussanat.** *Actions → Aseta tunnussana → Run workflow*, kerran
jokaiselle joukkueelle. Ilman tunnussanaa joukkueen vaihto on estetty, ja
kortin nappi kertoo sen.

## Vaihdon peruminen

Pelaaja ei voi perua vaihtoa sivustolta — se on sääntö. Ylläpitäjälle on
korjauskeino väärinklikkauksia ja testaamista varten:
*Actions → Peru vaihto → Run workflow*.

Pisteet lasketaan aina vaihtohistoriasta uudelleen, joten rivin poisto
palauttaa tilanteen täsmälleen ennalleen eikä mitään häviä.

## Käyttöönotto päätteeltä

```bash
npm install
npx wrangler login
node scripts/ensure-d1.mjs                 # luo tietokannan ja täyttää tunnisteen
npx wrangler d1 migrations apply liigaporssi --remote
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

Ensimmäinen synkronointi hakee koko kauden automaattisesti, koska tietokanta
on tyhjä. Myöhemmät ajot ovat kevyitä päivityksiä.

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
| `scripts/` | Kertaluontoiset apuskriptit: pelaajahaku, tunnussanat, kuvien pakkaus. |
| `.github/workflows/` | Julkaisu, tunnussanat ja vaihdon peruminen. |
| `docs/` | Rajapinnan ja ulkoasun perustelut. |
