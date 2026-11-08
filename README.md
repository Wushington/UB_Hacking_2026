# UB_Hacking_2026

**Orbit Study** – AI-powered note-taking and studying: whiteboard photos and lecture audio become organized notes, flashcards, and weak-concept tracking.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Clerk (Google sign-in) · Gemini (`@google/genai`) · Zod · Drizzle ORM + Postgres.js on Tiger Data · Vultr Object Storage (private, S3-compatible) · Vitest + React Testing Library

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the team's dev keys (ask in chat; never commit)
npm run dev                  # http://localhost:3000
```

Clerk keys are required for `npm run dev`; the build and tests run without credentials.

Whiteboard processing also needs the Python AI service running alongside (`AI_SERVICE_URL`, default port 8000):
```bash
cd src/ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r ../../requirements.txt
uvicorn main:app --reload --port 8000               # docs at http://localhost:8000/docs
```

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build / serve the build |
| `npm run typecheck` · `lint` · `test` | Quality checks (run all three before pushing) |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` (no DB needed) |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` – **coordinate with the team first** |

## Where things live

| Path | Purpose |
| --- | --- |
| `src/app/` | Routes (App Router). Feature pages go in their own route folders. |
| `src/contracts/` | Zod schemas + types shared between features and used to validate Gemini output. One file per domain. Change deliberately and tell the team. |
| `src/db/schema.ts` | Database tables. `src/db/index.ts` exports `getDb()` (server only). |
| `src/lib/auth.ts` | `requireUserId()` for every server action / route handler. |
| `src/lib/gemini.ts`, `src/lib/storage.ts` | Server-only Gemini client and private object storage (presigned URLs). |
| `src/app/capture/`, `src/app/lectures/[id]/page.tsx`, `src/app/subjects/` | Capture (whiteboard photos → notes), the read-only notes page (Markdown + KaTeX; change subject or delete) and My subjects. In the UI a lecture is a set of "notes" and a category is its "subject". |
| `src/lib/lectures/` | Creating notes, photo finalize, loading notes, changing subject, deleting, and serving the original photos (`photos.ts`: HEIC gets a JPEG preview from the AI service's `/preview`, stored as `<key>.preview.jpg`). |
| `src/ai-service/` | Python (FastAPI + OpenCV) service: whiteboard photos → notes. Only the Next.js server calls it, via `src/lib/ai/notes.ts`. All other Gemini features call `src/lib/gemini.ts`. |
| `src/lib/env.ts` | Environment validation per integration. |
| `src/components/ui/` | shadcn/ui primitives (`npx shadcn@latest add <name>`). `src/components/layout/` holds the app shell. |
| `deploy/` | Caddy + Vultr deployment notes. |

## Rules that keep us safe

- **Authorization is ours, not Clerk's.** Call `requireUserId()` and filter every query with `eq(table.userId, userId)`. Child rows (sections, blocks, segments, cards…) have no `user_id`: load the owned parent first.
- Insert the `users` row (`on conflict do nothing`) before a user's first write; every owned table references it.
- Never trust ids from Gemini or client-submitted owner ids; the server assigns ids and checks ownership.
- The Python AI service is internal: bind it to 127.0.0.1 and never call it from the browser.
- Secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `VULTR_S3_*`) stay in server-only modules. Only `NEXT_PUBLIC_*` reaches the browser.
- Media stays in the private bucket; the database stores only object keys. Serve files with short-lived presigned URLs.
- Validate all Gemini responses with the matching schema in `src/contracts/`.
- One branch per user story; keep `main` buildable with tests passing.

## Ownership (the team may reassign)

| Dev | Stories | Main paths (one owner per folder) |
| --- | --- | --- |
| 1 | Whiteboard + AI processing (#11 server side, #14, #17 associations) | `src/app/api/uploads/`, `src/app/api/lectures/[id]/process/`, `src/lib/ai/notes*` |
| 2 | Frontend + notes (#22, #13, #16, #11/#17 UI, dashboard) | `src/app/page.tsx`, `src/app/dashboard/`, `src/app/lectures/`, `src/components/` |
| 3 | Flashcards + study (#19, #20, #24) | `src/app/lectures/[id]/study/`, `src/app/api/decks/`, `src/app/api/study-sessions/`, `src/app/weak-concepts/` |
| 4 | Audio + backend integration (#10, #12, audio weak concepts) | `src/app/audio/`, `src/app/explain/`, `src/app/api/audio/`, `src/app/api/explanations/` |

**Shared infrastructure: exactly one owner each. Everyone else proposes changes in their PR description.**

| File / module | Owner |
| --- | --- |
| `src/db/schema.ts`, `drizzle/` migrations | Dev 4 |
| `src/contracts/**` (shared Zod contracts) | Dev 4 (contract changes are announced in team chat) |
| `src/proxy.ts`, `src/lib/auth.ts` (auth config) | Dev 4 |
| `src/lib/env.ts`, `.env.example` | Dev 4 |
| `src/app/layout.tsx`, `src/components/layout/`, `src/components/ui/` | Dev 2 |

Routes, API endpoints and acceptance criteria follow the team's agreed user stories (#10–#24).
