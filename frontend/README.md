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
