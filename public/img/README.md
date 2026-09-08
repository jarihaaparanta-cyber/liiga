# Kuvat

Sivusto käyttää WebP-muotoa, joka on samalla laadulla murto-osan PNG:n
kokoisesta. Muunna alkuperäinen kuva komennolla:

```bash
node scripts/optimize-image.mjs ~/kuvat/mainos.png public/img/sponsor-ainto.webp
```

Skripti rajaa samalla pois yläreunan valkoisen kaistaleen ja kertoo
lopputuloksen koon.

| Tiedosto | Sisältö | Tila |
| --- | --- | --- |
| `header.webp` | Stiga Pörssi -banneri | valmis |
| `sponsor-jersey53.webp` | Jersey53-banneri | valmis |
| `sponsor-ainto.webp` | Ainto-banneri | valmis |

Sponsoribannerit ovat molemmat suhteessa 2,20:1, jotta ne asettuvat pariksi.
Ainton alkuperäinen mainos on pystyjuliste, josta on rajattu bannerimuotoon
logo ja pääotsikko (rivit 33–498); leipäteksti jää pois, koska se olisi
tässä koossa lukukelvoton.

Nimet on kiinnitetty koodiin, joten oikea tiedosto vain korvaa paikkamerkin.
Kunnes tiedosto on lisätty, sivu näyttää sen paikalla katkoviivaisen
paikkamerkin eikä rikkinäistä kuvaa.
