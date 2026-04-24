# Nova — ELK + Grafana Observability

Integrate structured logging, trace-id propagation, and end-to-end observability
for the real Nova chat app (FastAPI backend + React/Vite frontend) using the
existing `lab/docker-elk-main/` stack (Elasticsearch, Logstash, Kibana, Grafana).

The Go demo app in `lab/app/` stays untouched — it remains the reference sample
from the lab README. The chat app logs into **the same** indices and dashboards
using the same JSON schema, so a single `traceId` filter finds both.

## Goals

1. Every HTTP request, business event, LLM call, and unhandled error from the
   chat app is a structured JSON record in Elasticsearch under `logstash-*`.
2. A single `traceId` links frontend action → backend request → sub-steps →
   LLM call → response, across browser and server.
3. Grafana has provisioned datasource + two dashboards (overview, trace
   explorer) that work out of the box for both the Go demo and the chat app.
4. Stays close to the lab example: same JSON field names, same Logstash
   pipeline, same index, no bespoke Kibana configuration beyond the existing
   index pattern.

## Non-Goals

- No Sentry / OpenTelemetry / APM. The lab grades ELK+Grafana; adding a second
  observability stack dilutes the demo.
- No source-map upload or release tracking for frontend errors.
- No metrics pipeline (Prometheus/StatsD). Metrics are derived from logs inside
  Grafana (count, rate, percentiles on `durationMs`).
- No client-side persistent buffer (IndexedDB). If the backend is fully down,
  the batch in memory is lost on reload. Acceptable for a lab.
- No changes to the Go demo app. It keeps its own direct-TCP hook to Logstash.

## Architecture

```
┌──────────────────────────────────────────────────┐
│ Frontend (React/Vite, :5173)                     │
│  shared/logger/                                  │
│   • traceId.ts      — new/current trace id       │
│   • clientLogger.ts — batch + flush (5s / 20     │
│                       records / beforeunload)    │
│   • apiClient.ts    — X-Trace-Id header, 4xx/5xx │
│                       auto-log                   │
│  auto-capture: window.onerror,                   │
│                unhandledrejection, route change  │
│       │                                          │
│       └─► POST /api/v1/_telemetry/logs           │
└──────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│ FastAPI backend (:8080)                          │
│  core/logging.py    — structlog JSON → stdout    │
│  core/trace.py      — ContextVar[str]            │
│  core/middleware.py — TraceMiddleware            │
│  api/v1/telemetry.py — re-emits frontend logs    │
│  business code: log.info / log.error calls with  │
│                 log.bind(source=...)             │
└──────────────────────────────────────────────────┘
                      │  (docker stdout JSON)
                      ▼
┌──────────────────────────────────────────────────┐
│ Filebeat (in lab/docker-elk-main/, sidecar)      │
│   inputs.d/docker.yml — autodiscover by label    │
│                         logging=elk              │
│   decode_json_fields: message                    │
│                      │                           │
│                      ▼  beats → :5044            │
└──────────────────────────────────────────────────┘
              Logstash → Elasticsearch
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          Kibana           Grafana (provisioned
       (logstash-*)        datasource + dashboards)
```

## Log Record Schema

Every record emitted by backend or frontend re-emit must contain:

| Field        | Type   | Source           | Example                                |
|--------------|--------|------------------|----------------------------------------|
| `@timestamp` | ISO-8601 UTC | auto         | `2026-04-24T22:17:03.412Z`             |
| `level`      | string | logger           | `info`, `debug`, `warn`, `error`       |
| `msg`        | string | call site        | `request.end`                          |
| `traceId`    | uuid   | ContextVar / client | `a1b2c3d4-...`                      |
| `source`     | string | bound in logger  | `backend` \| `frontend` \| `llm`       |

Extra, context-dependent fields (not all present on every record):

`userId`, `chatId`, `messageId`, `method`, `path`, `status`, `durationMs`,
`action`, `error`, `exception.stacktrace`, `ip`, `userAgent`, `route`.

Field names are chosen to match the Go demo app's existing output
(`traceId` in camelCase, not `trace_id`) so that one Kibana query and one
Grafana panel work across both.

## Backend

### Dependencies

Add to `backend/pyproject.toml`:

- `structlog>=24` — structured logging frontend.

Standard library `logging` stays in use for third-party loggers (uvicorn,
sqlalchemy); `structlog` intercepts them with `structlog.stdlib.ProcessorFormatter`
so every log line ends up as JSON on stdout.

### Files

- **`backend/app/core/logging.py`**
  - `configure_logging(level: str)` — installs structlog + stdlib handler.
  - Processors, in order: `add_log_level`, `TimeStamper("iso", utc=True, key="@timestamp")`,
    `contextvars.merge_contextvars`, `format_exc_info`, `EventRenamer("msg")`,
    `JSONRenderer`.
  - Reroutes `uvicorn.access`, `uvicorn.error`, `sqlalchemy.engine`, root logger
    through the same formatter.
  - Called once from `app/main.py` on startup, before `FastAPI(...)`.

- **`backend/app/core/trace.py`**
  - `trace_id_var: ContextVar[str | None] = ContextVar("trace_id", default=None)`.
  - `get_trace_id() -> str | None`.
  - `bind_trace(trace_id: str) -> Token` — sets contextvar and returns reset token.
  - Registered as a structlog contextvar so every log automatically gets
    `traceId` without explicit `.bind()` calls in business code.

- **`backend/app/core/middleware.py`**
  - `TraceMiddleware(BaseHTTPMiddleware)`.
  - Reads `X-Trace-Id` header, validates as uuid; if absent/invalid generates
    `uuid4()`.
  - Calls `bind_trace(...)`, tries to also bind `userId` if the request has an
    authenticated user (best-effort — skip if auth hasn't run yet at middleware
    layer; revisit in implementation phase).
  - Logs `request.start` (`method`, `path`).
  - Wraps call in try/finally; on finally logs `request.end`
    (`method`, `path`, `status`, `durationMs`).
  - On uncaught exception: `log.error("unhandled_exception", exc_info=True)`
    then re-raises.
  - Sets `X-Trace-Id` on the response.

- **`backend/app/api/v1/telemetry.py`**
  - `POST /_telemetry/logs` — no auth required.
  - Request body: `{records: ClientLogRecord[]}`, max 100 per batch.
  - `ClientLogRecord`: `{ts: str, level: str, msg: str, traceId: str, source?: str, fields?: dict}`.
  - For each record: `logger.bind(source="frontend", traceId=rec.traceId, **rec.fields).<level>(rec.msg)`.
  - Naive token-bucket rate limit (in-memory, per client IP): 60 records/sec
    average, burst 200; exceeded → 429 + `log.warn("telemetry.rate_limited")`.
  - Response: 204 on success.

- **Business-code instrumentation** — point edits only, no refactor:
  - `api/v1/auth.py`: log OTP request/verify start, success, and failure
    (with `email` hashed or omitted — don't log raw PII).
  - `api/v1/chats.py`: create/delete/rename → `chat.created` / `chat.deleted` /
    `chat.renamed` with `chatId`, `userId`.
  - `api/v1/messages.py` (or wherever `POST /chats/{id}/messages` lives):
    - `log.info("request.validate_start")`
    - `log.info("message.user_saved", messageId=...)`
    - `log.info("llm.call_start", source="llm", model=...)`
    - per-chunk log at `debug` with token count only (no chunk text, avoid
      bloating ES)
    - `log.info("llm.call_end", source="llm", durationMs=..., tokens=...)`
    - on LLM failure: `log.error("llm.call_failed", source="llm", error=...)`
    - `log.info("message.assistant_saved", messageId=...)`
  - All of the above auto-inherit `traceId` from ContextVar. No explicit `.bind()`
    needed at call sites.

### main.py wiring

```
configure_logging(settings.log_level)
app = FastAPI(...)
app.add_middleware(TraceMiddleware)
# existing middleware (CORS, auth) stays after TraceMiddleware
# so the trace is already bound when they run.
app.include_router(telemetry_router, prefix="/api/v1")
```

Middleware order matters: `TraceMiddleware` must be outermost so request
start/end wrap everything, including CORS responses.

## Frontend

### Files

- **`frontend/src/shared/logger/traceId.ts`**
  - `newTraceId()` — returns `crypto.randomUUID()`.
  - Per-action model: each API call in `apiClient` generates its own traceId.
  - `window.onerror` / `unhandledrejection` handlers generate their own traceId
    per error (no ambient per-page traceId — keeps semantics close to the Go
    lab's per-request model).

- **`frontend/src/shared/logger/clientLogger.ts`**
  - Queue `ClientLogRecord[]`.
  - `log(level, msg, fields?)` enqueues `{ts: new Date().toISOString(), level,
    msg, traceId: fields?.traceId ?? newTraceId(), fields}`.
  - Flush triggers: timer (5s), queue size (20), `beforeunload`
    (`navigator.sendBeacon`).
  - Flush target: `POST /api/v1/_telemetry/logs` with `{records: queue}`.
  - Failure on flush: keep items in queue up to a cap of 200 records; drop
    oldest when full. No IndexedDB persistence.
  - Initializes once in `app/main.tsx` (or wherever the app root is), attaches
    `window.onerror` and `unhandledrejection` → `log("error", "unhandled.*", ...)`.

- **`frontend/src/shared/api/apiClient.ts`** (edit existing fetch wrapper,
  don't fork)
  - Signature gets an optional `traceId?: string` in the request options. If
    absent, `traceId = newTraceId()`.
  - Add `X-Trace-Id: traceId` header.
  - On non-2xx: `log("error", "api.error", {status, method, path, traceId})`.
  - On network failure: `log("error", "api.network_error", {method, path,
    traceId, error: err.message})`.
  - The traceId is exposed to the caller (return it alongside the response,
    e.g. `{data, traceId}`, or attach to a thrown error) so that feature-level
    code can log user actions with the same traceId as the API call they
    triggered.

- **Route-change hook** — in the TanStack Router subscription or wherever
  navigation is centralised, call `log("info", "nav", {route, traceId:
  newTraceId()})`.

- **Key user actions** — 3–4 targeted calls, no blanket instrumentation:
  - Login success: `log("info", "user.login", {userId})`.
  - Send message: action code mints `traceId = newTraceId()`, passes it into
    the `apiClient` call, and logs `log("info", "user.message_send",
    {chatId, traceId})` with the same traceId.
  - Regenerate: same pattern — mint once, thread through API call + user
    action log (`{chatId, messageId, traceId}`).

### No new dependencies

`crypto.randomUUID` is available in every browser we target. No logging lib —
`clientLogger` is ~80 lines of TypeScript.

## Infrastructure

### Filebeat

Activate the filebeat service that already exists under
`lab/docker-elk-main/extensions/filebeat/` by including it in
`docker-compose.yml`:

- Config: `filebeat.autodiscover` provider `docker`, condition
  `contains.container.labels.logging: elk`.
- Processors: `decode_json_fields: {fields: [message], target: ""}` so the
  JSON stdout of the app becomes top-level fields in the ES document.
- Output: `logstash: hosts: [logstash:5044]`.
- Volume mounts: `/var/lib/docker/containers:ro`, `/var/run/docker.sock:ro`.

### Docker networking

The chat stack (`/docker-compose.yml`) and the ELK stack
(`lab/docker-elk-main/docker-compose.yml`) are kept as separate compose files.
They share a bridge network declared external:

- `lab/docker-elk-main/docker-compose.yml`: network `elk` becomes external
  (created manually once: `docker network create elk`). Alternative: keep ELK
  as network owner, and the chat compose references `external: true`. Pick
  whichever works with current Docker versions — verified during implementation.
- `/docker-compose.yml`: add `networks: [default, elk]` to the `backend`
  service, label `logging=elk`. Add the `elk` network at the top level as
  `external: true`.
- The Go demo app stays in its own compose (commented service at the bottom
  of the ELK compose, unchanged — it uses direct TCP and doesn't need the
  filebeat label).

### Grafana provisioning

New files under `lab/docker-elk-main/grafana/provisioning/`:

- `datasources/elasticsearch.yml`:
  ```yaml
  apiVersion: 1
  datasources:
    - name: Elasticsearch
      type: elasticsearch
      access: proxy
      url: http://elasticsearch:9200
      database: "logstash-*"
      jsonData:
        esVersion: "8.5.3"
        timeField: "@timestamp"
        logMessageField: msg
        logLevelField: level
  ```

- `dashboards/dashboards.yml` — provider pointing at `/var/lib/grafana/dashboards`.

- `dashboards/nova-overview.json`:
  - Stat panel: req/sec (count of `msg:request.end` over time window).
  - Stat panel: error rate (count of `level:error` / count of
    `msg:request.end`).
  - Time series: p50 / p95 of `durationMs` (filter `msg:request.end`).
  - Bar chart: count grouped by `level.keyword`.
  - Top-N table: top `msg.keyword` with `level:error`.

- `dashboards/nova-trace-explorer.json`:
  - Dashboard variable `$traceId` (text box).
  - Single logs panel, Lucene query `traceId:"$traceId"`, sorted ascending by
    `@timestamp`. Columns: `@timestamp`, `level`, `source`, `msg`, `durationMs`,
    `status`, `path`.

Mount point in grafana service:
`./grafana/provisioning:/etc/grafana/provisioning:ro` and
`./grafana/dashboards:/var/lib/grafana/dashboards:ro`.

## Error handling

| Failure mode                         | Behaviour                                                                 |
|--------------------------------------|---------------------------------------------------------------------------|
| Backend uncaught exception           | `log.error("unhandled_exception", exc_info=True)`, 500 to client          |
| LLM call fails / times out           | `log.error("llm.call_failed")` with `error`, request continues if partial |
| Logstash down                        | Filebeat buffers on disk (default behaviour), catches up on recovery      |
| Elasticsearch down                   | Logstash retries; filebeat keeps buffering                                |
| Frontend → backend network error     | `clientLogger` keeps records in memory queue (cap 200), retries next flush|
| `/_telemetry/logs` over rate limit   | 429, `log.warn("telemetry.rate_limited")`, client drops batch             |
| Invalid JSON posted to `/_telemetry` | 422, no log emitted from that record                                      |
| Browser tab closed mid-session       | `beforeunload` → `sendBeacon` flush (best-effort, not guaranteed)         |

## Security / privacy

- No raw email / OTP / passwords in logs. Auth code either omits identifiers
  or logs hashed versions (`sha256(email)[:16]`).
- No message text, no LLM prompts/completions in logs. LLM events log only
  metadata: model, token count, duration, status.
- `_telemetry/logs` is unauthenticated (so errors can be logged before login)
  but rate-limited per IP. No user-controlled fields are blindly trusted as
  structured fields — `fields` is whitelisted to string/number/bool values and
  capped at 2KB per record.

## Testing

### Backend — unit

- `test_trace_middleware.py`:
  - Header missing → generated uuid present in response `X-Trace-Id`.
  - Header present + valid → echoed back.
  - Header present + invalid → generated uuid (warn logged).
  - Under exception inside handler: `unhandled_exception` log + response 500.
- `test_telemetry_api.py`:
  - Happy batch → 204 + records appear in captured log stream with
    `source:frontend` and original `traceId`.
  - Empty batch → 204, no-op.
  - Oversized record / batch → 422.
  - Rate-limit exceeded → 429.

### Backend — integration

- `test_request_trace_e2e.py`: hit `/api/v1/health`, capture stdout via
  `capsys`, assert `request.start` and `request.end` logs share one `traceId`
  and that `X-Trace-Id` header is present and matches.
- `test_message_trace_e2e.py`: mock LLM client (already mocked in existing
  tests), POST a message, assert the full expected sequence of log messages
  all share one `traceId`.

### Frontend — unit

- `clientLogger.test.ts`:
  - enqueue → flush after size threshold.
  - enqueue → flush after timer (fake timers).
  - `beforeunload` → `sendBeacon` called with correct payload.
  - Network failure → records stay in queue, next flush retries.
  - Queue cap: oldest dropped on overflow.
- `apiClient.test.ts`:
  - `X-Trace-Id` header present on every request.
  - 4xx response → `api.error` log.
  - Network error → `api.network_error` log.

### Manual smoke

Documented in `lab/README.md` additions:

1. `docker network create elk`
2. `cd lab/docker-elk-main && docker compose up -d`
3. `cd ../.. && docker compose up -d` (chat stack)
4. Open `http://localhost:5173`, log in, send a message.
5. Kibana → Discover → `logstash-*`: filter `source:frontend` shows client
   records; `source:backend` shows server records; both findable by one
   `traceId`.
6. Grafana → "Nova Overview" renders; "Nova Trace Explorer" with a trace id
   pasted from Kibana shows the full sequence.

## Migration / rollout

This is net-new instrumentation; no migration. No existing logs to preserve.
All changes additive:

- New files only in `backend/app/core/logging.py`, `trace.py`, `middleware.py`,
  `api/v1/telemetry.py`.
- New files only in `frontend/src/shared/logger/**`.
- `apiClient.ts` — edit to add header + auto-log. The existing return shape is
  untouched.
- `main.py` — three lines added for wiring.
- Grafana / Filebeat — new config files, no changes to ES or Logstash.

## Out of scope (future work)

- Metrics (Prometheus) and APM (OpenTelemetry).
- Log retention / ILM policies on Elasticsearch.
- Authenticated `_telemetry/logs` once frontend always has a session.
- Sentry for frontend error grouping and session replay.
- Upload of frontend source maps so stack traces are symbolicated.
