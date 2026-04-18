# Plan 3a — Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete Nova frontend foundation — Vite 5 + React 18 + TypeScript 5 strict, Tailwind CSS v4, shadcn/ui primitives, TanStack Router + Query, Zustand 5 stores, next-themes with anti-flash, ky HTTP client, AppShell with theme toggle, mobile drawer, ErrorBoundary, Vitest smoke tests, ESLint 9 + Prettier 3, and Docker multi-stage build. Leaves a "Nova is ready" welcome screen at `/` and stops before auth UI (Plan 3b) and chat UI (Plan 4).

**Architecture:** SPA served by Vite dev server (dev) / nginx (prod). TanStack Router handles file-based routing from `src/pages/`. TanStack Query owns server state. Zustand 5 owns client state (auth skeleton + UI/sidebar). ky wraps `fetch` for all REST calls with `credentials: 'include'`. CSS variables in `globals.css` feed both light and dark themes; `next-themes` flips `class="dark"` on `<html>` without flash via an inline script in `index.html`. Tailwind v4 uses `@tailwindcss/vite` plugin and `@theme inline` — no `tailwind.config.js`.

**Tech Stack:** Node 20 LTS · Vite 5 · React 18 · TypeScript 5.6 (strict) · Tailwind CSS 4 (@tailwindcss/vite) · tailwindcss-animate · shadcn/ui style "new-york" (hand-written, no CLI) · TanStack Router 1.82+ (@tanstack/router-plugin) · TanStack Query 5.59+ · Zustand 5 · next-themes 0.4+ · ky 1.7+ · @microsoft/fetch-event-source · lucide-react · react-hook-form · zod · motion · react-markdown · remark-gfm · rehype-pretty-code · shiki · Vitest 2.1+ · @testing-library/react · jsdom · ESLint 9 flat config · Prettier 3 · Docker (multi-stage) · nginx

**Repo layout (after this plan):**
```
chat/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── providers/
│   │   │   │   ├── query-provider.tsx
│   │   │   │   └── theme-provider.tsx
│   │   │   ├── router.tsx
│   │   │   └── main.tsx
│   │   ├── pages/
│   │   │   ├── __root.tsx
│   │   │   └── index.tsx
│   │   ├── widgets/
│   │   │   ├── sidebar/
│   │   │   │   └── sidebar-placeholder.tsx
│   │   │   └── topbar/
│   │   │       ├── topbar.tsx
│   │   │       └── theme-toggle.tsx
│   │   ├── features/
│   │   │   └── toggle-theme/
│   │   │       └── use-toggle-theme.ts
│   │   ├── entities/             # empty dirs (populated in Plans 4+)
│   │   │   ├── chat/
│   │   │   ├── message/
│   │   │   └── user/
│   │   ├── shared/
│   │   │   ├── ui/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   └── dialog.tsx
│   │   │   ├── api/
│   │   │   │   └── client.ts
│   │   │   ├── lib/
│   │   │   │   └── utils.ts
│   │   │   ├── config/
│   │   │   │   └── env.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-media-query.ts
│   │   │   └── store/
│   │   │       ├── auth-store.ts
│   │   │       └── ui-store.ts
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── test/
│   │       └── setup.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── .eslintrc.js            # ESLint 9 flat config (eslint.config.js)
│   ├── .prettierrc
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .dockerignore
│   ├── .env.example
│   └── README.md
├── docker-compose.yml          # surgical add of frontend service
└── .gitignore                  # surgical add of frontend ignores
```

---

## Out of Scope (explicitly excluded from this plan)

The following are intentionally NOT implemented here. Do not add stubs or TODOs for these in Plan 3a code:

- **Auth UI pages** — OTP request form, OTP verify form, redirect logic (Plan 3b)
- **Sidebar chat list** — chat entries, new-chat button, rename/delete menu (Plan 4)
- **Chat view** — message list, assistant bubble, user bubble, auto-scroll, streaming cursor (Plan 4)
- **Composer** — textarea, send button, stop button (Plan 4)
- **Markdown rendering** — react-markdown + rehype-pretty-code integration on messages (Plan 4)
- **SSE streaming** — @microsoft/fetch-event-source usage (Plan 4); package is installed here only
- **entities/chat, entities/message, entities/user queries** — TanStack Query hooks for these (Plan 4)
- **features/auth-login, features/send-message, features/regenerate-message, etc.** — all chat features (Plans 3b/4)
- **Logout button** — part of auth flow (Plan 3b)

---

## Task 1: Node scaffold — package.json + initial structure

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`

- [ ] **Step 1.1: Verify Node 20 is active**

```bash
node --version
# Expected: v20.x.x
# If not, install via: nvm install 20 && nvm use 20
```

- [ ] **Step 1.2: Create `frontend/` directory**

```bash
mkdir -p /path/to/chat/frontend
# From repo root:
mkdir -p frontend
```

- [ ] **Step 1.3: Create `frontend/package.json`**

Create `frontend/package.json`:

```json
{
  "name": "nova-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@microsoft/fetch-event-source": "^2.0.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-router": "^1.82.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "ky": "^1.7.2",
    "lucide-react": "^0.460.0",
    "motion": "^11.11.0",
    "next-themes": "^0.4.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-markdown": "^9.0.1",
    "rehype-pretty-code": "^0.13.2",
    "remark-gfm": "^4.0.0",
    "shiki": "^1.22.0",
    "tailwind-merge": "^2.5.4",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "@tanstack/router-plugin": "^1.82.0",
    "@testing-library/jest-dom": "^6.6.2",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.3",
    "eslint": "^9.13.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.13",
    "globals": "^15.11.0",
    "jsdom": "^25.0.1",
    "prettier": "^3.3.3",
    "prettier-plugin-tailwindcss": "^0.6.8",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.10.0",
    "vite": "^5.4.10",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 1.4: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.5: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 1.6: Install dependencies**

```bash
cd frontend
npm install
# Produces node_modules/ and package-lock.json
```

- [ ] **Step 1.7: Commit**

```bash
# From repo root
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json
git commit -m "feat(frontend): scaffold Node 20 project with all deps"
```

---

## Task 2: Vite config + Tailwind CSS v4 setup

**Files:**
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/styles/globals.css`

> **Tailwind v4 note:** v4 does NOT use `tailwind.config.js`. Configuration lives in CSS via `@theme inline` and `@import "tailwindcss"`. The `@tailwindcss/vite` plugin handles everything — no PostCSS config needed.

- [ ] **Step 2.1: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/pages', generatedRouteTree: './src/app/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

- [ ] **Step 2.2: Create `frontend/src/styles/globals.css`**

```css
@import "tailwindcss";
@import "tailwindcss-animate";

@theme inline {
  /* Brand colors */
  --color-brand-50: oklch(0.97 0.02 264);
  --color-brand-100: oklch(0.94 0.04 264);
  --color-brand-200: oklch(0.87 0.07 264);
  --color-brand-300: oklch(0.78 0.11 264);
  --color-brand-400: oklch(0.67 0.15 264);
  --color-brand-500: oklch(0.58 0.19 264);
  --color-brand-600: oklch(0.50 0.20 264);
  --color-brand-700: oklch(0.42 0.18 264);
  --color-brand-800: oklch(0.34 0.14 264);
  --color-brand-900: oklch(0.27 0.10 264);

  /* Semantic tokens — light mode defaults */
  --color-background: oklch(0.99 0 0);
  --color-foreground: oklch(0.13 0.02 264);
  --color-card: oklch(0.97 0 0);
  --color-card-foreground: oklch(0.13 0.02 264);
  --color-popover: oklch(0.99 0 0);
  --color-popover-foreground: oklch(0.13 0.02 264);
  --color-primary: oklch(0.50 0.20 264);
  --color-primary-foreground: oklch(0.99 0 0);
  --color-secondary: oklch(0.94 0.01 264);
  --color-secondary-foreground: oklch(0.27 0.10 264);
  --color-muted: oklch(0.94 0.01 264);
  --color-muted-foreground: oklch(0.50 0.03 264);
  --color-accent: oklch(0.94 0.01 264);
  --color-accent-foreground: oklch(0.27 0.10 264);
  --color-destructive: oklch(0.54 0.22 27);
  --color-destructive-foreground: oklch(0.99 0 0);
  --color-border: oklch(0.89 0.01 264);
  --color-input: oklch(0.89 0.01 264);
  --color-ring: oklch(0.58 0.19 264);

  /* Radius */
  --radius: 0.5rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Dark mode overrides — applied when <html class="dark"> */
.dark {
  --color-background: oklch(0.13 0.02 264);
  --color-foreground: oklch(0.97 0.01 264);
  --color-card: oklch(0.17 0.02 264);
  --color-card-foreground: oklch(0.97 0.01 264);
  --color-popover: oklch(0.15 0.02 264);
  --color-popover-foreground: oklch(0.97 0.01 264);
  --color-primary: oklch(0.67 0.15 264);
  --color-primary-foreground: oklch(0.13 0.02 264);
  --color-secondary: oklch(0.22 0.03 264);
  --color-secondary-foreground: oklch(0.87 0.03 264);
  --color-muted: oklch(0.22 0.03 264);
  --color-muted-foreground: oklch(0.60 0.04 264);
  --color-accent: oklch(0.22 0.03 264);
  --color-accent-foreground: oklch(0.87 0.03 264);
  --color-destructive: oklch(0.60 0.20 27);
  --color-destructive-foreground: oklch(0.97 0 0);
  --color-border: oklch(0.25 0.03 264);
  --color-input: oklch(0.25 0.03 264);
  --color-ring: oklch(0.67 0.15 264);
}

@layer base {
  * {
    border-color: var(--color-border);
    outline-color: var(--color-ring);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-feature-settings: "rlig" 1, "calt" 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

- [ ] **Step 2.3: Create `frontend/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 2.4: Commit**

```bash
git add frontend/vite.config.ts frontend/src/styles/globals.css frontend/src/test/setup.ts
git commit -m "feat(frontend): vite config with Tailwind v4 and TanStack Router plugin"
```

---

## Task 3: ESLint 9 flat config + Prettier 3

**Files:**
- Create: `frontend/eslint.config.js`
- Create: `frontend/.prettierrc`
- Create: `frontend/.prettierignore`

- [ ] **Step 3.1: Create `frontend/eslint.config.js`**

```javascript
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/app/routeTree.gen.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

- [ ] **Step 3.2: Create `frontend/.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3.3: Create `frontend/.prettierignore`**

```
dist/
node_modules/
src/app/routeTree.gen.ts
```

- [ ] **Step 3.4: Verify lint runs (no files yet — expect clean)**

```bash
cd frontend
npm run lint
# Expected: no errors (no source files exist yet)
```

- [ ] **Step 3.5: Commit**

```bash
git add frontend/eslint.config.js frontend/.prettierrc frontend/.prettierignore
git commit -m "feat(frontend): ESLint 9 flat config + Prettier 3"
```

---

## Task 4: Env loader (zod-validated)

**Files:**
- Create: `frontend/.env.example`
- Create: `frontend/src/shared/config/env.ts`
- Create: `frontend/src/shared/config/env.test.ts`

- [ ] **Step 4.1: Create `frontend/.env.example`**

```env
# Backend API base URL — no trailing slash
VITE_API_URL=http://localhost:8080/api/v1
```

- [ ] **Step 4.2: Copy to `.env` for local dev**

```bash
cd frontend
cp .env.example .env
```

- [ ] **Step 4.3: Write failing test `frontend/src/shared/config/env.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('env loader', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports VITE_API_URL when set', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8080/api/v1');
    const { env } = await import('./env');
    expect(env.VITE_API_URL).toBe('http://localhost:8080/api/v1');
  });

  it('throws when VITE_API_URL is missing', async () => {
    vi.stubEnv('VITE_API_URL', '');
    await expect(import('./env')).rejects.toThrow();
  });
});
```

- [ ] **Step 4.4: Run failing test**

```bash
cd frontend
npm run test
# Expected: FAIL — env.ts not found
```

- [ ] **Step 4.5: Create `frontend/src/shared/config/env.ts`**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url('VITE_API_URL must be a valid URL'),
});

const _parsed = envSchema.safeParse({
  VITE_API_URL: import.meta.env['VITE_API_URL'],
});

if (!_parsed.success) {
  const msg = _parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`[nova] Invalid environment variables:\n${msg}`);
}

export const env = _parsed.data;
```

- [ ] **Step 4.6: Run test — should pass**

```bash
cd frontend
npm run test
# Expected: PASS
```

- [ ] **Step 4.7: Commit**

```bash
git add frontend/.env.example frontend/src/shared/config/env.ts frontend/src/shared/config/env.test.ts
git commit -m "feat(frontend): zod-validated env loader with VITE_API_URL"
```

---

## Task 5: Shared utilities — cn helper

**Files:**
- Create: `frontend/src/shared/lib/utils.ts`
- Create: `frontend/src/shared/lib/utils.test.ts`

- [ ] **Step 5.1: Write failing test `frontend/src/shared/lib/utils.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves Tailwind conflicts — last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('filters falsy values', () => {
    expect(cn('foo', false && 'bar', undefined, null, 'baz')).toBe('foo baz');
  });
});
```

- [ ] **Step 5.2: Run failing test**

```bash
cd frontend
npm run test -- src/shared/lib/utils.test.ts
# Expected: FAIL — utils.ts not found
```

- [ ] **Step 5.3: Create `frontend/src/shared/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5.4: Run test — should pass**

```bash
cd frontend
npm run test -- src/shared/lib/utils.test.ts
# Expected: PASS (3 tests)
```

- [ ] **Step 5.5: Commit**

```bash
git add frontend/src/shared/lib/utils.ts frontend/src/shared/lib/utils.test.ts
git commit -m "feat(frontend): cn utility (clsx + tailwind-merge)"
```

---

## Task 6: shadcn/ui baseline primitives (hand-written)

> **Why hand-written:** The shadcn/ui CLI (`npx shadcn@latest init`) modifies `package.json`, `tailwind.config.js`, and outputs to `src/components/ui/` — none of which match our project structure or Tailwind v4 approach. We write the three baseline primitives by hand following the shadcn/ui "new-york" style, placing them in `src/shared/ui/`.

**Files:**
- Create: `frontend/src/shared/ui/button.tsx`
- Create: `frontend/src/shared/ui/input.tsx`
- Create: `frontend/src/shared/ui/dialog.tsx`
- Create: `frontend/src/shared/ui/button.test.tsx`

- [ ] **Step 6.1: Write failing test `frontend/src/shared/ui/button.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant class for destructive', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/destructive/);
  });
});
```

- [ ] **Step 6.2: Run failing test**

```bash
cd frontend
npm run test -- src/shared/ui/button.test.tsx
# Expected: FAIL — button.tsx not found
```

- [ ] **Step 6.3: Create `frontend/src/shared/ui/button.tsx`**

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[--color-primary] text-[--color-primary-foreground] shadow hover:opacity-90',
        destructive:
          'destructive bg-[--color-destructive] text-[--color-destructive-foreground] shadow-sm hover:opacity-90',
        outline:
          'border border-[--color-border] bg-[--color-background] shadow-sm hover:bg-[--color-accent] hover:text-[--color-accent-foreground]',
        secondary:
          'bg-[--color-secondary] text-[--color-secondary-foreground] shadow-sm hover:opacity-80',
        ghost: 'hover:bg-[--color-accent] hover:text-[--color-accent-foreground]',
        link: 'text-[--color-primary] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 6.4: Create `frontend/src/shared/ui/input.tsx`**

```typescript
import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[--color-input] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[--color-muted-foreground] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 6.5: Create `frontend/src/shared/ui/dialog.tsx`**

```typescript
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[--color-border] bg-[--color-background] p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[--color-background] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[--color-accent] data-[state=open]:text-[--color-muted-foreground]">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[--color-muted-foreground]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
```

- [ ] **Step 6.6: Run button test — should pass**

```bash
cd frontend
npm run test -- src/shared/ui/button.test.tsx
# Expected: PASS (4 tests)
```

- [ ] **Step 6.7: Commit**

```bash
git add frontend/src/shared/ui/button.tsx frontend/src/shared/ui/input.tsx frontend/src/shared/ui/dialog.tsx frontend/src/shared/ui/button.test.tsx
git commit -m "feat(frontend): hand-written shadcn/ui new-york primitives (button, input, dialog)"
```

---

## Task 7: ky HTTP client

**Files:**
- Create: `frontend/src/shared/api/client.ts`
- Create: `frontend/src/shared/api/client.test.ts`

- [ ] **Step 7.1: Write failing test `frontend/src/shared/api/client.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { apiClient } from './client';

describe('apiClient', () => {
  it('is a ky instance (has .get method)', () => {
    expect(typeof apiClient.get).toBe('function');
  });

  it('exposes extend method', () => {
    expect(typeof apiClient.extend).toBe('function');
  });
});
```

- [ ] **Step 7.2: Run failing test**

```bash
cd frontend
npm run test -- src/shared/api/client.test.ts
# Expected: FAIL — client.ts not found
```

- [ ] **Step 7.3: Create `frontend/src/shared/api/client.ts`**

```typescript
import ky from 'ky';
import { env } from '@/shared/config/env';

export const apiClient = ky.create({
  prefixUrl: env.VITE_API_URL,
  credentials: 'include',
  timeout: 30_000,
  retry: {
    limit: 2,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error;
        if (response) {
          try {
            const body = await response.clone().json<{ detail?: string }>();
            if (body.detail) {
              error.message = body.detail;
            }
          } catch {
            // ignore JSON parse errors — keep original message
          }
        }
        return error;
      },
    ],
  },
});
```

- [ ] **Step 7.4: Run test — should pass**

```bash
cd frontend
npm run test -- src/shared/api/client.test.ts
# Expected: PASS (2 tests)
```

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/shared/api/client.ts frontend/src/shared/api/client.test.ts
git commit -m "feat(frontend): ky HTTP client with credentials:include and prefixUrl"
```

---

## Task 8: Zustand 5 stores

**Files:**
- Create: `frontend/src/shared/store/auth-store.ts`
- Create: `frontend/src/shared/store/ui-store.ts`
- Create: `frontend/src/shared/store/auth-store.test.ts`
- Create: `frontend/src/shared/store/ui-store.test.ts`

- [ ] **Step 8.1: Write failing test `frontend/src/shared/store/auth-store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth-store';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('starts with no user', () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setUser sets user and isAuthenticated', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'test@example.com' });
    expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('clearUser resets state', () => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'test@example.com' });
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```

- [ ] **Step 8.2: Write failing test `frontend/src/shared/store/ui-store.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './ui-store';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false });
  });

  it('starts with sidebar closed', () => {
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('openSidebar sets sidebarOpen true', () => {
    useUiStore.getState().openSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('closeSidebar sets sidebarOpen false', () => {
    useUiStore.getState().openSidebar();
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('toggleSidebar flips sidebarOpen', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });
});
```

- [ ] **Step 8.3: Run failing tests**

```bash
cd frontend
npm run test -- src/shared/store/
# Expected: FAIL — store files not found
```

- [ ] **Step 8.4: Create `frontend/src/shared/store/auth-store.ts`**

```typescript
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}));
```

- [ ] **Step 8.5: Create `frontend/src/shared/store/ui-store.ts`**

```typescript
import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

- [ ] **Step 8.6: Run tests — should pass**

```bash
cd frontend
npm run test -- src/shared/store/
# Expected: PASS (7 tests across 2 suites)
```

- [ ] **Step 8.7: Commit**

```bash
git add frontend/src/shared/store/auth-store.ts frontend/src/shared/store/ui-store.ts frontend/src/shared/store/auth-store.test.ts frontend/src/shared/store/ui-store.test.ts
git commit -m "feat(frontend): Zustand 5 auth store + ui store (sidebar drawer state)"
```

---

## Task 9: useMediaQuery hook

**Files:**
- Create: `frontend/src/shared/hooks/use-media-query.ts`
- Create: `frontend/src/shared/hooks/use-media-query.test.ts`

- [ ] **Step 9.1: Write failing test `frontend/src/shared/hooks/use-media-query.test.ts`**

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMediaQuery } from './use-media-query';

describe('useMediaQuery', () => {
  let listeners: Array<(e: MediaQueryListEvent) => void>;
  let matchResult: boolean;

  beforeEach(() => {
    listeners = [];
    matchResult = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: matchResult,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_: string, listener: (e: MediaQueryListEvent) => void) => {
          listeners.push(listener);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when media query does not match', () => {
    matchResult = false;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when media query matches', () => {
    matchResult = true;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    matchResult = false;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    });
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 9.2: Run failing test**

```bash
cd frontend
npm run test -- src/shared/hooks/use-media-query.test.ts
# Expected: FAIL — hook not found
```

- [ ] **Step 9.3: Create `frontend/src/shared/hooks/use-media-query.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
```

- [ ] **Step 9.4: Run test — should pass**

```bash
cd frontend
npm run test -- src/shared/hooks/use-media-query.test.ts
# Expected: PASS (3 tests)
```

- [ ] **Step 9.5: Commit**

```bash
git add frontend/src/shared/hooks/use-media-query.ts frontend/src/shared/hooks/use-media-query.test.ts
git commit -m "feat(frontend): useMediaQuery hook for responsive sidebar drawer"
```

---

## Task 10: TanStack Query provider

**Files:**
- Create: `frontend/src/app/providers/query-provider.tsx`

- [ ] **Step 10.1: Create `frontend/src/app/providers/query-provider.tsx`**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 minute
      gcTime: 5 * 60_000,         // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 10.2: Commit**

```bash
git add frontend/src/app/providers/query-provider.tsx
git commit -m "feat(frontend): TanStack Query v5 QueryClient + provider"
```

---

## Task 11: next-themes provider + anti-flash script

**Files:**
- Create: `frontend/src/app/providers/theme-provider.tsx`
- Modify: `frontend/index.html` (created in next step — holds anti-flash inline script)

- [ ] **Step 11.1: Create `frontend/src/app/providers/theme-provider.tsx`**

```typescript
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="nova-theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 11.2: Create `frontend/index.html`**

The inline script in `<head>` runs synchronously before React hydrates, preventing any theme flash. It reads `localStorage["nova-theme"]` and applies `class="dark"` if needed.

```html
<!doctype html>
<html lang="en" suppressHydrationWarning>
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nova</title>
    <!--
      Anti-flash theme script.
      Runs synchronously before first paint.
      Reads localStorage["nova-theme"]:
        "dark"   → adds class "dark" to <html>
        "light"  → no class
        "system" or missing → uses prefers-color-scheme
      Must stay inline — do NOT move to an external script file.
    -->
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('nova-theme');
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var isDark =
            stored === 'dark' || (stored !== 'light' && prefersDark);
          if (isDark) {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {
          // localStorage blocked (private browsing, etc.) — default to light
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11.3: Commit**

```bash
git add frontend/src/app/providers/theme-provider.tsx frontend/index.html
git commit -m "feat(frontend): next-themes provider + anti-flash inline script (nova-theme key)"
```

---

## Task 12: Theme toggle feature + button

**Files:**
- Create: `frontend/src/features/toggle-theme/use-toggle-theme.ts`

- [ ] **Step 12.1: Create `frontend/src/features/toggle-theme/use-toggle-theme.ts`**

```typescript
import { useTheme } from 'next-themes';

export interface UseToggleThemeReturn {
  theme: string | undefined;
  isDark: boolean;
  toggle: () => void;
}

export function useToggleTheme(): UseToggleThemeReturn {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return { theme, isDark, toggle };
}
```

- [ ] **Step 12.2: Commit**

```bash
git add frontend/src/features/toggle-theme/use-toggle-theme.ts
git commit -m "feat(frontend): useToggleTheme hook (next-themes wrapper)"
```

---

## Task 13: AppShell — topbar with theme toggle + sidebar placeholder

**Files:**
- Create: `frontend/src/widgets/topbar/theme-toggle.tsx`
- Create: `frontend/src/widgets/topbar/topbar.tsx`
- Create: `frontend/src/widgets/sidebar/sidebar-placeholder.tsx`

- [ ] **Step 13.1: Create `frontend/src/widgets/topbar/theme-toggle.tsx`**

This button uses Motion for the sun/moon icon swap animation.

```typescript
import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/shared/ui/button';
import { useToggleTheme } from '@/features/toggle-theme/use-toggle-theme';

export function ThemeToggle() {
  const { isDark, toggle } = useToggleTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            <Moon className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            <Sun className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
```

- [ ] **Step 13.2: Create `frontend/src/widgets/topbar/topbar.tsx`**

```typescript
import { Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const isMobile = !useMediaQuery('(min-width: 768px)');

  return (
    <header className="flex h-14 items-center border-b border-[--color-border] bg-[--color-background] px-4">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Open navigation"
          className="mr-2"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-center gap-2">
        {/* Brand mark */}
        <span className="text-lg font-semibold tracking-tight text-[--color-foreground]">
          Nova
        </span>
      </div>

      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 13.3: Create `frontend/src/widgets/sidebar/sidebar-placeholder.tsx`**

This is a placeholder sidebar — the real sidebar with chat list is implemented in Plan 4.

```typescript
import { cn } from '@/shared/lib/utils';

interface SidebarPlaceholderProps {
  className?: string;
}

export function SidebarPlaceholder({ className }: SidebarPlaceholderProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-[--color-border] bg-[--color-background] p-4',
        className,
      )}
    >
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[--color-muted-foreground]">
        Navigation
      </div>
      <div className="flex-1 space-y-1">
        {/* Chat list will be rendered here in Plan 4 */}
        <div className="rounded-md px-3 py-2 text-sm text-[--color-muted-foreground]">
          No chats yet
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 13.4: Commit**

```bash
git add frontend/src/widgets/topbar/theme-toggle.tsx frontend/src/widgets/topbar/topbar.tsx frontend/src/widgets/sidebar/sidebar-placeholder.tsx
git commit -m "feat(frontend): AppShell widgets — topbar with animated theme toggle + sidebar placeholder"
```

---

## Task 14: TanStack Router — route tree + pages

**Files:**
- Create: `frontend/src/pages/__root.tsx`
- Create: `frontend/src/pages/index.tsx`
- Create: `frontend/src/app/router.tsx`

> **TanStack Router file-based routing:** The `@tanstack/router-plugin/vite` plugin watches `src/pages/` and auto-generates `src/app/routeTree.gen.ts` on `vite dev` / `vite build`. You NEVER edit `routeTree.gen.ts` by hand. `__root.tsx` is the root layout component. `index.tsx` maps to `/`.

- [ ] **Step 14.1: Create `frontend/src/pages/__root.tsx`**

The root route is the AppShell — sidebar + topbar + main outlet. On mobile, the sidebar becomes a Sheet (drawer) powered by Radix Dialog.

```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { SidebarPlaceholder } from '@/widgets/sidebar/sidebar-placeholder';
import { Topbar } from '@/widgets/topbar/topbar';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { ErrorBoundary } from '@/app/error-boundary';

function RootLayout() {
  const { sidebarOpen, closeSidebar } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Close mobile drawer when resizing to desktop
  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      closeSidebar();
    }
  }, [isDesktop, sidebarOpen, closeSidebar]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar — always visible */}
          {isDesktop && <SidebarPlaceholder />}

          {/* Mobile sidebar — Sheet drawer */}
          {!isDesktop && (
            <Dialog open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
              <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                <DialogHeader className="sr-only">
                  <DialogTitle>Navigation</DialogTitle>
                </DialogHeader>
                <SidebarPlaceholder className="w-full border-0" />
              </DialogContent>
            </Dialog>
          )}

          {/* Main content area */}
          <main className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
```

- [ ] **Step 14.2: Create `frontend/src/app/error-boundary.tsx`**

```typescript
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-semibold text-[--color-destructive]">
              Something went wrong
            </p>
            <p className="text-sm text-[--color-muted-foreground]">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              className="mt-4 rounded-md bg-[--color-primary] px-4 py-2 text-sm text-[--color-primary-foreground] hover:opacity-90"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 14.3: Create `frontend/src/pages/index.tsx`**

```typescript
import { createFileRoute } from '@tanstack/react-router';

function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[--color-foreground]">
          Nova is ready
        </h1>
        <p className="text-sm text-[--color-muted-foreground]">
          Your AI assistant is standing by. Start a new chat to begin.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: WelcomePage,
});
```

- [ ] **Step 14.4: Create `frontend/src/app/router.tsx`**

> Note: `routeTree.gen.ts` is auto-generated by the Vite plugin on first `npm run dev`. This file imports it — it will not exist until you run `dev` for the first time. The typecheck step in CI must run after `vite build` (which also generates the tree).

```typescript
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 14.5: Commit**

```bash
git add frontend/src/pages/__root.tsx frontend/src/pages/index.tsx frontend/src/app/router.tsx frontend/src/app/error-boundary.tsx
git commit -m "feat(frontend): TanStack Router file-based routes + root AppShell + welcome page"
```

---

## Task 15: App entry point (main.tsx)

**Files:**
- Create: `frontend/src/app/main.tsx`

- [ ] **Step 15.1: Create `frontend/src/app/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryProvider } from './providers/query-provider';
import { ThemeProvider } from './providers/theme-provider';
import { router } from './router';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('[nova] #root element not found in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 15.2: Run dev server and verify welcome screen**

```bash
cd frontend
npm run dev
# Open http://localhost:5173 in browser
# Expected:
#   - Topbar with "Nova" brand and sun/moon toggle
#   - "Nova is ready" centered text
#   - Theme toggle animates between sun and moon
#   - On mobile (<768px), hamburger menu appears; tapping opens drawer
#   - No console errors
#   - No theme flash on refresh
```

- [ ] **Step 15.3: Run full test suite**

```bash
cd frontend
npm run test
# Expected: all tests pass (env, utils, button, ky client, auth-store, ui-store, use-media-query)
```

- [ ] **Step 15.4: Run typecheck**

```bash
cd frontend
npm run typecheck
# Expected: 0 errors
# NOTE: routeTree.gen.ts must exist (generated by step 15.2 / npm run dev or npm run build)
# If typecheck runs before dev/build, generate it first: npm run build 2>&1 | head -5
```

- [ ] **Step 15.5: Commit**

```bash
git add frontend/src/app/main.tsx
git commit -m "feat(frontend): React app entry with ThemeProvider + QueryProvider + RouterProvider"
```

---

## Task 16: Smoke test — AppShell renders without crash

**Files:**
- Create: `frontend/src/app/app-shell.test.tsx`

- [ ] **Step 16.1: Create `frontend/src/app/app-shell.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from '@tanstack/react-router';

// Smoke test: ThemeProvider requires a DOM — wrap with MemoryRouter
// We render the WelcomePage directly to avoid needing routeTree.gen.ts in tests.
import { ThemeProvider } from './providers/theme-provider';
import { QueryProvider } from './providers/query-provider';

function WelcomePage() {
  return (
    <div>
      <h1>Nova is ready</h1>
    </div>
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <WelcomePage />
      </QueryProvider>
    </ThemeProvider>
  );
}

describe('AppShell smoke test', () => {
  it('renders without crashing', () => {
    render(<AppWrapper />);
    expect(screen.getByText('Nova is ready')).toBeInTheDocument();
  });

  it('ThemeProvider renders children', () => {
    const { container } = render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 16.2: Run smoke test**

```bash
cd frontend
npm run test -- src/app/app-shell.test.tsx
# Expected: PASS (2 tests)
```

- [ ] **Step 16.3: Commit**

```bash
git add frontend/src/app/app-shell.test.tsx
git commit -m "test(frontend): AppShell + provider smoke tests"
```

---

## Task 17: Frontend Dockerfile (multi-stage) + nginx.conf + .dockerignore

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

- [ ] **Step 17.1: Create `frontend/Dockerfile`**

```dockerfile
# ─── Stage 1: development ───────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

# Install deps first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

EXPOSE 5173

# Vite must bind to 0.0.0.0 inside container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ─── Stage 2: builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Accept build-time VITE_API_URL so the bundle bakes in the right URL
ARG VITE_API_URL=http://localhost:8080/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ─── Stage 3: production (nginx) ────────────────────────────────────────────
FROM nginx:1.27-alpine AS prod

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/nova.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 17.2: Create `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        image/svg+xml;

    # Cache hashed assets aggressively
    location ~* \.[0-9a-f]{8}\.(js|css|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html — never cache (so new deploys take effect immediately)
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # SPA fallback — all unknown paths → index.html (React Router handles them)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location = /healthz {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
```

- [ ] **Step 17.3: Create `frontend/.dockerignore`**

```
node_modules/
dist/
.vite/
.env
.env.local
*.log
coverage/
.DS_Store
Thumbs.db
src/**/*.test.ts
src/**/*.test.tsx
src/**/*.spec.ts
src/**/*.spec.tsx
```

- [ ] **Step 17.4: Build Docker image (verify both stages)**

```bash
cd frontend

# Verify dev stage builds
docker build --target dev -t nova-frontend:dev .

# Verify prod stage builds
docker build --target prod --build-arg VITE_API_URL=http://localhost:8080/api/v1 -t nova-frontend:prod .

# Test prod image
docker run --rm -d -p 8088:80 --name nova-fe-test nova-frontend:prod
curl -sSf http://localhost:8088/healthz
# Expected: "ok"
curl -sSf http://localhost:8088/ | grep -o '<title>Nova</title>'
# Expected: <title>Nova</title>
docker stop nova-fe-test
```

- [ ] **Step 17.5: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "feat(frontend): multi-stage Dockerfile (dev=vite, prod=nginx) + nginx.conf"
```

---

## Task 18: Surgical docker-compose.yml update

> **CRITICAL:** The `docker-compose.yml` in the repo root was created by Plan 1 (backend). It already contains `postgres`, `mailpit`, and `backend` services. You MUST add ONLY the `frontend` service block. Do NOT rewrite or replace the file.

**Files:**
- Modify: `docker-compose.yml` (root, already exists — surgical edit only)

- [ ] **Step 18.1: Read current docker-compose.yml**

```bash
cat docker-compose.yml
# Verify it contains: postgres, mailpit, backend services
# Identify the last line before "volumes:" section
```

- [ ] **Step 18.2: Add frontend service block**

Using a text editor or `sed`, insert the following block BEFORE the `volumes:` section at the bottom of `docker-compose.yml`.

The block to insert:

```yaml
  frontend:
    build:
      context: ./frontend
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/index.html:/app/index.html
    environment:
      VITE_API_URL: http://localhost:8080/api/v1
    depends_on:
      - backend
```

**Exact edit instruction:** Open `docker-compose.yml`, find the line `volumes:` (the top-level key at end of file), and insert the above block immediately before it. The result should look like:

```yaml
  # ... existing backend service ...

  frontend:
    build:
      context: ./frontend
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/index.html:/app/index.html
    environment:
      VITE_API_URL: http://localhost:8080/api/v1
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 18.3: Validate compose file**

```bash
docker compose config --quiet
# Expected: no errors (exits 0)
```

- [ ] **Step 18.4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): surgical add frontend service to docker-compose"
```

---

## Task 19: Surgical .gitignore update

> **CRITICAL:** `.gitignore` in the repo root was created by Plan 1. Do NOT rewrite it. Add frontend-specific entries only.

**Files:**
- Modify: `.gitignore` (root, already exists — append only)

- [ ] **Step 19.1: Append frontend entries to root .gitignore**

Open `.gitignore` and append the following at the end (after existing content):

```gitignore

# Frontend
frontend/node_modules/
frontend/dist/
frontend/.vite/
frontend/.env
frontend/.env.local
frontend/src/app/routeTree.gen.ts
```

- [ ] **Step 19.2: Verify gitignore works**

```bash
git status
# routeTree.gen.ts and .env should not appear as untracked
```

- [ ] **Step 19.3: Commit**

```bash
git add .gitignore
git commit -m "chore: add frontend entries to root .gitignore"
```

---

## Task 20: frontend/README.md quickstart

**Files:**
- Create: `frontend/README.md`

- [ ] **Step 20.1: Create `frontend/README.md`**

```markdown
# Nova — Frontend

React 18 + Vite 5 + TypeScript 5 SPA for the Nova chat application.

## Quickstart

### Prerequisites
- Node 20 LTS (`nvm install 20 && nvm use 20`)
- Backend running at `http://localhost:8080` (see `../backend/README.md`)

### Local dev

```bash
cp .env.example .env
npm install
npm run dev
# Open http://localhost:5173
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✓ | Backend API base URL, e.g. `http://localhost:8080/api/v1` |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | ESLint 9 check |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type-check only (no emit) |

### Docker

**Dev (Vite hot-reload):**
```bash
docker compose up frontend
```

**Production build:**
```bash
docker build --target prod --build-arg VITE_API_URL=https://your-api.example.com -t nova-frontend:prod .
docker run -p 80:80 nova-frontend:prod
```

## Architecture

```
src/
├── app/          # Entry, providers (QueryClient, Theme, Router)
├── pages/        # TanStack Router file-based routes
├── widgets/      # Topbar, Sidebar — composed from features/entities
├── features/     # Use-cases (toggle-theme, auth-login, send-message, ...)
├── entities/     # Domain types + queries (chat, message, user)
└── shared/
    ├── ui/       # shadcn/ui new-york primitives
    ├── api/      # ky client instance
    ├── config/   # Zod-validated env
    ├── hooks/    # useMediaQuery, ...
    ├── lib/      # cn utility
    └── store/    # Zustand stores (auth, ui)
```

## Theming

Themes are stored in `localStorage["nova-theme"]` (values: `"light"`, `"dark"`, `"system"`).
An inline script in `index.html` applies the class before React hydrates to prevent flash.
Toggle with the sun/moon button in the topbar.
```

- [ ] **Step 20.2: Commit**

```bash
git add frontend/README.md
git commit -m "docs(frontend): quickstart README with scripts, env vars, and architecture"
```

---

## Task 21: Final verification — full test suite + lint + typecheck

- [ ] **Step 21.1: Run all tests**

```bash
cd frontend
npm run test
# Expected: all tests pass
# Tests covered:
#   - src/shared/config/env.test.ts          (2 tests)
#   - src/shared/lib/utils.test.ts           (3 tests)
#   - src/shared/ui/button.test.tsx          (4 tests)
#   - src/shared/api/client.test.ts          (2 tests)
#   - src/shared/store/auth-store.test.ts    (3 tests)
#   - src/shared/store/ui-store.test.ts      (4 tests)
#   - src/shared/hooks/use-media-query.test.ts (3 tests)
#   - src/app/app-shell.test.tsx             (2 tests)
# Total: 23 tests across 8 suites
```

- [ ] **Step 21.2: Run lint**

```bash
cd frontend
npm run lint
# Expected: 0 errors, 0 warnings (or only acceptable warnings)
```

- [ ] **Step 21.3: Generate route tree + run typecheck**

```bash
cd frontend
# Generate routeTree.gen.ts (needed for typecheck)
npm run build 2>&1 | tail -5
# Then typecheck standalone
npm run typecheck
# Expected: 0 errors
```

- [ ] **Step 21.4: Run dev server — final manual check**

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 and verify:

- [ ] "Nova is ready" text is centered
- [ ] "Nova" brand visible in topbar
- [ ] Sun/moon theme toggle visible top-right
- [ ] Clicking toggle animates icon and switches theme
- [ ] After refresh, theme is remembered (no flash)
- [ ] Resize browser to <768px — hamburger icon appears in topbar
- [ ] Click hamburger — sidebar drawer slides in from left
- [ ] Click outside drawer or X — drawer closes
- [ ] Resize back to ≥768px — sidebar shows inline, hamburger disappears
- [ ] No console errors

- [ ] **Step 21.5: Final commit (if any stray files)**

```bash
cd ..
git status
# Stage any untracked files if needed
git add -p   # review interactively
git commit -m "chore(frontend): final cleanup and verification"
```

---

## Self-Review Checklist

Run these commands from `frontend/` after completing all tasks. Every item must pass before handing off to Plan 3b.

```bash
# 1. All tests pass
npm run test
# Expected: 23 tests passed

# 2. TypeScript clean
npm run typecheck
# Expected: no errors

# 3. Lint clean
npm run lint
# Expected: no errors

# 4. Production build succeeds
npm run build
# Expected: dist/ created, no TS/Vite errors

# 5. Preview build serves correctly
npm run preview &
curl -sSf http://localhost:4173/ | grep 'Nova'
# Expected: HTML containing "Nova"

# 6. Docker dev image builds
docker build --target dev -t nova-frontend:dev-check .
# Expected: exit 0

# 7. Docker prod image builds
docker build --target prod --build-arg VITE_API_URL=http://localhost:8080/api/v1 -t nova-frontend:prod-check .
# Expected: exit 0

# 8. Docker prod image serves index.html
docker run --rm -d -p 8099:80 nova-frontend:prod-check
curl -sSf http://localhost:8099/
# Expected: HTML with <title>Nova</title>
docker stop $(docker ps -q --filter ancestor=nova-frontend:prod-check)

# 9. Compose config is valid
cd ..
docker compose config --quiet
# Expected: exit 0
```

---

## Spec Coverage Table

| Plan 3a In-Scope Item | Implemented In |
|---|---|
| Vite 5 + React 18 + TypeScript 5 strict scaffold in `frontend/` | Task 1, 2, 15 |
| Tailwind CSS v4 (`@tailwindcss/vite` + `@theme inline`) + tailwindcss-animate + CSS variable tokens | Task 2 |
| shadcn/ui setup (components.json-style hand-written, `src/shared/ui/` — button, input, dialog) | Task 6 |
| TanStack Router (file-based via @tanstack/router-plugin), routes in `src/pages/` | Task 2, 14 |
| TanStack Query v5 (QueryClient + provider) | Task 10 |
| Zustand 5 skeleton auth store + ui store with sidebar-drawer state | Task 8 |
| next-themes (attribute="class"), inline anti-flash script, persists to "nova-theme" | Task 11 |
| ky HTTP client with `credentials: 'include'` and prefixUrl from env | Task 7 |
| @microsoft/fetch-event-source installed (stub only, full use Plan 4) | Task 1 (package.json) |
| lucide-react, react-hook-form, zod, motion, react-markdown, remark-gfm, rehype-pretty-code, shiki installed | Task 1 (package.json) |
| Folder structure `src/{app,pages,widgets,features,entities,shared/{ui,api,lib,config,hooks,store},styles,test}` | Tasks 1–16 |
| AppShell: sidebar placeholder + topbar (brand + theme toggle) + welcome page "/" | Tasks 13, 14, 15 |
| Theme toggle button in topbar (sun/moon, animates with Motion) | Task 12, 13 |
| Mobile drawer (Sheet on Radix Dialog) for sidebar on small screens; useMediaQuery hook | Tasks 9, 13, 14 |
| ErrorBoundary at root | Task 14 |
| zod-validated env loader with `VITE_API_URL` | Task 4 |
| Vitest + @testing-library/react + jsdom; smoke tests per core piece | Tasks 4, 5, 6, 7, 8, 9, 16 |
| ESLint 9 flat config + Prettier 3 | Task 3 |
| package.json scripts: dev, build, preview, test, test:watch, lint, format, typecheck | Task 1 |
| Dockerfile multi-stage (dev=vite, prod=nginx serving dist/) | Task 17 |
| nginx.conf, .dockerignore | Task 17 |
| frontend/.env.example with VITE_API_URL | Task 4 |
| frontend/README.md quickstart | Task 20 |
| docker-compose.yml surgical add: frontend service (dev target) | Task 18 |

**Out of Scope (NOT in Plan 3a):**

| Item | Planned In |
|---|---|
| Auth UI pages (OTP request + verify flow) | Plan 3b |
| Sidebar chat list, new-chat button, rename/delete menu | Plan 4 |
| Chat view, composer, streaming cursor, stop button | Plan 4 |
| Markdown / Shiki rendering of chat messages | Plan 4 |
| @microsoft/fetch-event-source SSE usage | Plan 4 |
| entities/chat, entities/message, entities/user TanStack Query hooks | Plan 4 |
| features/auth-login, send-message, regenerate-message, etc. | Plans 3b / 4 |
| Logout button | Plan 3b |

---

## Execution Options

**Option A — Subagent-Driven Development (recommended for parallel execution):**
Use `superpowers:subagent-driven-development`. Tasks 1–9 (scaffold + shared layer) can be dispatched as parallel agents after Task 1 completes. Tasks 10–16 (app assembly) must be sequential. Tasks 17–20 (infra + docs) can run in parallel with each other after Task 16.

**Option B — Inline Execution:**
Use `superpowers:executing-plans`. Work through tasks sequentially in the current session. Run `npm run test` after every task to keep the green bar intact. Commit after each task as specified — small commits make bisect easy.

**Caution for both options:**
- `routeTree.gen.ts` is generated at build/dev time, NOT by hand. Any agent working on `src/app/router.tsx` must either run `npm run dev` first or run `npm run build` to generate the file before `npm run typecheck` will pass.
- `docker-compose.yml` and `.gitignore` are shared files owned by Plan 1. Always read before editing; never rewrite the whole file.
- Tailwind v4 syntax uses `bg-[--color-primary]` arbitrary value notation to consume CSS variables, NOT `bg-primary` (that's the v3 convention). Keep this consistent throughout.
