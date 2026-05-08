import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("./src", import.meta.url).pathname;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }

    if (!path.endsWith(".ts")) {
      continue;
    }

    const before = readFileSync(path, "utf8");
    const after = before.replace(/from "(\.[^"]+?)";/g, (match, specifier) => {
      if (specifier.endsWith(".js") || specifier.endsWith(".json")) {
        return match;
      }
      return `from "${specifier}.js";`;
    });

    if (after !== before) {
      writeFileSync(path, after);
    }
  }
}

walk(root);
