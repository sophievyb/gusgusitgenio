# AskITGenio Pages Upload

Это пакет только для GitHub Pages.

Что загрузить в репозиторий:

- папку `docs/` целиком

Что поменять перед публикацией:

1. Откройте `docs/config.js`
2. Впишите адрес вашего backend

Пример:

```js
window.ASKITGENIO_CONFIG = {
  apiBaseUrl: "https://your-backend.example.com",
};
```

Как включить Pages:

1. `Settings` → `Pages`
2. `Source` → `Deploy from a branch`
3. `Branch` → `main`
4. `Folder` → `/docs`
5. `Save`

Важно: GitHub Pages публикует только интерфейс. Для ответов бота нужен отдельно запущенный backend с API.
