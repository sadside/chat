# Nova — Design Document

**Date:** 2026-04-18
**Status:** Draft (awaiting user approval)
**Stack owner:** full-stack + ML

## 1. Summary

Nova — это локальное чат-приложение, работающее с open-source LLM через vLLM. Архитектурно: SPA-фронт (React + Vite) ↔ FastAPI-бэк ↔ vLLM OpenAI-compatible API. Хранилище — PostgreSQL. Email — SMTP (Mailpit локально).

Модель по умолчанию: `bond005/meno-lite-0.1`.

Ключевые характеристики:

- Passwordless-аутентификация (email + OTP), JWT в httpOnly cookie
- Многопользовательский режим, полная изоляция чатов между юзерами
- Мультичат с сохранением контекста в PostgreSQL
- Стриминг ответа через SSE с плавным рендерингом
- Dark / Light / System темы, Tailwind + shadcn/ui
- Умный auto-title, регенерация, клиентский поиск, export в Markdown

## 2. Non-Goals (что НЕ делаем в MVP)

Явно исключено, чтобы не разрастаться:

- RAG / загрузка документов
- Мультимодальность (изображения, аудио, файлы)
- Роли / ACL / sharing чатов между юзерами
- Биллинг, квоты, лимиты использования
- OAuth (Google/GitHub)
- Email-верификация с валидацией домена, reCAPTCHA
- Редактирование отправленного сообщения с перегенерацией (feature C из брейншторма)
- Настройка system prompt на чат (feature E)
- Счётчик токенов в UI (feature F)
- Суммаризация истории при переполнении контекст-окна (простой truncate хвоста)
- Horizontal scaling (один bk инстанс, один vLLM)

## 3. Архитектура (high-level)

```
┌──────────────┐     HTTPS/SSE      ┌────────────────┐     HTTP/SSE     ┌────────────┐
│   Frontend   │ ◄────────────────► │    Backend     │ ◄──────────────► │    vLLM    │
│ React + Vite │                    │    FastAPI     │                  │ OpenAI API │
└──────────────┘                    └────────┬───────┘                  └────────────┘
                                             │
                                  ┌──────────┼──────────┐
                                  ▼                     ▼
                          ┌───────────────┐     ┌──────────────┐
                          │  PostgreSQL   │     │  Mailpit /   │
                          │ users, chats, │     │  SMTP        │
                          │ messages, otp │     │              │
                          └───────────────┘     └──────────────┘
```

- **Frontend** и **backend** общаются через REST + SSE (для стриминга).
- **Backend** — единственный компонент, который ходит в vLLM. Фронт никогда не обращается к vLLM напрямую.
- **vLLM** stateless, принимает OpenAI-совместимые запросы `/v1/chat/completions` со `stream: true`.
- **PostgreSQL** — единый источник правды для пользователей, чатов, сообщений и OTP-кодов.
- **Mailpit** — локальный fake-SMTP для доставки OTP в dev-окружении. В проде заменяется на реальный SMTP через env.

## 4. Feature scope (MVP)

### Ядро

- OTP-авторизация (email → 6-значный код → JWT в httpOnly cookie, TTL 7 дней)
- Auto-создание пользователя на первом успешном verify
- Список чатов в сайдбаре, сортировка по `updated_at desc`
- Создание нового чата через `POST /chats` (отдельный endpoint, вызывается UI-кнопкой «New chat» и при открытии welcome-экрана «/» перед отправкой первого сообщения). Чат создаётся сразу с `title = 'New chat'` и без сообщений.
- Переименование и удаление чата из контекстного меню
- Чат-окно: отправка сообщения → стриминг ответа с мигающим курсором
- История сообщений грузится при открытии чата, передаётся в vLLM при каждом новом запросе
- Markdown рендеринг (GFM) + Shiki-подсветка кода
- Копирование сообщения и блока кода
- Dark / Light / System темы без flash (`next-themes`)
- Умный auto-scroll: следует за стримом, только если юзер уже внизу
- Кнопка Stop во время генерации — отменяет SSE, частичный ответ сохраняется с флагом `aborted=true`
- Индикаторы загрузки (skeleton'ы, спиннер в composer)
- Mobile-адаптация: сайдбар становится drawer'ом
- Logout

### Включённые фичи

- **A — Auto-title чата.** После первого `assistant_done` запускается отдельный вызов vLLM с промптом «Дай короткий заголовок (3-5 слов) для этого диалога. Ответь только заголовком». Результат приходит в `title_update` event.
- **B — Регенерация последнего ответа.** Кнопка `↻` под последним assistant-сообщением. Удаляет это сообщение из БД и запускает стрим заново с той же историей (без последнего assistant).
- **D — Клиентский fuzzy-поиск по чатам.** Поле поиска в сайдбаре, фильтрация по `title` через `fuse.js`. Без серверного endpoint'а.
- **G — Export в Markdown.** `GET /chats/{id}/export` отдаёт файл `{title}.md` с оформленной историей (роли как заголовки, `content` как текст).

## 5. Frontend

### Стек

| Слой | Выбор |
|---|---|
| Bundler | Vite 5 |
| Language | TypeScript 5.x strict |
| Framework | React 18 |
| Router | TanStack Router (file-based) |
| Server state | TanStack Query v5 |
| Client state | Zustand (с immer middleware) |
| UI primitives | shadcn/ui (Radix под капотом) |
| Styling | Tailwind CSS v4 + CSS variables |
| Theming | next-themes |
| Animations | Motion (ex Framer Motion) |
| Markdown | react-markdown + remark-gfm + rehype-pretty-code (Shiki) |
| Forms | react-hook-form + zod |
| HTTP | ky |
| SSE | @microsoft/fetch-event-source |
| Icons | lucide-react |

### Структура

```
frontend/
├── src/
│   ├── app/
│   │   ├── providers/           # QueryClientProvider, ThemeProvider, RouterProvider
│   │   ├── router.tsx           # routeTree
│   │   └── main.tsx             # entry
│   ├── pages/                   # тонкие композиции (один файл на роут)
│   │   ├── auth.page.tsx
│   │   ├── chat.page.tsx        # /chats/$chatId
│   │   └── index.page.tsx       # / — welcome + composer (новый чат)
│   ├── widgets/                 # крупные составные блоки
│   │   ├── sidebar/             # список чатов, поиск, new-chat, user-menu
│   │   ├── chat-view/           # лента сообщений + autoscroll
│   │   ├── composer/            # textarea + send/stop
│   │   └── topbar/              # заголовок чата, theme toggle
│   ├── features/                # use-case'ы (UI + model)
│   │   ├── auth-login/          # OTP flow (два шага)
│   │   ├── send-message/        # POST + SSE обработка
│   │   ├── regenerate-message/  # B-фича
│   │   ├── create-chat/
│   │   ├── rename-chat/
│   │   ├── delete-chat/
│   │   ├── export-chat/         # G-фича
│   │   ├── search-chats/        # D-фича (клиентский fuse.js)
│   │   └── toggle-theme/
│   ├── entities/
│   │   ├── chat/                # types + useChatsQuery, useChatQuery
│   │   ├── message/             # types + useMessagesQuery
│   │   └── user/                # types + useMeQuery
│   ├── shared/
│   │   ├── ui/                  # shadcn компоненты (button, input, dialog, ...)
│   │   ├── api/
│   │   │   ├── client.ts        # ky instance с auth + error handling
│   │   │   └── sse.ts           # типизированный SSE-клиент
│   │   ├── lib/                 # утилиты (cn, dates, markdown helpers)
│   │   ├── config/              # env, constants
│   │   └── hooks/               # useAutoScroll, useClipboard, ...
│   └── styles/
│       └── globals.css          # tailwind layers + CSS vars тем
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

### Правила разделения логики

- **`ui/`** — только JSX + пропсы + обработчики, которые вызывают хуки.
- **`model.ts`** внутри фичи — кастомные хуки: `useSendMessage(chatId)` → возвращает `{ send, stop, isStreaming }`. Вся работа с API, сторами и эффектами живёт здесь.
- **`api.ts`** — TanStack Query mutations/queries + `ky`-вызовы.
- **`lib/`** — чистые функции (парсер SSE, форматтеры).
- Прямой вызов `ky` из компонента запрещён.

### Стриминг — визуальный UX

1. При `send` фича создаёт оптимистичное user-сообщение и пустое assistant-сообщение со статусом `streaming`.
2. SSE `delta`-события аппендят текст в `assistant.content` в Zustand-сторе стриминг-фичи. React-Query не используется для стрима — только для финального refetch.
3. Курсор `▋` — это pseudo-element у последнего стримящегося span, CSS `animation: blink 1s step-end infinite`.
4. Motion: новые `delta`-span'ы появляются с `opacity: 0 → 1` за 150мс (через `animate-in fade-in`).
5. Auto-scroll: `IntersectionObserver` на bottom-якоре. Если якорь в viewport → скролим. Если юзер скроллил вверх — не мешаем.
6. Stop: `AbortController.abort()` → SSE закрывается → UI показывает частичный ответ серым с пометкой «Stopped».
7. При `title_update` event — invalidate `useChatsQuery` или прямой update через `queryClient.setQueryData`.

### Темы

- `next-themes` ставит `class="dark"` на `<html>`.
- CSS vars в `globals.css`:
  ```css
  :root { --bg: 0 0% 98%; --fg: 222 47% 11%; /* ... */ }
  .dark { --bg: 222 47% 4%; --fg: 210 40% 98%; /* ... */ }
  ```
- Shiki темы: `github-light` / `github-dark`, переключаются через data-атрибут в `rehype-pretty-code`.

## 6. Backend

### Стек

| Слой | Выбор |
|---|---|
| Framework | FastAPI + uvicorn |
| Language | Python 3.12 |
| ORM | SQLAlchemy 2.0 async + asyncpg |
| Migrations | Alembic |
| Validation | Pydantic v2 + pydantic-settings |
| JWT | python-jose[cryptography] (HS256) |
| HTTP client | httpx[http2] (для vLLM streaming) |
| Email | aiosmtplib |
| Rate limit | slowapi |
| Logging | structlog (JSON) |
| Tests | pytest + pytest-asyncio + httpx.AsyncClient |
| Deps | uv + pyproject.toml |

### Структура

```
backend/
├── app/
│   ├── main.py                 # create_app(), middleware, CORS, экспошн-хендлеры
│   ├── config.py               # Settings (pydantic-settings, читает .env)
│   ├── deps.py                 # get_db, get_current_user, get_llm_client
│   ├── core/
│   │   ├── security.py         # jwt_encode, jwt_decode, set_auth_cookie
│   │   ├── exceptions.py       # AppException, NotFound, Unauthorized
│   │   └── rate_limit.py       # slowapi limiter
│   ├── db/
│   │   ├── base.py             # DeclarativeBase
│   │   ├── session.py          # async engine + async_sessionmaker
│   │   └── models.py           # User, OtpCode, Chat, Message
│   ├── schemas/
│   │   ├── auth.py             # RequestOtpIn, VerifyOtpIn, MeOut
│   │   ├── chat.py             # ChatSummary, ChatCreateOut, ChatUpdateIn
│   │   └── message.py          # MessageOut, SendMessageIn
│   ├── api/v1/
│   │   ├── auth.py
│   │   ├── chats.py
│   │   ├── messages.py         # POST ... messages (SSE), POST ... regenerate
│   │   ├── health.py
│   │   └── router.py           # aggregate
│   ├── services/
│   │   ├── auth_service.py     # request_otp, verify_otp
│   │   ├── otp_service.py      # generate_code, hash_code, verify_code
│   │   ├── chat_service.py     # CRUD + ownership guards
│   │   ├── message_service.py  # send_stream, regenerate_stream, export_markdown
│   │   ├── llm_client.py       # vLLM async streaming + non-streaming
│   │   ├── context_builder.py  # history → messages[] + truncate по хвосту
│   │   ├── title_generator.py  # A-фича (отдельный non-stream вызов vLLM)
│   │   └── email/
│   │       ├── base.py         # EmailSender Protocol
│   │       ├── smtp.py         # SMTPSender (для Mailpit / SMTP)
│   │       └── console.py      # ConsoleSender (в stdout, для quick-dev)
│   └── alembic/
│       ├── env.py
│       └── versions/
├── tests/
│   ├── conftest.py
│   ├── unit/
│   │   ├── test_otp_service.py
│   │   ├── test_context_builder.py
│   │   └── test_email_smtp.py
│   └── integration/
│       ├── test_auth_flow.py
│       ├── test_chat_crud.py
│       └── test_message_streaming.py  # с моком vLLM
├── pyproject.toml
├── uv.lock
├── alembic.ini
├── Dockerfile
├── .env.example
└── README.md
```

### Правила разделения логики

- **`api/`** — только HTTP: парсинг запроса → вызов сервиса → формирование response. Никакой бизнес-логики.
- **`services/`** — чистая бизнес-логика, принимают `AsyncSession` и DTO. Не импортируют `fastapi.*`.
- **`llm_client.py`** — единственная точка, знающая про vLLM. Используется через DI.
- **`context_builder.py`** — чистая функция, тестируется изолированно без БД.

### Схема БД

```sql
-- users
CREATE TABLE users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- otp_codes
CREATE TABLE otp_codes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) NOT NULL,
  code_hash    VARCHAR(255) NOT NULL,           -- sha256(code + pepper)
  expires_at   TIMESTAMPTZ  NOT NULL,
  consumed_at  TIMESTAMPTZ,
  attempts     INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_email_created ON otp_codes (email, created_at DESC);

-- chats
CREATE TABLE chats (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chats_user_updated ON chats (user_id, updated_at DESC);

-- messages
CREATE TABLE messages (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID         NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       VARCHAR(16)  NOT NULL,              -- 'user' | 'assistant' | 'system'
  content    TEXT         NOT NULL,
  aborted    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_chat_created ON messages (chat_id, created_at ASC);
```

### REST API

Все эндпоинты под `/api/v1/`. Все защищённые требуют валидной JWT cookie.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/request-otp` | нет | `{email}` → 204. Rate-limit: 3 запроса / 15 мин на email |
| POST | `/auth/verify-otp` | нет | `{email, code}` → 200 `{user}`, ставит cookie |
| POST | `/auth/logout` | да | Сбрасывает cookie → 204 |
| GET | `/auth/me` | да | Возвращает `{id, email}` |
| GET | `/chats` | да | Список чатов юзера (`ChatSummary[]`) |
| POST | `/chats` | да | Создаёт пустой чат → `ChatSummary` |
| PATCH | `/chats/{id}` | да | `{title}` → переименование |
| DELETE | `/chats/{id}` | да | Удаляет чат и все сообщения → 204 |
| GET | `/chats/{id}/export` | да | text/markdown, оформленная история |
| GET | `/chats/{id}/messages` | да | История сообщений (`MessageOut[]`) |
| POST | `/chats/{id}/messages` | да | `{content}` → **SSE stream** (см. протокол ниже) |
| POST | `/chats/{id}/regenerate` | да | SSE stream перегенерации последнего ответа |
| GET | `/health` | нет | `{status, vllm: "up"\|"down"}` |

Ownership: все ручки `/chats/*` проверяют `chat.user_id == current_user.id`, иначе 404 (не 403, чтобы не раскрывать существование).

### SSE-протокол стриминга

Единый формат для `/messages` и `/regenerate`. `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

```
event: user_message
data: {"id": "uuid", "role": "user", "content": "...", "created_at": "..."}

event: assistant_start
data: {"id": "uuid"}

event: delta
data: {"text": "Привет"}

event: delta
data: {"text": "! Как дела?"}

event: assistant_done
data: {"id": "uuid", "content": "...", "aborted": false}

event: error
data: {"code": "LLM_UNAVAILABLE", "message": "..."}
```

Порядок гарантируется:
1. `user_message` — сразу после сохранения user-сообщения в БД
2. `assistant_start` — перед первым токеном
3. `delta` — по мере прихода чанков из vLLM (батчинг не обязателен)
4. `assistant_done` — после сохранения полного ответа в БД
5. `error` — в любой момент вместо/после `assistant_done`, стрим закрывается

**Title update не идёт через SSE** (стрим может закрыться раньше, чем title_generator отработает). Вместо этого клиент после `assistant_done` инвалидирует `useChatsQuery` с задержкой 1500мс — к этому моменту `generate_title` типично успевает обновить `chat.title` в БД.

### Auth flow (детально)

**Request OTP:**
1. Клиент шлёт `POST /auth/request-otp {email}`
2. Rate-limit: ≤3 запроса на email за 15 минут (проверка через COUNT в `otp_codes`)
3. Генерим 6-значный код (`secrets.randbelow(10**6)`), хешим `sha256(code + OTP_PEPPER)`
4. Инсертим в `otp_codes` с `expires_at = now() + 10 минут`
5. Шлём email через `EmailSender.send(email, code)`
6. Отвечаем 204 (не раскрываем, существует ли пользователь)

**Verify OTP:**
1. Клиент шлёт `POST /auth/verify-otp {email, code}`
2. Находим последний неконсьюмленный `otp_code` для email
3. Проверяем: `expires_at > now()`, `attempts < 5`, `sha256(code + PEPPER) == code_hash`
4. При неверном коде — `attempts += 1`, 400
5. При успехе — `consumed_at = now()`, инвалидируем все остальные OTP этого email
6. `get_or_create` пользователя по email
7. Генерим JWT (HS256, payload: `{sub: user_id, exp: now+7d}`)
8. Ставим httpOnly cookie `access_token` (Secure в проде, SameSite=Lax)
9. Возвращаем `{user}`

**Авторизованный запрос:**
- Зависимость `get_current_user` читает cookie, декодит JWT, грузит юзера из БД. 401 при любой проблеме.

### vLLM-интеграция

`llm_client.py` — тонкая асинхронная обёртка:

```python
class LlmClient:
    def __init__(self, base_url: str, model: str, timeout: float = 120.0):
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout, http2=True)
        self._model = model

    async def stream(self, messages: list[dict], **params) -> AsyncIterator[str]:
        """Yields text deltas."""
        ...

    async def complete(self, messages: list[dict], **params) -> str:
        """Non-streaming, для title_generator."""
        ...
```

Под капотом:
- `POST {VLLM_URL}/chat/completions` с `{model, messages, stream: true, temperature, max_tokens}`
- Парсим SSE из vLLM (`data: {...}\n\n`), вытаскиваем `choices[0].delta.content`
- Ловим `data: [DONE]` как конец

`context_builder.py`:
- Вход: список `Message` из БД (`role`, `content`)
- Выход: список `{role, content}` dict'ов, подходящий под OpenAI API
- Truncate: если сумма токенов (грубая оценка `len(content) / 4`) больше `CONTEXT_WINDOW * 0.75` — отрезаем с головы, сохраняя system (если есть)
- `CONTEXT_WINDOW` — конфигурируемый в `.env` (по умолчанию 8192 для `meno-lite-0.1`)

### Title generator (A-фича)

Запускается в фоне после сохранения ответа ассистента, до отправки `assistant_done`:

```python
# в message_service.send_stream, после сохранения assistant-сообщения
if is_first_exchange:
    asyncio.create_task(generate_title(chat_id, user_msg, assistant_msg))
# не ждём, шлём assistant_done сразу
```

`generate_title` делает отдельный non-stream вызов vLLM с промптом:

```
system: Ты генератор заголовков.
user: Вот диалог:
User: {user_msg}
Assistant: {assistant_msg}

Дай короткий заголовок (3-5 слов). Ответь только заголовком, без кавычек.
```

Обновляет `chat.title` в БД в отдельной сессии (task переживает закрытие HTTP-сессии). Клиент после `assistant_done` ждёт 1500мс и инвалидирует `useChatsQuery` — этого достаточно для типичного случая. Если title_generator всё же не успел — title обновится при следующем invalidate (например, при смене чата).

**Ошибки внутри task:** ловятся и логируются, не пробрасываются (title — best-effort фича).

### Ошибки и обработка

- **vLLM unreachable** (connection refused, timeout) → `event: error` с кодом `LLM_UNAVAILABLE`, HTTP 200 (SSE уже начат) или 503 (до первого event).
- **vLLM вернул 5xx** → тот же `LLM_UNAVAILABLE`.
- **Превышен context window** → ContextBuilder режет; если даже после reзки не влазит — `CONTEXT_TOO_LARGE`, 400.
- **DB down** → 503 через глобальный exception handler.
- **Client disconnect во время стрима** → при закрытии соединения FastAPI отменяет async-generator через `asyncio.CancelledError`. Паттерн:
  ```python
  accumulated = []
  try:
      async for delta in llm_client.stream(messages):
          accumulated.append(delta)
          yield sse("delta", {"text": delta})
  except asyncio.CancelledError:
      aborted = True
      raise   # пробрасываем обязательно
  finally:
      # сохраняем частичный ответ с aborted=aborted
      await message_service.persist_assistant("".join(accumulated), aborted=aborted)
  ```
  `finally` выполнится даже при отмене, БД сохранит то, что успело стримиться.
- **Rate limit превышен** → 429 + `Retry-After`.

### Конфигурация (.env)

```env
# App
APP_ENV=development              # development | production
APP_HOST=0.0.0.0
APP_PORT=8080
APP_CORS_ORIGINS=http://localhost:5173

# Database
DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova

# JWT
JWT_SECRET=change-me-in-prod
JWT_ALGORITHM=HS256
JWT_TTL_HOURS=168                # 7 days
JWT_COOKIE_SECURE=false          # true в проде

# OTP
OTP_PEPPER=change-me
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_REQUEST_LIMIT=3              # на email за OTP_REQUEST_WINDOW_MIN
OTP_REQUEST_WINDOW_MIN=15

# vLLM
VLLM_URL=http://localhost:8000/v1
VLLM_MODEL=bond005/meno-lite-0.1
VLLM_TIMEOUT_SECONDS=120
VLLM_CONTEXT_WINDOW=8192
VLLM_TEMPERATURE=0.7
VLLM_MAX_TOKENS=1024

# Email
EMAIL_BACKEND=smtp               # smtp | console
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@nova.local
SMTP_TLS=false
```

## 7. Infrastructure

### Docker Compose

`docker-compose.yml` в корне репо поднимает всё, кроме vLLM (из-за GPU):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nova
      POSTGRES_PASSWORD: nova
      POSTGRES_DB: nova
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nova"]
      interval: 5s
      timeout: 3s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_MAX_MESSAGES: 500

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      mailpit:
        condition: service_started
    extra_hosts:
      - "host.docker.internal:host-gateway"   # чтобы достучаться до vLLM на хосте
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8080"

  frontend:
    build:
      context: ./frontend
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
    environment:
      VITE_API_URL: http://localhost:8080/api/v1

volumes:
  pgdata:
```

### vLLM — запуск отдельно

В README даём две команды в зависимости от окружения:

**С GPU (Linux + NVIDIA):**
```bash
docker run --gpus all -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model bond005/meno-lite-0.1 \
  --max-model-len 8192
```

**Нативно (macOS / CPU):**
```bash
uv tool install vllm
vllm serve bond005/meno-lite-0.1 --port 8000 --max-model-len 8192
```

> ⚠️ На CPU vLLM работает медленно. Для быстрой разработки на маке можно подменить `VLLM_URL` на OpenAI-совместимый endpoint (например, `llama.cpp server`, `ollama` с OpenAI-совместимым режимом, или замокать в тестах).

Бэк из контейнера достучится до vLLM через `http://host.docker.internal:8000/v1`.

## 8. Тестирование

### Backend

- **Unit** — services в изоляции: `otp_service`, `context_builder`, `title_generator` (с моком vLLM), `email/*`.
- **Integration** — поднимаем тестовую БД (pytest fixture → отдельная schema в postgres), `httpx.AsyncClient` на FastAPI app. Мокируем `LlmClient` (Dependency override).
- Покрываем: полный OTP-флоу, CRUD чатов, ownership (юзер A не видит чат юзера B), стриминг (mock vLLM, считаем событий в ответе), Stop (disconnect → aborted=true в БД).

### Frontend

Не пишем автотесты фронта в MVP (не в требованиях). Фокус — ручное тестирование golden path + ключевых edge-cases:
- Новый пользователь: OTP → чат → первое сообщение → title
- Stop посреди генерации → частичный ответ сохранён
- Переключение темы → без flash
- Mobile: drawer, composer, скролл
- Regenerate → один ответ исчез, новый стримится
- Export → скачивается .md
- Сеть падает во время стрима → понятная ошибка

## 9. Инструкция запуска (для README)

```bash
# 1. Поднять инфраструктуру (postgres + mailpit)
docker compose up -d postgres mailpit

# 2. Поднять vLLM (отдельный терминал)
vllm serve bond005/meno-lite-0.1 --port 8000

# 3. Backend
cd backend
cp .env.example .env
uv sync
alembic upgrade head
uv run uvicorn app.main:app --reload --port 8080

# 4. Frontend
cd frontend
cp .env.example .env
npm install    # или pnpm install
npm run dev

# 5. Открыть http://localhost:5173
#    OTP-код смотрим в Mailpit UI: http://localhost:8025
```

Prod-вариант (всё в docker):
```bash
docker compose up -d
```
(vLLM поднимается отдельно, как выше).

## 10. Пример запроса

```bash
# Отправить сообщение
curl -N -X POST http://localhost:8080/api/v1/chats/{chat_id}/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=eyJ..." \
  -d '{"content": "Привет! Что такое vLLM?"}'

# Ответ (SSE поток):
# event: user_message
# data: {"id": "...", "content": "Привет!...", ...}
#
# event: assistant_start
# data: {"id": "..."}
#
# event: delta
# data: {"text": "vLLM — это "}
#
# event: delta
# data: {"text": "open-source движок "}
# ...
# event: assistant_done
# data: {"id": "...", "content": "vLLM — это open-source движок...", "aborted": false}
```

## 11. Открытые вопросы

Ничего критичного. Решения по будущим развилкам:
- Суммаризация при переполнении контекста — вне MVP, оставлен хук в `ContextBuilder`.
- WebSocket вместо SSE — не нужен, стрим односторонний. Если понадобится two-way (voice, typing-indicator) — перейдём позже.
- Множественные модели — сейчас один `VLLM_MODEL` в env; добавление селектора моделей потребует расширения DTO `/messages`.
