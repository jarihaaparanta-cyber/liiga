# Ulkoasun ja kuvaajan perustelut

## Joukkueiden värit

Värit tulevat bannerin pelipaidoista: Apa sininen, Jarde keltainen, Börje
punainen, Niksu vihreä. Suoraan paidoista poimitut sävyt eivät kuitenkaan
kelpaa kuvaajaan sellaisenaan, joten ne on hienosäädetty:

| Joukkue | Väri | Muutos paitaan nähden |
| --- | --- | --- |
| Apa | `#2E6FE0` | – |
| Jarde | `#B98600` | tummennettu, jotta se erottuu tummasta taustasta |
| Börje | `#E62E4D` | viilennetty hitusen, jotta se erottuu keltaisesta |
| Niksu | `#00A878` | siirretty hieman sinivihreään punaisen takia |

Paletti on tarkistettu koneellisesti kaikkien parien osalta tummaa taustaa
vasten: kirkkausvyöhyke, värikylläisyys, normaalin värinäön erottuvuus ja
kontrasti läpäisevät.

## Miksi kuvaajan kärjessä on kasvokuva

Punainen ja vihreä ovat punavihersokealle lähes samat: paras saavutettu
erottuvuus Börjen ja Niksun välillä on ΔE 6,3, kun tavoite on 8. Tätä ei saa
paremmaksi ilman että luovutaan paitojen väreistä.

Siksi väri ei ole ainoa tunniste. Jokaisen käyrän kärjessä on bannerista
rajattu kasvokuva joukkueen värisessä kehyksessä, ja sen vieressä joukkueen
nimi ja pistemäärä. Sama kasvokuva toistuu selitteessä. Kuvaajan saa myös
vaihdettua taulukkonäkymäksi.

Kasvot ovat vahvempi tunniste kuin aiemmat viivakuviot ja merkkien muodot,
koska ne tunnistaa yhdellä silmäyksellä eikä niitä tarvitse verrata
selitteeseen. Siksi viivat ovat nyt yhtenäisiä ja kaikki datapisteet
samanmuotoisia.

Kärkimerkinnät siirretään tarvittaessa pystysuunnassa erilleen, jotta
tasapisteissä olevien joukkueiden kasvot eivät mene päällekkäin. Ohut
yhdysviiva kertoo mihin kohtaan käyrä oikeasti päättyy.

## Viisto viiva

Käyrä nousee viistosti ottelupäivästä toiseen. Tarkalleen ottaen pistesaldo
hyppää vasta ottelupäivänä, joten porrasviiva olisi kirjaimellisesti
täsmällisempi, mutta se näytti kulmikkaalta ja vaikeammin luettavalta.
Viisto viiva valittiin luettavuuden vuoksi.

Ottelupäivien kohdalla on merkkipiste, joten todelliset havainnot erottuvat
interpoloidusta välistä. Viimeisestä ottelupäivästä oikeaan reunaan viiva
jatkuu vaakasuorana, koska uusia pisteitä ei ole tullut.

## Banneri näkyy kokonaan

Banneri on 2:1, eli täysleveänä se veisi työpöydällä yli puolet ruudusta.
Rajaaminen taas pudotti kuvasta osia pois. Ratkaisu on kolmas: kuvan korkeus
rajataan ja leveys seuraa kuvasuhdetta, jolloin koko banneri näkyy mutta
sivuille jää tilaa.

Tyhjät sivut täytetään samasta kuvasta tehdyllä sumennetulla suurennoksella,
jolloin reunoille ei jää irrallisen näköistä palkkia. Tiedosto on sama, joten
ylimääräistä latausta ei synny.

Puhelimessa kuva täyttää leveyden kokonaan eikä sivuja synny lainkaan.

## Kuvaaja piirretään säiliön leveydelle

Kuvaajalla oli kiinteä 900 yksikön viewBox ja 520 pikselin vähimmäisleveys,
joten kapealla näytöllä se joko kutistui lukukelvottomaksi tai vaati
vaakavieritystä — ja vieritettävässä kuvaajassa tuorein tilanne jäi näkymän
ulkopuolelle.

Kuvaaja mitoitetaan nyt säiliön todelliselle leveydelle, jolloin teksti
pysyy oikean kokoisena eikä mitään tarvitse vierittää. Kapealla näytöllä
kärjessä on pelkkä kasvokuva ilman nimeä ja pistelukua: nimet näkyvät
selitteessä ja pisteet kuvaajan yläpuolisissa korteissa, joten mitään ei
katoa.

## Kesken olevat ottelut

Pisteet päivittyvät ottelun aikana, jotta sivulta voi seurata miten saldo
kasvaa illan mittaan. Ne eivät kuitenkaan mene tietokantaan kesken pelin:
tietokanta on lukittu totuus, jonka illan synkronointi kirjoittaa vasta
ottelun päätyttyä.

Käytännössä tämä tarkoittaa, että kesken olevien otteluiden suoritukset
haetaan liiga.fi:stä sivupyynnön yhteydessä ja lisätään tietokannan rivien
päälle. Haku tehdään vain silloin kun päivän ottelu on jo alkanut eikä sitä
ole vielä merkitty päättyneeksi, ja se on ohitettavissa: jos liiga.fi ei
vastaa, sivu näyttää tietokannan tilanteen eikä kaadu.

Mukaan otetaan myös jo päättyneet ottelut, joita synkronointi ei ole vielä
ehtinyt tallentaa. Muuten pisteet katoaisivat näkyvistä ottelun päätyttyä ja
ilmestyisivät takaisin vasta klo 21:30.

Kesken oleva ottelu näkyy sivulla kolmella tavalla: merkkinä otsikossa,
lukuna "+2" joukkueen pisteiden vieressä ja pystyviivana kuvaajassa.
Kuvaaja ulottuu kuluvaan pelipäivään myös silloin kun pisteitä ei ole vielä
tullut; muuten se ei kertoisi käynnissä olevasta ottelusta mitään ennen
ensimmäistä osumaa.
Sivu hakee tilanteen uudelleen minuutin välein niin kauan kuin ottelu on
käynnissä.

## Vain tumma teema

Banneri on tumma hallikuva. Vaalea teema näyttäisi siltä, että banneri on
liimattu päälle, joten sivusto on tarkoituksella pelkästään tumma.
