CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0000_cold_khan.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_slim_lady_deathstrike.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_melted_lilith.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_odd_jasper_sitwell.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_lazy_blur.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_colossal_warbird.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_youthful_power_pack.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_dizzy_champions.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0008_brown_silhouette.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_groovy_tattoo.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0010_faulty_puppet_master.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0011_magical_iron_fist.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0012_flawless_obadiah_stane.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0013_nice_slapstick.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0014_complex_titanium_man.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0015_naive_giant_man.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0016_volatile_red_hulk.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0017_mute_dreaming_celestial.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0018_funny_alex_wilder.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0019_absurd_lilandra.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0020_flawless_lockjaw.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0021_normal_the_initiative.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0022_rainy_mystique.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0023_fast_titanium_man.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0024_aspiring_calypso.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0025_sour_steve_rogers.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0026_tricky_madripoor.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0027_light_alice.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0028_steady_steve_rogers.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0029_charming_maginty.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0030_mature_skrulls.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0031_silent_cable.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0032_stormy_thena.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0033_flashy_harrier.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0034_puzzling_night_nurse.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0035_clean_hydra.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0036_tired_klaw.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0037_tough_korath.sql');
