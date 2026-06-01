import assert from "node:assert/strict";

import { loadState } from "../src/lib/data-store.mjs";
import { createAnswerEngine } from "../src/lib/answer-engine.mjs";

const state = await loadState();
const engine = createAnswerEngine(state);

const cases = [
  "С какого возраста можно записать на Python?",
  "Кто заведующий Scratch?",
  "У ученика Scratch пишет WebGL not supported",
  "Как установить VPN?",
];

for (const question of cases) {
  const result = engine.answerQuestion(question);
  assert.ok(result.answer && result.answer.length > 10, `Empty answer for: ${question}`);
  assert.ok(Array.isArray(result.sources), `No sources array for: ${question}`);
  console.log(`OK: ${question}`);
  console.log(result.answer.slice(0, 180));
}
