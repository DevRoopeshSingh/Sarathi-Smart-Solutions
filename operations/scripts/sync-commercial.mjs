import { copyFileSync } from "node:fs";
copyFileSync(
  new URL("../../server/domain/commercial.mjs", import.meta.url),
  new URL("../src/lib/commercial.mjs", import.meta.url)
);
