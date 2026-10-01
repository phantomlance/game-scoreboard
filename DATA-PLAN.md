# Data Plan

## Context provenance
- “Yes, rebuild it as a saved app.” (current user request; requires server-backed persistence across sessions)
- “add players, add points to each player, total points at the bottom for each player, show who is leading, no reordering when points are added” (verbatim build request; defines the core scoring flow and fixed roster order)
- Prior conversation says players should survive refreshes until Reset, and that leader highlighting must not reorder them (parent conversation; clarifies persistence and ordering behavior).

## Tested sources
No external sources are needed. This is a user-entry artifact whose records are created only through its own UI and stored in its own database.

## Imagery
Imagery not needed: the artifact is an in-the-moment scorekeeping utility with no real-world visual subjects; large readable scores and tactile controls are the visual focus.

## Long-term data behavior
- **Refresh policy**: Players and totals load from the artifact database whenever the artifact opens; no scheduled refresh.
- **Growth**: One row per player plus one score-event row per point adjustment; Reset explicitly clears all players and score history.
- **Ordering**: Players retain immutable creation order; score changes never reorder the roster or totals summary.
- **Time semantics**: Creation timestamps are persistence metadata only and are not shown as gameplay times.

## Rejected approaches
- **Tried**: Browser-only/local storage persistence.
  **Why rejected**: The user explicitly chose a server-backed saved artifact so state survives reopening and sessions.
- **Tried**: Sorting players by score.
  **Why rejected**: The user explicitly said not to reorder; leaders are indicated with styling and labels in place.
