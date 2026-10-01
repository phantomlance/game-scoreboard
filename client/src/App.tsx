import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type ApiResponse } from "./api";

type Player = ApiResponse<typeof api, "getScoreboard">["players"][number];
type NilBid = "none" | "made" | "missed" | "blind_made" | "blind_missed";
type Tab = "scoreboard" | "spades";

function nilLabel(value: NilBid) {
  if (value === "made") return "Nil made";
  if (value === "missed") return "Nil missed";
  if (value === "blind_made") return "Blind nil made";
  if (value === "blind_missed") return "Blind nil missed";
  return "No nil bid";
}

function scoreLabel(score: number) {
  return `${score} ${Math.abs(score) === 1 ? "point" : "points"}`;
}

function AppTabs({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="game-tabs" aria-label="Scorecard type">
      <button
        type="button"
        className={activeTab === "scoreboard" ? "is-active" : ""}
        aria-current={activeTab === "scoreboard" ? "page" : undefined}
        onClick={() => onChange("scoreboard")}
      >
        Scoreboard
      </button>
      <button
        type="button"
        className={activeTab === "spades" ? "is-active" : ""}
        aria-current={activeTab === "spades" ? "page" : undefined}
        onClick={() => onChange("spades")}
      >
        Spades
      </button>
    </nav>
  );
}

function StandardScoreboard() {
  const queryClient = useQueryClient();
  const [newPlayer, setNewPlayer] = useState("");
  const [customPoints, setCustomPoints] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);

  const scoreboard = useQuery({ queryKey: ["scoreboard"], queryFn: () => api.getScoreboard({}) });
  const refreshScoreboard = async () => queryClient.invalidateQueries({ queryKey: ["scoreboard"] });

  const addPlayer = useMutation({
    mutationFn: (name: string) => api.addPlayer({ name }),
    onSuccess: async (result) => {
      if (!result.ok) return setMessage(result.message);
      setNewPlayer("");
      setMessage(null);
      await refreshScoreboard();
    },
    onError: () => setMessage("Could not add the player. Try again."),
  });

  const adjustScore = useMutation({
    mutationFn: ({ playerId, delta }: { playerId: number; delta: number }) => api.adjustScore({ playerId, delta }),
    onMutate: ({ playerId }) => {
      setActivePlayerId(playerId);
      setMessage(null);
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) return setMessage(result.message);
      setCustomPoints((current) => ({ ...current, [variables.playerId]: "" }));
      await refreshScoreboard();
    },
    onError: () => setMessage("Could not update the score. Try again."),
    onSettled: () => setActivePlayerId(null),
  });

  const resetGame = useMutation({
    mutationFn: () => api.resetGame({}),
    onSuccess: async () => {
      setConfirmReset(false);
      setCustomPoints({});
      setMessage(null);
      await refreshScoreboard();
    },
    onError: () => setMessage("Could not reset the game. Try again."),
  });

  const players = scoreboard.data?.players ?? [];
  const highScore = useMemo(
    () => (players.length ? Math.max(...players.map((player) => player.score)) : null),
    [players],
  );
  const leaders = highScore === null ? [] : players.filter((player) => player.score === highScore);

  const submitPlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPlayer.trim()) return setMessage("Enter a player name.");
    addPlayer.mutate(newPlayer);
  };

  const submitCustomPoints = (event: FormEvent<HTMLFormElement>, player: Player) => {
    event.preventDefault();
    const value = Number(customPoints[player.id]);
    if (!Number.isInteger(value) || value === 0 || value < -999 || value > 999) {
      return setMessage("Enter a whole number from −999 to 999, except zero.");
    }
    adjustScore.mutate({ playerId: player.id, delta: value });
  };

  const leaderText =
    leaders.length === 1
      ? `${leaders[0]?.name ?? ""} leads with ${scoreLabel(leaders[0]?.score ?? 0)}`
      : leaders.length > 1
        ? `${leaders.map((player) => player.name).join(" & ")} are tied at ${highScore}`
        : "Add a player to start scoring";

  return (
    <>
      <section className="score-entry" aria-labelledby="score-entry-title">
        <div className="round-mark" aria-hidden="true">LIVE SCORE</div>
        <h1 id="score-entry-title">Who’s playing?</h1>
        <p className="intro-copy">Build the roster once. Scores save automatically.</p>
        <form className="add-player-form" onSubmit={submitPlayer}>
          <label htmlFor="player-name">Player name</label>
          <div className="add-player-row">
            <input id="player-name" value={newPlayer} onChange={(event) => setNewPlayer(event.target.value)} maxLength={40} autoComplete="off" placeholder="Enter a name" />
            <button type="submit" disabled={addPlayer.isPending}>{addPlayer.isPending ? "Adding…" : "Add player"}</button>
          </div>
        </form>
      </section>

      {message ? <StatusMessage message={message} onDismiss={() => setMessage(null)} /> : null}

      {scoreboard.isPending ? (
        <LoadingState label="Loading scoreboard" />
      ) : scoreboard.isError ? (
        <ErrorState title="Scoreboard unavailable" body="We couldn’t load the saved game." onRetry={() => scoreboard.refetch()} />
      ) : players.length === 0 ? (
        <section className="empty-state"><span className="empty-number" aria-hidden="true">00</span><h2>Your board is open</h2><p>Add the first player above, then start the points.</p></section>
      ) : (
        <>
          <section className="leader-strip" aria-live="polite"><span className="leader-signal" aria-hidden="true" /><div><span className="leader-label">Current lead</span><strong>{leaderText}</strong></div></section>
          <section className="players" aria-label="Players and scoring controls">
            {players.map((player, index) => {
              const isLeader = player.score === highScore;
              const busy = adjustScore.isPending && activePlayerId === player.id;
              return (
                <article className={`player-lane${isLeader ? " is-leader" : ""}`} key={player.id}>
                  <div className="player-heading">
                    <span className="player-order">{String(index + 1).padStart(2, "0")}</span>
                    <div className="player-name-wrap"><h2>{player.name}</h2>{isLeader ? <span className="leader-tag">Leader</span> : null}</div>
                    <output className="big-score" aria-label={`${player.name} score`}>{player.score}</output>
                  </div>
                  <div className="quick-actions" aria-label={`Quick points for ${player.name}`}>
                    <button type="button" className="minus-button" disabled={adjustScore.isPending} onClick={() => adjustScore.mutate({ playerId: player.id, delta: -1 })} aria-label={`Subtract 1 point from ${player.name}`}>−1</button>
                    <button type="button" disabled={adjustScore.isPending} onClick={() => adjustScore.mutate({ playerId: player.id, delta: 1 })} aria-label={`Add 1 point to ${player.name}`}>+1</button>
                    <button type="button" disabled={adjustScore.isPending} onClick={() => adjustScore.mutate({ playerId: player.id, delta: 5 })} aria-label={`Add 5 points to ${player.name}`}>+5</button>
                  </div>
                  <form className="custom-score" onSubmit={(event) => submitCustomPoints(event, player)}>
                    <label htmlFor={`custom-${player.id}`}>Other points</label>
                    <input id={`custom-${player.id}`} type="number" inputMode="numeric" min={-999} max={999} step={1} value={customPoints[player.id] ?? ""} onChange={(event) => setCustomPoints((current) => ({ ...current, [player.id]: event.target.value }))} placeholder="± amount" aria-label={`Custom points for ${player.name}`} />
                    <button type="submit" disabled={adjustScore.isPending}>{busy ? "Saving…" : "Apply"}</button>
                  </form>
                </article>
              );
            })}
          </section>
          <section className="totals" aria-labelledby="totals-heading">
            <div className="totals-heading-row"><h2 id="totals-heading">Totals</h2><span>Added order</span></div>
            <ol>{players.map((player, index) => <li key={player.id} className={player.score === highScore ? "is-leader" : ""}><span className="total-order">{String(index + 1).padStart(2, "0")}</span><span className="total-name">{player.name}</span>{player.score === highScore ? <span className="total-leader">Leads</span> : null}<strong>{player.score}</strong></li>)}</ol>
          </section>
          <ResetControl confirm={confirmReset} onBegin={() => setConfirmReset(true)} onCancel={() => setConfirmReset(false)} onConfirm={() => resetGame.mutate()} pending={resetGame.isPending} title="Clear this game?" body="This removes every player and score." />
        </>
      )}
    </>
  );
}

function SpadesScorecard() {
  const queryClient = useQueryClient();
  const [teamOneName, setTeamOneName] = useState("Team 1");
  const [teamTwoName, setTeamTwoName] = useState("Team 2");
  const [namesEdited, setNamesEdited] = useState(false);
  const [teamOneBid, setTeamOneBid] = useState("");
  const [teamOneTricks, setTeamOneTricks] = useState("");
  const [teamOneNil, setTeamOneNil] = useState<NilBid>("none");
  const [teamTwoBid, setTeamTwoBid] = useState("");
  const [teamTwoTricks, setTeamTwoTricks] = useState("");
  const [teamTwoNil, setTeamTwoNil] = useState<NilBid>("none");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const scorecard = useQuery({ queryKey: ["spades-scorecard"], queryFn: () => api.getSpadesScorecard({}) });
  const data = scorecard.data;
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["spades-scorecard"] });

  useEffect(() => {
    if (data && !namesEdited) {
      setTeamOneName(data.team_one.name);
      setTeamTwoName(data.team_two.name);
    }
  }, [data, namesEdited]);

  const saveNames = useMutation({
    mutationFn: () => api.saveSpadesTeamNames({ teamOneName, teamTwoName }),
    onSuccess: async (result) => {
      if (!result.ok) return setMessage(result.message);
      setNamesEdited(false);
      setMessage("Team names saved.");
      await refresh();
    },
    onError: () => setMessage("Could not save team names."),
  });

  const addRound = useMutation({
    mutationFn: (values: { teamOneBid: number; teamOneTricks: number; teamOneNil: NilBid; teamTwoBid: number; teamTwoTricks: number; teamTwoNil: NilBid }) => api.addSpadesRound(values),
    onSuccess: async (result) => {
      if (!result.ok) return setMessage(result.message);
      setTeamOneBid("");
      setTeamOneTricks("");
      setTeamOneNil("none");
      setTeamTwoBid("");
      setTeamTwoTricks("");
      setTeamTwoNil("none");
      setMessage(null);
      await refresh();
    },
    onError: () => setMessage("Could not save that round."),
  });

  const undoRound = useMutation({
    mutationFn: () => api.undoSpadesRound({}),
    onSuccess: async (result) => {
      if (!result.ok) return setMessage(result.message);
      setMessage("Last round removed.");
      await refresh();
    },
    onError: () => setMessage("Could not undo the last round."),
  });

  const resetGame = useMutation({
    mutationFn: () => api.resetSpadesGame({}),
    onSuccess: async () => {
      setConfirmReset(false);
      setMessage(null);
      await refresh();
    },
    onError: () => setMessage("Could not reset the Spades game."),
  });

  const submitRound = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = [teamOneBid, teamOneTricks, teamTwoBid, teamTwoTricks].map(Number);
    if (values.some((value) => !Number.isInteger(value))) return setMessage("Enter whole numbers for every bid and trick total.");
    const [oneBid = 0, oneTricks = 0, twoBid = 0, twoTricks = 0] = values;
    if (oneBid < 1 || oneBid > 13 || twoBid < 1 || twoBid > 13 || oneTricks < 0 || oneTricks > 13 || twoTricks < 0 || twoTricks > 13) {
      return setMessage("Bids must be 1–13 and tricks must be 0–13.");
    }
    addRound.mutate({ teamOneBid: oneBid, teamOneTricks: oneTricks, teamOneNil, teamTwoBid: twoBid, teamTwoTricks: twoTricks, teamTwoNil });
  };

  const leader = data
    ? data.team_one.score === data.team_two.score
      ? "Tied game"
      : data.team_one.score > data.team_two.score
        ? `${data.team_one.name} leads`
        : `${data.team_two.name} leads`
    : "New game";

  return (
    <>
      <section className="spades-hero" aria-labelledby="spades-title">
        <div><div className="round-mark">♠ SPADES</div><h1 id="spades-title">Bid. Take tricks. Keep score.</h1><p className="intro-copy">A separate two-team scorecard with bags tracked automatically.</p></div>
        <div className="spades-lead"><span>Game status</span><strong>{leader}</strong></div>
      </section>

      {message ? <StatusMessage message={message} onDismiss={() => setMessage(null)} /> : null}

      {scorecard.isPending ? <LoadingState label="Loading Spades scorecard" /> : scorecard.isError || !data ? (
        <ErrorState title="Spades scorecard unavailable" body="We couldn’t load this saved game." onRetry={() => scorecard.refetch()} />
      ) : (
        <>
          <section className="spades-scores" aria-label="Spades team totals">
            {[data.team_one, data.team_two].map((team, index) => {
              const isLeader = data.team_one.score !== data.team_two.score && team.score === Math.max(data.team_one.score, data.team_two.score);
              return <article className={`team-score${isLeader ? " is-leader" : ""}`} key={index}><span className="team-number">TEAM {index + 1}</span><h2>{team.name}</h2><output aria-label={`${team.name} score`}>{team.score}</output><span className="bags"><strong>{team.bags}</strong> / 10 bags</span></article>;
            })}
          </section>

          <section className="spades-panel" aria-labelledby="team-names-title">
            <div className="section-heading"><div><span className="section-index">01</span><h2 id="team-names-title">Teams</h2></div><p>Rename anytime</p></div>
            <form className="team-name-form" onSubmit={(event) => { event.preventDefault(); saveNames.mutate(); }}>
              <div className="team-name-field"><label htmlFor="team-one-name">Team 1</label><input id="team-one-name" aria-label="Team 1 name" value={teamOneName} maxLength={40} onChange={(event) => { setTeamOneName(event.target.value); setNamesEdited(true); }} /></div>
              <div className="team-name-field"><label htmlFor="team-two-name">Team 2</label><input id="team-two-name" aria-label="Team 2 name" value={teamTwoName} maxLength={40} onChange={(event) => { setTeamTwoName(event.target.value); setNamesEdited(true); }} /></div>
              <button type="submit" disabled={saveNames.isPending || !namesEdited}>{saveNames.isPending ? "Saving…" : "Save names"}</button>
            </form>
          </section>

          <section className="spades-panel" aria-labelledby="round-entry-title">
            <div className="section-heading"><div><span className="section-index">02</span><h2 id="round-entry-title">Add round {data.rounds.length + 1}</h2></div><p>13 tricks total</p></div>
            <form className="round-form" onSubmit={submitRound}>
              <fieldset><legend>{data.team_one.name}</legend><label>Bid<input aria-label={`${data.team_one.name} bid`} type="number" inputMode="numeric" min={1} max={13} value={teamOneBid} onChange={(event) => setTeamOneBid(event.target.value)} placeholder="Bid" /></label><label>Tricks<input aria-label={`${data.team_one.name} tricks`} type="number" inputMode="numeric" min={0} max={13} value={teamOneTricks} onChange={(event) => setTeamOneTricks(event.target.value)} placeholder="Won" /></label><label className="nil-field">Nil result<select aria-label={`${data.team_one.name} nil result`} value={teamOneNil} onChange={(event) => setTeamOneNil(event.target.value as NilBid)}><option value="none">No nil</option><option value="made">Nil made (+100)</option><option value="missed">Nil missed (−100)</option><option value="blind_made">Blind nil made (+200)</option><option value="blind_missed">Blind nil missed (−200)</option></select></label></fieldset>
              <fieldset><legend>{data.team_two.name}</legend><label>Bid<input aria-label={`${data.team_two.name} bid`} type="number" inputMode="numeric" min={1} max={13} value={teamTwoBid} onChange={(event) => setTeamTwoBid(event.target.value)} placeholder="Bid" /></label><label>Tricks<input aria-label={`${data.team_two.name} tricks`} type="number" inputMode="numeric" min={0} max={13} value={teamTwoTricks} onChange={(event) => setTeamTwoTricks(event.target.value)} placeholder="Won" /></label><label className="nil-field">Nil result<select aria-label={`${data.team_two.name} nil result`} value={teamTwoNil} onChange={(event) => setTeamTwoNil(event.target.value as NilBid)}><option value="none">No nil</option><option value="made">Nil made (+100)</option><option value="missed">Nil missed (−100)</option><option value="blind_made">Blind nil made (+200)</option><option value="blind_missed">Blind nil missed (−200)</option></select></label></fieldset>
              <button type="submit" className="record-round" disabled={addRound.isPending}>{addRound.isPending ? "Scoring…" : "Score round"}</button>
            </form>
            <p className="scoring-note">Made bids score 10× the bid plus overtricks. Missed bids lose 10× the bid. Nil is ±100, blind nil is ±200, and every 10 bags costs 100.</p>
          </section>

          <section className="spades-history" aria-labelledby="round-history-title">
            <div className="section-heading"><div><span className="section-index">03</span><h2 id="round-history-title">Rounds</h2></div>{data.rounds.length ? <button type="button" className="undo-link" onClick={() => undoRound.mutate()} disabled={undoRound.isPending}>{undoRound.isPending ? "Undoing…" : "Undo last"}</button> : null}</div>
            {data.rounds.length === 0 ? <div className="rounds-empty"><strong>No rounds yet</strong><span>Enter both bids and tricks above.</span></div> : (
              <ol className="round-list">{data.rounds.map((round) => <li key={round.id}><span className="round-number">R{round.round_number}</span><div><strong>{data.team_one.name}</strong><span>Bid {round.team_one_bid} · Took {round.team_one_tricks}{round.team_one_nil !== "none" ? ` · ${nilLabel(round.team_one_nil)}` : ""}</span></div><b className={round.team_one_delta < 0 ? "negative" : ""}>{round.team_one_delta > 0 ? "+" : ""}{round.team_one_delta}</b><div><strong>{data.team_two.name}</strong><span>Bid {round.team_two_bid} · Took {round.team_two_tricks}{round.team_two_nil !== "none" ? ` · ${nilLabel(round.team_two_nil)}` : ""}</span></div><b className={round.team_two_delta < 0 ? "negative" : ""}>{round.team_two_delta > 0 ? "+" : ""}{round.team_two_delta}</b></li>)}</ol>
            )}
          </section>

          <ResetControl confirm={confirmReset} onBegin={() => setConfirmReset(true)} onCancel={() => setConfirmReset(false)} onConfirm={() => resetGame.mutate()} pending={resetGame.isPending} title="Clear Spades scores?" body="This removes the round history and scores. Team names stay." />
        </>
      )}
    </>
  );
}

function StatusMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="message" role="status"><span>{message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button></div>;
}

function LoadingState({ label }: { label: string }) {
  return <section className="loading-state" aria-label={label}><div className="loading-line" /><div className="loading-line short" /></section>;
}

function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  return <section className="empty-state"><h2>{title}</h2><p>{body}</p><button type="button" onClick={onRetry}>Try again</button></section>;
}

function ResetControl({ confirm, onBegin, onCancel, onConfirm, pending, title, body }: { confirm: boolean; onBegin: () => void; onCancel: () => void; onConfirm: () => void; pending: boolean; title: string; body: string }) {
  return <div className="reset-zone">{!confirm ? <button type="button" className="reset-link" onClick={onBegin}>Reset game</button> : <div className="reset-confirm" role="group" aria-label="Confirm reset"><div><strong>{title}</strong><p>{body}</p></div><div className="reset-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="danger-button" onClick={onConfirm} disabled={pending}>{pending ? "Clearing…" : "Clear scores"}</button></div></div>}</div>;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("scoreboard");
  return (
    <div className="scoreboard-shell">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="scoreboard-main">
        <AppTabs activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "scoreboard" ? <StandardScoreboard /> : <SpadesScorecard />}
      </main>
    </div>
  );
}
