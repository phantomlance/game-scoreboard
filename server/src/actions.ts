import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, desc, eq, sql } from "drizzle-orm";
import * as schema from "./schema";

const playerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  score: z.number().int(),
  created_at: z.string(),
});

const mutationResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

const spadesTeamSchema = z.object({
  name: z.string(),
  score: z.number().int(),
  bags: z.number().int().min(0).max(9),
});

const nilBidSchema = z.enum(["none", "made", "missed", "blind_made", "blind_missed"]);
type NilBid = z.infer<typeof nilBidSchema>;

const spadesRoundSchema = z.object({
  id: z.number().int(),
  round_number: z.number().int(),
  team_one_bid: z.number().int(),
  team_one_tricks: z.number().int(),
  team_one_delta: z.number().int(),
  team_one_bags_after: z.number().int(),
  team_one_nil: nilBidSchema,
  team_two_bid: z.number().int(),
  team_two_tricks: z.number().int(),
  team_two_delta: z.number().int(),
  team_two_bags_after: z.number().int(),
  team_two_nil: nilBidSchema,
});

function nilAdjustment(nil: NilBid) {
  if (nil === "made") return 100;
  if (nil === "missed") return -100;
  if (nil === "blind_made") return 200;
  if (nil === "blind_missed") return -200;
  return 0;
}

function scoreSpadesHand(bid: number, tricks: number, currentBags: number, nil: NilBid) {
  const nilPoints = nilAdjustment(nil);
  if (tricks < bid) {
    return { delta: -10 * bid + nilPoints, bags: currentBags };
  }
  const overtricks = tricks - bid;
  const rawBags = currentBags + overtricks;
  const penalties = Math.floor(rawBags / 10);
  return {
    delta: 10 * bid + overtricks - penalties * 100 + nilPoints,
    bags: rawBags % 10,
  };
}

export const Actions = {
  getScoreboard: defineAction({
    request: z.object({}),
    response: z.object({ players: z.array(playerSchema) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.players).orderBy(asc(schema.players.id));
      return {
        players: rows.map((player) => ({
          id: player.id,
          name: player.name,
          score: player.score,
          created_at: player.createdAt.toISOString(),
        })),
      };
    },
  }),

  addPlayer: defineAction({
    request: z.object({ name: z.string().max(40) }),
    response: z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), id: z.number().int() }),
      z.object({ ok: z.literal(false), message: z.string() }),
    ]),
    async handler(ctx, args) {
      const name = args.name.trim().replace(/\s+/g, " ");
      if (!name) return { ok: false as const, message: "Enter a player name." };

      const db = ctx.db<typeof schema>();
      const existing = await db.select({ name: schema.players.name }).from(schema.players);
      if (existing.some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        return { ok: false as const, message: "That player is already on the board." };
      }

      const insertedRows = await db.insert(schema.players).values({ name }).returning({ id: schema.players.id });
      const inserted = insertedRows[0];
      if (!inserted) return { ok: false as const, message: "Could not add the player. Try again." };
      ctx.invalidateQueries();
      return { ok: true as const, id: inserted.id };
    },
  }),

  adjustScore: defineAction({
    request: z.object({
      playerId: z.number().int().positive(),
      delta: z.number().int().min(-999).max(999).refine((value) => value !== 0),
    }),
    response: mutationResponse,
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const updatedRows = await db
        .update(schema.players)
        .set({ score: sql<number>`${schema.players.score} + ${args.delta}` })
        .where(eq(schema.players.id, args.playerId))
        .returning({ id: schema.players.id });

      if (!updatedRows[0]) return { ok: false as const, message: "That player is no longer on the board." };

      await db.insert(schema.scoreEvents).values({ playerId: args.playerId, delta: args.delta });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  resetGame: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.scoreEvents);
      await db.delete(schema.players);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  getSpadesScorecard: defineAction({
    request: z.object({}),
    response: z.object({
      team_one: spadesTeamSchema,
      team_two: spadesTeamSchema,
      rounds: z.array(spadesRoundSchema),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const gameRows = await db.select().from(schema.spadesGame).where(eq(schema.spadesGame.id, 1));
      const game = gameRows[0];
      const rounds = await db.select().from(schema.spadesRounds).orderBy(asc(schema.spadesRounds.roundNumber));
      return {
        team_one: {
          name: game?.teamOneName ?? "Team 1",
          score: game?.teamOneScore ?? 0,
          bags: game?.teamOneBags ?? 0,
        },
        team_two: {
          name: game?.teamTwoName ?? "Team 2",
          score: game?.teamTwoScore ?? 0,
          bags: game?.teamTwoBags ?? 0,
        },
        rounds: rounds.map((round) => ({
          id: round.id,
          round_number: round.roundNumber,
          team_one_bid: round.teamOneBid,
          team_one_tricks: round.teamOneTricks,
          team_one_delta: round.teamOneDelta,
          team_one_bags_after: round.teamOneBagsAfter,
          team_one_nil: round.teamOneNil,
          team_two_bid: round.teamTwoBid,
          team_two_tricks: round.teamTwoTricks,
          team_two_delta: round.teamTwoDelta,
          team_two_bags_after: round.teamTwoBagsAfter,
          team_two_nil: round.teamTwoNil,
        })),
      };
    },
  }),

  saveSpadesTeamNames: defineAction({
    request: z.object({ teamOneName: z.string().max(40), teamTwoName: z.string().max(40) }),
    response: mutationResponse,
    async handler(ctx, args) {
      const teamOneName = args.teamOneName.trim().replace(/\s+/g, " ");
      const teamTwoName = args.teamTwoName.trim().replace(/\s+/g, " ");
      if (!teamOneName || !teamTwoName) return { ok: false as const, message: "Enter both team names." };
      if (teamOneName.toLocaleLowerCase() === teamTwoName.toLocaleLowerCase()) {
        return { ok: false as const, message: "Use a different name for each team." };
      }
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.spadesGame)
        .values({ id: 1, teamOneName, teamTwoName })
        .onConflictDoUpdate({
          target: schema.spadesGame.id,
          set: { teamOneName, teamTwoName, updatedAt: new Date() },
        });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addSpadesRound: defineAction({
    request: z.object({
      teamOneBid: z.number().int().min(1).max(13),
      teamOneTricks: z.number().int().min(0).max(13),
      teamOneNil: nilBidSchema,
      teamTwoBid: z.number().int().min(1).max(13),
      teamTwoTricks: z.number().int().min(0).max(13),
      teamTwoNil: nilBidSchema,
    }),
    response: mutationResponse,
    async handler(ctx, args) {
      if (args.teamOneTricks + args.teamTwoTricks !== 13) {
        return { ok: false as const, message: "The two trick totals must add up to 13." };
      }
      const db = ctx.db<typeof schema>();
      let game = (await db.select().from(schema.spadesGame).where(eq(schema.spadesGame.id, 1)))[0];
      if (!game) {
        const created = await db.insert(schema.spadesGame).values({ id: 1 }).returning();
        game = created[0];
      }
      if (!game) return { ok: false as const, message: "Could not start the Spades scorecard." };

      const teamOne = scoreSpadesHand(args.teamOneBid, args.teamOneTricks, game.teamOneBags, args.teamOneNil);
      const teamTwo = scoreSpadesHand(args.teamTwoBid, args.teamTwoTricks, game.teamTwoBags, args.teamTwoNil);
      const latestRound = (await db
        .select({ roundNumber: schema.spadesRounds.roundNumber })
        .from(schema.spadesRounds)
        .orderBy(desc(schema.spadesRounds.roundNumber))
        .limit(1))[0];
      const roundNumber = (latestRound?.roundNumber ?? 0) + 1;

      await db.insert(schema.spadesRounds).values({
        roundNumber,
        teamOneBid: args.teamOneBid,
        teamOneTricks: args.teamOneTricks,
        teamOneDelta: teamOne.delta,
        teamOneBagsAfter: teamOne.bags,
        teamOneNil: args.teamOneNil,
        teamTwoBid: args.teamTwoBid,
        teamTwoTricks: args.teamTwoTricks,
        teamTwoDelta: teamTwo.delta,
        teamTwoBagsAfter: teamTwo.bags,
        teamTwoNil: args.teamTwoNil,
      });
      await db.update(schema.spadesGame).set({
        teamOneScore: game.teamOneScore + teamOne.delta,
        teamTwoScore: game.teamTwoScore + teamTwo.delta,
        teamOneBags: teamOne.bags,
        teamTwoBags: teamTwo.bags,
        updatedAt: new Date(),
      }).where(eq(schema.spadesGame.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  undoSpadesRound: defineAction({
    request: z.object({}),
    response: mutationResponse,
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rounds = await db.select().from(schema.spadesRounds).orderBy(asc(schema.spadesRounds.roundNumber));
      const latest = rounds[rounds.length - 1];
      if (!latest) return { ok: false as const, message: "There isn’t a round to undo." };
      const remaining = rounds.slice(0, -1);
      const previous = remaining[remaining.length - 1];
      const teamOneScore = remaining.reduce((total, round) => total + round.teamOneDelta, 0);
      const teamTwoScore = remaining.reduce((total, round) => total + round.teamTwoDelta, 0);
      await db.delete(schema.spadesRounds).where(eq(schema.spadesRounds.id, latest.id));
      await db.update(schema.spadesGame).set({
        teamOneScore,
        teamTwoScore,
        teamOneBags: previous?.teamOneBagsAfter ?? 0,
        teamTwoBags: previous?.teamTwoBagsAfter ?? 0,
        updatedAt: new Date(),
      }).where(eq(schema.spadesGame.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  resetSpadesGame: defineAction({
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.spadesRounds);
      await db.update(schema.spadesGame).set({
        teamOneScore: 0,
        teamTwoScore: 0,
        teamOneBags: 0,
        teamTwoBags: 0,
        updatedAt: new Date(),
      }).where(eq(schema.spadesGame.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;

export type Actions = typeof Actions;
