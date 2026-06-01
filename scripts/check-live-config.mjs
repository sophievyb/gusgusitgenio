import { getConfig, getMissingConfig } from "../src/lib/config.mjs";

const config = getConfig();
const missing = getMissingConfig(config);

if (missing.length) {
  console.log(`Missing config: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Live config looks complete.");
