export function createOpenAIClient(config) {
  function extractOutputText(payload) {
    const output = payload.output || [];
    const chunks = [];
    for (const item of output) {
      for (const content of item.content || []) {
        if (content.type === "output_text" || content.type === "text") {
          chunks.push(content.text || "");
        }
      }
    }
    return chunks.join("\n").trim();
  }

  async function generateAnswer({ question, genaContext, notionContext }) {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const instructions = [
      "Ты — внутренний помощник ITGenio.",
      "Отвечай по-русски.",
      "Пиши живым и понятным языком, без канцелярита.",
      "Используй только факты из переданного контекста.",
      "Если данных не хватает, честно скажи, что точного ответа в источниках нет.",
      "Не придумывай правила, процессы, возраст, VPN-статусы и ответственных.",
      "Дай короткий итог, затем 1-3 предложения с пояснением.",
    ].join(" ");

    const input = [
      "Вопрос пользователя:",
      question,
      "",
      "Контекст из Gena API:",
      genaContext || "Нет релевантных данных из Gena API.",
      "",
      "Контекст из Notion API:",
      notionContext || "Нет релевантных данных из Notion API.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        instructions,
        input,
        store: false,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error?.message || `OpenAI API error: HTTP ${response.status}`);
      error.status = response.status;
      error.type = payload.error?.type || "";
      error.code = payload.error?.code || "";
      throw error;
    }

    return {
      id: payload.id,
      text: extractOutputText(payload),
    };
  }

  return { generateAnswer };
}
