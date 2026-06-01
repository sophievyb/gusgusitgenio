import { normalize, pick, scoreText, tokenize } from "./text.mjs";

export function createAnswerEngine(state) {
  function rowText(row) {
    return Object.values(row ?? {}).join(" ");
  }

  function getDraftAnswer(row) {
    return pick(row, ["Черновик ответа", "Готовый ответ"]);
  }

  function getSourceText(row) {
    return pick(row, ["Источники", "Источник", "Главный источник"]);
  }

  function getSelfCheckText(row) {
    return pick(row, ["Где посмотреть самому", "Где искать"]);
  }

  function getDirectionTitle(direction) {
    return direction["Название"] || direction.title || direction.name || "";
  }

  function directionValue(direction, keys) {
    for (const key of keys) {
      if (direction?.[key]) return direction[key];
    }
    return "";
  }

  function isSensitiveCase(question) {
    const q = normalize(question);
    return [
      "удар",
      "бьет",
      "бьет",
      "побил",
      "насили",
      "агресс",
      "унижа",
      "оскорб",
      "ссор",
      "конфликт",
      "опасн",
      "безопас",
      "плач",
      "истер",
      "родител",
      "мама",
      "папа",
    ].some((marker) => q.includes(marker));
  }

  function isDirectionQuestion(question) {
    const q = normalize(question);
    return [
      "направлен",
      "курс",
      "программ",
      "возраст",
      "завед",
      "установ",
      "требован",
      "формат",
      "шаблон",
      "пробн",
      "предлож",
    ].some((marker) => q.includes(marker));
  }

  function findDirection(question) {
    const q = normalize(question);
    const tokens = tokenize(question);

    const exact = state.directions.find((direction) => {
      const title = normalize(getDirectionTitle(direction));
      return title && q.includes(title);
    });
    if (exact) return exact;

    if (!isDirectionQuestion(question) || isSensitiveCase(question)) return undefined;

    return state.directions
      .map((direction) => ({
        direction,
        score: scoreText(
          tokens,
          [
            getDirectionTitle(direction),
            direction["Описание направления"],
            direction["Внутренняя заметка"],
            direction["Шаблон"],
          ].join(" "),
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.direction;
  }

  function findKbRow(question) {
    const q = normalize(question);
    const tokens = tokenize(question);
    const hints = [
      ["завед", "Заведующий"],
      ["возраст", "Мин. возраст"],
      ["лет", "Мин. возраст"],
      ["webgl", "WebGL"],
      ["горяч", "горячие клавиши"],
      ["illustrator", "Illustrator"],
      ["vpn", "VPN"],
      ["направлен", "направления"],
      ["удар", "родитель"],
      ["бьет", "родитель"],
      ["насили", "безопасность"],
      ["агресс", "сложные ситуации"],
      ["унижа", "унижении"],
      ["оскорб", "унижении"],
      ["дурак", "дурак"],
      ["ссор", "Ссора родителей"],
      ["конфликт", "конфликт"],
    ];

    return state.knowledgeBase
      .map((row) => {
        const haystack = [
          row.ID,
          pick(row, ["Блок", "Категория"]),
          pick(row, ["Вопрос/сценарий", "Вопрос пользователя", "Нормализованный вопрос"]),
          getDraftAnswer(row),
          getSourceText(row),
          getSelfCheckText(row),
          pick(row, ["Теги", "Заметки"]),
        ].join(" ");
        let score = scoreText(tokens, haystack);
        for (const [needle, boost] of hints) {
          if (q.includes(needle) && normalize(haystack).includes(normalize(boost))) score += 4;
        }
        return { row, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.row;
  }

  function findSheetMatches(question) {
    const tokens = tokenize(question);
    return state.sheetRows
      .map(({ sheet, row }) => ({
        sheet,
        row,
        score: scoreText(tokens, rowText(row)),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function findNotionMatches(question) {
    const tokens = tokenize(question);
    const sensitive = isSensitiveCase(question);
    return state.notionPages
      .map((page) => {
        const text = [page.title, page.url, page.text, page.content, page.plain_text].join(" ");
        const normalizedText = normalize(text);
        let score = scoreText(tokens, text);
        if (sensitive) {
          for (const marker of [
            "советы психолога",
            "сложные ситуации",
            "практические кейсы",
            "родител",
            "безопас",
            "конфликт",
            "агресс",
            "насили",
            "унижа",
          ]) {
            if (normalizedText.includes(marker)) score += 3;
          }
        }
        return {
          title: page.title || "Страница Notion",
          url: page.url || "",
          snippet: String(page.text || page.content || page.plain_text || "").slice(0, 240),
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function buildDirectionAnswer(question, direction) {
    if (!direction) return "";
    const q = normalize(question);
    const title = getDirectionTitle(direction);
    const head = directionValue(direction, ["Заведующий", "head", "manager"]);
    const minAge = directionValue(direction, ["Мин. возраст", "minAge"]);
    const maxAge = directionValue(direction, ["Макс. возраст", "maxAge"]);
    const description = directionValue(direction, ["Описание направления", "description"]);
    const template = directionValue(direction, ["Шаблон", "template"]);
    const note = directionValue(direction, ["Внутренняя заметка", "innerNote"]);
    const os = directionValue(direction, ["ОС", "os"]);
    const tablet = directionValue(direction, ["Планшет", "tablet"]);
    const installer = directionValue(direction, ["Установщик", "installer"]);

    if (q.includes("завед")) {
      return head
        ? `За направление ${title} отвечает ${head}.`
        : `В карточке направления ${title} заведующий не указан.`;
    }

    if (q.includes("возраст") || q.includes("лет")) {
      if (minAge && maxAge) return `На ${title} можно записывать детей с ${minAge} лет, обычно до ${maxAge} лет.`;
      if (minAge) return `На ${title} можно записывать детей с ${minAge} лет.`;
    }

    if (q.includes("установ") || q.includes("требован") || q.includes("ос") || q.includes("webgl")) {
      const parts = [
        os ? `Поддерживаемые ОС: ${os}.` : "",
        tablet ? `Планшеты: ${tablet}.` : "",
        installer ? `Установщик: ${installer}.` : "",
      ].filter(Boolean);
      return parts.length ? parts.join("\n") : "";
    }

    if (template) return template.replaceAll("_ИмяУ_", "ученику");
    if (description) return description;
    if (note) return note.slice(0, 900);
    return "";
  }

  function fillTemplate(answer, row, direction) {
    if (!answer) return "";
    const replacements = new Map([
      ["{направление}", getDirectionTitle(direction)],
      ["{Заведующий из Гены}", directionValue(direction, ["Заведующий", "head"])],
      ["{minAge}", directionValue(direction, ["Мин. возраст", "minAge"])],
      ["{maxAge}", directionValue(direction, ["Макс. возраст", "maxAge"])],
      ["{operationSystems}", directionValue(direction, ["ОС", "os"])],
      ["{tabletSystems или “не указаны”}", directionValue(direction, ["Планшет", "tablet"]) || "не указаны"],
      ["{languages}", directionValue(direction, ["Языки", "languages"])],
      ["{visibleLanguages}", directionValue(direction, ["Языки", "languages"])],
    ]);

    let output = answer;
    for (const [token, value] of replacements) {
      output = output.replaceAll(token, value || "");
    }

    const selfCheck = getSelfCheckText(row);
    if (selfCheck && output.includes("{")) {
      output += `\n\nДля проверки деталей: ${selfCheck}.`;
    }

    return output.replace(/\n{3,}/g, "\n\n").trim();
  }

  function answerQuestion(question) {
    const sensitive = isSensitiveCase(question);
    const direction = sensitive ? undefined : findDirection(question);
    const kbRow = findKbRow(question);
    const sheetMatches = findSheetMatches(question);
    const notionMatches = findNotionMatches(question);
    const directionAnswer = buildDirectionAnswer(question, direction);
    const kbAnswer = fillTemplate(getDraftAnswer(kbRow), kbRow, direction);
    const notionAnswer = notionMatches[0]?.snippet;

    const answer =
      kbAnswer ||
      (sensitive ? notionAnswer || directionAnswer : directionAnswer || notionAnswer) ||
      "Пока не нашла готовый ответ в подключенных источниках. Лучше уточнить формулировку или добавить этот сценарий в базу знаний.";

    const sources = [];
    if (kbRow) {
      sources.push({
        type: "table",
        title: `Таблица: вопрос ${kbRow.ID || "без ID"}`,
        detail: [pick(kbRow, ["Категория", "Блок"]), getSourceText(kbRow), getSelfCheckText(kbRow)]
          .filter(Boolean)
          .join(" | "),
      });
    }
    for (const match of sheetMatches.slice(0, 3)) {
      const title =
        pick(match.row, ["Вопрос пользователя", "Демо-вопрос", "Объект", "Название", "Нормализованный вопрос"]) ||
        "строка таблицы";
      sources.push({
        type: "sheet",
        title: `${match.sheet}: ${title}`,
        detail: `совпадение: ${match.score}`,
      });
    }
    if (notionMatches.length) {
      sources.push({
        type: "notion",
        title: `Notion: ${notionMatches[0].title}`,
        detail: notionMatches[0].url || "локальный индекс Notion",
      });
    }
    if (direction) {
      sources.push({
        type: "gena",
        title: `Гена: ${getDirectionTitle(direction)}`,
        detail: [
          directionValue(direction, ["Заведующий", "head"]) &&
            `заведующий: ${directionValue(direction, ["Заведующий", "head"])}`,
          directionValue(direction, ["Мин. возраст", "minAge"]) &&
            `возраст: ${directionValue(direction, ["Мин. возраст", "minAge"])}-${directionValue(direction, ["Макс. возраст", "maxAge"])} лет`,
        ]
          .filter(Boolean)
          .join(", "),
      });
    }

    return {
      answer,
      matchedQuestion: pick(kbRow, ["Вопрос/сценарий", "Вопрос пользователя", "Нормализованный вопрос"]),
      direction: direction ? getDirectionTitle(direction) : "",
      sources,
      notionMatches,
    };
  }

  return { answerQuestion };
}
