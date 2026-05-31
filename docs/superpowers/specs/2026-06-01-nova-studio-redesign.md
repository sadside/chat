# Nova Studio — Redesign & Feature Pack

**Date:** 2026-06-01
**Branch base:** `feat/frontend-bugs-and-features` (will fold into / sit alongside)
**Demo deadline:** 2026-06-02 morning

## Goal

Turn the Nova chat into a polished, demo-ready product: rebuild the dark theme and the streaming UX so it stops feeling broken, ship 12 high-impact features that make the app feel like a serious AI tool, and make math/code rendering actually work.

Three pillars: **(P1) Fixes** — dark theme, streaming jitter, math rendering — must land; without them nothing else feels finished. **(P2) Visual concept** — single direction "Nova Studio" with the aesthetic of Linear / Vercel / Arc. **(P3) Feature pack** — 12 approved features ordered so any cut-off leaves a presentable build.

## Out of scope

- Voice input (Web Speech API)
- Read-aloud / TTS
- Side-by-side multi-model comparison

These three are deferred — multi-model needs simultaneous local model serving the user does not have set up.

---

## P1 — Mandatory fixes

### F1. Dark theme rebuild

**Problem (verified via screenshot):** The assistant message body in dark mode is nearly invisible — the `prose` plugin defaults render text at very low contrast against the near-black background. Headings, list bullets, `<hr>`, blockquotes all disappear. Sidebar "недавнее" header is barely readable. Date dividers are correct, user bubble is correct.

**Fix:**
- Overhaul color tokens in `frontend/src/styles/globals.css`:
  - Dark background moves from near-pure-black to `oklch(0.16 0.012 270)` — a cool blue-purple `#0c0c14`. Light mode shifts ~2% warmer to read as paper.
  - `--color-foreground` in dark goes from current `oklch(0.98 ...)` to `oklch(0.96 0.005 270)`. `--muted-foreground` goes from currently-too-dim to `oklch(0.75 0.01 270)` (was ~0.55).
  - `--color-border` gets a hairline `oklch(0.28 0.012 270)` so panel boundaries are visible without being heavy.
  - Single accent scale rebuilt in oklch — primary stays violet but now uses `oklch(0.65 0.18 280)` for vibrant pop on both themes.
- Add a dedicated dark-prose override for `MarkdownContent`:
  - Headings get explicit light color (`text-foreground`), not the prose default.
  - `<hr>` becomes 1px gradient, not the invisible default.
  - `<blockquote>` gets a left bar with the accent color at 60% opacity.
  - `<li>` markers (bullets, numbers) explicitly colored.
  - `<a>` underlined with accent color.
- Sidebar section header ("Недавнее") gets `tracking-widest text-[10px] font-medium` and brighter color so it reads as a label, not invisible.
- Topbar uses `bg-background/80 backdrop-blur-xl` for a glass effect — separates the chat title from the content.

### F2. Streaming jitter elimination

**Problem:** Each `delta` SSE event triggers a full re-parse of the entire markdown content. When the message grows, every keystroke-worth of delta re-tokenises the whole buffer, the markdown AST is rebuilt, and React re-renders all children — including any KaTeX nodes already mounted. Visually the page jumps.

**Fix (two-stage rendering):**
1. **During streaming** — render the assistant bubble through a lightweight "streaming view":
   - Single `<pre>` wrapper with `whitespace-pre-wrap` and a fixed `min-height: 1.5em` so the chat doesn't reflow as content arrives.
   - Detect code fences `\`\`\`...` on the fly: render the *closed* preceding text as Markdown (memoised), and the unfinished tail as plain `<pre>`. This lets us still show code blocks live but without re-parsing the whole document.
   - A blinking caret `▍` (1px wide, accent color, `animate-pulse`) at the end of the content.
   - KaTeX is **disabled** during streaming — formulas appear as raw `$...$` text until `assistant_done`, then switch to rendered.
2. **After `assistant_done`** — switch the bubble to the full `MarkdownContent` (the existing component) with KaTeX + rehype-pretty-code + remark-gfm.

Implementation in `MarkdownContent`: existing component takes `streaming` boolean — extend it so the streaming branch is the new lightweight renderer. The non-streaming branch is unchanged.

### F3. Math rendering

**Problem:** Two layers of failure visible in screenshot:
- Model emits raw LaTeX without `$` delimiters: `f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} ...`. remark-math never picks it up, KaTeX never renders.
- Model also emits malformed LaTeX (`\lef$$` instead of `\left(`, `\right$` instead of `\right)`) — looks like the CJK-stripper from `llm_client.py` is also stripping characters from inside LaTeX commands.

**Fix:**
1. **Backend system prompt** — `backend/app/services/context_builder.py`: extend the system message to instruct the model:
   > Math: use `$...$` for inline formulas and `$$...$$` for displayed formulas. Use standard LaTeX commands. Never write `\lef` (use `\left`), `\rgh` (use `\right`).
2. **Backend post-stripper** — `llm_client.py`: the existing `_strip_cjk` regex includes `　-〿` (CJK punctuation including full-width parens). That range collides with… actually it doesn't strip `(` / `)` directly. Re-check: the actual `\lef$$` artefact looks like the LLM produced "lef" + Cyrillic / Japanese paren that got stripped, leaving `\lef`. Add a guard: skip CJK stripping inside LaTeX command spans (between `\` and the next non-alpha char). Implementation: process the delta as `re.sub` with a callback that detects `\command{...}` blocks and leaves them untouched.
3. **Frontend auto-wrap** — `MarkdownContent`: before passing content to remark, run a pre-pass that detects lines containing LaTeX commands (`\frac`, `\sum`, `\int`, `\sqrt`, `\alpha`-`\omega`, etc.) without surrounding `$` and wraps the whole expression in `$...$`. Lines that contain `$` already are left alone. Heuristic: a regex matching `\\[a-zA-Z]+(\{[^}]*\})*` — if found in a line that has no `$` and no triple-backtick code fence around it, wrap.
4. **Frontend math CSS** — display math gets horizontal scroll with fade edges, inline math gets proper vertical alignment. Set `font-size: 1.05em` on `.katex-display` so they read prominently.

---

## P2 — Visual concept: Nova Studio

**Aesthetic reference:** Linear (clean structure, restraint), Vercel (sharp typography, generous whitespace), Arc (glass surfaces, soft shadows). **Not**: Material Design, brutalism, neon, neumorphism.

### Color system

Single accent — violet (oklch 280° hue). All semantic colors derived from it via oklch lightness shifts. Both themes share the accent value; only foreground/background flip.

| Token | Light | Dark |
|---|---|---|
| `--color-background` | `oklch(0.99 0.003 80)` (warm paper white) | `oklch(0.16 0.012 270)` (cool blue-black) |
| `--color-foreground` | `oklch(0.20 0.012 270)` | `oklch(0.96 0.005 270)` |
| `--color-muted` | `oklch(0.96 0.005 270)` | `oklch(0.22 0.012 270)` |
| `--color-muted-foreground` | `oklch(0.45 0.012 270)` | `oklch(0.75 0.012 270)` |
| `--color-border` | `oklch(0.92 0.005 270)` | `oklch(0.28 0.012 270)` |
| `--color-primary` | `oklch(0.55 0.20 280)` | `oklch(0.65 0.20 280)` |
| `--color-card` | `oklch(0.98 0.003 80)` | `oklch(0.19 0.012 270)` |
| `--color-destructive` | `oklch(0.60 0.22 25)` | `oklch(0.68 0.22 25)` |

### Typography

- Sans body: `Inter` (already system-ish via Tailwind defaults; add explicit `Inter` import from `@fontsource/inter` for consistency).
- Mono code: `JetBrains Mono` (already shipped via shiki themes — add as `@fontsource/jetbrains-mono`).
- Math: KaTeX bundled fonts.

### Surface layers

- **Background** (canvas) — plain.
- **Topbar** — `bg-background/70 backdrop-blur-xl border-b border-border`. Sticky.
- **Sidebar** — same glass style, but right border only.
- **Cards / dialogs** — `bg-card border border-border shadow-lg shadow-black/5 dark:shadow-black/40`.
- **User bubble** — gradient tint `bg-gradient-to-br from-[oklch(0.65_0.20_280/0.12)] to-[oklch(0.65_0.20_280/0.06)]` + `border border-primary/15` + subtle inner highlight on top.
- **Assistant bubble** — no background. Instead a 1px gradient bar on the left (`linear-gradient(180deg, primary, transparent)`) as a "rail" with a 24px Nova avatar above it. Indent the body 40px so the rail + avatar are flush left.

### Motion

All motion uses one of two easings:
- **softOut** — `cubic-bezier(0.16, 1, 0.3, 1)` (smooth out). Used for entrances, hover.
- **softInOut** — `cubic-bezier(0.65, 0, 0.35, 1)`. Used for cross-fades.

Durations: 120 ms (micro — hover), 180 ms (component entrance), 280 ms (page transitions). Streaming token fade-in: 80 ms.

Specific updates:
- Replace Radix's default scale animations with `fade + 4px translate-y`.
- Theme toggle animates icon morph using SVG path interpolation (lucide already has both icons; we layer them and cross-fade with rotate).
- Sidebar items get a subtle background flash on hover (`bg-muted/40 transition-colors duration-120`).
- Send button on hover gets a 1.05 scale; on click 0.95 (existing `active:scale-95`, plus `hover:scale-[1.05]`).

### Streaming animation

Each delta from SSE pushes new characters into the streaming view. We don't animate per-character (too jittery for fast models), but we *do* animate the freshly-appended chunk by tracking a `lastDeltaStart` index in the streaming view and applying `animate-in fade-in-0 duration-[80ms]` to the slice `[lastDeltaStart, length]`. After 200 ms the animated class is dropped (so it doesn't accumulate).

### Empty state / welcome

New welcome screen for `/chats` (no chat selected) and the first render of a brand new chat:
- Centered Nova wordmark + tagline ("Локальная LLM. Полная приватность.").
- 4 prompt suggestion cards in a 2×2 grid, content rotating based on time of day (morning: "Объясни …", afternoon: "Помоги с кодом …", evening: "Идея для …").
- Below: "Доступные модели" — horizontal scroll of model cards from `/api/v1/models`, each with name + context window + capability badges.

### Topbar shape

```
[ chat title (editable on click) ]   [tokens/s · 24 чат · модель ▼]   [theme]   [user]
```

Center: live tokens/sec while streaming (otherwise hidden). Right cluster: theme toggle, user avatar with dropdown (logout + onboarding + settings link).

---

## P3 — Feature pack

Ordered by priority — earlier features ship first; any cutoff leaves a coherent build.

### 1. Command palette (⌘K)

Linear-style global command center. **No backend.**

- Trigger: `⌘K` / `Ctrl+K` anywhere, or click ⌘K affordance in sidebar header.
- Modal overlay (Radix Dialog) with full-screen on mobile, 640px centered card on desktop.
- Top search input. Below: ranked sections.
  - **Chats** — fuzzy filter via fuse.js (already in deps) over the user's chats.
  - **Actions** — "Новый чат" (⌘N), "Переключить тему" (⌘⇧L), "Экспорт чата" (⌘⇧E), "Открыть статистику" (⌘⇧S), "Закрепить чат" (⌘D).
  - **Models** — switch the active model for the current chat.
- Keyboard nav: arrows + enter. ESC closes.
- Empty query shows recent chats (last 5).

### 2. Slash commands

Composer command suggestions. **No backend** beyond a prompt-wrapper service.

- Typing `/` at the start of the composer textarea opens an inline popover with a list of commands:
  - `/summarize` — wraps user message in "Сделай краткое резюме следующего…"
  - `/translate` — opens sub-prompt for target language (default English)
  - `/explain` — "Объясни простыми словами…"
  - `/code` — "Напиши код для…"
  - `/improve` — "Улучши этот текст…"
  - `/eli5` — "Объясни как ребёнку…"
- Arrow keys + Enter selects, ESC cancels.
- Selecting a command turns the textarea into "command mode": the command name appears as a chip before the cursor, the user types arguments. On submit, the actual user message sent is the wrapped prompt; the original chip-form is recorded as `command_meta` on the message (purely client-side display).
- Implementation: pure frontend. Wrap in `SLASH_COMMANDS` config in `src/features/slash-commands/`.

### 3. Per-chat system prompt

**Backend changes required.**

- Add column `system_prompt: str | None` to `Chat` model. Migration via alembic.
- New endpoint `PATCH /api/v1/chats/{id}` already exists for rename — extend `ChatUpdateIn` schema with optional `system_prompt`.
- `context_builder.build_context` reads `chat.system_prompt`: if non-empty, append it as a second system message after the default Nova system prompt (separated by a blank line). If empty/null, only the default Nova system prompt is used. No `[replace]` sentinel — simple append semantics only.
- Frontend: in chat topbar, add a "Настройки чата" icon → opens dialog with textarea for system prompt + character counter (max 4000).

### 4. Conversation branching

**Backend changes required.**

- Add column `parent_id: UUID | None` and `branch_index: int` to `Message`. Migration.
- When regenerate or edit fires, instead of deleting the old assistant message, set `parent_id` on the new assistant message to the previous user message and `branch_index = sibling_count`.
- New endpoint: `GET /api/v1/chats/{id}/messages` already returns ordered list — extend response to include `parent_id` and `branch_index`. When the user views a chat, the frontend picks the *currently active* branch (max `branch_index` per parent by default; client stores chosen index per parent_id in zustand).
- `build_context` walks the active branch only.
- UI: when an assistant bubble has siblings, show `< 2/3 >` controls above the message; left/right cycles. Edited user messages also get versioning (same model: user message can have siblings too).

This is the most invasive feature. If time is short, defer to "branching v2" — for v1, we just keep the old behaviour (delete + regenerate) and call it.

### 5. Global search across all chats

**No backend** for v1.

- ⌘F (or button in sidebar header) opens an overlay above the chat view.
- Query input + result list. Search runs client-side via fuse.js over `useChatsQuery` + cached `useMessagesQuery` results.
- Each result: chat title, message snippet, role badge, "2 hours ago" timestamp.
- Click → navigates to the chat (route param) and scrolls to that message (anchor by id). The chat-view scroll-to-id logic: read `?focus=<messageId>` query param on mount, scroll into view, add a soft glow ring for 1.5 s.

### 6. Pin chats

**Backend changes required (small).**

- Add `pinned: bool` (default false) to `Chat`. Migration.
- `PATCH /chats/{id}` accepts `pinned`.
- `GET /chats` returns chats ordered by `(pinned DESC, updated_at DESC)`.
- Sidebar groups pinned chats in a separate "Закреплённые" section at top with a pin icon.
- Right-click / hover-menu on a chat: "Закрепить" / "Открепить".

### 7. Stats dashboard

**Backend changes required.**

- New endpoint `GET /api/v1/stats`:
  ```json
  {
    "total_chats": 24,
    "total_messages": 312,
    "total_chars_generated": 184_320,    // sum of assistant content length
    "total_chars_sent": 12_456,          // sum of user content length
    "model_usage": [
      { "model": "llama3.1:8b", "messages": 200 },
      { "model": "qwen2.5:7b", "messages": 112 }
    ],
    "messages_by_day": [
      { "date": "2026-05-25", "count": 12 },
      …
    ],
    "avg_assistant_response_chars": 591,
    "longest_chat_messages": 48
  }
  ```
  All scoped to the current user. Model usage by reading `llm.call_start` would require log-store join — instead, store the model id used per message in `Message.model_used: str | None` (migration); fill from the `?model=` query at send time.
- New frontend page `/stats` (TanStack file route) with cards + a 14-day bar chart (use lightweight `recharts` or just hand-rolled SVG — avoid heavy charting libs; pick hand-rolled SVG to keep bundle slim).

### 8. Thinking indicator + reasoning display

**No backend** required for the indicator. Reasoning display is optional and tied to model capability.

- **Thinking indicator:** between `assistant_start` and the first `delta`, render a row with three pulsing dots (`animate-pulse` staggered) and label "Думаю…". When first delta arrives, the row disappears and the streaming view starts.
- **Reasoning display (bonus):** some models emit `<think>...</think>` blocks (deepseek-r1, qwq, gpt-o1-style). Detect in the streaming buffer: if content starts with `<think>`, render the content inside in a separate collapsible "Размышления" panel above the answer, with a subtle dotted border and 60% opacity. When `</think>` is seen, switch to rendering the actual answer below. This is purely a client-side parse — no model whitelist needed.

### 9. Auto-save draft

**No backend.**

- The composer textarea content is mirrored to localStorage under `nova-draft-${chatId}` on each keystroke (debounced 200 ms).
- On chat mount, if a draft exists and is non-empty, restore it and show a small "восстановлен черновик" toast with an Undo (clears localStorage + textarea).
- On successful send the draft is cleared.

### 10. Export chat to PDF

**No backend.** Browser print-to-PDF via a print stylesheet.

- "Экспорт в PDF" action in command palette + chat menu.
- Triggers a styled print view: hides sidebar/topbar/composer, shows full message history with chat title and date at top.
- Print CSS: `@media print` applies a high-contrast palette regardless of theme, removes shadows/animations, ensures code blocks don't break across pages (`break-inside: avoid`).
- Implementation: a route `/chats/{id}/print` with a minimal `print-layout.tsx`. The action is `window.print()`.

### 11. Onboarding tour

**No backend.**

- First-time visit (no `nova-onboarded` in localStorage) — small spotlight overlay walks through 5 stops: composer → model picker → sidebar (search + create) → topbar user menu → ⌘K palette.
- Each stop: anchored tooltip with "Дальше" / "Пропустить".
- Skippable; only shown once. Mark complete by setting localStorage. A "Перепройти онбординг" entry in user-menu replays it.
- Implementation: a small hand-rolled tour using `position: fixed` + computed anchor rects. No third-party tour library.

### 12. Welcome screen with model cards

**Backend changes required (small).**

- Extend `GET /api/v1/models` response to include per-model metadata: `context_window`, `description` (short), `capabilities: ["code", "math", "russian", "vision"]`.
- Backend pulls metadata from a static config dict keyed by model id (no Ollama API for this — Ollama doesn't expose descriptions). For unknown models, default to `{ context_window: 8192, description: "—", capabilities: [] }`.
- Frontend `EmptyState` already exists — expand it to render model cards horizontally with hover-elevation. Click a card → sets selected model and focuses composer.

---

## Architecture & file layout

New top-level dirs under `frontend/src/`:

```
features/
  command-palette/
    model.ts       — open/close store + registered commands
    ui/
      CommandPalette.tsx
      CommandItem.tsx
  slash-commands/
    config.ts      — registered slash commands
    model.ts       — popover state + selection
    ui/
      SlashPopover.tsx
  global-search/
    model.ts
    ui/
      GlobalSearchOverlay.tsx
  chat-system-prompt/
    api.ts         — useUpdateSystemPrompt mutation
    ui/
      ChatSettingsDialog.tsx
  pin-chat/
    api.ts
  branching/
    model.ts       — active branch per parent_id store
    ui/
      BranchNav.tsx
  draft-saver/
    model.ts
  print-chat/
    routes / styles
  onboarding/
    config.ts
    ui/
      OnboardingTour.tsx
  stats/
    api.ts

pages/
  stats.tsx                 — /stats route
  chats.$chatId.print.tsx   — /chats/$chatId/print route

shared/
  ui/
    Avatar.tsx              — Nova logo + user initials
    Spinner.tsx
    Kbd.tsx                 — keyboard shortcut chip
  hooks/
    use-hotkeys.ts          — minimal global hotkey hook
  fonts/
    inter.css               — @fontsource imports
    jetbrains.css

styles/
  globals.css               — rebuilt oklch palette
  markdown.css              — dark-mode prose overrides
  print.css                 — print stylesheet
```

Backend additions:

```
backend/app/
  api/v1/
    stats.py               — GET /api/v1/stats
  db/
    alembic/versions/
      <next>_chat_system_prompt_pinned.py
      <next>_message_parent_branch_model_used.py
  services/
    stats_service.py
    context_builder.py     — accept chat.system_prompt
    llm_client.py          — protect LaTeX from CJK stripper
  schemas/
    chat.py                — extend ChatUpdateIn with system_prompt, pinned
    message.py             — extend MessageOut with parent_id, branch_index
    stats.py               — StatsResponse
```

---

## Data model changes

```sql
ALTER TABLE chats
  ADD COLUMN system_prompt VARCHAR(4000),
  ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX ix_chats_pinned ON chats (user_id, pinned DESC, updated_at DESC);

ALTER TABLE messages
  ADD COLUMN parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN branch_index INT NOT NULL DEFAULT 0,
  ADD COLUMN model_used VARCHAR(200);

CREATE INDEX ix_messages_parent ON messages (chat_id, parent_id, branch_index);
```

Two alembic migrations. The migration order can be either: (a) one combined revision, or (b) two — `chat_system_prompt_pinned` then `message_parent_branch_model_used`. We'll use (b) so they can land independently.

`build_context` and `stream_new_message` / `stream_regenerate` / `stream_edit` update:
- Write `model_used` to assistant messages.
- For branching: on regenerate or edit, instead of `DELETE`, create a new assistant Message with `parent_id` pointing at the matching user message and `branch_index` = `count_existing_siblings`. `build_context` walks: starting from the latest active leaf, walk back via `parent_id` to root.

If branching ships partially: keep regenerate as-is (delete) and only thread `model_used` through. Frontend hides the version arrows.

---

## Streaming view internals

The streaming branch of `MarkdownContent` is replaced with a `StreamingView`:

```tsx
interface StreamingViewProps { content: string; }

function StreamingView({ content }: StreamingViewProps) {
  // Split content into closed-fenced code blocks + everything else.
  // For each closed fence, render through MarkdownContent (memoised by content).
  // For the unfinished tail (after the last ```), render as <pre>.
  // Append a blinking caret at the end of the tail.
  // No KaTeX, no remark-math.
}
```

`MessageBubble` decides which to render:
```tsx
{isUser ? <UserText/> : streaming ? <StreamingView content={content}/> : <MarkdownContent content={content}/>}
```

Switching to the full renderer on `assistant_done` triggers a 200 ms cross-fade between the two views to mask any KaTeX layout shift.

---

## Hotkey map

| Combo | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘F` / `Ctrl+F` | Open global search |
| `⌘N` / `Ctrl+N` | New chat |
| `⌘⇧L` | Toggle theme |
| `⌘⇧E` | Export current chat to PDF |
| `⌘⇧S` | Open stats |
| `⌘D` | Pin / unpin current chat |
| `⌘E` | Edit last user message (focus textarea inline) |
| `↑` (in composer, empty) | Recall last sent message |
| `Esc` | Close any open overlay |

Implementation via `useHotkeys` hook (single global listener in `app/main.tsx` after mount).

---

## Testing strategy

For each feature, write or extend tests:

- **Command palette**: vitest + RTL — opens on ⌘K, fuzzy-filters, navigates with arrows.
- **Slash commands**: model.ts unit test for command resolution.
- **System prompt**: backend pytest unit for `build_context` reading chat.system_prompt.
- **Branching**: backend pytest for regenerate creating a sibling (not deleting).
- **Global search**: hook test + integration test that focus query scrolls.
- **Pin**: backend pytest — list orders pinned first.
- **Stats**: backend pytest with a seeded chat history.
- **Streaming view**: vitest + RTL — emit deltas, assert no full markdown re-render between them (count renders via spy).
- **Math auto-wrap**: unit test on the pre-pass given known broken model outputs.

E2E manual smoke checklist (in browser, requires Ollama running):
- Login → home → palette opens → new chat → send "hello" → assistant streams → no jitter → "напиши формулу разложения в ряд фурье" → math renders → regenerate → branch nav appears → pin chat → reload → still pinned → /stats → cards visible.

---

## Phasing (for partial-completion safety)

If we run out of time, the cut-off order is: `15→14→13→11→10→9→8→7→6→5→4→3→2→1`. Practical lines:

- **Must demo:** F1 dark theme, F2 streaming jitter, F3 math, feature 1 (⌘K), feature 2 (slash), feature 8 (thinking indicator), feature 12 (welcome+models).
- **Should demo:** + 3 (system prompt), 5 (global search), 6 (pin), 9 (draft save), 10 (PDF export).
- **Nice to demo:** + 4 (branching), 7 (stats), 11 (onboarding).

Plan tasks should be ordered accordingly so the working tree is always demo-ready.

---

## Risks

- **Branching (feature 4)** is the only invasive backend change. If migration breaks, fallback: keep delete-and-replace, hide branch UI.
- **Math auto-wrap** can have false positives (e.g. `\n` inside a normal text mistaken for a TeX command). The regex is restricted to `\\[a-zA-Z]{2,}` so single-letter `\n` won't match, but we should fall back to literal rendering if KaTeX throws.
- **Onboarding tour** depends on layout positions — flaky if the layout shifts during scroll. Mitigation: tour is opt-in only on first visit; users can dismiss.
- **Streaming view memoisation** — if the memo key is wrong, jitter remains. Test that scrollHeight is stable between deltas.

---

## What ships first

To get a green build fast, the first wave is: F1 + F2 + F3 + Feature 1 + Feature 2. Once that lands the app is **already demo-ready**. Everything after is bonus.
