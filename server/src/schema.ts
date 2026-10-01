import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const scoreEvents = sqliteTable(
  "score_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("score_events_player_id_idx").on(table.playerId)],
);

export const spadesGame = sqliteTable("spades_game", {
  id: integer("id").primaryKey(),
  teamOneName: text("team_one_name").notNull().default("Team 1"),
  teamTwoName: text("team_two_name").notNull().default("Team 2"),
  teamOneScore: integer("team_one_score").notNull().default(0),
  teamTwoScore: integer("team_two_score").notNull().default(0),
  teamOneBags: integer("team_one_bags").notNull().default(0),
  teamTwoBags: integer("team_two_bags").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const spadesRounds = sqliteTable("spades_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roundNumber: integer("round_number").notNull(),
  teamOneBid: integer("team_one_bid").notNull(),
  teamOneTricks: integer("team_one_tricks").notNull(),
  teamOneDelta: integer("team_one_delta").notNull(),
  teamOneBagsAfter: integer("team_one_bags_after").notNull(),
  teamOneNil: text("team_one_nil", { enum: ["none", "made", "missed", "blind_made", "blind_missed"] }).notNull().default("none"),
  teamTwoBid: integer("team_two_bid").notNull(),
  teamTwoTricks: integer("team_two_tricks").notNull(),
  teamTwoDelta: integer("team_two_delta").notNull(),
  teamTwoBagsAfter: integer("team_two_bags_after").notNull(),
  teamTwoNil: text("team_two_nil", { enum: ["none", "made", "missed", "blind_made", "blind_missed"] }).notNull().default("none"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
