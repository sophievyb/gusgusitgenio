# AskITGenio Clean

Чистая версия локального бота AskITGenio с интерфейсом "гуся".

## Что внутри

- `src/` — live backend
- `public/` — интерфейс с гусем
- `public/assets/` — ассеты гуся
- `data/` — старые локальные выгрузки, их можно использовать как резерв
- `scripts/` — проверки конфигурации и smoke tests

## Запуск

```bash
cd /Users/sophie/Documents/Codex/2026-06-01/files-mentioned-by-the-user-pasted/outputs/AskITGenio_clean
npm start
```

Откройте [http://localhost:5177](http://localhost:5177).

## Live-режим

Бот отвечает через:

- `GENA API`
- `Notion API`
- `OpenAI Responses API`

Нужны переменные окружения из `.env.example`:

- `OPENAI_API_KEY`
- `GENA_TOKEN`
- `NOTION_API_KEY`
- `CORS_ALLOW_ORIGIN` — домен фронта, если интерфейс будет жить отдельно, например на GitHub Pages

Опционально:

- `OPENAI_MODEL`
- `GENA_BASE_URL`
- `NOTION_API_VERSION`
- `NOTION_ROOT_PAGE_ID`

## GitHub Pages

Если публикуете только интерфейс на GitHub Pages, в `public/config.js` или `docs/config.js`
нужно прописать адрес backend, например:

```js
window.ASKITGENIO_CONFIG = {
  apiBaseUrl: "https://your-backend.example.com",
};
```

## Проверка

```bash
npm run check:live
```

Если хотите запускать старые локальные тесты по выгрузкам:

```bash
npm run test:smoke
```
