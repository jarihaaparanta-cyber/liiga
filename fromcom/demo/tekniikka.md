# Demosivun tekniikka

## Alusta

- **Next.js** (App Router, React), staattisesti esirenderöity sivu
- Kuvat Next.js:n `next/image`-optimoinnilla (`/_next/image?url=...&w=...&q=90`), lähdekuvat WebP/JPG
- Ikonit: **Lucide** (arrow-up-right, arrow-left, maximize-2, phone, map-pin jne.)
- Lomakkeen palvelu- ja kohdekuvakkeet ovat itse piirrettyjä SVG-viivapiirroksia (`fc-qi-accent` = korostusväri)
- Isännöinti: webfindemot.fi (demopalvelu). Sivulla on myös demopalvelun oma seurantaeväste (UTM-parametrit, kävijätyyppi) – ei kuulu lopulliseen sivuun.

## Fontit (Google Fonts)

| Muuttuja | Fontti | Käyttö |
| --- | --- | --- |
| `--fc-heading` | **Russo One** | Pääotsikot (H1, H2) |
| `--fc-display` | **Barlow Condensed** | Yläotsikot, tunnisteet ("FROMCOM OY / PALVELUT"), numerot |
| `--fc-body` | **Manrope** | Leipäteksti, painikkeet, lomake |

## Värit

| Muuttuja | Arvo | Käyttö |
| --- | --- | --- |
| `--fc-black` | `#080808` | Tumma tausta |
| `--fc-dark` | `#181a19` | Osioiden tausta, painikkeet |
| `--fc-white` | `#ebeae6` | Lämmin vaalea (teksti tummalla, vaaleat osiot) |
| `--fc-amber` | `#e6a32e` | Korostusväri (meripihka / työmaakeltainen) |
| `--fc-form-tint` | `#ede6d9` | Lomakkeen vaalea tausta |
| `--fc-line` | `#ffffff26` | Ohuet erotinviivat tummalla |

Muita käytettyjä sävyjä: `#c4831a`, `#895c15` (tummempi amber), `#f2c46d` (vaalea amber), `#e08c33`, `#dcd8ce`, `#343632`, `#303129`, `#737b7e`, virheet `#b42318` / `#a3201a`.

## Tyyli

- Tumma, teollinen ilme: isot kuvat koko leveydellä, tumma peittoväri kuvien päällä, valkoinen Russo One -otsikko
- Pienet versaali-tunnisteet muodossa "FROMCOM OY / PIRKANMAA" ja numerointi "01 / 06"
- Ohuet vaakaviivat ja mittaviivamaiset merkit (viittaus mittaukseen / koneohjaukseen)
- Painikkeet suorakulmaisia, nuoli-ikoni oikealla; vaalea ja ääriviivallinen versio
- Luokkien etuliite `fc-` (esim. `fc-hero`, `fc-services`, `fc-gallery`, `fc-process`, `fc-guide`, `fc-q-*` = tarjouslomake)

## Toiminnallisuudet

1. **Kiinteä ylätunniste**, joka muuttuu tummaksi kun sivua vieritetään yli 48 px
2. **Palvelut-alasvetovalikko** (mega menu) kuvalla ja numeroiduilla palveluilla
3. **Mobiilivalikko** koko näytön paneelina, palvelut avautuvat alavalikkona
4. **Hero**: otsikon rivit animoituvat sisään, vieritysanimaatioita (scroll-triggerit "top bottom" jne.)
5. **Palvelut-haitari**: valittu palvelu vaihtaa ison kuvan ja laskurin "01 / 06"
6. **Referenssigalleria**: kuvat aukeavat suurennettuna (lightbox) edellinen/seuraava-painikkeilla
7. **Prosessi**: neljä vaihetta, edistymispalkki ja vaiheiden välillä siirtyminen
8. **Pirkanmaan kartta** SVG:nä, Kangasala merkitty
9. **Tarjouslomake 5 vaiheessa** (React-tila):
   - valinta siirtää automaattisesti seuraavaan vaiheeseen
   - edistymispalkki, jonka vaiheisiin voi palata
   - valinnat näkyvät "polkuna" (`fc-q-trail`) ja sivupaneelissa
   - vaiheen 3 vaihtoehdot riippuvat valitusta palvelusta
   - pinta-alan liukusäädin + pikavalinnat
   - paikkakunnan tunnistus Pirkanmaan kuntalistasta
   - vaihtuvat pakolliset kentät valitun yhteydenottotavan mukaan
   - kuvien lisäys esikatseluineen (max 4)
   - kenttäkohtainen validointi ja virheilmoitukset, `aria-invalid` / `aria-describedby`
   - animaatiot `fc-q-forward`, `fc-q-back`, `fc-q-pop`, `fc-q-shake` (virhe) ym.
   - **ei lähetä tietoja mihinkään** – taustapalvelu (sähköposti tms.) puuttuu
10. **Pikaopas**: kelluva painike, josta aukeaa paneeli usein kysytyillä aiheilla ja "Soita Artolle" -linkki
11. **Saavutettavuus**: "Siirry sisältöön" -linkki, aria-labelit, kuvaavat alt-tekstit, `prefers-reduced-motion` huomioitu

## Jatkokehitettävää

- Alasivut puuttuvat: Palvelut + 6 palvelusivua, Kalusto, Referenssit, Yritys, Yhteystiedot, Tietosuoja
- Tarjouslomakkeen lähetys (esim. sähköpostiin Artolle/Väinölle) ja roskapostisuojaus
- Tietosuojaseloste (lomake kerää henkilötietoja ja kuvia)
- Demopalvelun seuranta ja "VERKKOSIVUDEMO"-merkinnät pois
- Hakukoneoptimointi: meta-kuvaukset, Open Graph -kuvat, LocalBusiness-rakenteinen data
