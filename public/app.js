const askForm = document.getElementById("askForm");
const searchInput = document.getElementById("searchInput");
const questionBubble = document.getElementById("questionBubble");
const bubbleTime = document.getElementById("bubbleTime");
const replyPreview = document.getElementById("replyPreview");
const sourcesBlock = document.getElementById("sourcesBlock");
const serverMeta = document.getElementById("serverMeta");
const statusLine = document.getElementById("statusLine");
const apiBaseUrl = String(window.ASKITGENIO_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");

function buildApiUrl(path) {
  return `${apiBaseUrl}${path}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateQuestionBubble(text) {
  questionBubble.textContent = text;
  const now = new Date();
  bubbleTime.textContent = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSources(sources = [], notionMatches = []) {
  const parts = [];

  if (sources.length) {
    parts.push(`
      <details class="sources-box" open>
        <summary>Источники</summary>
        <ul>
          ${sources
            .map(
              (source) => `
                <li>
                  <strong>${escapeHtml(source.title || source.type || "Источник")}</strong>
                  ${source.detail ? `<span>${escapeHtml(source.detail)}</span>` : ""}
                </li>
              `,
            )
            .join("")}
        </ul>
      </details>
    `);
  }

  if (notionMatches.length) {
    parts.push(`
      <details class="sources-box">
        <summary>Похожие заметки Notion</summary>
        <ul>
          ${notionMatches
            .map(
              (item) => `
                <li>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.snippet)}</span>
                </li>
              `,
            )
            .join("")}
        </ul>
      </details>
    `);
  }

  sourcesBlock.innerHTML = parts.join("");
}

async function ask(question) {
  updateQuestionBubble(question);
  replyPreview.textContent = "Ищу ответ по базе, направлениям Гены и заметкам Notion...";
  sourcesBlock.innerHTML = "";

  try {
    const response = await fetch(buildApiUrl("/api/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    replyPreview.textContent = data.answer;
    renderSources(data.sources, data.notionMatches);
    serverMeta.textContent = data.direction
      ? `Найдено направление: ${data.direction}`
      : data.matchedQuestion
        ? `Найден сценарий: ${data.matchedQuestion}`
        : "Ответ собран из подключённых источников";
  } catch (error) {
    replyPreview.textContent = "Не смогла получить ответ от локального сервера.";
    sourcesBlock.innerHTML = `<div class="sources-box error-box">${escapeHtml(error.message)}</div>`;
    serverMeta.textContent = "Ошибка соединения";
  }
}

askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = searchInput.value.trim();
  if (!question) return;
  ask(question);
});

async function loadStatus() {
  try {
    const response = await fetch(buildApiUrl("/api/status"));
    const data = await response.json();

    const sources = [];
    if (data.genaConfigured) sources.push("API ITGenio");
    if (data.notionConfigured) sources.push("Notion");
    if (data.openaiConfigured) sources.push(`GPT (${data.model})`);

    statusLine.textContent = sources.length
      ? sources.join(", ")
      : "API ITGenio, Notion и GPT";

    serverMeta.textContent = data.missingConfig?.length
      ? `Не хватает ключей: ${data.missingConfig.join(", ")}`
      : "Источники подключены";
  } catch {
    statusLine.textContent = "API ITGenio, Notion и GPT";
    serverMeta.textContent = "Не удалось загрузить статус";
  }
}

loadStatus();
ask(questionBubble.textContent);
