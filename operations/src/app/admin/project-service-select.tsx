"use client";

import { useId } from "react";
import { PROJECT_SERVICE_OPTIONS } from "@/lib/project-services";

export function ProjectServiceSelect() {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <fieldset className="project-service-select" aria-describedby={hintId}>
      <legend>Services *</legend>
      <p id={hintId} className="project-service-hint">
        Choose one or more services for this project.
      </p>
      <div className="project-service-options">
        {PROJECT_SERVICE_OPTIONS.map((service) => (
          <label key={service.id} className="project-service-option">
            <input
              type="checkbox"
              name="serviceTypes"
              value={service.id}
              defaultChecked={service.id === "cctv"}
            />
            <span>{service.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
