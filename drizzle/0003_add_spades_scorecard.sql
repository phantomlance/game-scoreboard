CREATE TABLE spades_game (
  id INTEGER PRIMARY KEY,
  team_one_name TEXT NOT NULL DEFAULT 'Team 1',
  team_two_name TEXT NOT NULL DEFAULT 'Team 2',
  team_one_score INTEGER NOT NULL DEFAULT 0,
  team_two_score INTEGER NOT NULL DEFAULT 0,
  team_one_bags INTEGER NOT NULL DEFAULT 0,
  team_two_bags INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE spades_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_number INTEGER NOT NULL,
  team_one_bid INTEGER NOT NULL,
  team_one_tricks INTEGER NOT NULL,
  team_one_delta INTEGER NOT NULL,
  team_one_bags_after INTEGER NOT NULL,
  team_two_bid INTEGER NOT NULL,
  team_two_tricks INTEGER NOT NULL,
  team_two_delta INTEGER NOT NULL,
  team_two_bags_after INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
