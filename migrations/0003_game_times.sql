-- Otteluiden alkuaika ja tulos, jotta sivulla voi näyttää päivän ottelut.
--
-- Aika säilytetään sellaisenaan UTC-muodossa niin kuin liiga.fi sen antaa;
-- muunnos Suomen aikaan tehdään vasta näytettäessä.

ALTER TABLE games ADD COLUMN start_time TEXT;
ALTER TABLE games ADD COLUMN started    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN home_goals INTEGER;
ALTER TABLE games ADD COLUMN away_goals INTEGER;
