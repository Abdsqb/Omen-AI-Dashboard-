# OMEN — AI Improvements Roadmap

> **Guiding principle:** OMEN's chat is the *only* interface. There are no manual
> buttons or fallback controls by design. That means the AI channel must be
> **bulletproof and capable** — every failure is user-facing, because there's no
> other way to get the job done. The items below are ordered by how much they
> protect or extend that single channel.
>
> Voice input/output is intentionally **out of scope for now** (see "Deferred").

---

## Priority 1 — The AI must never silently fail

### 1.1 Stop swallowing malformed action blocks
- **Where:** [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) — the `try/catch` around `JSON.parse(actionMatch[1])`.
- **Problem:** If the model emits a slightly-broken `<action>` block, the `catch {}` discards it silently. The user sees a friendly reply but **nothing happens to the board**, with zero signal. In an AI-only app this is the worst failure mode — it *looks* like success.
- **Fix:**
  - On parse failure, `console.warn` the raw block, and return a soft, honest `actionResult` to the client (e.g. `"⚠️ I tried to update the board but couldn't — say that again?"`).
  - Distinguish "no action intended" (normal chat) from "action attempted but failed to parse" so we only warn on the latter.
- **Stretch:** one self-repair retry — re-prompt the model with "your last action block was invalid JSON, re-emit it" before giving up.

### 1.2 Validate action fields before touching the database
- **Where:** `route.ts` action handlers, and the REST routes in [`src/app/api/tasks/route.ts`](src/app/api/tasks/route.ts) / [`[id]/route.ts`](src/app/api/tasks/[id]/route.ts).
- **Problem:** Nothing constrains `status` or `priority`. The model could emit `status:"in progress"` or `priority:"urgent"`, which silently corrupts the board — the UI groups by exactly `todo|doing|done` and styles by exactly `low|medium|high`, so an off-enum value just *disappears* from the board.
- **Fix:**
  - Central allow-lists: `STATUS = ['todo','doing','done']`, `PRIORITY = ['low','medium','high']`.
  - Reject/normalize out-of-enum values before write; surface a clear message if the AI sent something invalid.
  - Validate `deadline` is `YYYY-MM-DD` (or `null`); reject garbage dates.

### 1.3 Guard genuinely destructive actions
- **Where:** `delete` and `clear_done` handlers in `route.ts`.
- **Problem:** Deletes execute immediately on the model's say-so. Combined with "AI is the only interface," a misread instruction permanently drops tasks.
- **Fix (discuss):** lightweight confirmation step for `delete` / `clear_done` — OMEN states what it's about to remove and waits for a confirming turn, instead of acting on the first mention. (Trade-off: adds a round-trip. Decide per-action.)

---

## Priority 2 — Make the single channel more capable

### 2.1 Allow more than one action per turn
- **Where:** `route.ts` (`reply.match(...)` captures only the **first** `<action>`), plus the system prompt rule "Only emit ONE `<action>` block per reply."
- **Problem:** "Add three tasks and mark the report done" needs four separate messages today. When chat is the whole interface, this friction is constant.
- **Fix:**
  - Switch to `matchAll` and execute action blocks in order, collecting a list of results.
  - Relax the system-prompt rule to allow multiple actions, while keeping the safety rules (no inventing/duplicating/guessing names).
  - Return `actionResults: string[]` and show them as a small batch summary toast.

### 2.2 Feed action outcomes back into the model's context
- **Where:** `route.ts` builds `boardCtx` fresh each turn (good), but the assistant's stored history is only the cleaned text.
- **Problem:** The model re-reads the board so it sees end-state, but it has no explicit record of *what it just did* or whether an action **failed** (see 1.1). It can claim "done!" when the write was rejected.
- **Fix:** Append a terse system/tool note of the real action results to the next turn's context (e.g. `Last actions: created "X"; FAILED to delete "Y" (not found)`), so OMEN's claims match reality.

### 2.3 Tighten generation settings for task precision
- **Where:** `route.ts` request body (`temperature: 0.7`, `top_p: 0.95`).
- **Problem:** Task management is a precision task (exact names, exact enums). 0.7 invites drift in names/JSON.
- **Fix (discuss):** lower temperature for the action-bearing path (e.g. 0.2–0.4) while keeping personality in the prose. Possibly separate "decide the action" from "write the reply."

---

## Priority 3 — Persist the conversation

### 3.1 Conversation survives refresh
- **Where:** [`src/app/page.tsx`](src/app/page.tsx) — `historyRef` is in-memory only; it's lost on reload even though tasks persist.
- **Problem:** For an AI-first product, the conversation *is* the product. Refreshing the page wipes OMEN's memory of the session, which feels broken next to the tasks that do persist.
- **Fix options (pick one):**
  - **Quick:** persist `historyRef` to `localStorage`, rehydrate on mount.
  - **Proper:** a `messages` table in SQLite (mirrors the tasks layer in [`src/lib/db.ts`](src/lib/db.ts)), loaded on boot. Enables history across devices and future features (search, summaries).
- **Note:** keep the existing last-30-messages trim for the *model* context window, but persist the full log for display.

---

## Priority 4 — Hardening the endpoint

### 4.1 Input validation & shape-checking on `/api/chat`
- Validate `messages` is a well-formed array of `{role, content}` before forwarding to the model; reject otherwise with a clear 400.

### 4.2 Timeouts & graceful upstream failures
- Add a fetch timeout/abort to the NVIDIA call so a hung upstream doesn't hang the only interface. Map upstream 4xx/5xx to friendly, actionable messages.

### 4.3 (If ever multi-user) auth
- The routes are currently open. Fine for a single-user personal tool. Revisit only if others will use it. **Out of scope unless that changes.**

---

## Deferred (explicitly not now)

- **Voice in/out** — speech-to-text input and TTS replies. Conceptually the natural endgame of an AI-only interface (the orb already has a `listening` state), but parked for later by decision.
- **Streaming replies** — token-by-token rendering for perceived speed. Nice-to-have; revisit after Priority 1–2.
- **Proactive OMEN** — unprompted nudges ("one task is overdue — start there?"). Bigger product shift; revisit later.

---

## Suggested order of execution

1. **1.1 + 1.2** — make failures visible and impossible-to-corrupt (highest risk, lowest effort).
2. **2.1** — multi-action, the biggest day-to-day capability win.
3. **2.2** — close the loop so OMEN's words match what actually happened.
4. **3.1** — persist the conversation.
5. **4.1 + 4.2** — endpoint hardening.
6. Re-evaluate Deferred items.
