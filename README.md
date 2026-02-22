# MXT223 — расписание и рейтинги

Веб-приложение для группы МХТ-223: расписание, рейтинги преподавателей, профиль, PWA, push-уведомления.

## Стек

- **Backend:** FastAPI, PostgreSQL / SQLite (databases), JWT, APScheduler
- **Frontend:** статические HTML/CSS/JS, PWA (manifest, Service Worker)
- **Deploy:** Heroku (Procfile), опционально Sentry

## Быстрый старт

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Отредактировать .env (JWT_SECRET_KEY, при необходимости DATABASE_URL, VAPID)
make run
# или: python -m uvicorn app.main:app --reload
```

Открыть: http://127.0.0.1:8000

**Makefile:** `make run` | `make test` | `make lint` | `make format` | `make install-dev`

## Переменные окружения (.env)

| Переменная | Описание |
|------------|----------|
| `ENV` | `development` (по умолчанию) или `production`. В production приложение не запустится без своего `JWT_SECRET_KEY`. |
| `DATABASE_URL` | SQLite: `sqlite:///./schedule.db` или PostgreSQL URL |
| `JWT_SECRET_KEY` | Секрет для JWT (обязательно свой в продакшене) |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Push-уведомления (скрипт: `python scripts/generate_vapid_keys.py`) |
| `SENTRY_DSN` | Опционально: мониторинг ошибок |
| `CORS_ORIGINS` | Опционально: через запятую (например `https://mxt223.com`). Пусто = все origins |
| `LOG_LEVEL` | Опционально: `DEBUG`, `INFO`, `WARNING`, `ERROR` (по умолчанию `INFO`) |
| `CACHE_TTL_SECONDS` | TTL кэша для schedule/subjects (по умолчанию 300) |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Лимит запросов на логин/refresh (по умолчанию 5 за 60 сек) |
| `API_RATE_LIMIT_REQUESTS` / `API_RATE_LIMIT_WINDOW_SECONDS` | Глобальный лимит на все API по IP (по умолчанию 120 за 60 сек) |
| `REDIS_URL` | Опционально: URL Redis для кэша расписания и проверки в `/health` |
| `JWT_ACCESS_EXPIRE_MINUTES` / `JWT_REFRESH_EXPIRE_DAYS` | Срок жизни access/refresh токенов (по умолчанию 15 мин / 7 дней) |
| `DATABASE_CONNECT_TIMEOUT` | Таймаут подключения к БД в секундах (PostgreSQL; по умолчанию 10) |
| `AVATAR_MAX_LENGTH` | Макс. длина имени аватара (по умолчанию 64) |

## Health и метрики

- **`GET /health/live`** — liveness (без БД). В ответе: `status`, `version`, `env`.
- **`GET /health`** — readiness: при доступной БД — `200` и `database: "connected"`, при недоступной — `503`. Если задан `REDIS_URL`, в ответ добавляется статус Redis.
- **`GET /metrics`** — метрики в формате Prometheus (счётчики запросов и ошибок 5xx).

## Безопасность и наблюдаемость

- На все ответы (включая статику) — заголовки: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.
- В ответе каждого запроса — `X-Request-ID`. В логах — метод, путь, статус, длительность, request_id.
- Единый формат ошибок API: `{"detail", "code", "request_id"}`.
- Rate limit: на `/api/login` и `/api/refresh` — 5 запросов в минуту с IP; на все `/api/*` — по умолчанию 120 запросов в минуту с IP (настраивается через `API_RATE_LIMIT_REQUESTS` и `API_RATE_LIMIT_WINDOW_SECONDS`).
- В `ENV=production` приложение не стартует с дефолтным `JWT_SECRET_KEY`; `/docs` и `/redoc` отключены.
- Аватар: допустимы только имена файлов вида `1.png`, `2.jpg` (буквы, цифры, `-_`, расширения png/jpg/gif/webp).

## Структура проекта

```
app/           # FastAPI: main, config, database, routers, scheduler, middleware, rate_limit
web/           # Статика: HTML, static/css|js, manifest.json, sw.js
utils/         # JWT, auth, cache
scripts/       # Генерация VAPID, сиды
migrations/    # Скрипты миграций БД (по номерам), README с инструкцией
tests/         # Pytest (unit + e2e)
```

## Тесты

```bash
pytest
```

E2E (опционально): `pip install playwright && playwright install chromium`, затем запустить сервер и `pytest tests/e2e/test_frontend.py -v`.

## Docker и деплой

```bash
docker build -t mxt223 .
docker run -p 8000:8000 -e JWT_SECRET_KEY=your-secret -e DATABASE_URL=sqlite:///./schedule.db mxt223
```

В production рекомендуется:
- Прокси (Nginx, Caddy и т.п.) перед приложением с **HTTPS** и по возможности **HTTP/2**.
- Передавать `X-Forwarded-Proto: https` и при необходимости `X-Forwarded-For` для корректного редиректа и rate limit по IP.
- Чек-лист перед релизом: см. [RELEASE.md](RELEASE.md).

## Дополнительно

- **Офлайн:** при отсутствии сети открывается `offline.html` (кэшируется в Service Worker).
- **404:** несуществующие страницы (не `/api/*`) отдают кастомную страницу с ссылкой на главную.
- **Уведомления:** тосты вместо `alert` (логин, профиль, заметки); при 429 показывается «Подождите минуту».
- **Скелетоны:** на главной, в профиле и рейтингах при загрузке отображаются скелетоны.
- **Доступность:** `aria-label`, `role="navigation"`, `aria-current`, видимый фокус (`:focus-visible`).
- **CSP:** заголовок `Content-Security-Policy` ограничивает источники скриптов и стилей.
- **Заметки:** при выводе заметок к занятиям текст экранируется (защита от XSS).
- **Кэш:** для статики в URL версия `?v=1.0.0` (при деплое можно менять).

## Разработка

- **Линтер и формат:** [Ruff](https://docs.astral.sh/ruff/). Конфиг в `pyproject.toml`.
  ```bash
  make install-dev
  make format   # или make lint
  ```
- **Pre-commit:** один раз `pip install pre-commit && pre-commit install` — перед коммитом будут запускаться ruff и проверки (trailing whitespace, large files). Конфиг: `.pre-commit-config.yaml`.
- Версия приложения задаётся в `pyproject.toml` (одно место).

## Папка ios/

Приложение для iOS (Schedy) — отдельный проект. В этом репозитории папка `ios/` в `.gitignore`; хранить и разрабатывать её лучше в отдельном репозитории.
