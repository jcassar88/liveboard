# Live Whiteboard (step 1 scaffold)

Each student gets their own tldraw canvas. The teacher sees a live grid of
every student's canvas, updating as they draw, without students seeing each
other's work. No LTI yet — this step proves the core "many canvases, one
live grid" pattern with a plain URL-based launcher.

## What's here

- `app/session/[sessionId]/student/[studentId]` — a student's individual
  canvas. Autosaves to Supabase ~800ms after they stop drawing.
- `app/session/[sessionId]/teacher` — live grid of every student's canvas
  in that session, click a tile to expand. Subscribes to Supabase Realtime
  so new strokes show up without a refresh.
- `app/page.tsx` — a dev-only launcher to jump into a session by typing a
  session ID and student ID. This gets replaced by the real LTI launch
  flow in the next step (student launch resolves session + student ID from
  the LTI token instead of a text box).
- `supabase/migrations/0001_canvases.sql` — the one table this needs.

## Setup

1. Create a free Supabase project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_canvases.sql`.
3. Copy `.env.local.example` to `.env.local` and fill in your project's
   URL and anon key (Project Settings -> API).
4. `npm install`
5. `npm run dev`
6. Open http://localhost:3000, type a session ID, open it as a student in
   one tab and the teacher grid in another, and draw.

## Known gaps (expected at this stage)

- **No auth/LTI yet.** Anyone with a session ID and student ID can write to
  that canvas. Fine for local testing, not for a real class.
- **RLS is wide open.** The migration's policies allow the anon key to
  read/write everything. Needs to be scoped to a verified LTI launch
  before this touches real students.
- **No roster.** Student names are whatever's typed in — the LTI launch
  step will pull real names via NRPS.

## Next step

Wire up LTI 1.3: OIDC launch flow (`ltijs` is a solid library for this),
Deep Linking so a teacher can drop this into a Canvas module, and NRPS to
populate the roster automatically instead of the dev launcher's text boxes.
