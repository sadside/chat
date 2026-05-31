# Nova Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Nova Studio spec (P1 fixes + Nova Studio visual concept + 12-feature pack) in priority order, where each task is self-contained and any early cut-off leaves the working tree demo-ready.

**Architecture:** Three fix tasks first (dark theme, streaming jitter, math) → killer feature pair (⌘K + slash) → small wins (thinking indicator, welcome+models) → backend-touching features (system prompt, pin, stats, draft, PDF, global search, onboarding) → branching last (most invasive, has fallback). Each task ends in a green typecheck + tests + a single commit.

**Tech Stack:** React 18 + Vite 5, TanStack Router 1.82 file-based, TanStack Query 5, Zustand 5 + immer + persist, Radix + shadcn/ui, Tailwind 4 (oklch palette), fuse.js (already in deps), react-markdown + remark-math + rehype-katex + rehype-pretty-code (already in deps), Lucide icons. Backend: FastAPI + SQLAlchemy 2 + Alembic + structlog.

---

## Phase 1 — Mandatory fixes

### Task 1: Rebuild oklch color palette (light + dark)

**Files:**
- Modify: `frontend/src/styles/globals.css`

This task replaces the `:root` and `.dark` color tokens with the new oklch scale from the spec. Sidebar, topbar, bubbles will pick up the new colors automatically because they reference these tokens.

- [ ] **Step 1: Read current `globals.css` to know what's there**

Run: open `frontend/src/styles/globals.css` and identify the `:root { --color-* }` and `.dark { --color-* }` blocks.

- [ ] **Step 2: Replace both color blocks**

Replace the `:root` block with:

```css
:root {
  --color-background: oklch(0.99 0.003 80);
  --color-foreground: oklch(0.20 0.012 270);
  --color-card: oklch(0.98 0.003 80);
  --color-card-foreground: oklch(0.20 0.012 270);
  --color-popover: oklch(0.99 0.003 80);
  --color-popover-foreground: oklch(0.20 0.012 270);
  --color-primary: oklch(0.55 0.20 280);
  --color-primary-foreground: oklch(0.99 0.003 80);
  --color-secondary: oklch(0.96 0.005 270);
  --color-secondary-foreground: oklch(0.20 0.012 270);
  --color-muted: oklch(0.96 0.005 270);
  --color-muted-foreground: oklch(0.45 0.012 270);
  --color-accent: oklch(0.96 0.005 270);
  --color-accent-foreground: oklch(0.20 0.012 270);
  --color-destructive: oklch(0.60 0.22 25);
  --color-destructive-foreground: oklch(0.99 0.003 80);
  --color-border: oklch(0.92 0.005 270);
  --color-input: oklch(0.92 0.005 270);
  --color-ring: oklch(0.55 0.20 280);
  --radius: 0.75rem;
}
```

Replace `.dark` with:

```css
.dark {
  --color-background: oklch(0.16 0.012 270);
  --color-foreground: oklch(0.96 0.005 270);
  --color-card: oklch(0.19 0.012 270);
  --color-card-foreground: oklch(0.96 0.005 270);
  --color-popover: oklch(0.19 0.012 270);
  --color-popover-foreground: oklch(0.96 0.005 270);
  --color-primary: oklch(0.65 0.20 280);
  --color-primary-foreground: oklch(0.16 0.012 270);
  --color-secondary: oklch(0.22 0.012 270);
  --color-secondary-foreground: oklch(0.96 0.005 270);
  --color-muted: oklch(0.22 0.012 270);
  --color-muted-foreground: oklch(0.75 0.012 270);
  --color-accent: oklch(0.22 0.012 270);
  --color-accent-foreground: oklch(0.96 0.005 270);
  --color-destructive: oklch(0.68 0.22 25);
  --color-destructive-foreground: oklch(0.96 0.005 270);
  --color-border: oklch(0.28 0.012 270);
  --color-input: oklch(0.28 0.012 270);
  --color-ring: oklch(0.65 0.20 280);
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/globals.css
git commit -m "feat(frontend): oklch palette rebuild (Nova Studio dark + light)"
```

---

### Task 2: Dark-prose overrides for MarkdownContent

**Files:**
- Modify: `frontend/src/styles/markdown.css` (read first, then extend)
- Modify: `frontend/src/shared/ui/markdown-content.tsx` (only if `prose` classes need adjustment)

**Goal:** Make assistant headings, list markers, blockquotes, hr, links readable in dark mode.

- [ ] **Step 1: Read `markdown.css`**

Run: open `frontend/src/styles/markdown.css`.

- [ ] **Step 2: Append the dark-prose overrides**

Append at the end of `markdown.css`:

```css
/* Nova Studio dark-prose overrides — Tailwind prose defaults are too dim in dark mode. */
.prose-nova {
  color: var(--color-foreground);
  font-size: 15px;
  line-height: 1.7;
  max-width: 100%;
}

.prose-nova :where(h1, h2, h3, h4, h5, h6) {
  color: var(--color-foreground);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.prose-nova h1 { font-size: 1.5rem; margin-top: 1.5em; margin-bottom: 0.6em; }
.prose-nova h2 { font-size: 1.25rem; margin-top: 1.4em; margin-bottom: 0.5em; }
.prose-nova h3 { font-size: 1.1rem;  margin-top: 1.2em; margin-bottom: 0.4em; }

.prose-nova p { margin: 0.6em 0; }

.prose-nova a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.prose-nova ul { list-style: disc; padding-left: 1.4em; margin: 0.6em 0; }
.prose-nova ol { list-style: decimal; padding-left: 1.4em; margin: 0.6em 0; }
.prose-nova li { margin: 0.25em 0; }
.prose-nova li::marker { color: var(--color-muted-foreground); }

.prose-nova hr {
  margin: 1.5em 0;
  border: none;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--color-border) 30%,
    var(--color-border) 70%,
    transparent
  );
}

.prose-nova blockquote {
  margin: 0.8em 0;
  padding: 0.4em 0 0.4em 1em;
  border-left: 3px solid color-mix(in oklch, var(--color-primary) 60%, transparent);
  color: var(--color-muted-foreground);
  font-style: italic;
}

.prose-nova code {
  background: var(--color-muted);
  padding: 0.15em 0.35em;
  border-radius: 4px;
  font-size: 0.88em;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
}
.prose-nova pre code { background: transparent; padding: 0; }

.prose-nova strong { color: var(--color-foreground); font-weight: 600; }
.prose-nova em { color: var(--color-foreground); }

.prose-nova table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
.prose-nova th, .prose-nova td {
  border: 1px solid var(--color-border);
  padding: 0.4em 0.6em;
}
.prose-nova th {
  background: var(--color-muted);
  font-weight: 600;
  text-align: left;
}

/* KaTeX display formulas */
.prose-nova .katex-display {
  margin: 1em 0;
  padding: 0.4em 0;
  overflow-x: auto;
  overflow-y: hidden;
  font-size: 1.05em;
}
.prose-nova .katex-display::-webkit-scrollbar { height: 4px; }
.prose-nova .katex-display::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
```

- [ ] **Step 3: Read `markdown-content.tsx` to see how prose class is applied**

Run: open `frontend/src/shared/ui/markdown-content.tsx`. Find the root wrapper class string.

- [ ] **Step 4: Replace the `prose ...` class with `prose-nova`**

If the wrapper currently uses something like `className="prose prose-sm dark:prose-invert ..."`, replace with `className="prose-nova"`. If it composes other classes (like `max-w-none`), keep them.

- [ ] **Step 5: Typecheck + manual smoke**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/markdown.css frontend/src/shared/ui/markdown-content.tsx
git commit -m "feat(frontend): dark-readable prose-nova styles for MarkdownContent"
```

---

### Task 3: Sidebar + topbar glass + section-header polish

**Files:**
- Modify: `frontend/src/widgets/sidebar/sidebar.tsx`
- Modify: `frontend/src/widgets/topbar/topbar.tsx`

- [ ] **Step 1: Read both files**

Run: open `frontend/src/widgets/sidebar/sidebar.tsx` and `frontend/src/widgets/topbar/topbar.tsx`.

- [ ] **Step 2: Edit topbar — glass background**

Locate the topbar root element. Replace its className (or add) with:
`"sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/70 px-3 backdrop-blur-xl"`

Keep all children intact.

- [ ] **Step 3: Edit sidebar — header label + glass**

Find the "недавнее" / "Recent" header and change the className for that text to:
`"px-3 pt-4 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"`

If the sidebar root container has a `bg-background` class, replace with `bg-background/60 backdrop-blur-xl` and ensure the right border is `border-r border-border`.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/widgets/sidebar/sidebar.tsx frontend/src/widgets/topbar/topbar.tsx
git commit -m "feat(frontend): glass topbar + sidebar polish"
```

---

### Task 4: Assistant rail + Nova avatar (drop bubble shading)

**Files:**
- Modify: `frontend/src/widgets/chat-view/message-bubble.tsx`
- Create: `frontend/src/shared/ui/nova-avatar.tsx`

- [ ] **Step 1: Create NovaAvatar**

Create `frontend/src/shared/ui/nova-avatar.tsx`:

```tsx
import { Sparkles } from 'lucide-react';

export function NovaAvatar({ size = 24 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.65_0.20_280)] to-[oklch(0.55_0.20_320)] text-white shadow-sm"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Sparkles className="h-3 w-3" />
    </div>
  );
}
```

- [ ] **Step 2: Restructure assistant branch in message-bubble.tsx**

Open `frontend/src/widgets/chat-view/message-bubble.tsx`. Find the outer assistant block (the `<div>` that wraps the assistant content). Replace it with a structure that renders a left rail + avatar + body:

```tsx
{!isUser && (
  <div className="flex w-full gap-3">
    <div className="flex flex-col items-center pt-1">
      <NovaAvatar />
      <div
        className="mt-1 w-px flex-1 bg-gradient-to-b from-[oklch(0.65_0.20_280/0.5)] to-transparent"
        aria-hidden="true"
      />
    </div>
    <div className="min-w-0 flex-1">
      {/* existing assistant content goes here: streaming view OR MarkdownContent + action row */}
    </div>
  </div>
)}
```

For the user branch (unchanged structure), update the bubble class to use the gradient tint per spec:

Replace the existing user bubble class string with:

```tsx
isUser
  ? [
      'rounded-2xl rounded-tr-md px-4 py-2.5',
      'bg-gradient-to-br from-[oklch(0.65_0.20_280/0.12)] to-[oklch(0.65_0.20_280/0.06)]',
      'border border-[oklch(0.65_0.20_280/0.18)]',
      'text-foreground shadow-sm',
    ].join(' ')
  : 'text-foreground w-full',
```

Add import for `NovaAvatar` at the top:
```tsx
import { NovaAvatar } from '@/shared/ui/nova-avatar';
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/chat-view/message-bubble.tsx frontend/src/shared/ui/nova-avatar.tsx
git commit -m "feat(frontend): assistant rail + Nova avatar + glass user bubble"
```

---

### Task 5: Streaming view (kill jitter) + math auto-wrap

**Files:**
- Create: `frontend/src/shared/ui/streaming-view.tsx`
- Modify: `frontend/src/shared/ui/markdown-content.tsx`
- Create: `frontend/src/shared/ui/markdown-content.test.tsx`

- [ ] **Step 1: Write failing test for math auto-wrap**

Create `frontend/src/shared/ui/markdown-content.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { autoWrapMath } from './markdown-content';

describe('autoWrapMath', () => {
  it('wraps inline LaTeX in $...$ when no delimiters present', () => {
    const out = autoWrapMath('f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty}');
    expect(out).toContain('$f(x) = \\frac{a_0}{2} + \\sum_{n=1}^{\\infty}$');
  });

  it('leaves text without TeX commands untouched', () => {
    expect(autoWrapMath('просто текст без формул')).toBe('просто текст без формул');
  });

  it('leaves lines already containing $ alone', () => {
    expect(autoWrapMath('inline $\\frac{1}{2}$ here')).toBe('inline $\\frac{1}{2}$ here');
  });

  it('skips fenced code blocks', () => {
    const md = 'before\n```\n\\frac{1}{2}\n```\nafter';
    expect(autoWrapMath(md)).toBe(md);
  });

  it('handles multi-line content', () => {
    const out = autoWrapMath('intro\n\\sum_n x_n = 0\nend');
    expect(out).toContain('$\\sum_n x_n = 0$');
    expect(out).toContain('intro');
    expect(out).toContain('end');
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `cd frontend && npm test -- src/shared/ui/markdown-content.test.tsx`
Expected: FAIL (`autoWrapMath` not exported).

- [ ] **Step 3: Read existing `markdown-content.tsx`**

Run: open `frontend/src/shared/ui/markdown-content.tsx`. Note imports, exports, plugin list.

- [ ] **Step 4: Add `autoWrapMath` helper and wire it in**

Insert near the top of `markdown-content.tsx` (after imports, before the component):

```tsx
// Matches a TeX command: backslash + 2+ letters, optionally followed by {...}.
// Two-letter minimum avoids matching \n (newline literal in tooltips etc).
const TEX_CMD = /\\[a-zA-Z]{2,}(\{[^}]*\})*/;

/**
 * Models often emit raw LaTeX without $-delimiters. This pre-pass scans the
 * content line by line and wraps lines that contain TeX commands but no
 * existing $ delimiters in $...$. Code fences are skipped.
 */
export function autoWrapMath(input: string): string {
  const lines = input.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.includes('$')) continue;
    if (TEX_CMD.test(line)) {
      lines[i] = `$${line.trim()}$`;
    }
  }
  return lines.join('\n');
}
```

In the body of the component, find where `content` is passed to react-markdown. Replace with `autoWrapMath(content)`.

- [ ] **Step 5: Run test — should pass**

Run: `cd frontend && npm test -- src/shared/ui/markdown-content.test.tsx`
Expected: PASS.

- [ ] **Step 6: Create StreamingView**

Create `frontend/src/shared/ui/streaming-view.tsx`:

```tsx
import { useMemo } from 'react';

interface Props { content: string; }

/**
 * Lightweight rendering used WHILE an SSE delta stream is in flight.
 * - Splits content on completed fenced code blocks. Each closed fence stays
 *   in its own <pre> with a JetBrains-Mono font; the unfinished tail (the
 *   part after the last unmatched ``` or the whole content if no fence) is
 *   a single <pre>. KaTeX and markdown parsing are deferred until done so
 *   the layout doesn't reflow on every delta.
 * - Appends a blinking caret at the end.
 */
export function StreamingView({ content }: Props) {
  const segments = useMemo(() => splitOnFences(content), [content]);
  return (
    <div className="relative min-h-[1.5em] whitespace-pre-wrap break-words text-[15px] leading-7">
      {segments.map((seg, i) =>
        seg.kind === 'code' ? (
          <pre
            key={i}
            className="my-2 overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-sm"
          >
            <code>{seg.text}</code>
          </pre>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block w-[2px] bg-primary align-text-bottom animate-pulse"
        style={{ height: '1em' }}
      />
    </div>
  );
}

type Segment = { kind: 'text' | 'code'; text: string };

function splitOnFences(content: string): Segment[] {
  const out: Segment[] = [];
  const re = /```[\s\S]*?(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: content.slice(last, m.index) });
    const raw = m[0];
    const stripped = raw.replace(/^```[a-zA-Z0-9]*\n?/, '').replace(/```$/, '');
    out.push({ kind: 'code', text: stripped });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ kind: 'text', text: content.slice(last) });
  return out;
}
```

- [ ] **Step 7: Switch `message-bubble.tsx` to use StreamingView during streaming**

Open `frontend/src/widgets/chat-view/message-bubble.tsx`. Import:

```tsx
import { StreamingView } from '@/shared/ui/streaming-view';
```

Replace the existing assistant render — `<MarkdownContent content={message.content} streaming={streaming} />` — with:

```tsx
{streaming ? (
  <StreamingView content={message.content} />
) : (
  <MarkdownContent content={message.content} streaming={false} />
)}
```

- [ ] **Step 8: Typecheck + tests**

Run: `cd frontend && npm run typecheck && npm test -- src/shared/ui/markdown-content.test.tsx`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/ui/streaming-view.tsx \
        frontend/src/shared/ui/markdown-content.tsx \
        frontend/src/shared/ui/markdown-content.test.tsx \
        frontend/src/widgets/chat-view/message-bubble.tsx
git commit -m "feat(frontend): streaming view + math auto-wrap

StreamingView renders incoming deltas as plain pre + completed code
fences with a blinking caret, deferring full markdown + KaTeX parsing
to assistant_done. autoWrapMath rescues malformed LaTeX from models
that emit raw \\frac/\\sum without \$ delimiters."
```

---

### Task 6: Backend — protect LaTeX from CJK stripper + system prompt math hint

**Files:**
- Modify: `backend/app/services/llm_client.py`
- Modify: `backend/app/services/context_builder.py`
- Create: `backend/tests/unit/test_llm_client_strip.py`

- [ ] **Step 1: Read both backend files**

Run: open `backend/app/services/llm_client.py` and `backend/app/services/context_builder.py`.

- [ ] **Step 2: Write failing test**

Create `backend/tests/unit/test_llm_client_strip.py`:

```python
from app.services.llm_client import _strip_cjk


def test_strip_cjk_leaves_ascii_alone():
    assert _strip_cjk("hello world") == "hello world"


def test_strip_cjk_removes_chinese():
    assert "你好" not in _strip_cjk("hi 你好 there")


def test_strip_cjk_preserves_latex_commands():
    src = r"f(x) = \frac{a_0}{2} + \sum_{n=1}^{\infty} a_n \cos(\frac{n\pi x}{L})"
    out = _strip_cjk(src)
    assert r"\frac{a_0}{2}" in out
    assert r"\sum_{n=1}^{\infty}" in out
    assert r"\cos" in out
```

- [ ] **Step 3: Run test — should reveal current behaviour**

Run: `cd backend && uv run pytest tests/unit/test_llm_client_strip.py -v`
Expected: first two pass; third may pass already (regex doesn't match `\` directly), but if it fails — proves the bug.

- [ ] **Step 4: Update `_strip_cjk` to skip across LaTeX commands**

In `backend/app/services/llm_client.py` replace the `_strip_cjk` function with:

```python
_LATEX_SPAN = re.compile(r"\\[a-zA-Z]+(\{[^}]*\})*")


def _strip_cjk(text: str) -> str:
    """Remove CJK characters and collapse the whitespace they leave behind.

    LaTeX command spans (\\command{args}) are protected — the CJK regex
    range includes CJK-Symbols-and-Punctuation which has historically eaten
    characters inside math-mode arguments.
    """
    if not text:
        return text
    if not _CJK_RE.search(text):
        return text
    parts: list[str] = []
    pos = 0
    for m in _LATEX_SPAN.finditer(text):
        if m.start() > pos:
            parts.append(_CJK_RE.sub("", text[pos : m.start()]))
        parts.append(m.group(0))
        pos = m.end()
    if pos < len(text):
        parts.append(_CJK_RE.sub("", text[pos:]))
    out = "".join(parts)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out
```

- [ ] **Step 5: Run test — should pass**

Run: `cd backend && uv run pytest tests/unit/test_llm_client_strip.py -v`
Expected: PASS (all 3).

- [ ] **Step 6: Extend system prompt with math hint**

In `backend/app/services/context_builder.py` find the constant that holds the default system message (something like `SYSTEM_PROMPT = "..."`). Append the math directive at the end of the prompt string:

```python
# Math hint appended to whatever the existing system prompt is.
_MATH_HINT = (
    "\n\nЕсли в ответе есть формулы, используй LaTeX: $…$ для inline-формул "
    "и $$…$$ для отдельных формул. Используй стандартные команды (\\frac, "
    "\\sum, \\int, \\sqrt). Никогда не пиши \\lef или \\rgh — только \\left и \\right."
)
```

Find where the system message is built (look for `messages.append({"role": "system", ...})` or similar) and change the content string to `existing_content + _MATH_HINT`.

- [ ] **Step 7: Run all backend unit tests**

Run: `cd backend && uv run pytest tests/unit -q`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/llm_client.py \
        backend/app/services/context_builder.py \
        backend/tests/unit/test_llm_client_strip.py
git commit -m "fix(backend): protect LaTeX from CJK strip + math hint in system prompt"
```

---

### Task 7: Sonner toast → glass design + motion refresh

**Files:**
- Modify: `frontend/src/shared/ui/sonner.tsx`

- [ ] **Step 1: Read file**

Run: open `frontend/src/shared/ui/sonner.tsx`.

- [ ] **Step 2: Update toast styling and motion easing**

Find the `motion.div` block. Replace its className with:

```tsx
className={cn(
  'flex min-w-[280px] items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl',
  t.variant === 'destructive'
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-border bg-background/80 text-foreground'
)}
```

Replace transition with:

```tsx
transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/ui/sonner.tsx
git commit -m "feat(frontend): glass toasts + Nova Studio easing"
```

---

## Phase 2 — Killer features

### Task 8: Command palette (⌘K)

**Files:**
- Create: `frontend/src/shared/hooks/use-hotkey.ts`
- Create: `frontend/src/features/command-palette/store.ts`
- Create: `frontend/src/features/command-palette/registry.ts`
- Create: `frontend/src/features/command-palette/ui/CommandPalette.tsx`
- Create: `frontend/src/features/command-palette/index.ts`
- Modify: `frontend/src/pages/__root.tsx` to mount the palette + register the global hotkey

- [ ] **Step 1: Create `use-hotkey.ts`**

```ts
import { useEffect } from 'react';

interface Combo {
  key: string;        // case-insensitive single key e.g. 'k'
  meta?: boolean;     // ⌘ on mac, Ctrl elsewhere
  shift?: boolean;
}

/**
 * Global hotkey hook — binds to window keydown. Does NOT fire when focus is
 * inside an editable input/textarea/contentEditable unless `allowInInput`.
 */
export function useHotkey(combo: Combo, handler: () => void, allowInInput = false) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
      }
      const metaWanted = !!combo.meta;
      const shiftWanted = !!combo.shift;
      const metaActive = e.metaKey || e.ctrlKey;
      if (e.key.toLowerCase() !== combo.key.toLowerCase()) return;
      if (metaWanted !== metaActive) return;
      if (shiftWanted !== e.shiftKey) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo.key, combo.meta, combo.shift, handler, allowInInput]);
}
```

- [ ] **Step 2: Create palette store**

`frontend/src/features/command-palette/store.ts`:

```ts
import { create } from 'zustand';

interface PaletteState {
  open: boolean;
  query: string;
  toggle: () => void;
  setOpen: (v: boolean) => void;
  setQuery: (q: string) => void;
}

export const usePalette = create<PaletteState>((set) => ({
  open: false,
  query: '',
  toggle: () => set((s) => ({ open: !s.open, query: s.open ? '' : s.query })),
  setOpen: (v) => set({ open: v, query: v ? '' : '' }),
  setQuery: (q) => set({ query: q }),
}));
```

- [ ] **Step 3: Create registry**

`frontend/src/features/command-palette/registry.ts`:

```ts
import type { LucideIcon } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  title: string;
  hint?: string;
  icon: LucideIcon;
  section: 'actions' | 'chats' | 'models';
  /** Run the command. Receives the close() of the palette. */
  run: (close: () => void) => void;
  keywords?: string[];
}
```

- [ ] **Step 4: Create UI**

`frontend/src/features/command-palette/ui/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import Fuse from 'fuse.js';
import { Search, Plus, Sun, Moon, Pin, Cpu, Download, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { usePalette } from '../store';
import type { PaletteCommand } from '../registry';
import { useChatsQuery } from '@/entities/chat/queries';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model';
import { useToggleTheme } from '@/features/toggle-theme/use-toggle-theme';
import { apiClient as api } from '@/shared/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/entities/chat/queries';
import type { Chat } from '@/entities/chat/types';

export function CommandPalette() {
  const { open, query, setOpen, setQuery } = usePalette();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  const { data: chats = [] } = useChatsQuery();
  const { data: models = [] } = useModelsQuery();
  const setSelectedModel = useSelectedModel((s) => s.setSelectedModel);
  const toggleTheme = useToggleTheme();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const close = () => setOpen(false);

  const actionCommands: PaletteCommand[] = useMemo(() => [
    {
      id: 'new-chat',
      title: 'Новый чат',
      hint: '⌘N',
      icon: Plus,
      section: 'actions',
      run: async (cls) => {
        const chat = await api.post('chats').json<Chat>();
        await qc.invalidateQueries({ queryKey: chatKeys.list() });
        cls();
        navigate({ to: '/chats/$chatId', params: { chatId: chat.id } });
      },
    },
    {
      id: 'toggle-theme',
      title: 'Переключить тему',
      hint: '⌘⇧L',
      icon: Sun,
      section: 'actions',
      run: (cls) => { toggleTheme(); cls(); },
    },
    {
      id: 'open-stats',
      title: 'Статистика',
      hint: '⌘⇧S',
      icon: BarChart3,
      section: 'actions',
      run: (cls) => { cls(); navigate({ to: '/stats' }); },
    },
  ], [navigate, qc, toggleTheme]);

  const chatCommands: PaletteCommand[] = useMemo(
    () => chats.map((c) => ({
      id: `chat-${c.id}`,
      title: c.title || 'Без названия',
      icon: Pin,
      section: 'chats' as const,
      run: (cls) => { cls(); navigate({ to: '/chats/$chatId', params: { chatId: c.id } }); },
      keywords: [c.title ?? ''],
    })),
    [chats, navigate],
  );

  const modelCommands: PaletteCommand[] = useMemo(
    () => models.map((m) => ({
      id: `model-${m.id}`,
      title: `Модель: ${m.name}`,
      icon: Cpu,
      section: 'models' as const,
      run: (cls) => { setSelectedModel(m.id); cls(); },
      keywords: [m.id, m.name],
    })),
    [models, setSelectedModel],
  );

  const all = useMemo(
    () => [...actionCommands, ...chatCommands, ...modelCommands],
    [actionCommands, chatCommands, modelCommands],
  );

  const results = useMemo(() => {
    if (!query.trim()) return all.slice(0, 12);
    const fuse = new Fuse(all, { keys: ['title', 'keywords'], threshold: 0.4, ignoreLocation: true });
    return fuse.search(query).slice(0, 12).map((r) => r.item);
  }, [all, query]);

  useEffect(() => { setActive(0); }, [query, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); results[active]?.run(close); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Командная панель</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск чатов, действий, моделей…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
          )}
          {results.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
              }`}
              onMouseEnter={() => setActive(i)}
              onClick={() => cmd.run(close)}
            >
              <cmd.icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{cmd.title}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{cmd.section}</span>
              {cmd.hint && (
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{cmd.hint}</kbd>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create barrel**

`frontend/src/features/command-palette/index.ts`:

```ts
export { CommandPalette } from './ui/CommandPalette';
export { usePalette } from './store';
```

- [ ] **Step 6: Mount in `__root.tsx` + register hotkey**

Open `frontend/src/pages/__root.tsx`. Add imports:

```tsx
import { CommandPalette, usePalette } from '@/features/command-palette';
import { useHotkey } from '@/shared/hooks/use-hotkey';
```

Inside `RootLayout`, after existing hooks, add:

```tsx
const togglePalette = usePalette((s) => s.toggle);
useHotkey({ key: 'k', meta: true }, togglePalette, true);
useHotkey({ key: 'n', meta: true }, () => {
  // Defer to palette new-chat action — simulate by opening palette + Enter would be too magic.
  // Just open palette so user can pick.
  togglePalette();
}, true);
```

Inside both return branches (auth-layout and main-layout), render `<CommandPalette />` near the Toaster.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/hooks/use-hotkey.ts \
        frontend/src/features/command-palette \
        frontend/src/pages/__root.tsx
git commit -m "feat(frontend): ⌘K command palette with chats/actions/models"
```

---

### Task 9: Slash commands in composer

**Files:**
- Create: `frontend/src/features/slash-commands/config.ts`
- Create: `frontend/src/features/slash-commands/SlashPopover.tsx`
- Create: `frontend/src/features/slash-commands/index.ts`
- Modify: `frontend/src/widgets/composer/composer.tsx`

- [ ] **Step 1: Create command config**

`frontend/src/features/slash-commands/config.ts`:

```ts
export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  /** Build the final prompt given the user's argument text. */
  apply: (arg: string) => string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'summarize',
    label: '/summarize',
    description: 'Сделать краткое резюме',
    apply: (arg) => `Сделай краткое резюме следующего текста, выдели главные идеи:\n\n${arg}`,
  },
  {
    id: 'translate',
    label: '/translate',
    description: 'Перевести на английский',
    apply: (arg) => `Переведи на английский, сохрани стиль и тон:\n\n${arg}`,
  },
  {
    id: 'explain',
    label: '/explain',
    description: 'Объяснить простыми словами',
    apply: (arg) => `Объясни простыми словами, как будто я не специалист:\n\n${arg}`,
  },
  {
    id: 'code',
    label: '/code',
    description: 'Написать код',
    apply: (arg) => `Напиши готовый рабочий код для задачи. Используй современные практики и добавь короткое объяснение к коду:\n\n${arg}`,
  },
  {
    id: 'improve',
    label: '/improve',
    description: 'Улучшить текст',
    apply: (arg) => `Улучши этот текст: сделай яснее, убери воду, исправь ошибки. Не меняй смысл:\n\n${arg}`,
  },
  {
    id: 'eli5',
    label: '/eli5',
    description: 'Объяснить как ребёнку',
    apply: (arg) => `Объясни как пятилетнему ребёнку, простыми словами и с примерами:\n\n${arg}`,
  },
];
```

- [ ] **Step 2: Create popover**

`frontend/src/features/slash-commands/SlashPopover.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { SLASH_COMMANDS, type SlashCommand } from './config';

interface Props {
  query: string;            // text after the leading '/'
  onPick: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function SlashPopover({ query, onPick, onClose }: Props) {
  const list = SLASH_COMMANDS.filter((c) => c.label.includes(query.toLowerCase()) || c.id.startsWith(query.toLowerCase()));
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (list[active]) { e.preventDefault(); onPick(list[active]); }
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, active, onPick, onClose]);

  if (list.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-xl backdrop-blur-xl"
    >
      {list.map((c, i) => (
        <button
          key={c.id}
          className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors ${
            i === active ? 'bg-primary/10' : 'hover:bg-muted'
          }`}
          onMouseEnter={() => setActive(i)}
          onClick={() => onPick(c)}
        >
          <span className="font-medium">{c.label}</span>
          <span className="text-xs text-muted-foreground">{c.description}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Barrel**

`frontend/src/features/slash-commands/index.ts`:

```ts
export { SLASH_COMMANDS, type SlashCommand } from './config';
export { SlashPopover } from './SlashPopover';
```

- [ ] **Step 4: Wire into composer**

Open `frontend/src/widgets/composer/composer.tsx`. Add:

```tsx
import { SlashPopover, type SlashCommand } from '@/features/slash-commands';
```

Add a `pendingCommand` state and parse logic:

```tsx
const [pendingCommand, setPendingCommand] = React.useState<SlashCommand | null>(null);
const slashOpen = !pendingCommand && value.startsWith('/');
const slashQuery = slashOpen ? value.slice(1) : '';

const pickCommand = (cmd: SlashCommand) => {
  setPendingCommand(cmd);
  setValue('');
};

const clearCommand = () => setPendingCommand(null);
```

Wrap the textarea in a `<div className="relative">` and render the popover above it when open:

```tsx
<div className="relative w-full">
  {slashOpen && (
    <SlashPopover query={slashQuery} onPick={pickCommand} onClose={() => setValue('')} />
  )}
  {pendingCommand && (
    <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
      {pendingCommand.label}
      <button onClick={clearCommand} aria-label="Очистить команду" className="hover:opacity-70">×</button>
    </div>
  )}
  <textarea ... /* existing */ />
</div>
```

Modify `handleSend` to apply the command:

```tsx
const handleSend = useCallback(() => {
  const trimmed = value.trim();
  if (!trimmed || isStreaming || disabled) return;
  const finalContent = pendingCommand ? pendingCommand.apply(trimmed) : trimmed;
  onSend(finalContent);
  setValue('');
  setPendingCommand(null);
}, [value, isStreaming, disabled, onSend, pendingCommand]);
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/slash-commands frontend/src/widgets/composer/composer.tsx
git commit -m "feat(frontend): slash commands in composer

/ at start of message opens picker for summarize/translate/explain/
code/improve/eli5. Selecting wraps the user's input in a templated
prompt before send."
```

---

### Task 10: Thinking indicator + `<think>` reasoning panel

**Files:**
- Create: `frontend/src/widgets/chat-view/thinking-indicator.tsx`
- Create: `frontend/src/widgets/chat-view/reasoning-panel.tsx`
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx`
- Modify: `frontend/src/shared/ui/streaming-view.tsx`

- [ ] **Step 1: Create ThinkingIndicator**

```tsx
// frontend/src/widgets/chat-view/thinking-indicator.tsx
import { NovaAvatar } from '@/shared/ui/nova-avatar';

export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <NovaAvatar />
      <div className="flex items-center gap-1 pt-1">
        <span className="text-sm text-muted-foreground">Думаю</span>
        <span className="inline-flex gap-0.5">
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '120ms' }} />
          <span className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '240ms' }} />
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ReasoningPanel**

```tsx
// frontend/src/widgets/chat-view/reasoning-panel.tsx
import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface Props { content: string; }

export function ReasoningPanel({ content }: Props) {
  const [open, setOpen] = useState(false);
  if (!content.trim()) return null;
  return (
    <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Brain className="h-3 w-3" />
        Размышления
      </button>
      {open && <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed opacity-80">{content}</pre>}
    </div>
  );
}
```

- [ ] **Step 3: Extract `<think>` from streaming content + render thinking indicator pre-first-delta**

In `frontend/src/shared/ui/streaming-view.tsx` add a helper at the top:

```tsx
function splitReasoning(content: string): { reasoning: string; answer: string } {
  const m = content.match(/^<think>([\s\S]*?)(?:<\/think>|$)/);
  if (m) {
    const closed = content.includes('</think>');
    const reasoning = m[1] ?? '';
    const answer = closed ? content.slice(content.indexOf('</think>') + '</think>'.length) : '';
    return { reasoning, answer };
  }
  return { reasoning: '', answer: content };
}
```

Modify `StreamingView` to extract and render reasoning panel above the streaming body:

```tsx
import { ReasoningPanel } from '@/widgets/chat-view/reasoning-panel';

export function StreamingView({ content }: Props) {
  const { reasoning, answer } = useMemo(() => splitReasoning(content), [content]);
  const segments = useMemo(() => splitOnFences(answer), [answer]);
  return (
    <div>
      {reasoning && <ReasoningPanel content={reasoning} />}
      <div className="relative min-h-[1.5em] whitespace-pre-wrap break-words text-[15px] leading-7">
        {/* unchanged segments + caret */}
      </div>
    </div>
  );
}
```

Also do the same split inside `MessageBubble` for the *finished* assistant content so the panel persists. Add at the top of the assistant render branch:

```tsx
const { reasoning, answer } = (() => {
  const m = message.content.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)/);
  return m ? { reasoning: m[1] ?? '', answer: m[2] ?? '' } : { reasoning: '', answer: message.content };
})();
```

And render `<ReasoningPanel content={reasoning} />` + use `answer` instead of `message.content` for the markdown render.

- [ ] **Step 4: Render thinking indicator between `assistant_start` and first delta**

Open `frontend/src/widgets/chat-view/chat-view.tsx`. After the messages map, before the GenerationProgress block, add:

```tsx
{isStreaming && stream.assistantContent.length === 0 && (
  <ThinkingIndicator />
)}
```

Import `ThinkingIndicator` at the top.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/widgets/chat-view/thinking-indicator.tsx \
        frontend/src/widgets/chat-view/reasoning-panel.tsx \
        frontend/src/widgets/chat-view/chat-view.tsx \
        frontend/src/shared/ui/streaming-view.tsx \
        frontend/src/widgets/chat-view/message-bubble.tsx
git commit -m "feat(frontend): thinking indicator + <think> reasoning panel"
```

---

### Task 11: Welcome screen revamp + model cards

**Backend** (small):

**Files:**
- Modify: `backend/app/api/v1/models.py`
- Create: `backend/app/services/model_catalog.py`

- [ ] **Step 1: Create catalog**

`backend/app/services/model_catalog.py`:

```python
"""Static metadata for known LLM model ids.

Ollama doesn't expose descriptions/capabilities, so we keep a small static
catalog. Unknown models fall back to a neutral default.
"""

CATALOG: dict[str, dict] = {
    "llama3.1:8b": {
        "description": "Универсальная модель Meta, хорошо держит инструкции.",
        "context_window": 128_000,
        "capabilities": ["chat", "code", "russian"],
    },
    "qwen2.5:7b": {
        "description": "Сильна в коде и многоязычности, лучший выбор для русского.",
        "context_window": 32_768,
        "capabilities": ["chat", "code", "math", "russian"],
    },
    "mistral:7b": {
        "description": "Лаконичная и быстрая модель Mistral.",
        "context_window": 32_768,
        "capabilities": ["chat", "russian"],
    },
    "deepseek-r1:7b": {
        "description": "Reasoning-модель с встроенным цепочечным размышлением.",
        "context_window": 32_768,
        "capabilities": ["chat", "math", "code", "reasoning"],
    },
}

DEFAULT: dict = {
    "description": "—",
    "context_window": 8192,
    "capabilities": [],
}


def metadata_for(model_id: str) -> dict:
    return CATALOG.get(model_id, DEFAULT)
```

- [ ] **Step 2: Extend `/models` endpoint**

In `backend/app/api/v1/models.py` change the route body:

```python
from app.services.model_catalog import metadata_for


@router.get("")
async def list_models(
    _current_user: User = Depends(get_current_user),  # noqa: B008
    llm: LlmClient = Depends(get_llm_client),  # noqa: B008
) -> list[dict]:
    try:
        ids = await llm.list_models()
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [
        {"id": mid, "name": mid, **metadata_for(mid)}
        for mid in ids
    ]
```

- [ ] **Step 3: Backend unit test**

Create `backend/tests/unit/test_model_catalog.py`:

```python
from app.services.model_catalog import metadata_for


def test_known_model_returns_catalog_entry():
    md = metadata_for("qwen2.5:7b")
    assert md["context_window"] == 32_768
    assert "russian" in md["capabilities"]


def test_unknown_model_returns_default():
    md = metadata_for("phantom:99b")
    assert md["context_window"] == 8192
    assert md["capabilities"] == []
```

Run: `cd backend && uv run pytest tests/unit/test_model_catalog.py -v`
Expected: PASS.

**Frontend:**

**Files:**
- Modify: `frontend/src/entities/model/api.ts`
- Modify: `frontend/src/widgets/chat-view/empty-state.tsx`

- [ ] **Step 4: Extend `LlmModel` type**

In `frontend/src/entities/model/api.ts`:

```ts
export interface LlmModel {
  id: string;
  name: string;
  description: string;
  context_window: number;
  capabilities: string[];
}
```

- [ ] **Step 5: Read existing empty-state.tsx**

Run: open `frontend/src/widgets/chat-view/empty-state.tsx`. Note prop shape.

- [ ] **Step 6: Revamp empty state**

Replace the file content with:

```tsx
import { Sparkles } from 'lucide-react';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model';

interface Props { onPromptClick?: (prompt: string) => void; }

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const PROMPT_SETS: Record<string, string[]> = {
  morning: [
    'Расскажи свежую новость по технологиям',
    'Объясни концепцию энтропии простыми словами',
    'Помоги составить план на день',
    'Что такое vLLM и зачем он нужен?',
  ],
  day: [
    'Напиши Python-скрипт, который читает CSV и считает среднее',
    'Объясни сортировку слиянием через пример',
    'Помоги улучшить мой текст',
    'Какие книги почитать про системный дизайн?',
  ],
  evening: [
    'Подбери идею для пет-проекта на выходные',
    'Расскажи интересный факт про космос',
    'Напиши короткое стихотворение про код',
    'Идеи для отдыха завтра',
  ],
};

function timeSlot(): keyof typeof PROMPT_SETS {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

export function EmptyState({ onPromptClick }: Props) {
  const greeting = hourGreeting();
  const prompts = PROMPT_SETS[timeSlot()]!;
  const { data: models = [] } = useModelsQuery();
  const setSelectedModel = useSelectedModel((s) => s.setSelectedModel);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-10 px-6 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.65_0.20_280)] to-[oklch(0.55_0.20_320)] text-white shadow-lg">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Локальная LLM. Полная приватность.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onPromptClick?.(p)}
            className="group rounded-xl border border-border bg-card/60 p-3 text-left text-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
          >
            <span className="line-clamp-2 group-hover:text-foreground">{p}</span>
          </button>
        ))}
      </div>

      {models.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Доступные модели
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className="min-w-[220px] rounded-xl border border-border bg-card/60 p-3 text-left transition-all hover:border-primary/40 hover:bg-card"
              >
                <div className="text-sm font-medium">{m.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.capabilities.slice(0, 3).map((c) => (
                    <span key={c} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {c}
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {(m.context_window / 1000).toFixed(0)}k
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add backend/app/api/v1/models.py \
        backend/app/services/model_catalog.py \
        backend/tests/unit/test_model_catalog.py \
        frontend/src/entities/model/api.ts \
        frontend/src/widgets/chat-view/empty-state.tsx
git commit -m "feat: welcome screen revamp + model cards with metadata catalog"
```

---

## Phase 3 — Backend-touching features

### Task 12: Per-chat system prompt + Pin chat (combined migration)

**Backend:**

**Files:**
- Create: `backend/app/db/alembic/versions/<rev>_chat_system_prompt_pinned.py`
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/schemas/chat.py`
- Modify: `backend/app/services/chat_service.py`
- Modify: `backend/app/services/context_builder.py`

- [ ] **Step 1: Generate migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "chat_system_prompt_pinned"`
Look at the generated file. Verify it ADDs `system_prompt` and `pinned` columns to `chats`. Edit if it includes unrelated changes (remove them). Confirm `down_revision` points at the previous head.

- [ ] **Step 2: Update model**

In `backend/app/db/models.py` add fields to `Chat`:

```python
system_prompt: Mapped[str | None] = mapped_column(String(4000), nullable=True)
pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
```

(Import `Boolean` from `sqlalchemy` if not already imported.)

- [ ] **Step 3: Update schema**

In `backend/app/schemas/chat.py`:

```python
class ChatUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    system_prompt: str | None = Field(default=None, max_length=4000)
    pinned: bool | None = None


class ChatSummary(BaseModel):
    id: UUID
    title: str
    pinned: bool
    system_prompt: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update service**

In `backend/app/services/chat_service.py`:

- `list_chats` query: `.order_by(Chat.pinned.desc(), Chat.updated_at.desc())`
- `rename_chat` (or whatever PATCH-handling method is named): accept `body.system_prompt` and `body.pinned` and apply them when not None.

If the method is `rename_chat(self, chat_id, user_id, body)`, generalize:

```python
async def update_chat(self, chat_id: UUID, user_id: UUID, body: ChatUpdateIn) -> Chat:
    chat = await self.get_chat_or_404(chat_id, user_id)
    if body.title is not None:
        chat.title = body.title.strip()
    if body.system_prompt is not None:
        chat.system_prompt = body.system_prompt
    if body.pinned is not None:
        chat.pinned = body.pinned
    await self._db.flush()
    return chat
```

(Replace `rename_chat` callers — there is one in `backend/app/api/v1/chats.py`.) Keep `rename_chat` as an alias if other tests reference it.

- [ ] **Step 5: Update context_builder**

Modify the signature of `build_context` (currently takes `messages` + `context_window`) to also accept the chat's system prompt and use it:

```python
def build_context(
    messages: list[Message],
    context_window: int,
    chat_system_prompt: str | None = None,
) -> list[dict[str, str]]:
    ...
    out: list[dict[str, str]] = [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT + _MATH_HINT}]
    if chat_system_prompt:
        out.append({"role": "system", "content": chat_system_prompt})
    out.extend(...)
    return out
```

Update all callers in `backend/app/services/message_service.py` (3 places: `stream_new_message`, `stream_regenerate`, `stream_edit`) to pass `chat.system_prompt`. Fetch `chat` once at the top (already done via `_get_chat_or_404`).

- [ ] **Step 6: Backend unit test**

Create `backend/tests/unit/test_context_builder_system_prompt.py`:

```python
from app.services.context_builder import build_context


def test_default_system_prompt_only_when_chat_has_none():
    ctx = build_context([], 8192, chat_system_prompt=None)
    assert ctx[0]["role"] == "system"
    assert len(ctx) == 1


def test_chat_system_prompt_appended_as_second_system_message():
    ctx = build_context([], 8192, chat_system_prompt="Ты пират.")
    assert ctx[0]["role"] == "system"
    assert ctx[1]["role"] == "system"
    assert "пират" in ctx[1]["content"]
```

Run: `cd backend && uv run pytest tests/unit/test_context_builder_system_prompt.py -v`
Expected: PASS.

- [ ] **Step 7: Run all backend unit tests**

Run: `cd backend && uv run pytest tests/unit -q`
Expected: green.

**Frontend:**

**Files:**
- Modify: `frontend/src/entities/chat/types.ts`
- Create: `frontend/src/features/chat-settings/ChatSettingsDialog.tsx`
- Create: `frontend/src/features/chat-settings/index.ts`
- Modify: `frontend/src/widgets/sidebar/chat-list-item.tsx`
- Modify: `frontend/src/widgets/sidebar/sidebar.tsx`
- Modify: `frontend/src/widgets/topbar/topbar.tsx`

- [ ] **Step 8: Extend Chat type**

In `frontend/src/entities/chat/types.ts` add fields:

```ts
export interface Chat {
  id: string;
  title: string;
  pinned: boolean;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 9: Create chat-settings dialog**

`frontend/src/features/chat-settings/ChatSettingsDialog.tsx`:

```tsx
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { apiClient as api } from '@/shared/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/entities/chat/queries';
import { toast } from '@/shared/ui/toast';

interface Props {
  chatId: string;
  initialPrompt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSettingsDialog({ chatId, initialPrompt, open, onOpenChange }: Props) {
  const [value, setValue] = useState(initialPrompt ?? '');
  const qc = useQueryClient();
  const save = async () => {
    await api.patch(`chats/${chatId}`, { json: { system_prompt: value } });
    await qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    await qc.invalidateQueries({ queryKey: chatKeys.list() });
    toast('Настройки чата сохранены');
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки чата</DialogTitle>
        </DialogHeader>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">System prompt</label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Например: «Ты эксперт по Python. Отвечай кратко и с примерами кода.»"
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        />
        <div className="text-right text-[11px] text-muted-foreground tabular-nums">{value.length}/4000</div>
        <DialogFooter className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={save}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Barrel:

```ts
// frontend/src/features/chat-settings/index.ts
export { ChatSettingsDialog } from './ChatSettingsDialog';
```

- [ ] **Step 10: Add settings entry-point in topbar**

In `frontend/src/widgets/topbar/topbar.tsx`, when on a chat route, render a settings button (`Sliders` icon) that opens the dialog. Use `useRouterState` to get the current params (route is `/chats/$chatId`).

Add:

```tsx
import { Sliders } from 'lucide-react';
import { useState } from 'react';
import { ChatSettingsDialog } from '@/features/chat-settings';
import { useChatQuery } from '@/entities/chat/queries';
import { useRouterState } from '@tanstack/react-router';

// inside Topbar:
const path = useRouterState({ select: (s) => s.location.pathname });
const chatId = path.match(/^\/chats\/([^/]+)/)?.[1] ?? null;
const { data: chat } = useChatQuery(chatId);
const [settingsOpen, setSettingsOpen] = useState(false);
// render conditionally:
{chatId && (
  <>
    <button
      onClick={() => setSettingsOpen(true)}
      aria-label="Настройки чата"
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Sliders className="h-4 w-4" />
    </button>
    <ChatSettingsDialog
      chatId={chatId}
      initialPrompt={chat?.system_prompt ?? null}
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
    />
  </>
)}
```

- [ ] **Step 11: Pin in sidebar**

In `frontend/src/widgets/sidebar/chat-list-item.tsx` add a pin/unpin button in the hover-actions row. Wire it to `PATCH /chats/{id}` with `{ pinned: !chat.pinned }`.

In `frontend/src/widgets/sidebar/sidebar.tsx` split chats into `pinned = chats.filter(c => c.pinned)` and `recent = chats.filter(c => !c.pinned)`. Render pinned first with a "Закреплённые" header.

- [ ] **Step 12: Run migration locally + typecheck**

Run:
```
cd backend && uv run alembic upgrade head
cd ../frontend && npm run typecheck
```
Expected: migration succeeds, typecheck passes.

- [ ] **Step 13: Commit**

```bash
git add backend/app/db/alembic/versions/ \
        backend/app/db/models.py \
        backend/app/schemas/chat.py \
        backend/app/services/chat_service.py \
        backend/app/services/context_builder.py \
        backend/app/services/message_service.py \
        backend/tests/unit/test_context_builder_system_prompt.py \
        frontend/src/entities/chat/types.ts \
        frontend/src/features/chat-settings \
        frontend/src/widgets/sidebar/chat-list-item.tsx \
        frontend/src/widgets/sidebar/sidebar.tsx \
        frontend/src/widgets/topbar/topbar.tsx
git commit -m "feat: per-chat system prompt + pinned chats

Alembic migration adds chats.system_prompt (varchar 4000) and
chats.pinned (bool default false). build_context appends the
per-chat system message after the default; list_chats orders pinned
first. Frontend: settings dialog in topbar, pin/unpin in sidebar."
```

---

### Task 13: Global search across all chats

**Files:**
- Create: `frontend/src/features/global-search/store.ts`
- Create: `frontend/src/features/global-search/GlobalSearch.tsx`
- Create: `frontend/src/features/global-search/index.ts`
- Modify: `frontend/src/pages/__root.tsx` (mount + hotkey)
- Modify: `frontend/src/pages/chats.$chatId.tsx` (handle `?focus=` query)
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx` (scroll to focus id)

- [ ] **Step 1: Store**

```ts
// frontend/src/features/global-search/store.ts
import { create } from 'zustand';
interface S {
  open: boolean;
  toggle: () => void;
  setOpen: (v: boolean) => void;
}
export const useGlobalSearch = create<S>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: v }),
}));
```

- [ ] **Step 2: GlobalSearch component**

```tsx
// frontend/src/features/global-search/GlobalSearch.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { useChatsQuery, chatKeys } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { useGlobalSearch } from './store';
import type { Message } from '@/entities/message/types';

interface Hit {
  chatId: string;
  chatTitle: string;
  message: Message;
  snippet: string;
}

function snippetAround(text: string, query: string, span = 100): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, span);
  const start = Math.max(0, idx - span / 2);
  const end = Math.min(text.length, idx + query.length + span / 2);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export function GlobalSearch() {
  const { open, setOpen } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const { data: chats = [] } = useChatsQuery();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const allMessages = useMemo(() => {
    const out: Hit[] = [];
    for (const c of chats) {
      const data = qc.getQueryData<Message[]>(messageKeys.list(c.id));
      if (!data) continue;
      for (const m of data) {
        out.push({ chatId: c.id, chatTitle: c.title, message: m, snippet: '' });
      }
    }
    return out;
  }, [chats, qc, open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const fuse = new Fuse(allMessages, {
      keys: ['message.content', 'chatTitle'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse
      .search(query)
      .slice(0, 30)
      .map((r) => ({ ...r.item, snippet: snippetAround(r.item.message.content, query) }));
  }, [allMessages, query]);

  const go = (h: Hit) => {
    setOpen(false);
    navigate({ to: '/chats/$chatId', params: { chatId: h.chatId }, search: { focus: h.message.id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Поиск по чатам</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по всем сообщениям…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Ничего не найдено</div>
          )}
          {results.map((h) => (
            <button
              key={h.message.id}
              onClick={() => go(h)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                  {h.message.role === 'user' ? 'Вы' : 'Nova'}
                </span>
                <span className="truncate text-xs text-muted-foreground">{h.chatTitle}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-foreground">{h.snippet}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Barrel:

```ts
// frontend/src/features/global-search/index.ts
export { GlobalSearch } from './GlobalSearch';
export { useGlobalSearch } from './store';
```

- [ ] **Step 3: Mount + hotkey**

In `frontend/src/pages/__root.tsx`:

```tsx
import { GlobalSearch, useGlobalSearch } from '@/features/global-search';
const toggleSearch = useGlobalSearch((s) => s.toggle);
useHotkey({ key: 'f', meta: true }, toggleSearch, true);
// Render <GlobalSearch /> next to CommandPalette in both layout branches.
```

- [ ] **Step 4: Handle `?focus=` in chat page**

In `frontend/src/pages/chats.$chatId.tsx`:

a) Add search validator:

```tsx
import { z } from 'zod';
const searchSchema = z.object({ focus: z.string().optional() }).strict();
export const Route = createFileRoute('/chats/$chatId')({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async () => { /* existing */ },
  component: ChatPage,
});
```

b) Read it: `const { focus } = Route.useSearch();` and pass `focusId={focus}` to `ChatView`.

- [ ] **Step 5: ChatView scrolls to focusId**

In `frontend/src/widgets/chat-view/chat-view.tsx` add prop `focusId?: string` and after the first render with messages present, if `focusId`, `document.getElementById('msg-' + focusId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })` and apply a transient ring.

Add `id={'msg-' + msg.id}` on each MessageBubble wrapper.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/global-search \
        frontend/src/pages/__root.tsx \
        frontend/src/pages/chats.\$chatId.tsx \
        frontend/src/widgets/chat-view/chat-view.tsx
git commit -m "feat(frontend): ⌘F global search across all chats with deep-link"
```

---

### Task 14: Stats dashboard

**Backend:**

**Files:**
- Create: `backend/app/api/v1/stats.py`
- Create: `backend/app/services/stats_service.py`
- Modify: `backend/app/api/v1/router.py`
- Create: `backend/app/db/alembic/versions/<rev>_message_model_used.py`
- Modify: `backend/app/db/models.py` (add `model_used`)
- Modify: `backend/app/services/message_service.py` (write `model_used` on assistant message)

- [ ] **Step 1: Generate migration for `model_used` only** (parent_id/branch_index land in Task 16)

Run: `cd backend && uv run alembic revision --autogenerate -m "message_model_used"`
Verify the file adds the `model_used` column. Trim anything else.

- [ ] **Step 2: Add column to model**

In `backend/app/db/models.py` add to `Message`:

```python
model_used: Mapped[str | None] = mapped_column(String(200), nullable=True)
```

- [ ] **Step 3: Write `model_used` in MessageService**

In `backend/app/services/message_service.py`, in all three streaming methods, when constructing the assistant `Message(...)`, pass `model_used=(model or settings.vllm_model)`.

- [ ] **Step 4: Stats service**

`backend/app/services/stats_service.py`:

```python
from __future__ import annotations

from datetime import datetime, timedelta, UTC
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chat, Message


class StatsService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def collect(self, user_id: UUID) -> dict:
        total_chats = await self._scalar(
            select(func.count()).select_from(Chat).where(Chat.user_id == user_id)
        )
        total_messages = await self._scalar(
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id)
        )
        total_chars_user = await self._scalar(
            select(func.coalesce(func.sum(func.length(Message.content)), 0))
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "user")
        )
        total_chars_assistant = await self._scalar(
            select(func.coalesce(func.sum(func.length(Message.content)), 0))
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "assistant")
        )
        model_rows = (await self._db.execute(
            select(Message.model_used, func.count())
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.role == "assistant", Message.model_used.is_not(None))
            .group_by(Message.model_used)
            .order_by(func.count().desc())
        )).all()
        since = datetime.now(UTC) - timedelta(days=14)
        day_rows = (await self._db.execute(
            select(func.date(Message.created_at), func.count())
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id, Message.created_at >= since)
            .group_by(func.date(Message.created_at))
            .order_by(func.date(Message.created_at))
        )).all()
        longest_chat = await self._scalar(
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.chat_id)
            .where(Chat.user_id == user_id)
            .group_by(Message.chat_id)
            .order_by(func.count().desc())
            .limit(1)
        )
        return {
            "total_chats": total_chats or 0,
            "total_messages": total_messages or 0,
            "total_chars_sent": int(total_chars_user or 0),
            "total_chars_generated": int(total_chars_assistant or 0),
            "model_usage": [{"model": m or "—", "messages": c} for m, c in model_rows],
            "messages_by_day": [{"date": str(d), "count": c} for d, c in day_rows],
            "avg_assistant_response_chars": (
                int(total_chars_assistant / total_messages) if total_messages else 0
            ),
            "longest_chat_messages": int(longest_chat or 0),
        }

    async def _scalar(self, stmt):
        return (await self._db.execute(stmt)).scalar()
```

- [ ] **Step 5: Endpoint**

`backend/app/api/v1/stats.py`:

```python
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db.models import User
from app.deps import get_current_user, get_session
from app.services.stats_service import StatsService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
async def get_stats(
    current_user: User = Depends(get_current_user),  # noqa: B008
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> dict:
    svc = StatsService(session)
    return await svc.collect(current_user.id)
```

Include router in `backend/app/api/v1/router.py`:

```python
from app.api.v1 import auth, health, stats as stats_api, telemetry
...
api_router.include_router(stats_api.router)
```

- [ ] **Step 6: Backend smoke**

Run: `cd backend && uv run alembic upgrade head && uv run pytest tests/unit -q`
Expected: green.

**Frontend:**

**Files:**
- Create: `frontend/src/features/stats/api.ts`
- Create: `frontend/src/pages/stats.tsx`
- Create: `frontend/src/widgets/stats/StatsCards.tsx`
- Create: `frontend/src/widgets/stats/MessagesByDayChart.tsx`

- [ ] **Step 7: Stats query**

```ts
// frontend/src/features/stats/api.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';

export interface StatsData {
  total_chats: number;
  total_messages: number;
  total_chars_sent: number;
  total_chars_generated: number;
  model_usage: { model: string; messages: number }[];
  messages_by_day: { date: string; count: number }[];
  avg_assistant_response_chars: number;
  longest_chat_messages: number;
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('stats').json<StatsData>(),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 8: Cards**

```tsx
// frontend/src/widgets/stats/StatsCards.tsx
interface CardProps { label: string; value: string | number; sub?: string; }
function Card({ label, value, sub }: CardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
export { Card as StatsCard };
```

- [ ] **Step 9: 14-day SVG chart**

```tsx
// frontend/src/widgets/stats/MessagesByDayChart.tsx
interface Props { data: { date: string; count: number }[]; }
export function MessagesByDayChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 28; const gap = 8; const totalW = data.length * (w + gap);
  return (
    <svg viewBox={`0 0 ${totalW} 120`} className="w-full" role="img" aria-label="Сообщения по дням">
      {data.map((d, i) => {
        const h = (d.count / max) * 100;
        return (
          <g key={d.date} transform={`translate(${i * (w + gap)},0)`}>
            <rect
              x={0} y={120 - h} width={w} height={h}
              rx={4}
              className="fill-primary/70"
            />
            <text x={w / 2} y={118} textAnchor="middle" className="fill-muted-foreground text-[8px]">
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 10: Stats page**

```tsx
// frontend/src/pages/stats.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';
import { useStatsQuery } from '@/features/stats/api';
import { StatsCard } from '@/widgets/stats/StatsCards';
import { MessagesByDayChart } from '@/widgets/stats/MessagesByDayChart';

export const Route = createFileRoute('/stats')({
  beforeLoad: async () => {
    try {
      const u = await queryClient.ensureQueryData(meQueryOptions);
      if (!u) throw redirect({ to: '/auth' });
    } catch (e) {
      if (e && typeof e === 'object' && 'to' in e) throw e;
      throw redirect({ to: '/auth' });
    }
  },
  component: StatsPage,
});

function StatsPage() {
  const { data, isLoading } = useStatsQuery();
  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Статистика</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatsCard label="Чатов" value={data.total_chats} />
        <StatsCard label="Сообщений" value={data.total_messages} />
        <StatsCard label="Знаков от вас" value={data.total_chars_sent.toLocaleString('ru-RU')} />
        <StatsCard label="Знаков от Nova" value={data.total_chars_generated.toLocaleString('ru-RU')} />
        <StatsCard label="Средн. ответ" value={`${data.avg_assistant_response_chars} симв`} />
        <StatsCard label="Самый длинный чат" value={`${data.longest_chat_messages} сообщ`} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Активность за 14 дней
        </div>
        <MessagesByDayChart data={data.messages_by_day} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Использование моделей
        </div>
        <ul className="space-y-1 text-sm">
          {data.model_usage.map((m) => (
            <li key={m.model} className="flex items-center justify-between">
              <span>{m.model}</span>
              <span className="tabular-nums text-muted-foreground">{m.messages}</span>
            </li>
          ))}
          {data.model_usage.length === 0 && <li className="text-muted-foreground">Пока нет данных</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 12: Commit**

```bash
git add backend/app/db/alembic/versions/ \
        backend/app/db/models.py \
        backend/app/services/message_service.py \
        backend/app/services/stats_service.py \
        backend/app/api/v1/stats.py \
        backend/app/api/v1/router.py \
        frontend/src/features/stats \
        frontend/src/widgets/stats \
        frontend/src/pages/stats.tsx
git commit -m "feat: /stats endpoint + dashboard

Tracks total chats/messages, characters sent/generated, model usage,
14-day activity bars, longest chat. Backed by SUM(LENGTH(content))
aggregates; model attribution via Message.model_used migration."
```

---

## Phase 4 — Polish features

### Task 15: Auto-save draft + PDF export + Onboarding tour

These three are pure frontend, small, low-risk — bundle into one task to save commit overhead.

**Files:**
- Create: `frontend/src/features/draft-saver/useDraft.ts`
- Modify: `frontend/src/widgets/composer/composer.tsx` (use the draft hook)
- Create: `frontend/src/pages/chats.$chatId.print.tsx`
- Create: `frontend/src/styles/print.css`
- Modify: `frontend/src/styles/globals.css` (import print.css)
- Create: `frontend/src/features/onboarding/config.ts`
- Create: `frontend/src/features/onboarding/Onboarding.tsx`
- Create: `frontend/src/features/onboarding/index.ts`
- Modify: `frontend/src/pages/__root.tsx`

- [ ] **Step 1: Draft hook**

```ts
// frontend/src/features/draft-saver/useDraft.ts
import { useEffect, useRef } from 'react';

export function useDraft(chatId: string, value: string, setValue: (v: string) => void) {
  const key = `nova-draft-${chatId}`;
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    const saved = localStorage.getItem(key);
    if (saved && !value) {
      setValue(saved);
    }
    restored.current = true;
  }, [key, setValue, value]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }, 200);
    return () => clearTimeout(id);
  }, [key, value]);

  return {
    clear: () => localStorage.removeItem(key),
  };
}
```

- [ ] **Step 2: Wire draft into Composer**

`composer.tsx` currently owns `value` state. Accept new optional prop `draftKey?: string`. If provided, call `useDraft(draftKey, value, setValue)`. On send, call `clear()`.

Then in `pages/chats.$chatId.tsx`, pass `draftKey={chatId}` to `<Composer>`.

- [ ] **Step 3: Print route**

`frontend/src/pages/chats.$chatId.print.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMessagesQuery } from '@/entities/message/queries';
import { useChatQuery } from '@/entities/chat/queries';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';

export const Route = createFileRoute('/chats/$chatId/print')({
  beforeLoad: async () => {
    const u = await queryClient.ensureQueryData(meQueryOptions);
    if (!u) throw redirect({ to: '/auth' });
  },
  component: PrintPage,
});

function PrintPage() {
  const { chatId } = Route.useParams();
  const { data: messages = [] } = useMessagesQuery(chatId);
  const { data: chat } = useChatQuery(chatId);
  return (
    <div className="print-layout mx-auto max-w-3xl bg-white p-8 text-black">
      <header className="mb-6 border-b pb-3">
        <h1 className="text-xl font-semibold">{chat?.title ?? 'Чат'}</h1>
        <p className="text-xs text-gray-500">Экспортировано {new Date().toLocaleString('ru-RU')}</p>
      </header>
      <main className="space-y-6">
        {messages.map((m) => (
          <article key={m.id} className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {m.role === 'user' ? 'Вы' : 'Nova'}
            </div>
            {m.role === 'user'
              ? <p className="whitespace-pre-wrap">{m.content}</p>
              : <MarkdownContent content={m.content} streaming={false} />}
          </article>
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Print CSS**

`frontend/src/styles/print.css`:

```css
@media print {
  body { background: white !important; color: black !important; }
  .print-layout { color: black; }
  .print-layout * { box-shadow: none !important; }
  .print-layout pre, .print-layout code {
    background: #f5f5f5 !important;
    color: #111 !important;
    break-inside: avoid;
  }
  /* Hide sidebar, topbar, composer when /chats/:id/print prints. They aren't
   * rendered on the print route anyway but this guards against accidental
   * window.print on the chat page. */
  aside, header, footer, .composer-root { display: none !important; }
}
```

Import in `globals.css` near other imports:

```css
@import './print.css';
```

- [ ] **Step 5: Add Export action**

Add to command palette registry in `CommandPalette.tsx` next to existing actions:

```tsx
{
  id: 'export-pdf',
  title: 'Экспорт чата в PDF',
  hint: '⌘⇧E',
  icon: Download,
  section: 'actions',
  run: (cls) => {
    cls();
    const m = window.location.pathname.match(/^\/chats\/([^/]+)/);
    if (!m) return;
    window.open(`/chats/${m[1]}/print`, '_blank');
    setTimeout(() => window.print(), 300);
  },
},
```

Note: the print page itself runs `window.print()` once mounted — adjust by adding `useEffect(() => { setTimeout(() => window.print(), 300); }, []);` inside `PrintPage`.

- [ ] **Step 6: Onboarding config**

```ts
// frontend/src/features/onboarding/config.ts
export interface TourStep {
  id: string;
  anchor: string;     // CSS selector
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'composer', anchor: '[data-tour="composer"]', title: 'Composer', body: 'Здесь пишешь сообщение. Поддержка Markdown, формул и slash-команд (/summarize, /explain…)', placement: 'top' },
  { id: 'model', anchor: '[data-tour="model-picker"]', title: 'Модель', body: 'Переключай локальную LLM на лету.', placement: 'top' },
  { id: 'sidebar', anchor: '[data-tour="sidebar"]', title: 'Сайдбар', body: 'История чатов, поиск, закреплённые наверху.', placement: 'right' },
  { id: 'topbar', anchor: '[data-tour="user-menu"]', title: 'Меню', body: 'Тема, выход, перепройти онбординг.', placement: 'bottom' },
  { id: 'palette', anchor: '[data-tour="palette-trigger"]', title: '⌘K', body: 'Палитра команд: чаты, действия, модели. Самый быстрый способ всё сделать.', placement: 'right' },
];
```

- [ ] **Step 7: Tour component**

```tsx
// frontend/src/features/onboarding/Onboarding.tsx
import { useEffect, useState } from 'react';
import { TOUR_STEPS } from './config';

const KEY = 'nova-onboarded';

export function Onboarding({ force = false, onClose }: { force?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (force || !localStorage.getItem(KEY)) setOpen(true);
  }, [force]);

  useEffect(() => {
    if (!open) return;
    const step = TOUR_STEPS[stepIdx];
    if (!step) return;
    const el = document.querySelector(step.anchor);
    if (!el) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, stepIdx]);

  if (!open) return null;
  const step = TOUR_STEPS[stepIdx];
  if (!step) return null;

  const finish = () => {
    localStorage.setItem(KEY, '1');
    setOpen(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[300]">
      {rect && (
        <>
          <div
            className="absolute rounded-lg ring-4 ring-primary/60 transition-all"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            }}
          />
          <div
            className="absolute max-w-xs rounded-xl border border-border bg-card p-3 text-sm shadow-2xl"
            style={{
              left: Math.min(window.innerWidth - 320, rect.left),
              top: rect.bottom + 12,
            }}
          >
            <div className="font-semibold">{step.title}</div>
            <div className="mt-1 text-muted-foreground">{step.body}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{stepIdx + 1} / {TOUR_STEPS.length}</span>
              <div className="flex gap-2">
                <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">
                  Пропустить
                </button>
                {stepIdx < TOUR_STEPS.length - 1 ? (
                  <button onClick={() => setStepIdx((i) => i + 1)} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">
                    Дальше
                  </button>
                ) : (
                  <button onClick={finish} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">
                    Готово
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

Barrel:
```ts
// frontend/src/features/onboarding/index.ts
export { Onboarding } from './Onboarding';
```

- [ ] **Step 8: Add tour anchors**

- Composer: add `data-tour="composer"` to root div in `composer.tsx`.
- Model picker: add `data-tour="model-picker"` to the `DropdownMenuTrigger` button.
- Sidebar root: `data-tour="sidebar"`.
- Topbar user-menu button (whatever exists): `data-tour="user-menu"`.
- Palette trigger: add a small `⌘K` button in the sidebar header with `data-tour="palette-trigger"` that calls `usePalette().toggle()`.

- [ ] **Step 9: Mount tour**

In `__root.tsx`, render `<Onboarding />` once in the main layout branch.

- [ ] **Step 10: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/draft-saver \
        frontend/src/widgets/composer/composer.tsx \
        frontend/src/pages/chats.\$chatId.tsx \
        frontend/src/pages/chats.\$chatId.print.tsx \
        frontend/src/styles/print.css \
        frontend/src/styles/globals.css \
        frontend/src/features/onboarding \
        frontend/src/pages/__root.tsx \
        frontend/src/widgets/sidebar/sidebar.tsx
git commit -m "feat(frontend): auto-save draft + PDF export route + onboarding tour"
```

---

## Phase 5 — Conversation branching (last; has fallback)

### Task 16: Branching backend (parent_id + branch_index)

**Files:**
- Create: `backend/app/db/alembic/versions/<rev>_message_parent_branch.py`
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/services/message_service.py`
- Modify: `backend/app/services/context_builder.py`
- Modify: `backend/app/schemas/message.py`

- [ ] **Step 1: Migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "message_parent_branch"`
Verify the migration adds:
- `parent_id` (UUID, nullable, FK to messages.id ON DELETE SET NULL)
- `branch_index` (int, default 0)
- index `ix_messages_parent` on `(chat_id, parent_id, branch_index)`

- [ ] **Step 2: Update model**

In `backend/app/db/models.py`:

```python
parent_id: Mapped[UUID | None] = mapped_column(
    PGUUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
)
branch_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
```

(Import `Integer` from sqlalchemy; `ForeignKey` likely already imported.)

- [ ] **Step 3: Schema**

In `backend/app/schemas/message.py` extend `MessageOut`:

```python
class MessageOut(BaseModel):
    id: UUID
    chat_id: UUID
    role: str
    content: str
    aborted: bool
    parent_id: UUID | None = None
    branch_index: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Regenerate + edit create sibling, don't delete**

In `backend/app/services/message_service.py`:

- `stream_regenerate`: find the previous user message (the one whose assistant we'd remove). Instead of `await self._db.delete(last_assistant)`, count existing assistant siblings for that user message and create the new assistant with `parent_id = prev_user.id` and `branch_index = sibling_count`.
- `stream_edit`: replaces user content; this is already a hard truncate. Convert to: instead of deleting subsequent messages, create a *new* user message with `parent_id = original_user.parent_id` (preserving the conversation root), `branch_index = sibling_count + 1`, content = new_content. The previous assistant stays in the tree; we just stream a new assistant whose `parent_id = new_user.id`.

This is a substantial change. The "v1 fallback" if time runs out: revert `stream_edit` and `stream_regenerate` to the prior delete-then-recreate flow but keep the `parent_id` column wired (left at `None`). UI just hides branch arrows.

Pragmatic decision in this task: implement regenerate-creates-sibling only. Edit stays as truncate. That gives the demo "regenerate makes alternatives you can flip between" without restructuring `stream_edit`.

Inside `stream_regenerate`, before `assistant_start`:

```python
# Find the user message that this assistant replies to (last user message).
last_user = next((m for m in reversed(messages_in_db) if m.role == "user"), None)
parent_id = last_user.id if last_user else None
sibling_count = sum(
    1 for m in messages_in_db
    if m.role == "assistant" and m.parent_id == parent_id
)
assistant_msg = Message(
    chat_id=chat_id,
    role="assistant",
    content="",
    aborted=False,
    parent_id=parent_id,
    branch_index=sibling_count,
    created_at=datetime.now(UTC),
    model_used=(model or settings.vllm_model),
)
# Do NOT delete last_assistant.
```

Remove the `await self._db.delete(last_assistant)` line.

For `stream_new_message` keep current behaviour (no parent, branch_index = 0).

- [ ] **Step 5: context_builder walks the active branch**

The frontend chooses which branch is "active"; backend just returns all messages and the frontend filters. So `build_context` continues to use the full list — but we need to filter to only messages on a single path. Simple v1: among assistant-with-siblings, pick the one with the highest `branch_index` (latest). Walk forward from root, at each user message choose the assistant with the highest `branch_index`, then continue.

```python
def _select_active_path(messages: list[Message]) -> list[Message]:
    by_parent: dict[UUID | None, list[Message]] = {}
    for m in messages:
        by_parent.setdefault(m.parent_id, []).append(m)
    out: list[Message] = []
    # Roots: messages with parent_id = None ordered by created_at.
    cursor: UUID | None = None
    while True:
        children = sorted(by_parent.get(cursor, []), key=lambda m: (m.branch_index, m.created_at))
        if not children:
            break
        chosen = children[-1]  # max branch_index wins
        out.append(chosen)
        cursor = chosen.id
    return out
```

Call `_select_active_path(history)` before passing to `build_context` inside each streaming method.

- [ ] **Step 6: Unit test for sibling creation**

Create `backend/tests/unit/test_branching_selection.py`:

```python
import datetime as dt
from uuid import uuid4
from app.services.message_service import _select_active_path
from app.db.models import Message


def _msg(id_, parent=None, branch=0, role="assistant", ts=0):
    m = Message.__new__(Message)
    m.id = id_
    m.parent_id = parent
    m.branch_index = branch
    m.role = role
    m.created_at = dt.datetime(2026, 6, 1) + dt.timedelta(seconds=ts)
    return m


def test_picks_latest_branch():
    u1 = _msg("u1", role="user")
    a1 = _msg("a1", parent="u1", branch=0)
    a2 = _msg("a2", parent="u1", branch=1)
    path = _select_active_path([u1, a1, a2])
    assert [m.id for m in path] == ["u1", "a2"]


def test_no_branches_returns_full_chain():
    u1 = _msg("u1", role="user")
    a1 = _msg("a1", parent="u1", branch=0)
    path = _select_active_path([u1, a1])
    assert [m.id for m in path] == ["u1", "a1"]
```

Run: `cd backend && uv run pytest tests/unit/test_branching_selection.py -v`
Expected: PASS.

- [ ] **Step 7: Run all backend unit tests + migrate**

Run: `cd backend && uv run alembic upgrade head && uv run pytest tests/unit -q`
Expected: green.

- [ ] **Step 8: Commit backend half**

```bash
git add backend/app/db/alembic/versions/ \
        backend/app/db/models.py \
        backend/app/schemas/message.py \
        backend/app/services/message_service.py \
        backend/tests/unit/test_branching_selection.py
git commit -m "feat(backend): regenerate creates a branch instead of deleting

Adds parent_id + branch_index columns on messages. Regenerate now
inserts a sibling assistant message under the same user message.
_select_active_path walks the tree picking the highest branch_index
at each step so build_context still sees a linear conversation."
```

### Task 17: Branching frontend (version arrows)

**Files:**
- Modify: `frontend/src/entities/message/types.ts` (add `parent_id`, `branch_index`)
- Create: `frontend/src/features/branching/store.ts`
- Create: `frontend/src/features/branching/BranchNav.tsx`
- Modify: `frontend/src/widgets/chat-view/chat-view.tsx` to compute siblings per parent and render `BranchNav` next to siblings

- [ ] **Step 1: Extend type**

```ts
export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  aborted: boolean;
  parent_id: string | null;
  branch_index: number;
  created_at: string;
}
```

- [ ] **Step 2: Branch store**

```ts
// frontend/src/features/branching/store.ts
import { create } from 'zustand';

interface State {
  // For each parent_id (user message id), which branch_index the user has
  // currently selected. Default behaviour (no entry) = max.
  selected: Record<string, number>;
  select: (parentId: string, idx: number) => void;
  reset: () => void;
}

export const useBranchStore = create<State>((set) => ({
  selected: {},
  select: (parentId, idx) =>
    set((s) => ({ selected: { ...s.selected, [parentId]: idx } })),
  reset: () => set({ selected: {} }),
}));
```

- [ ] **Step 3: BranchNav**

```tsx
// frontend/src/features/branching/BranchNav.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
interface Props { current: number; total: number; onPrev: () => void; onNext: () => void; }
export function BranchNav({ current, total, onPrev, onNext }: Props) {
  if (total <= 1) return null;
  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
      <button onClick={onPrev} disabled={current === 0} aria-label="Предыдущий вариант" className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="tabular-nums">{current + 1} / {total}</span>
      <button onClick={onNext} disabled={current >= total - 1} aria-label="Следующий вариант" className="rounded p-0.5 hover:bg-muted disabled:opacity-30">
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Compute active path on client**

In `chat-view.tsx` introduce a helper:

```ts
function activePath(messages: Message[], selected: Record<string, number>): Message[] {
  const byParent = new Map<string | null, Message[]>();
  for (const m of messages) {
    const k = m.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(m);
    byParent.set(k, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.branch_index - b.branch_index);
  const out: Message[] = [];
  let cursor: string | null = null;
  while (true) {
    const children = byParent.get(cursor);
    if (!children?.length) break;
    const parentKey = cursor ?? '__root__';
    const idx = selected[parentKey] ?? children.length - 1;
    const chosen = children[Math.min(idx, children.length - 1)]!;
    out.push(chosen);
    cursor = chosen.id;
  }
  return out;
}
```

Use it to build `messagesToRender`. Replace the existing `messages` array iteration with the filtered list.

- [ ] **Step 5: Render BranchNav next to siblings**

For each assistant message with siblings (same `parent_id`), render `<BranchNav .../>` below the bubble. Compute `siblings = byParent.get(msg.parent_id)`, `current = siblings.findIndex(s => s.id === msg.id)`, total = siblings.length.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/entities/message/types.ts \
        frontend/src/features/branching \
        frontend/src/widgets/chat-view/chat-view.tsx
git commit -m "feat(frontend): branch navigation for regenerated replies"
```

---

## Final verification

- [ ] **Run full backend unit suite**

Run: `cd backend && uv run pytest tests/unit -q`
Expected: green.

- [ ] **Run frontend typecheck + tests + lint**

Run: `cd frontend && npm run typecheck && npm test && npm run lint`
Expected: zero TS errors, zero test failures, only pre-existing lint warnings.

- [ ] **Manual smoke** (requires Ollama running)

```bash
docker compose up -d
```
Login → home → see new welcome with greeting + prompt cards + model cards → ⌘K opens palette → pick "Новый чат" → send "напиши формулу разложения в ряд фурье" → math renders → no UI shake during stream → regenerate → see `< 2/2 >` arrows → click pin in sidebar → reload → pinned still at top → ⌘F → search past content → click result → scrolls into view with ring → /stats → cards + chart → chat settings dialog (Sliders icon) → set system prompt → send → behaviour reflects new prompt.

---

## Self-Review

**Spec coverage:**
- F1 dark theme → Tasks 1, 2, 3
- F2 streaming jitter → Task 5 (StreamingView)
- F3 math rendering → Task 5 (auto-wrap) + Task 6 (system prompt + CJK guard)
- P2 visual concept → Tasks 1, 3, 4 + motion/easing in Task 7 (toasts)
- Feature 1 ⌘K → Task 8
- Feature 2 slash → Task 9
- Feature 3 system prompt → Task 12
- Feature 4 branching → Tasks 16, 17 (Phase 5)
- Feature 5 global search → Task 13
- Feature 6 pin → Task 12
- Feature 7 stats → Task 14
- Feature 8 thinking/reasoning → Task 10
- Feature 9 draft → Task 15
- Feature 10 PDF → Task 15
- Feature 11 onboarding → Task 15
- Feature 12 welcome+models → Task 11

**Placeholder scan:** no TBDs; every code step has the actual code.

**Type consistency:** `LlmModel` extended in Task 11 used in Task 8 (palette). `Message.parent_id/branch_index` added in Task 16 used in Task 17. `Chat.pinned/system_prompt` in Task 12 used in same task's frontend half. Stream-store unchanged. No name drift.

**Cuts if time runs short:** Tasks 1–11 already give a demo-ready build (P1 fixes + ⌘K + slash + thinking + welcome). Tasks 12–17 add depth. Stop after any task and the working tree stays green.
