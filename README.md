# Naval War

A browser multiplayer version of Avalon Hill's 1983 "Naval War" card game, built on
Supabase (Postgres + Auth + Realtime + Edge Functions) and a Vite/React frontend.

This file walks through getting your Supabase project wired up and the frontend
deployed to Vercel. You don't need any prior experience with either.

## 1. Supabase: database + policies

1. Open your Supabase project's dashboard → **SQL Editor** → **New query**.
2. Open [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in this repo, copy the whole
   file, paste it into the SQL editor, and click **Run**. This creates all the
   tables, security policies, and turns on Realtime for them. It's safe to
   re-run if something fails partway - every statement uses `if not exists`
   or `create or replace` where it matters.
3. Go to **Authentication → Sign In / Providers** and make sure **Anonymous
   Sign-ins** is turned **off** (it's off by default). Under the **Email**
   provider, turn **Allow new users to sign up** **off** too. Together these
   mean nobody can create their own account - the only way in is an account
   you create for them (next step). No email sending is used anywhere in this
   app, so there's nothing to configure for that.

## 1b. Creating logins for your players

This game is closed - accounts only exist if you create them. There's no
sign-up flow and no email involved at all; you hand out a login and password
directly (text, in person, however you like).

For each person in your group:

1. Go to **Authentication → Users** in the Supabase dashboard.
2. Click **Add user → Create new user**.
3. Enter an email-shaped login (their real email address is simplest -
   nothing ever gets sent to it, it's just used as their username) and a
   password you choose.
4. Check **Auto Confirm User**. This is the important part - it skips
   Supabase's confirmation email entirely, so nothing is sent and they can
   sign in immediately.
5. Save, and tell them the login + password however you like.

You only need to do this once per person, however many games you play with
them. Sharing a specific game's invite link (from inside the app, once
you've created a game) is a separate, ordinary step you do per-game.

## 2. Supabase: Edge Functions (the rules engine)

The game's rules engine runs as four Edge Functions (`create-game`,
`join-game`, `start-game`, `game-action`). These need the Supabase CLI to
deploy - here's the from-scratch path:

1. Install the CLI (pick one):
   ```bash
   npm install -g supabase
   ```
2. Log in (opens a browser to authorize):
   ```bash
   supabase login
   ```
3. From the repo root, link this folder to your project. You'll find your
   project ref in the dashboard URL (`https://supabase.com/dashboard/project/<ref>`)
   or under **Project Settings → General**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
4. Deploy each function:
   ```bash
   supabase functions deploy create-game
   supabase functions deploy join-game
   supabase functions deploy start-game
   supabase functions deploy game-action
   ```

That's it for the backend - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are automatically available to your functions at
runtime; you don't need to set them yourself.

If you ever change files under `supabase/functions/`, just re-run the
relevant `supabase functions deploy <name>` command to redeploy it.

## 3. Frontend: local setup

1. In the Supabase dashboard, go to **Project Settings → API** and copy the
   **Project URL** and the **anon public** key.
2. In `app/`, copy the example env file and fill it in:
   ```bash
   cd app
   cp .env.example .env
   ```
   Edit `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
3. Install dependencies and run it:
   ```bash
   npm install
   npm run dev
   ```
   Open the printed local URL. Create a game, copy the invite link it gives
   you, and open that link in another browser (or an incognito window) to
   join as a second player.

## 4. Frontend: deploying to Vercel

1. Push this repo to GitHub (if it isn't already).
2. In Vercel, **Add New Project**, import the repo.
3. Set the **Root Directory** to `app`.
4. Framework preset should auto-detect as Vite (build command `npm run
   build`, output directory `dist`) - leave those as-is.
5. Under **Environment Variables**, add the same two values from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy. Once it's live, share the app's home page with your group - each
   person creates or joins a game from there.

## Re-cropping card art

The 9 scanned card sheets in `cards/` are cut into the 162 individual card
images in `app/public/cards/` by `app/scripts/crop-cards.mjs`, driven by the
grid positions recorded in `app/src/data/cards.json`. You shouldn't need to
touch this, but if you ever replace a scan, re-run it from `app/`:
```bash
node scripts/crop-cards.mjs
```

## Project layout

- `cards/` - original scanned card sheets (source material, not served to players).
- `app/` - the Vite/React frontend. `app/src/data/cards.json` is the single
  source of truth for every card's stats; `app/public/cards/` holds the cropped
  art.
- `supabase/migrations/0001_init.sql` - database schema and RLS policies.
- `supabase/functions/` - the Edge Functions that referee the game. Game
  logic lives in `supabase/functions/_shared/engine.ts` (pure rules) and
  `supabase/functions/_shared/actions.ts` (turn handling, wired up to the DB).
