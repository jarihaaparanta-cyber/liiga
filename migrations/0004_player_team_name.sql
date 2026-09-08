-- Seuran koko nimi pelaajataulussa.
--
-- Ottelutaulu käyttää koko nimeä ("Kärpät") ja pelaajataulu lyhennettä
-- ("KÄR"). Putkilaskenta tarvitsee pelaajan seuran ottelut, joten nimi
-- tallennetaan molemmissa muodoissa.

ALTER TABLE players ADD COLUMN team_name TEXT;
