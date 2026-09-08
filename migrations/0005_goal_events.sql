-- Ottelun maalit tapahtumina.
--
-- player_game_stats riittää pistelaskentaan, mutta siitä ei näe maalien
-- järjestystä, aikaa eikä kumpi joukkue teki. Ottelutilanteen näyttämiseen
-- tarvitaan tapahtumat sellaisenaan.

CREATE TABLE goal_events (
  game_id     INTEGER NOT NULL,
  event_id    INTEGER NOT NULL,
  game_time   INTEGER,           -- sekunteina ottelun alusta
  period      INTEGER,
  team        TEXT    NOT NULL,  -- maalin tehneen joukkueen nimi
  scorer_id   INTEGER NOT NULL,
  assist_ids  TEXT,              -- pilkulla erotetut pelaaja-ID:t
  home_score  INTEGER,
  away_score  INTEGER,
  goal_types  TEXT,              -- pilkulla erotetut tyyppikoodit
  PRIMARY KEY (game_id, event_id)
);
CREATE INDEX idx_goal_events_game ON goal_events (game_id);
