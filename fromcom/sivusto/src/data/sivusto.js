// Sivuston yhteiset tiedot: yhteystiedot, valikko ja palvelut.
// Palvelusivut (/palvelut/<slug>/) luodaan automaattisesti tämän listan pohjalta.

import perustukset from '../assets/kuvat/IMG-20210724-WA0005.webp';
import kunnallis from '../assets/kuvat/FromCom_1.webp';
import putket from '../assets/kuvat/FromCom_4.webp';
import piha from '../assets/kuvat/valmis1-1.webp';
import raivaus from '../assets/kuvat/IMG_20220818_181338203.webp';
import purku from '../assets/kuvat/Purku5.webp';

export const yritys = {
  nimi: 'FromCom Oy',
  iskulause: 'Maanrakennustyöt Pirkanmaalla.',
  katuosoite: 'Lohiranta 6',
  postinumero: '36270',
  kaupunki: 'Kangasala',
  alue: 'Koko Pirkanmaa',
  karttalinkki: 'https://www.google.com/maps/search/?api=1&query=Lohiranta+6,+36270+Kangasala',
};

export const yhteyshenkilot = [
  { nimi: 'Arto From', puhelin: '050 550 3515', tel: '+358505503515', email: 'arto.from@fromcom.fi' },
  { nimi: 'Väinö From', puhelin: '0400 170 169', tel: '+358400170169', email: 'vaino.from@fromcom.fi' },
];

// Mihin "Pyydä tarjous" -painikkeet vievät: etusivun tarjouslomake.
export const TARJOUS_URL = '/#tarjous';

export const valikko = [
  { nimi: 'Etusivu', href: '/' },
  { nimi: 'Palvelut', href: '/palvelut/' },
  { nimi: 'Kalusto', href: '/kalusto/' },
  { nimi: 'Referenssit', href: '/referenssit/' },
  { nimi: 'Yritys', href: '/yritys/' },
  { nimi: 'Yhteystiedot', href: '/ota-yhteytta/' },
];

export const palvelut = [
  {
    slug: 'perustustyot',
    nimi: 'Rakennusten perustustyöt',
    tunniste: 'PERUSTUKSET',
    lyhyt: 'Rakennusten perustusten edellyttämät kaivu- ja maanrakennustyöt.',
    kuva: perustukset,
    kuvaAlt: 'Rakennuksen perustukset ja sorapohja työmaalla',
    johdanto:
      'Hyvä rakennus alkaa kunnollisesta pohjasta. Teemme rakennusten perustusten edellyttämät kaivu- ja maanrakennustyöt omakotitaloista ja vapaa-ajan asunnoista suurempiin kohteisiin.',
    kuvaus: [
      'Kaivamme rakennuksen pohjan, rakennamme sen kantavaksi ja teemme tarvittavat täytöt ja tasaukset. Novatron 3D-koneohjaus tukee suunnitelmien mukaista toteutusta, jolloin korot osuvat kohdalleen ja turhaa kaivamista jää vähemmän.',
      'Voit tilata meiltä yksittäisen työvaiheen tai koko rakennuksen maanrakennuksen. Jos suunnitelmat ovat vielä kesken, katsotaan yhdessä, mitä kohteessa kannattaa tehdä.',
    ],
    sisaltaa: ['Kaivutyöt', 'Pohjan rakentaminen', 'Täytöt ja tasaukset', 'Koko maanrakennus'],
    kohteet: ['Rakennustontit', 'Omakoti- ja paritalot', 'Vapaa-ajan kiinteistöt', 'Liike- ja teollisuuskohteet'],
  },
  {
    slug: 'kunnallistekniikka',
    nimi: 'Kunnallistekniset työt',
    tunniste: 'KUNNALLISTEKNIIKKA',
    lyhyt: 'Kunnallistekniikkaan liittyvät maanrakennustyöt rakentamisen eri vaiheisiin.',
    kuva: kunnallis,
    kuvaAlt: 'FromComin kaivinkone maanrakennustyömaalla',
    johdanto:
      'Toteutamme kunnallistekniikkaan liittyviä maanrakennustöitä rakentamisen eri vaiheisiin, niin yrityksille kuin yksityisille.',
    kuvaus: [
      'Kunnallistekniset työt vaativat tarkkuutta ja hyvää yhteistyötä muiden toimijoiden kanssa. Teemme kaivannot, putkilinjojen kaivutyöt ja alueiden maanrakennuksen suunnitelmien mukaisesti.',
      'Novatron 3D-koneohjaus auttaa toteuttamaan työn suunniteltuihin korkoihin ja kaltevuuksiin, mikä säästää aikaa ja vähentää turhaa kaivamista.',
    ],
    sisaltaa: ['Kaivannot', 'Alueen maanrakennus', 'Putkilinjojen kaivutyöt'],
    kohteet: ['Infrakohteet', 'Rakennusalueet', 'Liike- ja teollisuuskohteet', 'Taloyhtiöt'],
  },
  {
    slug: 'vesi-ja-viemarityot',
    nimi: 'Vesi- ja viemärityöt',
    tunniste: 'VESI JA VIEMÄRI',
    lyhyt: 'Vesi- ja viemärijärjestelmien kaivu- ja maanrakennustyöt.',
    kuva: putket,
    kuvaAlt: 'Putkitöitä ja kaivanto työmaalla',
    johdanto:
      'Teemme vesi- ja viemärijärjestelmien kaivu- ja maanrakennustyöt uudiskohteisiin ja saneerauksiin.',
    kuvaus: [
      'Kaivamme putkille ja kaivoille kaivannot, teemme tarvittavat pohjatyöt ja täytämme kaivannot asennusten jälkeen. Työ tehdään niin, että piha saadaan taas käyttöön mahdollisimman pian.',
      'Kaivutyöt sovitetaan yhteen putkiasennusten kanssa, jotta kaivanto on auki vain sen ajan kuin on tarpeen.',
    ],
    sisaltaa: ['Vesijohdon kaivutyöt', 'Viemäröinnin kaivutyöt', 'Kaivannot ja täytöt', 'Saneerauskohteet'],
    kohteet: ['Omakotitalot', 'Vapaa-ajan kiinteistöt', 'Taloyhtiöt', 'Uudiskohteet'],
  },
  {
    slug: 'piha-ja-viherrakentaminen',
    nimi: 'Piha- ja viherrakentaminen',
    tunniste: 'PIHAT',
    lyhyt: 'Piha-alueiden maanrakennus ja ympäristön rakentaminen.',
    kuva: piha,
    kuvaAlt: 'Valmis piha ja nurmialue',
    johdanto:
      'Rakennamme pihat pohjatöistä valmiiseen pintaan. Toimiva piha syntyy hyvästä pohjasta, oikeista kallistuksista ja huolellisesta viimeistelystä.',
    kuvaus: [
      'Teemme pihan pohjatyöt, muotoilun ja nurmialueet sekä tarvittaessa koko pihan rakentamisen. Huolehdimme, että pintavedet ohjautuvat pois rakennuksista ja piha kestää käyttöä.',
      'Olipa kyseessä uuden talon piha tai vanhan pihan uudistus, käydään toiveet yhdessä läpi ja suunnitellaan sopiva toteutus.',
    ],
    sisaltaa: ['Pihan pohjatyöt', 'Pihan muotoilu', 'Nurmialueet', 'Koko pihan rakentaminen'],
    kohteet: ['Omakotitalojen pihat', 'Vapaa-ajan kiinteistöt', 'Taloyhtiöiden piha-alueet', 'Yritysten piha-alueet'],
  },
  {
    slug: 'tonttien-raivaukset',
    nimi: 'Tonttien raivaukset',
    tunniste: 'RAIVAUS',
    lyhyt: 'Tonttien raivaus ja rakentamiseen valmistelu.',
    kuva: raivaus,
    kuvaAlt: 'Kaivinkone raivatulla tontilla metsäisessä ympäristössä',
    johdanto:
      'Raivaamme tontin ja valmistelemme sen rakentamista varten, jotta varsinainen rakentaminen pääsee alkamaan suunnitellusti.',
    kuvaus: [
      'Raivaus on usein rakennushankkeen ensimmäinen työvaihe. Poistamme kasvillisuuden ja kannot sekä valmistelemme maa-alueen seuraavia työvaiheita varten.',
      'Kun raivaus ja perustustyöt tehdään samalla kalustolla, työmaa etenee joustavasti ilman turhia välivaiheita.',
    ],
    sisaltaa: ['Tontin raivaus', 'Maa-alueen valmistelu', 'Rakentamiseen valmistelu'],
    kohteet: ['Rakennustontit', 'Vapaa-ajan tontit', 'Piha-alueet', 'Yritysten kohteet'],
  },
  {
    slug: 'purkutyot',
    nimi: 'Rakennusten purkutyöt',
    tunniste: 'PURKU',
    lyhyt: 'Rakennusten purkamiseen liittyvät työt.',
    kuva: purku,
    kuvaAlt: 'Purkutöiden puutavaraa ja kone työmaalla',
    johdanto:
      'Puramme pientaloja, ulkorakennuksia ja muita rakennuksia, ja valmistelemme alueen uutta käyttöä varten.',
    kuvaus: [
      'Purkutyö tehdään suunnitellusti ja turvallisesti. Purun jälkeen alue voidaan tasata tai valmistella suoraan uuden rakennuksen perustustöitä varten.',
      'Kerro purettavasta rakennuksesta ja kohteen olosuhteista, niin arvioimme työn laajuuden ja sopivan toteutustavan.',
    ],
    sisaltaa: ['Pientalojen purku', 'Ulkorakennusten purku', 'Muiden rakennusten purku', 'Alueen valmistelu purun jälkeen'],
    kohteet: ['Pientalot', 'Ulkorakennukset ja saunat', 'Vapaa-ajan kiinteistöt', 'Muut rakennukset'],
  },
];

export const kumppanit = [
  { nimi: 'Novatron', href: 'https://novatron.fi/', logo: 'novatron.jpg' },
  { nimi: 'Villein', href: 'https://www.villein.fi/', logo: 'villein.png' },
  { nimi: 'Prusi', href: 'https://prusi.fi/', logo: 'prusi.png' },
  { nimi: 'LVI Kaipainen', href: 'https://www.lvikaipainen.fi/', logo: 'lvi-kaipainen.png' },
  { nimi: 'Ekojärven Kuljetus Oy', href: null, logo: 'ekojarven-kuljetus.jpg' },
  { nimi: 'Räjäytystyö', href: 'https://rajaytystyo.fi/', logo: 'rajaytystyo.png' },
];
