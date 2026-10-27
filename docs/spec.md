# Olympiad Prep Platform — Product & Architecture Spec (planning phase, no UI code)

## Context
Saurya runs the National Science Competitions Club (NSCC), which prepares and registers students for
**USABO, USNCO, and F=ma**. They want a personally-owned site (club = pilot) with (1) a Resource Hub
split strictly by discipline and (2) an AI quiz engine whose questions are grounded in official past
exams — matching their structure, figure/equation style, and olympiad difficulty, never generic HS science.
This spec captures every decision from the grilling rounds and is the input to `writing-plans`.

## Settled decisions
| Area | Decision |
|---|---|
| Scope | 3 competitions: USABO, USNCO, F=ma. NSCC is the club, not an exam. |
| Hosting | Vercel, publicly reachable, promoted only to members. |
| Budget | $0. Free tiers only. |
| Auth | Google sign-in gates quizzes + Ask-the-Sources. Resource Hub is public. |
| LLM | Bring-your-own-key: each student's own Gemini API key; owner's key is never used at runtime. **Accepted risk:** Gemini API terms (eff. 2026-03-23) require 18+ and bar services likely used by minors. Mitigation: provider-agnostic LLM adapter. |
| Quiz modes | Topic drills + full mocks in two modes: **Replay** (a real past paper, timed, official key) and **Blueprint** (assembled from bank to the real topic/difficulty mix). Both show score vs that year's real cutoff. |
| AI variants (chem/phys) | Numeric-only in v1; each variant is re-solved by code in the browser before display. |
| Biology | USABO **tags + cutoffs only** — no exam text stored (CEE: "may not be distributed or stored electronically"). No CEE contact. Bio questions are AI-generated from OpenStax Biology, styled to the USABO tag distribution, released **unreviewed with a visible "Unverified" label** + flagging. |
| Shared bank | Verified variants from any student's key go into a shared bank for all members. |
| Sources | OpenStax Biology 2e / Chemistry 2e / University Physics (CC BY) + official F=ma & USNCO papers. Campbell → **chapter map only** (no text). |
| Ask-the-Sources | Built in-house in v1: retrieval over the indexed corpus + answer on student's key, citations required. |
| One-time setup | Done by Claude Code in the owner's sessions (no API key): pilot one exam to measure usage, then the most recent ~8 years per competition (~600–700 Qs). OpenStax embedded with a free local model. |
| Deferred to v2+ | Coordinator dashboard, adaptive sequencing, non-numeric chem/phys variants, older exam years. |

## Verified source inventory (2026-10-27)
- **F=ma** (AAPT): exams + solutions 2008–2026; A/B forms in 2018–2020, 2022. https://aapt.org/physicsteam/PT-exams.cfm
- **USNCO** (ACS): local exams (60 MCQ / 110 min) + National Parts I–III with keys/solutions.
  https://www.acs.org/education/olympiad/prepare-for-exams.html — ACS moves all USNCO exams online from 2027.
- **USABO**: 2003–2018 Open/Semi index at usabo-trc.org; 2020–2021 partial Drive folder (gaps: 2019, 2022–26, some keys).
  Cutoffs: Open 2004–2026, Semis 2007–2026 (with scoring-change notes: old vs new scoring, 2020 /150, 2021–22 no Part B partial).

## Information architecture (student mental model)
```
Discipline (Bio | Chem | Phys)
 └─ Competition (USABO | USNCO | F=ma)  ── Exam papers (year, round, form) ── Cutoffs
     └─ Topic (e.g., Mechanics)
         └─ Subtopic node (e.g., Kinematics → Projectile motion)
              ├─ Read: OpenStax section (indexed) + Campbell ch./pages (bio, map only)
              ├─ See: official questions tagged here (F=ma/USNCO text; USABO = link to PDF)
              ├─ Drill: bank questions → generate verified variants on demand
              └─ Mastery: your accuracy/time on this node
```
Top-level navigation: **Hub** (browse papers & readings by discipline) · **Practice** (Drill / Mock-Replay / Mock-Blueprint) · **Ask the Sources** · **Progress** (mastery per subtopic, mock history vs cutoffs).
The subtopic node is the shared key across all four, so a wrong answer in a mock links straight to its node's reading + drill.

## Core user workflows
1. **Onboard**: Google sign-in → choose competition(s) → optional "Add Gemini key" with disclaimer (your key, your quota, stored only in this browser). Hub, Replay mocks, and existing bank drills work **without** a key.
2. **Drill**: pick subtopic → serve bank questions → if exhausted and key present, generate variant → browser verification → show → answer → explanation → log attempt → (verified variant posted to shared bank as `pending`).
3. **Mock – Replay**: pick year/form → timed, official scoring → score vs cutoff → per-subtopic breakdown → links to weak nodes.
4. **Mock – Blueprint**: competition blueprint (topic weights from tags) → assemble from bank by difficulty band → same reporting; "cutoff" = median of recent cutoffs, labelled as estimate.
5. **Ask the Sources**: question → retrieve top chunks → answer with mandatory chunk citations → click citation → source passage.
6. **Flag**: any question → reason (wrong key / ambiguous / off-syllabus / too easy) → bank status changes per thresholds below.
7. **Owner (annual refresh)**: new exam year released → Claude Code tagging session → import tags/figures → bank + blueprints recompute.

## Data pipeline (one-time setup, re-run yearly)
1. **Acquire**: download official F=ma/USNCO PDFs (public). USABO PDFs are read only for tagging, not stored.
2. **Extract & tag (Claude Code)**: per question → stem (LaTeX for math/chem), choices, key, solution ref, figure crop (F=ma/USNCO only), and tags: `subtopic`, `format` (calc / concept / data-interpretation / pedigree / experiment-design…), `difficulty_band` (1–5, anchored by position in paper + solution length), `skills` (e.g., energy conservation, stoichiometry). USABO rows carry tags only, `stem = null`.
3. **Store as reviewable files** (JSON per paper) → owner can edit → import into DB.
4. **Index OpenStax** with a free local embedding model; chunk by section (~400–600 tokens, heading path kept). The same model runs in-browser for query embedding (no key needed for retrieval).
5. **Campbell map**: subtopic → Campbell chapter/section/page range (facts only).
6. **Derive blueprints**: per competition, topic weights + difficulty distribution from the tagged years.

## RAG blueprint (grounding generation and Q&A)
- **Retrieval units**: `source_chunks` (OpenStax sections + official solutions text for F=ma/USNCO) and `questions` (official exemplars, by tags — structured filter, not vector).
- **Generation context** (assembled in browser, sent on student's key):
  1. Competition **style card** (choice count, notation conventions, unit style, figure conventions, typical stem length, answer-choice ordering habits).
  2. **3 exemplar questions** from the same competition + subtopic + format, nearest difficulty band (official text for F=ma/USNCO; for USABO — none available, so exemplars come from the format spec + tag stats).
  3. **2–4 OpenStax chunks** for the subtopic (facts the question may rely on).
  4. Hard constraints: must require ≥2 reasoning steps; no definition-recall stems; every distractor tied to a named error.
- **Q&A**: hybrid retrieval (vector + keyword) → top 6 chunks → answer prompt requires `[chunk_id]` after every claim; client strips/flags uncited sentences; "not in sources" is an allowed answer.

## Few-shot generation & evaluation framework
**Generator output schema (JSON)**: `stem`, `choices[]`, `answer_index`, `worked_solution`, `distractor_rationales[]`, `parameters{}`, `solver_code` (Python, numeric only), `parent_question_id`, `subtopic`, `difficulty_band`.

**Release gates (all in the browser):**
1. **Deterministic**: schema valid; choice count matches style card; LaTeX parses; units present; no duplicate choices; similarity to parent stem within a band (not a copy, not unrelated).
2. **Solver check (numeric)**: run `solver_code` in Pyodide → result must match keyed choice within tolerance, and match **no** other choice; re-run with 2 perturbed parameter sets to catch hard-coded answers.
3. **Blind solve**: a second call solves the question without the key; must pick the same choice.
4. **Judge rubric** (few-shot calibrated): scores 1–5 on structural fidelity, reasoning depth, distractor quality, grounding, single-answer clarity. Calibration anchors in the prompt: one official question (anchor = 5), one generic textbook question on the same subtopic (anchor = 1–2), one degraded variant (anchor = 3). Release threshold: all dims ≥4.
- Bio questions skip gate 2, run 1/3/4, and are always labelled **Unverified**.

**Offline calibration (during setup)**: run the judge on held-out official questions vs. generic textbook questions; the judge must rank official > generic in ≥90% of pairs before its threshold is trusted.

**Post-release monitoring**: per question, track p-value (fraction correct) and median time vs official questions in the same subtopic/band. Shared-bank promotion: `pending` → `active` after an independent browser re-verification (gates 1–2) by another student **and** 5 attempts with no "wrong key" flag. Auto-quarantine at 2 "wrong key" flags or p-value outlier.

## Data model (entities & relationships)
- `users` (id, google_sub, name, role[student|owner], competitions[])
- `competitions` (id, name, discipline, choice_count, timing, scoring_rule, style_card)
- `exam_papers` (id, competition_id, year, round[local|national|open|semi|fma], form[A|B|null], source_url, storage_policy[full|tags_only])
- `topics` (id, discipline, parent_id, name) — tree: topic → subtopic
- `questions` (id, paper_id, number, stem[nullable], choices[nullable], answer[nullable], figure_ref, format, difficulty_band, origin[official|variant|ai_bio], parent_question_id, status[active|pending|quarantined], verification_level[official|code_verified|unverified])
- `question_topics` (question_id, topic_id, weight) — many-to-many
- `competition_blueprints` (competition_id, topic_id, weight, difficulty_dist)
- `cutoffs` (competition_id, year, round, cutoff_score, max_score, scoring_note)
- `verification_runs` (question_id, gate, passed, details, run_by_user_id, created_at)
- `source_documents` (id, title, license, url) · `source_chunks` (id, document_id, heading_path, text, embedding vector)
- `reading_map` (topic_id, document_id, locator) — OpenStax section or Campbell chapter/pages
- `quiz_sessions` (id, user_id, mode[drill|replay|blueprint], competition_id, paper_id[nullable], started_at, submitted_at, score, cutoff_ref)
- `responses` (session_id, question_id, chosen_index, correct, time_ms)
- `flags` (question_id, user_id, reason, note, created_at)
- `topic_mastery` — derived view from responses × question_topics (accuracy, attempts, recency-weighted).

Key relationships: Competition 1–N ExamPaper 1–N Question N–N Topic; Question 1–N Variant (self-ref);
User 1–N QuizSession 1–N Response N–1 Question; Topic 1–N ReadingMap / blueprint weights.

## Platform constraints ($0)
- Vercel Hobby (non-commercial; fine for a club). Postgres with vector search + Google auth on a free tier
  (e.g., Supabase free: 500 MB DB, pgvector, Google OAuth) — final pick made in writing-plans.
- Student Gemini keys: stored only in browser storage, sent directly browser → Gemini; never to our server.
- No server-side code execution of AI output; Pyodide sandbox in browser only.
- Figures: cropped from public F=ma/USNCO PDFs; variants only reuse a parent figure when its geometry is unchanged
  (otherwise text-only variants in v1).

## Capacity estimate (why one free Postgres is enough)
- Users: pilot ~30, plausible ceiling ~500. Peak = a club mock: 30 students autosaving ~1 answer/min → <1 write/s.
- Storage: OpenStax ~5,000 chunks × (~2 KB text + 1.5 KB 384-d vector) + HNSW index ≈ 40 MB; questions
  (~700 official + a few thousand variants × ~3 KB) ≈ 10 MB; responses ≈ 6 MB/yr at pilot scale.
  Total < 100 MB vs 500 MB free DB. Figures (~700 × ~50 KB ≈ 35 MB) go to object storage (1 GB free).
- Conclusion: single relational node, no replicas/sharding/cache layer. Revisit only if users >~2,000 or DB >~350 MB.

## Access paths & indexes
| Query | Key / index |
|---|---|
| Drill: questions for subtopic, active, by difficulty | `question_topics(topic_id)`, `questions(status, difficulty_band)` |
| Replay: paper in order | `questions(paper_id, number)` unique |
| Mastery / history | `quiz_sessions(user_id, started_at)`, `responses` PK `(session_id, question_id)` |
| Ask-the-Sources | HNSW on `source_chunks.embedding` + GIN full-text on `source_chunks.text` (hybrid) |
| Dedupe shared-bank submissions | `questions(content_hash)` unique (hash of normalized stem + params) |
| Flag review / quarantine | `flags(question_id)` |
Also: `source_documents.embedding_model` so the corpus can be re-embedded if the model changes.
All browser traffic goes through the DB's HTTP API (no raw connections) → no connection-exhaustion risk from serverless.

## Failure modes & defenses (stress test)
| Failure | Defense |
|---|---|
| Free DB project auto-pauses after inactivity (e.g., school breaks) | Daily scheduled keep-alive ping (Vercel cron); verify current free-tier pause policy at build time. |
| Student's Gemini key: 429 / quota out / invalid / slow | 30 s timeout; ≤2 retries with jittered backoff on 429/5xx only; then **degrade to bank-only mode** with an explicit "AI unavailable — serving saved questions" banner. Cap 3 generation attempts per drill question to protect the student's quota. |
| Malformed generator JSON | Schema-validate → one repair attempt → discard. Never shown. |
| AI `solver_code` hangs or misbehaves | Runs in a dedicated Web Worker (separate sandboxed origin, no network) that **never receives the API key**; hard kill after 5 s → variant rejected. |
| API key theft via XSS | Strict CSP, no third-party scripts on pages handling keys; key in sessionStorage by default, localStorage only if student opts "remember on this device". |
| Pyodide (~10 MB) / embedding model (~30 MB) slow first load | Lazy-load only on first generate / first Ask; browser-cached after. If the embedding model fails, fall back to keyword-only search. |
| Shared-bank spam or tampered "verified" posts | Row-level security: students may only insert `pending` rows as themselves; per-user daily insert cap; promotion to `active` only via a DB function after independent re-verification + 5 clean attempts. |
| Mock lost on network drop / tab close | Autosave each answer as an idempotent upsert on `(session_id, question_id)`; timer anchored to server `started_at`; resume on reload. |
| Wrong official key from tagging error | Pilot paper checked 100% against official solutions; "wrong key" flags on official questions go to owner review instead of auto-quarantine. |

## Phased roadmap
- **P0 – Data**: pilot-tag one F=ma paper (measure Claude usage) → tag ~8 recent years per competition → OpenStax index → Campbell map → blueprints.
- **P1 – Hub + Replay**: auth, Hub by discipline, Replay mocks w/ cutoffs. *No AI needed — usable on day one.*
- **P2 – Drills + numeric variants**: BYOK flow, generation + gates, shared bank, flagging.
- **P3 – Ask the Sources**: in-browser retrieval + cited answers.
- **P4 – Bio generation**: USABO-styled unverified questions + Blueprint mocks for USABO.

## Top risks
1. Gemini API age terms (owner-accepted) → adapter keeps a swap path open.
2. Unverified bio questions with wrong keys → label, flags, auto-quarantine.
3. Shared-bank poisoning from tampered clients → pending state + independent re-verification.
4. USABO style fidelity without exemplars → rely on tag stats + format spec; expect weaker match than chem/phys.

## Verification (how we'll know the plan works)
- Pilot tagging: one F=ma paper fully extracted; spot-check 100% of keys against AAPT solutions.
- Replay scoring: replay 2 past papers with the official key → computed score equals hand-scored result.
- Judge calibration: ≥90% official-over-generic ranking on held-out pairs.
- Variant gate: generate 30 F=ma/USNCO variants; report solver pass rate and blind-solve agreement; manually audit 10.
- Pilot with club: after 2 weeks, compare variant p-values with official ones per subtopic; review all flags.

## Next steps after approval
1. Create a project repo (location TBD with owner) and save this as the design spec there (no commits unless asked).
2. Look up the requested skills that aren't installed (system-architect:product-manager, ux-architecture:information-architecture, ai-engineering:rag-pipeline-planning, prompt-engineering:few-shot-evaluation, data-modeling:schema-design) on the marketplace, then GitHub; install only those with >10k stars.
3. Invoke `superpowers:writing-plans` for the P0 data pipeline.
4. UI skills already installed for later phases: `shadcn`, GSAP (needs re-copy to `~/.claude/skills/<name>/` to be detected).
   Architecture reviewed with `system-design-skills` (system-design, data-storage, resilience-failure).
