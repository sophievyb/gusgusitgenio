import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig, getMissingConfig } from "./lib/config.mjs";
import { createGenaClient } from "./lib/gena-client.mjs";
import { createNotionClient } from "./lib/notion-client.mjs";
import { createOpenAIClient } from "./lib/openai-client.mjs";
import { createLiveAnswerEngine } from "./lib/live-answer-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const config = getConfig();
const port = config.port;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
]);

const missingConfig = getMissingConfig(config);
const genaClient = createGenaClient(config);
const notionClient = createNotionClient(config);
const openaiClient = createOpenAIClient(config);
const engine = createLiveAnswerEngine({ genaClient, notionClient, openaiClient });

function sanitizePublicAnswer(answer) {
  const { model, ...publicAnswer } = answer;

  if (model && !model.providerOk && model.error?.message) {
    console.warn("OpenAI fallback:", model.error.message);
  }

  return publicAnswer;
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": config.corsAllowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(data, null, 2));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, rawPath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": config.corsAllowOrigin,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/api/status") {
      sendJson(response, {
        mode: "live",
        model: config.openaiModel,
        genaConfigured: Boolean(config.genaToken),
        notionConfigured: Boolean(config.notionApiKey),
        openaiConfigured: Boolean(config.openaiApiKey),
        missingConfig,
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/ask") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const question = String(body.question || "").trim();
      if (!question) {
        sendJson(response, { error: "question is required" }, 400);
        return;
      }
      if (missingConfig.length) {
        sendJson(
          response,
          {
            error: `Missing config: ${missingConfig.join(", ")}`,
            missingConfig,
          },
          400,
        );
        return;
      }
      sendJson(response, sanitizePublicAnswer(await engine.answerQuestion(question)));
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  }
});

server.listen(port, () => {
  console.log(`AskITGenio clean is running at http://localhost:${port}`);
  console.log(`Mode: live, model: ${config.openaiModel}`);
  console.log(`CORS origin: ${config.corsAllowOrigin}`);
  if (missingConfig.length) {
    console.log(`Missing config: ${missingConfig.join(", ")}`);
  }
});
