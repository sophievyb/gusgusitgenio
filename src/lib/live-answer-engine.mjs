export function createLiveAnswerEngine({ genaClient, notionClient, openaiClient }) {
  function buildFallbackAnswer(question, skill, notionMatches, modelError) {
    const lines = [];

    if (skill?.title) {
      const age =
        skill.minAge && skill.maxAge
          ? ` Обычно его рекомендуют детям примерно от ${skill.minAge} до ${skill.maxAge} лет.`
          : skill.minAge
            ? ` Обычно его рекомендуют от ${skill.minAge} лет.`
            : "";
      lines.push(`По данным ITGenio, вам подходит направление «${skill.title}».${age}`);
    }

    if (skill?.desc) {
      lines.push(skill.desc.trim());
    }

    if (skill?.note) {
      lines.push(`Важно: ${skill.note.trim()}`);
    }

    if (!lines.length && notionMatches.length) {
      lines.push(`Нашла материалы в Notion по запросу «${question}». Ниже приложила источник, чтобы можно было быстро открыть и проверить детали.`);
    }

    if (!lines.length) {
      lines.push("Я нашла только часть информации в подключённых источниках. Ниже приложила найденные материалы, чтобы можно было быстро уточнить ответ.");
    }

    if (modelError) {
      lines.push("Сейчас отвечаю без GPT, потому что генерация временно недоступна.");
    }

    return lines.join(" ");
  }

  function formatSkill(skill) {
    if (!skill) return "";
    const parts = [
      skill.title ? `Направление: ${skill.title}` : "",
      skill.desc ? `Описание: ${skill.desc}` : "",
      skill.minAge ? `Возраст: от ${skill.minAge}${skill.maxAge ? ` до ${skill.maxAge}` : ""}` : "",
      skill.lessonsFormats ? `Формат: ${JSON.stringify(skill.lessonsFormats)}` : "",
      skill.operationSystems ? `ОС: ${JSON.stringify(skill.operationSystems)}` : "",
      skill.tabletSystems ? `Планшеты: ${JSON.stringify(skill.tabletSystems)}` : "",
      skill.note ? `Заметки: ${skill.note}` : "",
      skill.downloadLink ? `Материалы: ${skill.downloadLink}` : "",
      skill.tildaLinkForParent ? `Страница для родителя: ${skill.tildaLinkForParent}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  }

  async function answerQuestion(question) {
    const skills = await genaClient.listSkills();
    const skill = genaClient.matchSkill(question, skills);

    let searchPages = await notionClient.searchPages(question);
    if (!searchPages.length && process.env.NOTION_ROOT_PAGE_ID) {
      try {
        searchPages = [await notionClient.retrievePage(process.env.NOTION_ROOT_PAGE_ID)];
      } catch {
        searchPages = [];
      }
    }

    const foundPages = notionClient.rerankPages(question, searchPages)
      .filter((page) => page.score > 0)
      .slice(0, 3);

    if (!foundPages.length && process.env.NOTION_ROOT_PAGE_ID) {
      try {
        const rootPage = await notionClient.retrievePage(process.env.NOTION_ROOT_PAGE_ID);
        foundPages.push({ ...rootPage, score: 1 });
      } catch {
        // Ignore root page fallback failures and continue with other sources.
      }
    }

    const notionMatches = await Promise.all(
      foundPages.map(async (page) => ({
        title: page.title,
        url: page.url,
        snippet: await notionClient.fetchPageSnippet(page.id),
      })),
    );

    const genaContext = formatSkill(skill);
    const notionContext = notionMatches
      .map((match, index) => `Страница ${index + 1}: ${match.title}\n${match.snippet}`)
      .join("\n\n");

    let modelReply = null;
    let modelError = null;

    try {
      modelReply = await openaiClient.generateAnswer({
        question,
        genaContext,
        notionContext,
      });
    } catch (error) {
      modelError = error;
    }

    const sources = [];
    if (skill) {
      sources.push({
        type: "gena",
        title: `Gena API: ${skill.title || skill.skillId}`,
        detail: skill.minAge
          ? `возраст: ${skill.minAge}${skill.maxAge ? `-${skill.maxAge}` : "+"}`
          : "найдено по live API",
      });
    }
    for (const match of notionMatches) {
      sources.push({
        type: "notion",
        title: `Notion API: ${match.title}`,
        detail: match.url,
      });
    }

    return {
      answer: modelReply?.text || buildFallbackAnswer(question, skill, notionMatches, modelError),
      matchedQuestion: "",
      direction: skill?.title || "",
      sources,
      notionMatches,
      model: configSafeModel(modelReply, modelError, skill, notionMatches),
    };
  }

  function configSafeModel(modelReply, modelError, skill, notionMatches) {
    return {
      responseId: modelReply?.id || "",
      providerOk: Boolean(modelReply),
      error: modelError
        ? {
            message: modelError.message,
            type: modelError.type || "",
            code: modelError.code || "",
            status: modelError.status || 0,
          }
        : null,
      usedGena: Boolean(skill),
      usedNotion: notionMatches.length,
    };
  }

  return { answerQuestion };
}
