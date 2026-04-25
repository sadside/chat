# Лабораторная работа

### Необходимо продемонстрировать работу с logstash, elasticsearch, kibana, grafana.
Выполнять в командах 
если у вас командный проект в нашей группе, то просто кто то мне показывает, что у вас все работает и я засчитваю лабу всем
если у вас командный проект с другой группой, то вы лично показываете, что у вас все работает

---

# Advanced Logging — ELK + Grafana

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Go-приложение                         │
│                   (localhost:8080)                       │
│                                                          │
│  Фоновые задачи:           HTTP-эндпоинты:               │
│  • debug  каждые 2с        • GET /logs                   │
│  • error  каждые 5с        • GET /process?userId=...     │
│  • panic  каждые 10с                                     │
│                                                          │
│  logrus (JSON) ──TCP──► Logstash:50000                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    Logstash      │
                    │   :50000 (TCP)   │
                    │   :5044  (beats) │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Elasticsearch   │
                    │     :9200        │
                    │  index:          │
                    │  logstash-*      │
                    └──────┬───────────┘
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
      ┌──────────────┐       ┌──────────────────┐
      │    Kibana    │       │     Grafana       │
      │    :5601     │       │      :3000        │
      └──────────────┘       └──────────────────┘
```

---

## Стек

| Компонент     | Версия  | Порт  | Назначение                              |
|---------------|---------|-------|-----------------------------------------|
| Go-приложение | 1.22    | 8080  | Генерация структурированных логов       |
| Logstash      | ELK     | 50000 | Приём и маршрутизация логов             |
| Elasticsearch | ELK     | 9200  | Хранение и индексация логов             |
| Kibana        | ELK     | 5601  | Поиск и просмотр логов                  |
| Grafana       | 10.4.3  | 3000  | Дашборды и визуализация метрик по логам |

---

## Запуск

### 1. Инфраструктура (ELK + Grafana)

```bash
cd docker-elk-main
docker compose up -d
```

Первый старт занимает ~1-2 минуты — Elasticsearch инициализируется.

### 2. Go-приложение

**Вариант A — GoLand/IDE:** открыть `app/main.go`, запустить `main()`.

**Вариант B — Docker:**
```bash
cd docker-elk-main
docker compose up -d --build app
```

**Вариант C — терминал:**
```bash
cd app
go run .
```

Приложение подключается к Logstash на `localhost:50000`. Если Logstash ещё не готов — переподключается каждые 2 секунды автоматически.

---

## Go-приложение (`app/main.go`)

### Структура лог-сообщения

Каждое сообщение — JSON с полями:

```json
{
  "@timestamp": "2026-04-18T07:21:10.627Z",
  "level": "error",
  "msg": "Scheduled error message",
  "traceId": "b5b622f7-5234-4055-bd80-8b895e78d93b"
}
```

### Отправка в Logstash

Кастомный `logstashHook` для logrus устанавливает TCP-соединение с Logstash и отправляет каждое сообщение в виде JSON-строки. При обрыве соединения — автоматически переподключается в фоне.

### Фоновые задачи

| Функция          | Интервал | Уровень | Описание                          |
|------------------|----------|---------|-----------------------------------|
| `postDebug`      | 2с       | DEBUG   | Штатное отладочное сообщение      |
| `postError`      | 5с       | ERROR   | Сообщение об ошибке               |
| `postException`  | 10с      | ERROR   | Recover из паники + поле `panic`  |

### HTTP-эндпоинты

#### `GET /logs`

Записывает по одному сообщению каждого уровня (trace → debug → info → warn → error) с одним `traceId`.

```bash
curl http://localhost:8080/logs
```

#### `GET /process?userId=alice`

Симулирует многошаговый запрос. Все шаги используют **один `traceId`** — так можно отследить весь путь запроса в Kibana и Grafana.

```bash
curl http://localhost:8080/process?userId=alice
# → {"traceId":"a1b2c3...","userId":"alice","status":"ok"}
```

Шаги:

| Шаг                    | Уровень      | Описание                                      |
|------------------------|--------------|-----------------------------------------------|
| `validateRequest`      | INFO + DEBUG | Проверка входных данных                       |
| `queryDatabase`        | INFO + DEBUG | Симуляция запроса к БД, иногда WARN о медлен. |
| `callExternalService`  | INFO + ERROR | Внешний сервис, с вероятностью ~25% — timeout |

Ответ содержит `traceId` — его копируют в фильтр Kibana/Grafana.

---

## Logstash (`docker-elk-main/logstash/pipeline/logstash.conf`)

### Входы

| Input | Адрес                                      | Формат |
|-------|--------------------------------------------|--------|
| TCP   | `:50000`                                   | JSON   |
| File  | `/usr/share/logstash/logs/application.log` | JSON   |
| Beats | `:5044`                                    | beats  |

Go-приложение использует **TCP** на порту 50000.

### Выход

Запись в Elasticsearch по шаблону `logstash-YYYY.MM.dd`:

```
logstash-2026.04.18
logstash-2026.04.19
...
```

---

## Grafana

**Адрес:** http://localhost:3000  
**Логин:** `admin` / `admin`

### Настройка datasource

Configuration → Data Sources → Add → **Elasticsearch**

| Поле            | Значение                    |
|-----------------|-----------------------------|
| URL             | `http://elasticsearch:9200` |
| Index name      | `logstash-*`                |
| Time field name | `@timestamp`                |
| ES version      | `7.x+`                      |

### Пример: количество логов по времени

1. Создать панель → **Time series**
2. Metric: `Count`
3. Group By: `Date Histogram` → `@timestamp` → Interval: `auto`

### Пример: разбивка по уровням

Добавить Group By: `Terms` → поле `level.keyword`

### Поиск по traceId

В поле **Lucene Query** ввести:
```
traceId:"вставить-id-сюда"
```

---

## Kibana

**Адрес:** http://localhost:5601

1. **Stack Management → Index Patterns → Create** — паттерн `logstash-*`, time field `@timestamp`
2. **Discover** — живой поиск по логам
3. Фильтр по уровню: `level: error`
4. Фильтр по traceId: `traceId: "a1b2c3..."`

---

## Демонстрация traceId

Смысл `traceId` — связать несколько лог-сообщений, относящихся к одной операции.

```bash
# Сделать запрос, получить traceId в ответе
curl "http://localhost:8080/process?userId=alice"
# → {"traceId":"a1b2c3-xxxx","userId":"alice","status":"ok"}

# В Kibana или Grafana вставить этот traceId в фильтр
# и увидеть все 5-7 сообщений одного запроса:
#   INFO  Processing request
#   INFO  Validating request
#   DEBUG Request validated
#   INFO  Querying database
#   WARN  Slow query detected   ← иногда
#   INFO  Calling external service
#   ERROR External service failed ← иногда
#   INFO  Request processed successfully
```

---

## Структура проекта

```
advanced-logging/
├── app/
│   ├── main.go          # Go-приложение
│   ├── go.mod
│   └── Dockerfile
├── docker-elk-main/
│   ├── docker-compose.yml
│   ├── elasticsearch/
│   ├── logstash/
│   │   ├── pipeline/
│   │   │   └── logstash.conf
│   │   └── config/
│   ├── kibana/
│   └── data/
│       └── grafana/     # данные Grafana
└── README.md
```

---

## Интеграция с чатом Nova

Чат-приложение из корня репозитория (`backend/`, `frontend/`) логирует в тот
же ELK-стек через Filebeat. `traceId` коррелирует фронт → бек → LLM в одной
записи.

### Архитектура связки

```
┌────────────────┐     X-Trace-Id    ┌─────────────────┐
│  Frontend      │ ────────────────► │  FastAPI bek    │
│  (clientLogger │  X-Trace-Id       │  structlog→JSON │
│   batch+flush) │ ─POST /_telemetry │  →stdout        │
│                │  /logs──────────► │                 │
└────────────────┘                   └────────┬────────┘
                                              │ docker stdout
                                              ▼
                                     ┌─────────────────┐
                                     │  Filebeat       │
                                     │  (label=elk     │
                                     │   autodiscover) │
                                     └────────┬────────┘
                                              │ beats:5044
                                              ▼
                          Logstash → Elasticsearch (logstash-*)
                                  │
                          ┌───────┴────────┐
                          ▼                ▼
                       Kibana          Grafana
                                       (Nova Overview,
                                        Nova Trace Explorer)
```

### Запуск (две стека, чёткий порядок)

```bash
# 1. Поднять ELK-стек — он создаст docker network "elk"
docker compose -f lab/docker-elk-main/docker-compose.yml up -d

# 2. Поднять чат — он подключится к network elk по метке logging=elk
docker compose -f docker-compose.yml up -d
```

Если сеть `elk` уже занята старым именем (например `docker-elk-main_elk`),
сначала: `docker compose -f lab/docker-elk-main/docker-compose.yml down && docker network rm docker-elk-main_elk`.

### Проверка

1. Открыть http://localhost:5173, залогиниться (письмо с OTP — http://localhost:8025), отправить сообщение в любой чат.
2. **Kibana** http://localhost:5601 → Discover → паттерн `logstash-*`:
   - `source:backend` — записи FastAPI (`request.start`, `request.end`, `auth.*`, `chat.*`, `message.*`)
   - `source:frontend` — записи браузера (`nav`, `user.login`, `user.message_send`, `api.error`, `unhandled.*`)
   - `source:llm` — вызовы модели (`llm.call_start`, `llm.call_end` с `durationMs`)
3. Скопировать любой `traceId` из любой записи в Kibana.
4. **Grafana** http://localhost:3000 (admin/admin) → Dashboards → Nova:
   - **Overview** — req/sec, error count, p95 `durationMs`, разбивка по уровням, топ ошибок.
   - **Trace Explorer** — вставить traceId в переменную сверху → увидеть всю цепочку событий одной операции в хронологическом порядке.

### Что искать в `traceId`-цепочке

Для типичного `POST /api/v1/chats/{id}/messages` ожидаемая последовательность под одним traceId:

```
user.message_send       (frontend)
request.start           (backend, method=POST, path=/api/v1/chats/.../messages)
request.validate_start  (backend)
message.user_saved      (backend)
llm.call_start          (source=llm)
llm.call_end            (source=llm, durationMs=...)
message.assistant_saved (backend)
request.end             (backend, status=200, durationMs=...)
```

Если что-то ломается, в этой же ленте увидишь либо `llm.call_failed` (с `error`), либо `unhandled_exception` (с stack trace), либо `api.error` от фронта.

---

## Полезные команды

```bash
# Список индексов в Elasticsearch
docker exec docker-elk-main-elasticsearch-1 \
  curl -s "http://localhost:9200/_cat/indices?v&s=index"

# Количество документов в индексе
docker exec docker-elk-main-elasticsearch-1 \
  curl -s "http://localhost:9200/logstash-*/_count"

# Последние 5 логов
docker exec docker-elk-main-elasticsearch-1 \
  curl -s "http://localhost:9200/logstash-*/_search?size=5&sort=@timestamp:desc&pretty"

# Логи Logstash (ошибки)
docker logs docker-elk-main-logstash-1 2>&1 | grep -i error | tail -20

# Статус контейнеров
docker compose -f docker-elk-main/docker-compose.yml ps
```
