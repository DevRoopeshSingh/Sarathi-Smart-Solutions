import { SERVICE_CATALOGUE } from "./recommendation.mjs";

export const PROJECT_SERVICE_OPTIONS: readonly { id: string; label: string }[] = Object.freeze(
  Object.entries(SERVICE_CATALOGUE).map(([id, service]) =>
    Object.freeze({ id, label: service.label })
  )
);

export function isProjectService(value: unknown): value is string {
  return typeof value === "string" && Object.hasOwn(SERVICE_CATALOGUE, value);
}

export function getProjectServiceLabel(id: string): string {
  return isProjectService(id) ? SERVICE_CATALOGUE[id].label : id;
}
