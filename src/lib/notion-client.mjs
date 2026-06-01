import { normalize, tokenize } from "./text.mjs";

export function createNotionClient(config) {
  async function request(endpoint, body) {
    if (!config.notionApiKey) {
      throw new Error("NOTION_API_KEY is missing");
    }

    const response = await fetch(`https://api.notion.com${endpoint}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${config.notionApiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": config.notionApiVersion,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Notion API error: HTTP ${response.status}`);
    }
    return data;
  }

  async function searchPages(query) {
    const data = await request("/v1/search", {
      query,
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 5,
    });
    return (data.results || []).map((page) => ({
      id: page.id,
      title: extractPageTitle(page),
      url: page.url || "",
      last_edited_time: page.last_edited_time,
    }));
  }

  async function retrievePage(pageId) {
    const page = await request(`/v1/pages/${pageId}`);
    return {
      id: page.id,
      title: extractPageTitle(page),
      url: page.url || "",
      last_edited_time: page.last_edited_time,
    };
  }

  function extractPageTitle(page) {
    const property = Object.values(page.properties || {}).find((value) => value?.type === "title");
    return property?.title?.map((item) => item.plain_text).join("") || "Страница Notion";
  }

  function extractTextFromBlock(block) {
    const payload = block[block.type];
    const richText = payload?.rich_text;
    if (Array.isArray(richText) && richText.length) {
      return richText.map((item) => item.plain_text || "").join(" ");
    }
    return payload?.caption?.map((item) => item.plain_text || "").join(" ") || "";
  }

  async function fetchBlockChildren(blockId) {
    const data = await request(`/v1/blocks/${blockId}/children?page_size=50`);
    return data.results || [];
  }

  async function fetchPageSnippet(pageId, depth = 2) {
    async function walk(blockId, remainingDepth) {
      const blocks = await fetchBlockChildren(blockId);
      const fragments = [];
      for (const block of blocks) {
        const text = extractTextFromBlock(block);
        if (text) fragments.push(text);
        if (block.has_children && remainingDepth > 0) {
          fragments.push(...(await walk(block.id, remainingDepth - 1)));
        }
        if (fragments.join(" ").length > 1200) break;
      }
      return fragments;
    }

    const fragments = await walk(pageId, depth);
    return fragments.join("\n").slice(0, 1200);
  }

  function rerankPages(question, pages) {
    const q = normalize(question);
    const qTokens = tokenize(question);
    return pages
      .map((page) => {
        const haystack = normalize(`${page.title} ${page.url}`);
        let score = 0;
        if (haystack && q.includes(haystack)) score += 40;
        for (const token of qTokens) {
          if (haystack.includes(token)) score += token.length >= 5 ? 8 : 4;
        }
        return { ...page, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  return { searchPages, retrievePage, fetchPageSnippet, rerankPages };
}
