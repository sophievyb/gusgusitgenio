import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

function loadDotEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile();

export function getConfig() {
  return {
    port: Number(process.env.PORT || 5177),
    corsAllowOrigin: process.env.CORS_ALLOW_ORIGIN || "*",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-5.2",
    genaBaseUrl: process.env.GENA_BASE_URL || "https://portal.itgen.io",
    genaToken: process.env.GENA_TOKEN || "",
    notionApiKey: process.env.NOTION_API_KEY || "",
    notionApiVersion: process.env.NOTION_API_VERSION || "2026-03-11",
    notionRootPageId: process.env.NOTION_ROOT_PAGE_ID || "",
  };
}

export function getMissingConfig(config) {
  const missing = [];
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.genaToken) missing.push("GENA_TOKEN");
  if (!config.notionApiKey) missing.push("NOTION_API_KEY");
  return missing;
}
