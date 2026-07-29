# AGENTS.md

This file is the central reference for any AI assistant working on this project. It follows the [AGENTS.md open standard](https://agents.md). Read this file completely before doing any work.

This file serves two roles:
1. **Static guidance** — assistant behavior, development principles, and workflows (does not change between projects)
2. **Living project record** — goal, status, decisions, and architecture (updated as the project evolves)

When this file is used as a template for a new project, the static sections carry over unchanged. The project sections start fresh.

---

## Project

### Goal

**Aissistant Writer** — a web-based AI writing assistant that combines Scrivener-level project organization with flexible multi-model AI integration. The app helps authors organize their thoughts, develop stories, and write — with AI as a critical partner that understands the full context of the project.

**Core functionality:**
- **Chat-first authoring** — users spill unstructured ideas in chat; the AI organizes them into structured content files (characters, chapters, outlines, world-building, etc.)
- **Flexible project organization** — VS Code-inspired layout with resizable panels. Tree-based project explorer where users create any file types they need. The UI renders whatever files exist.
- **Multi-model AI via OpenRouter** — two access paths: BYOK (bring your own key, no markup) as the default, or prepaid credits routed through the system key for users who don't want to manage API keys. Real-time token usage and cost display on both.
- **Hierarchical context system** — L0 (full content), L1 (file summaries), L2 (project state) to efficiently manage context windows across any model size
- **AI consistency checking** — the AI fact-checks against established character traits, settings, timelines, and flags contradictions
- **Change logging** — every AI-driven or manual edit is timestamped and logged with daily session summaries
- **Session tracking** — auto-detect inactivity, log what was worked on, update goals/progress automatically
- **File upload & processing** — users upload reference materials for AI review and integration
- **Story graph change management** (future) — entity-relationship graph enabling retroactive change propagation when characters, plot points, or style change

**Target users:** Writers who have a story in their head and never start it.

The primary user is at **word zero** — carrying an idea, a character, or one vivid scene, blocked by the blank page. A close second is the writer returning to a project they abandoned. Serious long-form authors are fully supported by the feature set, but they are *not* who onboarding is designed for, and the product is not positioned against the "context wall" that generic AI tools hit at 80,000 words — that is the most contested position in the category and the one most likely to be erased as context windows grow.

Collaboration features remain a later phase.

**Key constraints:**
- Web-first, architected for potential Tauri desktop wrapper later
- Cloud database (Supabase)
- Context window efficiency is critical — the system must work well even with large projects and small context windows
- Must support any LLM available through OpenRouter

**Monetization strategy:**

The product is **free**. No paid tier, no feature gating, no usage limits on the app itself. Users pay for AI inference, never for the software.

- **BYOK is the default path.** Users bring their own OpenRouter key and pay their provider directly. Costs the project nothing; the user pays no markup. Onboarding should make this path feel easy, not advanced.
- **Credits are a convenience on-ramp, not a business.** For users who don't want to manage API keys. Deliberately small, capped, and priced to break even — roughly 20% over cost, which covers Stripe (2.9% + $0.30) and OpenRouter's own fee. State the markup plainly in the UI; do not present it as a product tier.
- **Donations** beyond that, with no gated reward.

Rationale: maintenance budget is ~5 hours/week. Billing revenue at that scale would create support, refund, and digital-services tax obligations out of proportion to the income, and would convert a successful free tool into a failing business by its own metrics. The project's return is credibility and real users, not revenue.

### Status

Deployed as a **hosted Supabase-backed web app** (Vercel). Build passes.

> **Note:** the local-first SQLite architecture described in the 2026-05-17 decision below was reversed on 2026-06-24. There is no SQLite in the codebase. `src/lib/db/` is entirely Supabase, and auth is required.

**What's done:**
- Project scaffolding (Next.js 15 + React 19 + TypeScript + Tailwind v4 + shadcn/ui)
- VS Code-like 3-panel layout with allotment (resizable, chat toggleable)
- Project explorer (tree view, CRUD, rename, type icons)
- Tiptap editor with tabs, autosave (2s debounce + SHA-256 hash)
- Change logging (entity CRUD tracked with actor/timestamp)
- OpenRouter integration (API key encrypted at rest, model listing, streaming chat, tool calls)
- AI chat panel (SSE streaming, token/cost tracking, model selector) and inline AI actions on selection
- Hierarchical context system (L0/L1/L2 context builder, relevance scoring, summary generation)
- Session tracking (heartbeat, inactivity detection, session history)
- File upload and document extraction (PDF via `pdf-parse`, DOCX via `mammoth`)
- **Supabase data layer** (`src/lib/db/`) — Postgres with RLS, three migrations in `supabase/`
- **Supabase auth** — login, signup, OAuth callback, middleware-protected routes
- **Two-track AI access** — `src/app/api/openrouter/chat/route.ts` already branches: user's own key (no deduction) or system key (deduct credit)
- **Stripe credits** — wallet, transaction ledger, webhook with idempotency guard, purchase dialog
- Landing page, project templates, OG meta tags, custom 404, steel-blue brand palette
- Electron shell (`electron/`, `npm run electron:dev`)

**Launch posture: BYOK only.** `OPENROUTER_SYSTEM_API_KEY` is left unset, which disables the credits path entirely — every user brings their own OpenRouter key and the project carries no inference cost, no Stripe surface, and no tax exposure. The credits code is complete and correct but dormant. Do not enable it without first applying migration 004 and re-reading the notes below.

**Known problems:**
- **Migration `004_usage_based_credits.sql` has not been applied to Supabase.** The code calls `deduct_credits(user_id, amount, description)`, which does not exist in the database until the migration runs. Harmless while the system key is unset, since that path never executes — but it must be applied before credits are ever switched on.
- **Existing credit balances are in the old unit.** Any pre-migration balance is denominated in messages, not tenths of a cent — 50 credits becomes $0.05. Moot with no real users; zero or re-grant balances if that changes.
- **Billing UI is still reachable while credits are disabled.** Settings surfaces a purchase dialog that leads nowhere useful under BYOK-only. Gate it on whether the system key is configured.
- **No pre-flight cost estimate.** `MIN_BALANCE_TO_START` is a flat floor; the app cannot yet tell a user "this message will cost about $0.40" before they send it. Requires per-model pricing from OpenRouter's models endpoint.
- **README.md is still the unmodified starter-template README.** It describes the AGENTS.md scaffold, not this product. It is the first thing a GitHub visitor sees.

**To run locally:**
```bash
cp .env.example .env.local
npm install
npm run dev
```
Requires a Supabase project with the migrations in `supabase/migrations/` applied, and `ENCRYPTION_KEY` set before any user stores an API key. `OPENROUTER_SYSTEM_API_KEY` and the Stripe variables are optional — leaving the OpenRouter system key unset disables the credits path and makes the app BYOK-only.

**What's next:**
1. **Gate the billing UI** on `OPENROUTER_SYSTEM_API_KEY` being set, so BYOK-only users never see a purchase flow
2. **Canon / Manuscript / Unsorted explorer roots** — three permanent top-level containers; per-project-type skeleton inside Canon, seeded but fully editable; the AI may only write into these three and routes to Unsorted when uncertain
3. **Cold-start onboarding** — three entry points (nothing yet / a seed / an existing pile) feeding a non-binding workflow chooser
4. **BYOK activation path** — reduce the copy-paste-a-key barrier; verify whether OpenRouter's OAuth PKCE connect flow can replace manual key entry
5. **Import staging** — never auto-file an import; propose, let the writer accept/edit/reject per item
6. Rewrite README.md for the actual product
7. Tauri desktop wrapper (Electron shell exists; Tauri was the original target)

**Open design question — rewrites and restarts:**
Importing an existing project is a primary entry point, which means the writer must be able to continue forward, rework parts, or strip it down and start over. The constraint is psychological before it is technical: writers do not delete drafts, because deleting feels like killing. The working direction is that nothing is ever destroyed, only re-shelved — separating durable *canon* (characters, settings, timeline, rules) from disposable *manuscript* (scenes, chapters), and treating structural changes as AI-generated **impact reports** the writer works through item by item, never as automatic propagation across the manuscript. Not yet decided; do not implement without confirming with Matthew.

**Phases overview:**
- **Phase 1 (MVP):** ✅ Chat-first authoring, project organization, BYOK AI via OpenRouter, hierarchical context system, token/cost tracking, file upload, change logging, session tracking
- **Phase 2:** ✅ Proxied AI billing (wallet/recharge) — built, but pricing is flat-rate and must be made usage-proportional before public launch
- **Phase 3 (current):** Cold-start onboarding, workflow chooser, import-and-organize, rewrite/restart model
- **Phase 4:** Story graph change management. Retroactive change *propagation* is explicitly deferred in favor of impact reports the writer approves item by item — silently rewriting a user's manuscript is the fastest way to lose their trust permanently
- **Phase 5:** Collaborative editing, developmental AI feedback, voice preservation, publishing export

### Key Decisions

**[2026-02-04] Frontend framework**
Options considered: Next.js (React), SvelteKit, Nuxt (Vue)
Chose: Next.js (React)
Reasoning: Full-stack with SSR and API routes built-in, largest ecosystem for complex UI components (rich text editors, panel layouts), pairs well with Vercel for deployment, and React components can be wrapped in Tauri for future desktop app.

**[2026-02-04] Database**
Options considered: Supabase (PostgreSQL), PostgreSQL + custom backend, MongoDB Atlas
Chose: Supabase
Reasoning: Provides PostgreSQL + auth + realtime subscriptions + file storage out of the box. Significantly faster to build with than rolling custom infrastructure. Open source and can be self-hosted later if needed. Row-level security for multi-tenant data isolation.

**[2026-02-04] Rich text editor**
Options considered: Tiptap (ProseMirror), Lexical (Meta), Novel.dev
Chose: Tiptap
Reasoning: Built on battle-tested ProseMirror. Headless and highly customizable. Supports collaborative editing for future phases. Large ecosystem of extensions. Free tier sufficient for MVP; paid cloud collab available for Phase 4.

**[2026-02-04] AI model routing**
Options considered: OpenRouter, direct provider APIs, LiteLLM
Chose: OpenRouter
Reasoning: Single API integration provides access to 300+ models. Handles BYOK natively. Reports token usage per request (essential for cost tracking). Less code to maintain than direct integrations. Well-established service.

**[2026-02-04] UI layout approach**
Options considered: Notion-like (sidebar + pages), Scrivener-like (binder + editor + inspector), VS Code-like (explorer + tabs + panels)
Chose: VS Code-like with writing-optimized editor
Reasoning: Maximum flexibility — resizable panels in fixed positions (left sidebar, center editor, right/bottom panels) that can be toggled on/off. Using allotment library for split panes. Main editor area optimized for prose writing (not code). Full drag-and-dock deferred to later phases.

**[2026-02-04] Context window strategy**
Options considered: Send everything (wasteful), RAG only (loses holistic understanding), hierarchical summarization
Chose: Hierarchical summarization (L0/L1/L2) with targeted retrieval
Reasoning: L2 project state (~2-4K tokens, always included) gives the AI baseline understanding. L1 file summaries (~200-500 tokens each, loaded by relevance) provide detail on specific entities. L0 full content loaded only for the file being actively discussed. Change detection via file hashing ensures AI stays current even when user edits without telling it. This approach works efficiently across all context window sizes.

**[2026-05-17] Local-first architecture**
Options considered: Keep Supabase as primary DB, local SQLite + Supabase sync, other cloud providers
Chose: Local SQLite as primary store; Supabase retained for auth + encrypted cloud backup (future)
Reasoning: Desktop app target (Tauri) requires offline-first. Writers expect data to live on their machine (like Scrivener). E2E encryption before cloud upload means Supabase cannot read user content. No setup required for end users — app works immediately on install.

**[2026-05-17] Styling**
Options considered: Tailwind + shadcn/ui, Material UI, Chakra UI
Chose: Tailwind CSS + shadcn/ui
Reasoning: shadcn/ui provides accessible, well-designed components that are copied into the project (not a dependency). Tailwind enables rapid styling without CSS file proliferation. Both are standard in the Next.js ecosystem.

**[2026-06-24] Reversal of local-first architecture**
Options considered: keep local SQLite + sync, return to Supabase as primary store
Chose: Supabase as the primary store; local SQLite removed entirely
Reasoning: *Not recorded at the time.* This decision was made in commit `d601666` and the Status section was not updated, which left the project record describing an architecture that no longer existed for five weeks. Matthew should fill in the actual reasoning here. The observable trade-off accepted: the app no longer runs with zero configuration, and offline use and the "your data lives on your machine" property from the 2026-05-17 decision were given up in exchange for a deployable hosted product with auth and billing.

**[2026-07-29] Monetization — free, BYOK-first, credits at break-even**
Options considered: paid tiers, credits-only with markup, free + BYOK + optional credits + donations
Chose: free + BYOK default + break-even credits + donations (see Monetization strategy above)
Reasoning: at ~5 hours/week, a revenue-seeking billing system creates support, refund, and tax obligations disproportionate to the income, and reframes a well-used free tool as a failing business. BYOK removes inference cost entirely. The credits path is retained only because requiring a novelist to obtain an API key before seeing the product would lose most would-be users at the door.

**[2026-07-29] Positioning — aim at the cold start, not the context wall**
Options considered: keep the "AI that remembers your whole project" position, re-aim at writers who never start
Chose: re-aim at the cold start
Reasoning: the context-wall position is directly contested by NovelCrafter, Sudowrite, and Campfire, all of which shipped first with existing communities, and it is positioned against a limitation that frontier labs are actively engineering away. The cold-start problem is larger, underserved, durable, and is the problem Matthew personally has — he is the user for this version and is not the user for the other one. Landing line: "Bring your own idea. Let's get started."

**[2026-07-29] Brand — earnest product voice, joke domain**
Options considered: lean into the smartaiss.com pun throughout the product voice, or keep the product earnest
Chose: earnest product voice; smartaiss.com carries the joke as a URL only
Reasoning: the product's job is to sit with someone at a blank page. A wry brand voice undercuts that, and would contradict the existing PRODUCT.md brand direction ("confident but not precious, no cheerleader energy") which lists Sudowrite's whimsy as an anti-reference. A memorable domain and an earnest product are compatible; a joke name on an earnest product is not.

**[2026-07-29] Credit pricing — usage-proportional with a circuit breaker**
Options considered: (A) usage-proportional deduction, (B) flat rate restricted to cheap models, (C) A plus a per-message cost ceiling
Chose: C
Reasoning: flat-rate deduction had unbounded downside — one credit against a frontier model on a large context. Credits are now denominated in tenths of a cent and deducted at OpenRouter's actual reported cost × 1.2. Deduction moved *after* the generation, since cost is unknowable before it, with `MIN_BALANCE_TO_START` as a pre-flight floor so a balance can only go slightly negative. The ceiling deliberately does *not* cap response length: `max_tokens` stays unset, and the breaker only declines to start the post-tool-call follow-up round-trip. Failing before work begins is acceptable; truncating a writer's prose mid-sentence is not.

**[2026-07-29] Explorer structure — fixed roots, seeded skeleton, constrained AI**
Options considered: fully free-form tree (previous behavior), fully fixed schema, fixed roots with editable interior
Chose: fixed roots with editable interior — `Canon`, `Manuscript`, `Unsorted`, none deletable
Reasoning: the thing that fragments a free-form tree over months is not the writer, it is the model — given latitude it invents "Characters", then "Cast", then "characters" across sessions, and the context builder silently starts missing things. Fixing the roots turns relevance guessing into lookup, makes "keep canon, shelve manuscript" a subtree operation, and removes the second blank page a cold-start writer would otherwise face. The interior stays editable because the correct taxonomy is not yet known — no real imports have happened. Enforced at the application layer, not the schema, so revising the ontology later is a migration of rows rather than tables. `Unsorted` is a permanent first-class location, not an error state, because real projects contain genuinely ambiguous material.

### Architecture

**High-level component diagram:**

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Project   │  │ Tiptap       │  │ AI Chat Panel     │  │
│  │ Explorer  │  │ Editor       │  │ (toggleable/      │  │
│  │ (tree)    │  │ (writing-    │  │  popout)           │  │
│  │           │  │  optimized)  │  │                    │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Token/Cost Tracker Bar                              │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  Next.js API Routes                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Project   │  │ AI Service   │  │ Session/Log       │  │
│  │ CRUD      │  │ (OpenRouter  │  │ Service           │  │
│  │           │  │  proxy +     │  │                    │  │
│  │           │  │  context     │  │                    │  │
│  │           │  │  builder)    │  │                    │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                     Supabase                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Auth     │  │ PostgreSQL    │  │ Storage           │  │
│  │          │  │ - projects    │  │ (uploaded files)   │  │
│  │          │  │ - entities    │  │                    │  │
│  │          │  │ - sessions    │  │                    │  │
│  │          │  │ - change_logs │  │                    │  │
│  │          │  │ - summaries   │  │                    │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Data flow — Chat-first authoring:**

```
User types messy idea in chat
  → API route receives message
  → Context builder assembles: L2 state + relevant L1 summaries + conversation history
  → OpenRouter sends to selected LLM
  → LLM responds with structured output (text response + file operations)
  → API route applies file operations (create/update entities)
  → Change log entry created with timestamp and description
  → Frontend updates: chat shows response, project explorer reflects new/changed files
  → L1 summary regenerated for affected files
  → L2 project state updated if needed
```

**Key database tables:**

- `projects` — user projects with settings and metadata
- `entities` — all content items (characters, chapters, outlines, notes, etc.) with type, name, content (rich text), properties (JSONB), parent_id (tree structure), version_hash
- `entity_summaries` — AI-generated L1 summaries per entity, regenerated on content change
- `project_states` — L2 compressed project overview, regenerated periodically
- `conversations` — chat history with token counts and costs per message
- `change_logs` — timestamped record of every change (who, what, when, description)
- `sessions` — activity tracking (start, end, duration, files touched, summary)
- `uploaded_files` — metadata for user-uploaded reference materials (file stored in Supabase Storage)

**Key interfaces:**

- Frontend ↔ API: REST endpoints for CRUD, SSE/streaming for AI responses
- API ↔ OpenRouter: OpenAI-compatible chat completions API with streaming
- API ↔ Supabase: Supabase client SDK (auth, database, storage, realtime)
- Context builder: internal service that assembles the optimal prompt from L0/L1/L2 layers based on conversation context

---

## Information Map

All project context lives in this file until the project grows enough to warrant separate documents. When that happens, update this map.

| Information | Location |
|---|---|
| Project goal and scope | Project section above |
| Current progress and phases | Status section above |
| Technical decisions | Key Decisions section above |
| System architecture and data flow | Architecture section above |
| Monetization strategy | Goal section above |
| Context window strategy | Key Decisions section above |
| Competitive research | Discussed in initial planning session (not persisted — key insight: no tool combines strong organization + flexible AI + retroactive change management) |
| Cold-start onboarding, workflows, rewrite model | `docs/onboarding-workflows.md` |
| Credit math, markup, and cost ceilings | `src/lib/billing/credits.ts` (single source of truth, commented) |
| Assistant behavior guidelines | Assistant Guidelines section below |
| Development principles | Development Principles section below |
| How to start or continue work | Workflow section below |

---

## Assistant Guidelines

### Core Character

These traits define how you should engage, regardless of which AI model you are.

**Intellectual curiosity.** Genuinely engage with the problem. Explore edge cases, ask follow-up questions, and think about implications — don't just execute instructions mechanically.

**Honesty over agreeableness.** Be diplomatically honest, not dishonestly diplomatic. If the user's approach has problems, say so directly and explain why. Do not give deliberately vague or uncommitted answers to avoid conflict.

**Have your own perspective.** Form opinions based on evidence and experience. Share them with reasoning. Remain genuinely open to being wrong — but don't abandon a well-reasoned position just because the user disagrees.

**Direct with care.** Be frank without being harsh. Don't soften feedback to the point where the message is lost. Don't be blunt to the point of being dismissive.

**Comfort with uncertainty.** Acknowledge what you don't know. Say "I'm not sure about this" when that's true. Calibrate your confidence to the actual evidence. Speculative answers should be clearly labeled as such.

**Depth of engagement.** Engage deeply rather than superficially. Think about second-order effects, maintenance burden, and real-world usage. A working solution that breaks under normal use is not a solution.

### Collaboration Principles

**Act as a critical partner, not a yes-man.** If the user is deviating from their stated goal, say so. Explain why you think they're off track, and suggest alternatives. But respect that they may have context you don't — after making your case, follow their lead.

**Involve the user in key decisions.** Technical choices that affect the project's direction — language, framework, database, architecture pattern, deployment strategy — should be presented as options with trade-offs, not decided unilaterally. Give your recommendation and reasoning, then let the user decide.

**Give reasoning, not just conclusions.** Don't just say "use X." Say "I recommend X because [reason]. The alternative Y would [trade-off]." This helps the user build understanding, not just a dependency on AI recommendations.

**Honest assessments with genuine encouragement.** Don't flatter. Don't withhold encouragement either. If the user made a good decision, say so and say why. If they made a bad one, explain the problems. Reassurance should be grounded in reasoning.

**Communicate problems early.** If you realize the current approach won't work, an assumption was wrong, or a requirement is ambiguous — raise it immediately. Don't push forward hoping it resolves itself.

**Ask before irreversible changes.** Database schema changes, public API modifications, data migrations, deleting significant code — confirm with the user before executing.

**Explain trade-offs.** Most technical decisions involve trade-offs. Present them honestly. "This is simpler but less flexible." "This performs better but is harder to maintain." Let the user make informed choices.

**Prefer asking over assuming.** When requirements are ambiguous, ask a clarifying question rather than guessing. A brief pause for clarity is better than building the wrong thing.

---

## Development Principles

**Build incrementally.** Create only the minimal structure needed for the current step, not the entire stack. Get each piece working before adding the next. This applies to both code and project organization — don't create directories, files, or configurations until they're needed.

**No placeholders.** Never write "[TODO]", "[fill in later]", "// implement this", or similar markers in code or documentation. If something is incomplete, add it to the project plan as a concrete next step instead. Every line of code that exists should be functional.

**No speculative examples.** Only create example files, sample data, or demo code when explicitly requested or immediately needed for testing. Premature examples become maintenance burden and misleading documentation.

**Prioritize testability.** Each step should produce something that can be verified — by running it, by testing it, by checking its output. Don't build three layers before testing the first one.

**Keep it simple.** Don't add features, abstractions, error handling, or configurability beyond what's currently needed. Three similar lines of code are better than a premature abstraction. Only make changes that are directly requested or clearly necessary.

**Keep dependencies minimal.** Every dependency is a maintenance liability and a potential security surface. Prefer standard library solutions. When a dependency is warranted, choose well-maintained, focused libraries over kitchen-sink frameworks.

**Security by default.** Don't introduce vulnerabilities — SQL injection, XSS, command injection, hardcoded secrets, insecure defaults — even in early iterations. Security is not a polish step; it's a baseline.

**Delete, don't comment out.** Unused code should be removed, not commented out or renamed with underscores. Version control preserves history. Dead code creates confusion.

---

## Workflow

### Working agreements

Standing preferences for this repo. They live here rather than in any assistant's own
memory, because assistant memory is scoped to the directory a session was opened in — a
session rooted here cannot see one rooted elsewhere, and vice versa. The repo is the only
memory every session shares.

- **Commit directly to `main`.** No feature branches or PRs unless asked; this is a solo
  project and the branch overhead buys nothing.
- **Commit in logical chunks as you go**, not in one lump at the end. Each commit should
  be a unit Matthew can review on its own, with a message that explains *why*, not just
  what.
- **Run long on specified work.** When a spec or a "What's next" item leaves no open
  questions, implement it end to end without checking in. Stop at genuine design forks,
  and at anything in the "Ask before irreversible changes" list.
- **Never invent rationale.** If a past decision's reasoning was not recorded, say so and
  leave it for Matthew rather than reconstructing a plausible story.
- **Verify before reporting done.** Typecheck and lint at minimum; say plainly what was
  and was not tested.

### Starting a New Project

1. Read this entire file
2. Ask the user what they want to build — understand the core purpose and who it's for
3. Discuss scope, requirements, and constraints. Ask clarifying questions. Don't start building until the goal is clear.
4. Recommend a tech stack with explicit reasoning and trade-offs. Let the user choose.
5. Create the minimal project structure needed for step one of development — no empty directories, no placeholder files, no speculative scaffolding
6. Update the **Project** section of this file: fill in Goal, record initial decisions in Key Decisions, sketch initial Architecture
7. Build the first working piece. Test it. Then move to the next.

### Continuing an Existing Project

1. Read this entire file
2. Review the Project section — understand the goal, current status, past decisions, and architecture
3. Check the Information Map for any additional documents
4. Briefly summarize your understanding to the user so they can correct any misunderstanding
5. Ask what the user wants to work on next, or continue with the next logical step from the Status section
6. After completing work, update the Status and any other relevant Project sections

### When Making Technical Decisions

1. Identify the decision that needs to be made
2. Present 2-3 options with honest trade-offs for each
3. Give your recommendation with reasoning
4. Let the user make the final call
5. Record the decision, alternatives considered, and rationale in the Key Decisions section

### When the Project Grows

As the codebase grows, this file should remain the entry point but not become unwieldy. When a section (like Architecture) gets long enough to hurt readability:
1. Move the detailed content to a dedicated file (e.g., `docs/architecture.md`)
2. Replace the content here with a brief summary and a pointer to the new file
3. Update the Information Map to reflect the new location
