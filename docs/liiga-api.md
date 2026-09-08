# liiga.fi-rajapinta

Muistiinpanot rajapinnasta, joka on virallisesti dokumentoimaton mutta
julkinen: liiga.fi:n oma sivusto käyttää samoja osoitteita. Kaikki alla
olevat on todennettu oikeaa dataa vasten 8.9.2026.

## Kausinumerointi

Kausi merkitään sen **päättymisvuodella**: kausi 2026-27 on `2027`.
Tarkistettu hakemalla `season=2027`, jonka ensimmäinen ottelu on 1.9.2026 ja
viimeinen 23.3.2027.

## Käytettävät osoitteet

### Otteluluettelo tapahtumineen

```
GET https://liiga.fi/api/v2/games?tournament=runkosarja&season=2027
```

Palauttaa **koko kauden** kaikki 544 ottelua yhtenä JSON-taulukkona (n. 1,3 MB).
Tämä on ainoa haku jota pistelaskenta tarvitsee: jokainen ottelu sisältää
`homeTeam.goalEvents` ja `awayTeam.goalEvents`, joissa on maalintekijä ja
syöttäjät. Erillistä ottelukohtaista hakua ei siis tarvita.

Olennaiset kentät:

| Kenttä | Merkitys |
| --- | --- |
| `id` | Ottelun tunniste |
| `start` | Alkuaika UTC:nä. Päivä on muunnettava Suomen aikaan. |
| `ended` | `true` kun ottelu on päättynyt. Vain nämä lasketaan. |
| `serie` | `"RUNKOSARJA"`. Suodatetaan varmuuden vuoksi. |
| `homeTeam.goalEvents[]` | Maalitapahtumat |

Maalitapahtuman kentät:

| Kenttä | Merkitys |
| --- | --- |
| `scorerPlayerId` | Maalintekijä |
| `assistantPlayerIds[]` | Syöttäjät, 0–2 kpl |
| `goalTypes[]` | Maalin tyyppikoodit |
| `goalsSoFarInSeason` | Tekijän kauden maalimäärä tapahtuman jälkeen |

### Kauden koontitilastot

```
GET https://liiga.fi/api/v2/players/stats/summed/2027/2027/runkosarja/true
```

Pelaajien kausisummat: `playerId`, `firstName`, `lastName`, `teamShortName`,
`role`, `games`, `goals`, `assists`, `points` ja iso liuta edistyneempiä
tilastoja. Käytetään kahteen asiaan: otteluiden lukumäärään (`games`, jota
maalitapahtumista ei voi päätellä) ja laskennan oikeellisuuden tarkistamiseen.

Huomaa: mukana ovat vain pelaajat jotka ovat pelanneet vähintään yhden
ottelun. Kokoonpanoon valittu mutta vielä pelaamaton pelaaja puuttuu listalta.

### Roolikoodit

`role`-kenttä koontitilastoissa: `H` = hyökkääjä, `P` = puolustaja,
`MV` = maalivahti. Ottelukohtaisessa datassa käytetään sanallisia koodeja
(`LEFT_WING`, `RIGHT_DEFENSEMAN`, …), joita emme tarvitse.

## Mitkä maalitapahtumat EIVÄT ole pisteitä

Osa `goalEvents`-tapahtumista ei kerrytä pelaajatilastoja. Suodatussääntö:

> Ohita tapahtuma jos `goalTypes` sisältää **`VL`** tai **`RL0`**,
> tai jos `goalsSoFarInSeason === 0`.

- `VL` = voittolaukaus. Ratkaisee ottelun mutta ei ole pelaajan maali.
- `RL0` = rangaistuslaukaus josta ei tullut maalia.

Sääntö on todennettu laskemalla jokaisen pelaajan maalit ja syötöt
maalitapahtumista ja vertaamalla virallisiin koontitilastoihin:

| Aineisto | Tulos |
| --- | --- |
| Kausi 2025-26, 480 ottelua | **573/573 pelaajaa täsmää** |
| Kausi 2026-27, 16 ottelua | **387/387 pelaajaa täsmää** |

Ilman suodatusta kaudella 2025-26 poikkeaa 53 pelaajaa, joten sääntö on
välttämätön.

Huomionarvoista: `VT0` (59 kpl kaudessa) **lasketaan** normaalisti, joten
"nollaan päättyvä koodi" ei ole yleispätevä sääntö. Muut nähdyt koodit
(`YV` ylivoima, `AV` alivoima, `TM` tyhjään maaliin, `IM` itsemaali, `SR`,
`TV`, `VT`, `RL`, `YV2`) lasketaan kaikki mukaan.

## Sudenkuoppia

- **Diakriitit puuttuvat.** Kärppien Jiri Ticháček on rajapinnassa
  `Jiri Tichacek`. Nimihaku on normalisoitava.
- **Etunimet vaihtelevat.** Jokereiden Matt Caito on rajapinnassa
  `Matthew Caito`.
- **Samannimisiä on.** Kaudella 2026-27 on kaksi Fortieria (Gabriel/PEL ja
  Maxime/JOK) ja kaksi Tukiaista (Leevi/JYP ja Jirko/LUK). Pelkkä sukunimi ei
  riitä, vaan tarvitaan myös seura.
- **Vain nämä kolme osoitetta toimivat.** `/api/v2/teams`, `/api/v2/game/...`
  ja `/api/v1/...` palauttavat 403:n tai HTML-sivun.
- **Aikavyöhyke.** `start` on UTC:nä. Ottelupäivä on aina Suomen paikallinen
  kalenteripäivä.
- **Kausikooste päivittyy kesken ottelun.** `players/stats/summed` sisältää
  käynnissä olevan ottelun pisteet heti, mutta `goalEvents`-pohjainen laskenta
  ottaa mukaan vain päättyneet ottelut. Vertailu antaa siksi poikkeaman
  jokaisesta illan ottelusta niin kauan kuin peli on kesken. Käynnissä olevassa
  ottelussa pisteitä tehneet pelaajat jätetään tarkistuksen ulkopuolelle.

## Seurojen lyhenteet

`HPK IFK ILV JOK JUK JYP KAL KES KOO KÄR LUK PEL SAI SPO TAP TPS ÄSS`
