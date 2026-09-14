/**
 * Sarathi Smart Solutions - Solution Planner UI Controller
 *
 * Handles accessible multi-step navigation, input validation, state preservation,
 * safe DOM rendering (zero innerHTML), clipboard copying, and WhatsApp dispatch.
 */

import {
  buildRecommendation,
  SIZE_OPTIONS,
  CONTACT_CONFIG,
  buildWhatsAppUrl
} from "./recommendation.mjs";

export { CONTACT_CONFIG };

// DOM Element References
const form = document.querySelector("#solutionForm");
const steps = [...document.querySelectorAll(".form-step")];
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const stepLabel = document.querySelector("#stepLabel");
const stepName = document.querySelector("#stepName");
const progressBar = document.querySelector("#progressBar");
const progressTrack = document.querySelector(".progress-track");
const progressWrap = document.querySelector(".progress-wrap");
const sizeGrid = document.querySelector("#sizeGrid");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#result-title");
const resultIntro = document.querySelector("#resultIntro");
const summaryText = document.querySelector("#summaryText");
const recommendationList = document.querySelector("#recommendationList");
const whatsappButton = document.querySelector("#whatsappButton");
const copyButton = document.querySelector("#copyButton");
const shareButton = document.querySelector("#shareButton");
const resetButton = document.querySelector("#resetButton");
const copyStatus = document.querySelector("#copyStatus");

const STEP_NAMES = Object.freeze(["Your space", "Your needs", "Setup size"]);
const TOTAL_STEPS = 3;

let currentStep = 1;
let currentRenderedSpace = "";

/**
 * Retrieves the checked radio value for a given field name.
 * @param {string} name
 * @returns {string}
 */
function checkedValue(name) {
  return form?.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
}

/**
 * Retrieves all checked values for a checkbox group.
 * @param {string} name
 * @returns {string[]}
 */
function checkedValues(name) {
  if (!form) return [];
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

/**
 * Sets or clears the accessible error message for the current step.
 * @param {string} [message=""]
 */
function setError(message = "") {
  if (!steps[currentStep - 1]) return;
  const errorEl = steps[currentStep - 1].querySelector(".form-error");
  if (errorEl) {
    errorEl.textContent = message;
  }
}

/**
 * Dynamically builds size radio cards using safe DOM methods.
 * Preserves user's previous selection if valid for the space.
 * @param {string} space - 'Home' or 'Business'
 */
function renderSizes(space) {
  if (!sizeGrid || !SIZE_OPTIONS[space]) return;

  const previouslySelected = checkedValue("size");
  const options = SIZE_OPTIONS[space];

  const cards = options.map((option) => {
    const label = document.createElement("label");
    label.className = "size-card";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "size";
    input.value = option.value;
    input.setAttribute("aria-describedby", "sizeHelp");
    if (option.value === previouslySelected) {
      input.checked = true;
    }

    const check = document.createElement("span");
    check.className = "choice-check";
    check.setAttribute("aria-hidden", "true");

    const strong = document.createElement("strong");
    strong.textContent = option.title;

    const small = document.createElement("small");
    small.textContent = option.description;

    label.append(input, check, strong, small);
    return label;
  });

  sizeGrid.replaceChildren(...cards);
  currentRenderedSpace = space;
}

/**
 * Updates the text and arrow of the Next button safely without innerHTML.
 * @param {boolean} isFinalStep
 */
function updateNextButton(isFinalStep) {
  if (!nextButton) return;
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = " →";

  const buttonText = isFinalStep ? "See my recommendation" : "Continue";
  nextButton.replaceChildren(document.createTextNode(buttonText), arrow);
}

/**
 * Displays the specified step, managing focus, ARIA progress, and button states.
 * @param {number} step
 */
function showStep(step) {
  currentStep = step;

  // Toggle active class on step fieldsets
  steps.forEach((panel, index) => {
    panel.classList.toggle("active", index === step - 1);
  });

  // Update step indicators
  if (stepLabel) stepLabel.textContent = `Step ${step} of ${TOTAL_STEPS}`;
  if (stepName) stepName.textContent = STEP_NAMES[step - 1];

  // Update accessible progress bar
  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  if (progressBar) progressBar.style.width = `${progressPercent}%`;
  if (progressTrack) {
    progressTrack.setAttribute("aria-valuenow", String(step));
    progressTrack.setAttribute(
      "aria-valuetext",
      `Step ${step} of ${TOTAL_STEPS}: ${STEP_NAMES[step - 1]}`
    );
  }

  // Toggle Back button visibility
  if (backButton) backButton.classList.toggle("hidden", step === 1);

  // Update Next button label
  updateNextButton(step === TOTAL_STEPS);

  // Clear any existing error
  setError();

  // Move screen reader focus cleanly to the step legend
  const currentLegend = steps[step - 1]?.querySelector("legend");
  if (currentLegend) {
    currentLegend.focus();
  }
}

/**
 * Validates whether the user has answered the current step's required question.
 * @returns {boolean}
 */
function validateCurrentStep() {
  if (currentStep === 1 && !checkedValue("space")) {
    setError("Please choose Home or Business to continue.");
    const firstRadio = steps[0]?.querySelector('input[type="radio"]');
    firstRadio?.focus();
    return false;
  }
  if (currentStep === 2 && checkedValues("needs").length === 0) {
    setError("Please select at least one service need.");
    const firstCheckbox = steps[1]?.querySelector('input[type="checkbox"]');
    firstCheckbox?.focus();
    return false;
  }
  if (currentStep === 3 && !checkedValue("size")) {
    setError("Please choose an approximate setup size.");
    const firstSizeRadio = sizeGrid?.querySelector('input[type="radio"]');
    firstSizeRadio?.focus();
    return false;
  }
  setError();
  return true;
}

/**
 * Renders recommendation items and enquiry text using safe DOM construction.
 */
function renderResult() {
  const space = checkedValue("space");
  const needs = checkedValues("needs");
  const size = checkedValue("size");

  let recommendation;
  try {
    recommendation = buildRecommendation({ space, needs, size });
  } catch {
    setError("Unable to build recommendation. Please check your selections.");
    return;
  }

  if (resultTitle) resultTitle.textContent = recommendation.title;
  if (resultIntro) resultIntro.textContent = recommendation.intro;
  if (summaryText) summaryText.textContent = recommendation.summary;

  if (recommendationList) {
    const items = recommendation.items.map((item, index) => {
      const row = document.createElement("div");
      row.className = "recommendation-item";

      const badge = document.createElement("span");
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = String(index + 1).padStart(2, "0");

      const body = document.createElement("div");
      const titleEl = document.createElement("strong");
      titleEl.textContent = item.title;

      const detailEl = document.createElement("small");
      detailEl.textContent = item.detail;

      body.append(titleEl, detailEl);
      row.append(badge, body);
      return row;
    });

    recommendationList.replaceChildren(...items);
  }

  // Populate safe WhatsApp link
  if (whatsappButton) {
    whatsappButton.href = buildWhatsAppUrl(CONTACT_CONFIG.whatsappNumber, recommendation.summary);
  }

  // Swap view from form to result
  if (form) form.classList.add("hidden");
  if (progressWrap) progressWrap.classList.add("hidden");
  if (result) {
    result.classList.remove("hidden");
    result.focus();
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Event Listeners
nextButton?.addEventListener("click", () => {
  if (!validateCurrentStep()) return;

  const selectedSpace = checkedValue("space");
  if (currentStep === 1) {
    // Only re-render sizes if space changed or not yet rendered
    if (currentRenderedSpace !== selectedSpace) {
      renderSizes(selectedSpace);
    }
  }

  if (currentStep < TOTAL_STEPS) {
    showStep(currentStep + 1);
  } else {
    renderResult();
  }
});

backButton?.addEventListener("click", () => {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
});

// Clear error automatically whenever any form input changes
form?.addEventListener("change", () => {
  setError();
  // If user changed space while on Step 1, keep sizeGrid synced
  if (currentStep === 1) {
    const newSpace = checkedValue("space");
    if (newSpace && newSpace !== currentRenderedSpace) {
      renderSizes(newSpace);
    }
  }
});

// Copy enquiry summary to clipboard
copyButton?.addEventListener("click", async () => {
  const summary = summaryText?.textContent ?? "";
  if (!summary) return;

  try {
    await navigator.clipboard.writeText(summary);
    if (copyStatus) {
      copyStatus.textContent =
        "Enquiry summary copied! You can paste it into WhatsApp, SMS, or email.";
    }
  } catch {
    if (copyStatus) {
      copyStatus.textContent = "Please select the enquiry summary text above and copy it manually.";
    }
  }
});

// Web Share API with clipboard fallback
shareButton?.addEventListener("click", async () => {
  const summary = summaryText?.textContent ?? "";
  if (!summary) return;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Sarathi Smart Solutions Enquiry",
        text: summary
      });
      if (copyStatus) {
        copyStatus.textContent = "Share sheet opened — choose your preferred app to send.";
      }
    } catch (error) {
      if (error && error.name !== "AbortError" && copyStatus) {
        copyStatus.textContent = "Unable to open share sheet. Please use 'Copy enquiry summary'.";
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(summary);
      if (copyStatus) {
        copyStatus.textContent =
          "Sharing is not supported on this browser; summary copied to clipboard instead.";
      }
    } catch {
      if (copyStatus) {
        copyStatus.textContent =
          "Please select the enquiry summary text above and copy it manually.";
      }
    }
  }
});

// Reset planner to initial state
resetButton?.addEventListener("click", () => {
  if (form) form.reset();
  currentRenderedSpace = "";
  if (sizeGrid) sizeGrid.replaceChildren();
  if (result) result.classList.add("hidden");
  if (form) form.classList.remove("hidden");
  if (progressWrap) progressWrap.classList.remove("hidden");
  if (copyStatus) copyStatus.textContent = "";
  showStep(1);
});

// Initialise form at Step 1
showStep(1);
