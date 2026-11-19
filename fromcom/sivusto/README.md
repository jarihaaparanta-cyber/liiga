# FromCom – sivusto

Uusi fromcom.fi-sivusto. Tehty [Astrolla](https://astro.build): lopputulos on
tavallisia HTML-sivuja, jotka voi julkaista mihin tahansa (esim. Cloudflare Pages,
Netlify tai perinteinen webhotelli).

## Käyttö

```bash
cd fromcom/sivusto
npm install
npm run dev      # kehityspalvelin: http://localhost:4321
npm run build    # valmis sivusto kansioon dist/
```

## Sivut

| Osoite | Tiedosto |
| --- | --- |
| `/` | `src/pages/index.astro` – **väliaikainen**, korvataan demosivun etusivulla |
| `/palvelut/` | `src/pages/palvelut/index.astro` |
| `/palvelut/<palvelu>/` (6 kpl) | `src/pages/palvelut/[slug].astro` – sisältö `src/data/sivusto.js` |
| `/kalusto/` | `src/pages/kalusto.astro` |
| `/referenssit/` | `src/pages/referenssit.astro` |
| `/yritys/` | `src/pages/yritys.astro` |
| `/ota-yhteytta/` | `src/pages/ota-yhteytta.astro` |
| `/tietosuoja/` | `src/pages/tietosuoja.astro` – **luonnos** |

Yhteystiedot, valikko, palveluiden tekstit ja kumppanit ovat yhdessä paikassa:
`src/data/sivusto.js`. Ylä- ja alatunniste: `src/layouts/Sivupohja.astro`.
Tyylit: `src/styles/global.css` (värit ja fontit demosivun mukaiset).
Kuvat optimoidaan automaattisesti (`src/assets/kuvat/`).

## Täydennettävää asiakkaalta

- Y-tunnus, säilytysajat ja palveluntarjoajat tietosuojaselosteeseen
- Konekohtaiset tiedot kalustosivulle (merkki, malli, työlaitteet)
- Referenssikohteiden kuvaukset (paikkakunta, työn sisältö, vuosi) ja lisää kuvia
- Arton ja Väinön tehtävänimikkeet, jos halutaan näkyviin
- Palvelusivujen tekstit tarkistettavaksi

## Seuraavat vaiheet

1. Etusivu demosivun mukaiseksi (palveluhaitari, referenssit, prosessi, kartta, kumppanit)
2. 5-vaiheinen tarjouslomake ja sen lähetys sähköpostiin – sen jälkeen `TARJOUS_URL` → `/#tarjous`
