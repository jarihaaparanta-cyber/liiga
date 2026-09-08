-- Liigapörssi: tietokantaskeema
--
-- Keskeinen idea: pisteet tallennetaan OTTELUKOHTAISESTI, koska joukkueen
-- pistesaldo riippuu siitä, minä päivinä kukin pelaaja on ollut kokoonpanossa.
-- Kaikki summat lasketaan tästä taulusta ajonaikaisesti.

-- Liigan pelaajat sellaisena kuin liiga.fi ne tuntee.
CREATE TABLE players (
  id            INTEGER PRIMARY KEY,   -- liiga.fi:n pelaaja-ID
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  team          TEXT NOT NULL,         -- seuran lyhenne, esim. "TPS"
  position      TEXT NOT NULL,         -- 'F' = hyökkääjä, 'D' = pakki, 'G' = maalivahti
  jersey        INTEGER,
  updated_at    TEXT NOT NULL
);

-- Yksi rivi per pelaaja per ottelu, myös silloin kun pelaaja pelasi
-- pisteittä (goals = 0, assists = 0). Nollarivit tarvitaan, jotta
-- otteluiden lukumäärä (O-sarake) voidaan laskea aikavälille.
CREATE TABLE player_game_stats (
  player_id   INTEGER NOT NULL,
  game_id     INTEGER NOT NULL,
  game_date   TEXT    NOT NULL,        -- YYYY-MM-DD, Suomen aikaa
  goals       INTEGER NOT NULL DEFAULT 0,
  assists     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, game_id)
);
CREATE INDEX idx_pgs_player_date ON player_game_stats (player_id, game_date);
CREATE INDEX idx_pgs_date        ON player_game_stats (game_date);

-- Haetut ottelut, jotta inkrementaalinen synkronointi tietää mitä on jo tehty.
-- Keskeneräistä ottelua ei merkitä valmiiksi, joten se haetaan uudelleen.
CREATE TABLE games (
  id          INTEGER PRIMARY KEY,
  game_date   TEXT    NOT NULL,
  season      TEXT    NOT NULL,
  home_team   TEXT    NOT NULL,
  away_team   TEXT    NOT NULL,
  finished    INTEGER NOT NULL DEFAULT 0,
  synced_at   TEXT
);
CREATE INDEX idx_games_date ON games (game_date);

-- Liigapörssin joukkueet eli kaverit.
CREATE TABLE fantasy_teams (
  id          TEXT PRIMARY KEY,        -- 'apa', 'jarde', ...
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  -- Tunnusluku, jolla omistaja vahvistaa vaihdon. Tallennetaan tiivisteenä.
  pin_hash    TEXT
);

-- Kokoonpano. Avausviisikko: 3 hyökkääjää + 2 pakkia. Lisäksi yksi
-- varahyökkääjä ja yksi varapakki.
CREATE TABLE roster (
  team_id     TEXT    NOT NULL REFERENCES fantasy_teams(id),
  player_id   INTEGER NOT NULL,
  position    TEXT    NOT NULL CHECK (position IN ('F','D')),
  is_starter  INTEGER NOT NULL,        -- 1 = avauskokoonpanossa kauden alussa
  slot_order  INTEGER NOT NULL,
  PRIMARY KEY (team_id, player_id)
);

-- Tehdyt vaihdot. Joukkue saa tehdä koko runkosarjan aikana yhden
-- hyökkääjävaihdon ja yhden pakkivaihdon, minkä uniikki indeksi varmistaa.
CREATE TABLE swaps (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         TEXT    NOT NULL REFERENCES fantasy_teams(id),
  position        TEXT    NOT NULL CHECK (position IN ('F','D')),
  out_player_id   INTEGER NOT NULL,
  in_player_id    INTEGER NOT NULL,
  -- Ensimmäinen päivä jolta sisään tullut pelaaja kerryttää pisteitä, ja
  -- samalla ensimmäinen päivä jolta ulos jäänyt ei enää kerrytä.
  effective_date  TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);
CREATE UNIQUE INDEX idx_swaps_one_per_position ON swaps (team_id, position);

-- Synkronointiajojen loki, jotta käyttöliittymä voi kertoa milloin luvut
-- ovat viimeksi päivittyneet ja jotta epäonnistumiset näkyvät.
CREATE TABLE sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  kind        TEXT NOT NULL,           -- 'backfill' | 'nightly' | 'correction' | 'manual'
  ok          INTEGER,
  games_synced INTEGER NOT NULL DEFAULT 0,
  message     TEXT
);
