ALTER TABLE spades_rounds ADD COLUMN team_one_nil TEXT NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE spades_rounds ADD COLUMN team_two_nil TEXT NOT NULL DEFAULT 'none';
