-- Muodostettu automaattisesti: node scripts/generate-seed.mjs
-- Lähde: data/rosters.json

INSERT INTO fantasy_teams (id, name, color, sort_order) VALUES ('apa', 'Apa', '#2E6FE0', 1);
INSERT INTO fantasy_teams (id, name, color, sort_order) VALUES ('jarde', 'Jarde', '#B98600', 2);
INSERT INTO fantasy_teams (id, name, color, sort_order) VALUES ('borje', 'Börje', '#E62E4D', 3);
INSERT INTO fantasy_teams (id, name, color, sort_order) VALUES ('niksu', 'Niksu', '#00A878', 4);

-- Apa
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 40049925, 'F', 1, 1); -- Santeri Huovila (JYP)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 60799830, 'F', 1, 2); -- Lukas Wernblom (TPS)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 61073597, 'F', 1, 3); -- Brendan Ranford (HPK)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 24501132, 'D', 1, 4); -- Jyrki Jokipakka (Tappara)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 61029234, 'D', 1, 5); -- Alexis Binner (TPS)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 31275998, 'F', 0, 6); -- Alexander Forslund (Jokerit)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('apa', 61073595, 'D', 0, 7); -- Chad Nychuk (HPK)

-- Jarde
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 60954325, 'F', 1, 1); -- Maxime Fortier (Jokerit)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 22870292, 'F', 1, 2); -- Harri Pesonen (JYP)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 30712591, 'F', 1, 3); -- Henri Nikkanen (Jokerit)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 60351425, 'D', 1, 4); -- Simon Åkerström (Sport)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 40005621, 'D', 1, 5); -- Santeri Airola (SaiPa)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 25126574, 'F', 0, 6); -- Mikael Ruohomaa (Lukko)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('jarde', 22768061, 'D', 0, 7); -- Kristian Näkyvä (K-Espoo)

-- Börje
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 33490124, 'F', 1, 1); -- Benjamin Rautiainen (Tappara)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 33209030, 'F', 1, 2); -- Jere Lassila (JYP)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 32269686, 'F', 1, 3); -- Roni Hirvonen (Kärpät)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 23595916, 'D', 1, 4); -- Sami Vatanen (JYP)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 60342512, 'D', 1, 5); -- Matt Caito (Jokerit)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 61081809, 'F', 0, 6); -- Michael Lindqvist (Tappara)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('borje', 28897266, 'D', 0, 7); -- Juuso Arola (JYP)

-- Niksu
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 60963285, 'F', 1, 1); -- Joachim Blichfeld (Tappara)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 60544772, 'F', 1, 2); -- Lukas Jasek (Ilves)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 25506929, 'F', 1, 3); -- Teemu Turunen (Jokerit)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 60351426, 'D', 1, 4); -- Jakob Stenqvist (Lukko)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 60952399, 'D', 1, 5); -- Jiri Ticháček (Kärpät)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 30010552, 'F', 0, 6); -- Leevi Tukiainen (JYP)
INSERT INTO roster (team_id, player_id, position, is_starter, slot_order) VALUES ('niksu', 40215681, 'D', 0, 7); -- Ville Ruotsalainen (KalPa)
