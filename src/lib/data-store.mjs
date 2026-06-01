import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCsv } from "./csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "..", "data");

export async function loadState() {
  const knowledgeBase = await loadCsv(path.join(dataDir, "AskITGenio_Knowledge_Base.csv"));
  const apiMapping = await loadCsv(path.join(dataDir, "AskITGenio_API_Mapping.csv"));
  const demoScript = await loadCsv(path.join(dataDir, "AskITGenio_Demo_Script.csv"));
  const directions = await loadCsv(path.join(dataDir, "Gena_Directions_public.csv"));
  const notionRaw = JSON.parse(await readFile(path.join(dataDir, "notion_text_index.json"), "utf8"));
  const notionPages = Array.isArray(notionRaw) ? notionRaw : Array.isArray(notionRaw.pages) ? notionRaw.pages : [];

  const sheetRows = [
    ...knowledgeBase.map((row) => ({ sheet: "Knowledge_Base", row })),
    ...apiMapping.map((row) => ({ sheet: "API_Mapping", row })),
    ...demoScript.map((row) => ({ sheet: "Demo_Script", row })),
    ...directions.map((row) => ({ sheet: "Gena_Directions", row })),
  ];

  return {
    knowledgeBase,
    apiMapping,
    demoScript,
    directions,
    notionPages,
    sheetRows,
  };
}
