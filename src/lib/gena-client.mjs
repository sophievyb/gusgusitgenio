import { normalize, tokenize } from "./text.mjs";

export function createGenaClient(config) {
  let skillsCache = null;
  let cacheTs = 0;
  const CACHE_TTL_MS = 10 * 60 * 1000;

  async function call(methodName, params = []) {
    if (!config.genaToken) {
      throw new Error("GENA_TOKEN is missing");
    }

    const response = await fetch(`${config.genaBaseUrl}/api/gena`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        authorization: config.genaToken,
      },
      body: JSON.stringify({ methodName, params }),
    });

    const data = await response.json();
    if (!response.ok || data.status === "error") {
      throw new Error(data.error || `GENA API error: HTTP ${response.status}`);
    }
    return data.result;
  }

  function flattenSkills(rawResult) {
    const items = Array.isArray(rawResult)
      ? rawResult
      : Array.isArray(rawResult?.skills)
        ? rawResult.skills
        : Array.isArray(rawResult?.result)
          ? rawResult.result
          : Object.values(rawResult || {});

    const flat = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;

      if (item.ru && typeof item.ru === "object") {
        flat.push({ skillId: item.skillId || item.id, ...item.ru, raw: item });
        continue;
      }

      if (Array.isArray(item.skills)) {
        for (const nested of item.skills) {
          if (nested?.ru) flat.push({ skillId: nested.skillId || nested.id, ...nested.ru, raw: nested });
          else if (nested) flat.push({ skillId: nested.skillId || nested.id, ...nested, raw: nested });
        }
        continue;
      }

      flat.push({ skillId: item.skillId || item.id, ...item, raw: item });
    }
    return flat.filter((item) => item.title || item.desc || item.note);
  }

  async function listSkills() {
    const now = Date.now();
    if (skillsCache && now - cacheTs < CACHE_TTL_MS) {
      return skillsCache;
    }
    const raw = await call("api.skills.getSkills", []);
    skillsCache = flattenSkills(raw);
    cacheTs = now;
    return skillsCache;
  }

  function matchSkill(question, skills) {
    const q = normalize(question);
    const qTokens = tokenize(question);
    let best = null;
    let bestScore = 0;

    for (const skill of skills) {
      const haystack = normalize(
        [skill.title, skill.desc, skill.note, skill.requiredSkillId, skill.groupId].filter(Boolean).join(" "),
      );
      let score = 0;
      const title = normalize(skill.title);
      if (title && q.includes(title)) score += 100;
      for (const token of qTokens) {
        if (haystack.includes(token)) score += token.length >= 5 ? 10 : 6;
      }
      if (score > bestScore) {
        bestScore = score;
        best = skill;
      }
    }

    return bestScore >= 12 ? best : null;
  }

  return { listSkills, matchSkill };
}
