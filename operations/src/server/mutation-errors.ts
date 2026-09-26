import "server-only";
import { randomUUID } from "node:crypto";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class AccessDeniedError extends Error {
  constructor() {
    super("Administrator access is required.");
    this.name = "AccessDeniedError";
  }
}

export function mutationFailure(error: unknown): { error: string } {
  if (error instanceof InputError || error instanceof AccessDeniedError) {
    return { error: error.message };
  }
  const reference = randomUUID();
  const candidate = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const code =
    typeof candidate === "string" && /^[0-9A-Z]{5}$/.test(candidate) ? candidate : "UNKNOWN";
  // Do not log SQL, parameters, driver messages, customer data, or credentials.
  console.error(JSON.stringify({ event: "admin_mutation_failed", reference, code }));
  return { error: `Unable to save this change. Reference: ${reference}` };
}
