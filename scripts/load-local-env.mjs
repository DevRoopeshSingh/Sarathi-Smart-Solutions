import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Local configuration is optional. Hosting environment values retain precedence.
try {
  loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
