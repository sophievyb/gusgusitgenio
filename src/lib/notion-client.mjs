import { normalize, tokenize } from "./text.mjs";

export function createNotionClient(config) {
  let treeCache = null;
  let treeCacheTs = 0;
  const TREE_CACHE_TTL_MS = 10 * 60 * 1000;

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
      page_size: 10,
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
    if (block.type === "child_page") {
      return block.child_page?.title || "";
    }
    if (block.type === "child_database") {
      return block.child_database?.title || "";
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

  async function buildRootTreeIndex() {
    if (!config.notionRootPageId) return [];

    const now = Date.now();
    if (treeCache && now - treeCacheTs < TREE_CACHE_TTL_MS) {
      return treeCache;
    }

    const pages = [];
    const seen = new Set();
    const toPublicUrl = (id) => `https://www.notion.so/${String(id || "").replaceAll("-", "")}`;

    async function walkPage(pageId, pageTitle = "", depth = 0, maxDepth = 3) {
      if (!pageId || seen.has(pageId) || depth > maxDepth) return;
      seen.add(pageId);

      const snippet = depth === 0 ? await fetchPageSnippet(pageId, 0) : "";
      const title = pageTitle || "Страница Notion";
      const url = toPublicUrl(pageId);

      pages.push({
        id: pageId,
        title,
        url,
        snippet,
        depth,
      });

      const blocks = await fetchBlockChildren(pageId);
      for (const block of blocks) {
        if (block.type === "child_page") {
          await walkPage(block.id, block.child_page?.title || "", depth + 1, maxDepth);
        }
      }
    }

    await walkPage(config.notionRootPageId, "", 0, 3);
    treeCache = pages;
    treeCacheTs = now;
    return pages;
  }

  async function searchWithinRootTree(query) {
    const pages = await buildRootTreeIndex();
    return rerankPages(query, pages).filter((page) => page.score > 0).slice(0, 8);
  }

  function scorePage(question, page) {
    const q = normalize(question);
    const qTokens = tokenize(question);
    const haystack = normalize(`${page.title} ${page.snippet || ""} ${page.url}`);
    const title = normalize(page.title);
    let score = 0;

    if (title && q.includes(title)) score += 80;
    for (const token of qTokens) {
      if (title.includes(token)) score += token.length >= 5 ? 14 : 8;
      else if (haystack.includes(token)) score += token.length >= 5 ? 8 : 4;
    }

    return score;
  }

  function rerankPages(question, pages) {
    return pages
      .map((page) => ({ ...page, score: scorePage(question, page) }))
      .sort((a, b) => b.score - a.score);
  }

  return { searchPages, retrievePage, fetchPageSnippet, rerankPages, searchWithinRootTree, scorePage };
}
