# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A browser multiplayer implementation of Avalon Hill's 1983 "Naval War" card game. Backend is
Supabase (Postgres + Auth + Realtime + Edge Functions); frontend is Vite/React (TypeScript).
The full player-facing setup walkthrough (Supabase project setup, deploying Edge Functions,
Vercel deploy) lives in `README.md` — read it before touching deploy-related config.

## Commands

All frontend commands run from `app/`:
```bash
npm install
npm run dev      # start Vite dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # preview production build
```

There is no test suite in this repo currently.

Edge Functions (deployed individually, from repo root, via the Supabase CLI):
```bash
supabase functions deploy <name>   # create-game | join-game | start-game | game-action | delete-game
```
Re-run the relevant deploy command any time you edit files under `supabase/functions/`.

Database changes are plain SQL files in `supabase/migrations/`, applied in order (oldest
first) through the Supabase SQL Editor — there's no local migration runner. New migrations
are added as the next `NNNN_*.sql` file and should use `if not exists` / `create or replace`
so they're safe to re-run.

Card art: the 9 scanned sheets in `cards/` are cropped into `app/public/cards/` by
`app/scripts/crop-cards.mjs`, driven by grid coordinates in `app/src/data/cards.json`. Re-run
it (`node scripts/crop-cards.mjs` from `app/`) only if a source scan changes.

## Architecture

### Split rules engine (this is the core thing to understand)

The game rules exist in **two parallel places** that must stay in sync conceptually but are
not shared code (Deno edge functions vs. the Vite app are separate TS projects):

- `supabase/functions/_shared/engine.ts` — pure, stateless rule functions (dealing, shuffling,
  salvo resolution, minefields, scoring, turn order, sinking/elimination checks). No I/O.
- `supabase/functions/_shared/actions.ts` — `dispatchAction()` is the single entry point that
  takes a validated `GameContext` + the calling user's action payload, mutates the in-memory
  context by calling into `engine.ts`, and marks rows dirty. This is where turn legality,
  ownership checks, and the action-type switch statement live.
- `supabase/functions/_shared/context.ts` — `loadContext()` reads the game + players + hands +
  task forces + destroyer squadrons for a game in one shot; `saveContext()` writes back only
  what was marked dirty. The `games` row update uses a `version` column as an optimistic-lock
  compare-and-swap — concurrent actions on the same game race, and the loser gets an HTTP 409
  that the client should retry.
- The five Edge Functions (`create-game`, `join-game`, `start-game`, `game-action`,
  `delete-game`) are thin HTTP wrappers: auth → `loadContext` → mutate/dispatch → `saveContext`.
  All game-turn actions (draw/play/discard/salvo/airstrike/etc.) go through the single
  `game-action` function and `dispatchAction`'s switch, not separate endpoints per action type.

The frontend never re-implements rules — it calls `gameAction()` (`app/src/lib/api.ts`) and
renders whatever state comes back via Postgres Realtime. If you're adding a new player action,
it belongs in `actions.ts` (dispatch/validation) + `engine.ts` (pure rule logic), then a payload
type in `supabase/functions/_shared/types.ts` and `app/src/types/game.ts`.

### Frontend state flow

`useGameData` (`app/src/hooks/useGameData.ts`) is the sole source of live game state: it loads
`games`, `game_players`, `hands` (own hand only — RLS hides others'), `task_forces`,
`destroyer_squadrons`, and `game_log` for a game, then subscribes to Postgres Realtime changes
on each table to keep state live without polling. Components under `app/src/components/`
(`GameBoard`, `ActionPanel`, `Hand`, `TaskForceView`, etc.) are largely presentational and
receive this state as props — they call back into `app/src/lib/api.ts` for mutations.

`app/src/data/cards.json` is the single source of truth for every card's stats/art mapping;
`app/public/cards/` holds the cropped images referenced by it.

### Database / security model

Defined in `supabase/migrations/0001_init.sql` (core tables + RLS + Realtime) and
`0002_chat.sql` (in-game chat). Key tables: `profiles`, `games`, `game_players`, `hands`,
`task_forces`, `destroyer_squadrons`, `game_log`. RLS policies restrict each player to their
own `hands` row and to games they're seated in. The app is invite-only: there is no self
sign-up (anonymous sign-in and email sign-up are both disabled) — accounts are created
manually per-player in the Supabase dashboard, and per-game access is via invite token/link.

### Visual design system

The UI ("Pacific Theater Command" — a 1940s naval HQ plotting-table aesthetic) is fully
specified in `DESIGN.md` and implemented as CSS custom properties + `.ptc-*` utility classes
in `app/src/index.css`, using real embedded font files (Bebas Neue, Courier Prime, JetBrains
Mono) in `app/public/fonts/`, not system-font substitutes. Two deliberate, non-negotiable
constraints documented in `DESIGN.md`'s implementation notes:
- **No dark mode** — single theme only, by design (a lit plotting table has no night variant).
- **Scanned card art is never filtered** (no grayscale/sepia/contrast) — the mood is carried by
  the chrome around the art, not the art itself.

Consult `DESIGN.md` before styling new UI — it documents the palette, typography, layout, and
component conventions (Tactile Switches, Clipboards, Stamped Buttons, Ink Stamps, etc.) in
detail, including which components are and aren't implemented yet.
