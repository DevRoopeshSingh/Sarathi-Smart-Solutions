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
  buildWhatsAppUrl,
  SERVICE_CATALOGUE,
  describeEnquiryOptions,
  formatLeadWhatsAppMessage
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
const serviceGrid = document.querySelector("#serviceGrid");
const needGrid = document.querySelector("#needGrid");
const serviceOptions = document.querySelector("#serviceOptions");

const STEP_NAMES = Object.freeze(["Your space", "Your needs", "Setup size"]);
const TOTAL_STEPS = 3;

let currentStep = 1;
let currentRenderedSpace = "";

/** Create catalogue content with DOM APIs, including customer-supplied text. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function serviceIcon(pathData, className) {
  const wrapper = element("span", className);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  wrapper.append(svg);
  return wrapper;
}

/** Render both public cards and selectable needs from the same catalogue. */
function renderCatalogue() {
  Object.entries(SERVICE_CATALOGUE).forEach(([id, entry], index) => {
    const card = element("article", `service-card${index === 0 ? " featured" : ""}`);
    card.dataset.service = id;
    const body = element("div");
    const categoryTag = element(
      "span",
      `service-category-tag ${entry.category === "core" ? "tag-core" : "tag-additional"}`,
      entry.category === "core" ? "Core Solution" : "Additional Service"
    );
    const link = element("a", "service-enquiry", entry.ctaLabel || "Enquire about this service →");
    link.href = "#planner";
    link.setAttribute("aria-label", `Enquire about ${entry.label}`);
    link.addEventListener("click", () => {
      const input = needGrid?.querySelector(`input[value="${id}"]`);
      if (input) input.checked = true;
      form?.classList.remove("hidden");
      result?.classList.add("hidden");
      progressWrap?.classList.remove("hidden");
      syncServiceOptions();
      showStep(checkedValue("space") ? 2 : 1);
    });
    body.append(
      categoryTag,
      element("h4", "", entry.label),
      element("p", "", entry.description),
      link
    );
    const number = element("span", "number", String(index + 1).padStart(2, "0"));
    number.setAttribute("aria-hidden", "true");
    card.append(serviceIcon(entry.icon, "service-icon"), body, number);

    const coreContainer = document.querySelector("#coreServicesContainer");
    const additionalContainer = document.querySelector("#additionalServicesContainer");

    if (entry.category === "core" && coreContainer) {
      coreContainer.append(card);
    } else if (entry.category === "additional" && additionalContainer) {
      additionalContainer.append(card);
    } else {
      serviceGrid?.append(card);
    }

    const choice = element("label", "need-card");
    const input = element("input");
    input.type = "checkbox";
    input.name = "needs";
    input.value = id;
    input.setAttribute("aria-describedby", "needsHelp needsError");
    const check = element("span", "choice-check");
    check.setAttribute("aria-hidden", "true");
    const label = element("span");
    label.append(element("strong", "", entry.label), element("small", "", entry.description));
    choice.append(input, check, serviceIcon(entry.icon, "need-icon"), label);
    needGrid?.append(choice);

    const panel = element("fieldset", "service-options-panel");
    panel.dataset.service = id;
    panel.append(element("legend", "", entry.label));
    entry.fields.forEach((field) => {
      const label = element("label", "enquiry-field", field.label);
      const control = element(field.type === "select" ? "select" : "input");
      control.id = `enquiry-${id}-${field.id}`;
      control.name = `${id}.${field.id}`;
      control.dataset.field = field.id;
      control.setAttribute("aria-describedby", "enquiryHelp sizeError");
      label.htmlFor = control.id;
      if (field.type === "select") {
        const blank = element("option", "", "Not sure / discuss with me");
        blank.value = "";
        control.append(blank);
        field.options.forEach((value) => {
          const option = element("option", "", value);
          option.value = value;
          control.append(option);
        });
      } else {
        control.type = field.type;
        if (field.type === "number") {
          control.min = field.min;
          control.max = field.max;
          control.step = "1";
          control.inputMode = "numeric";
        } else {
          control.maxLength = field.maxLength;
          control.placeholder = field.placeholder;
        }
      }
      label.append(control);
      panel.append(label);
    });
    serviceOptions?.append(panel);
  });
  syncServiceOptions();
}

/** Keep answers on back/reselect, but disable and exclude deselected services. */
function syncServiceOptions() {
  const needs = checkedValues("needs");
  serviceOptions?.querySelectorAll("fieldset").forEach((panel) => {
    const selected = needs.includes(panel.dataset.service);
    panel.hidden = !selected;
    panel.disabled = !selected;
  });
}

function readEnquiryOptions() {
  return Object.fromEntries(
    checkedValues("needs").map((id) => {
      const controls =
        serviceOptions?.querySelectorAll(`[data-service="${id}"] [data-field]`) ?? [];
      return [
        id,
        Object.fromEntries([...controls].map((control) => [control.dataset.field, control.value]))
      ];
    })
  );
}

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
function showStep(step, { moveFocus = true } = {}) {
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
  if (moveFocus && currentLegend) {
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
  if (currentStep === 3) {
    const invalid = serviceOptions?.querySelector("fieldset:not([disabled]) input:invalid");
    if (invalid) {
      setError(`${invalid.closest("label").firstChild.textContent}: ${invalid.validationMessage}`);
      invalid.focus();
      return false;
    }
    try {
      describeEnquiryOptions(checkedValues("needs"), readEnquiryOptions());
    } catch (error) {
      setError(error.message);
      return false;
    }
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
    recommendation = buildRecommendation({
      space,
      needs,
      size,
      enquiryOptions: readEnquiryOptions()
    });
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

  window.dispatchEvent(
    new CustomEvent("sarathi:event", {
      detail: { event: "planner_completion", space, size, needs }
    })
  );
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
form?.addEventListener("change", (event) => {
  setError();
  if (event.target.name === "needs") syncServiceOptions();
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

  window.dispatchEvent(
    new CustomEvent("sarathi:event", {
      detail: { event: "planner_whatsapp_share", method: "clipboard_copy" }
    })
  );

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

  window.dispatchEvent(
    new CustomEvent("sarathi:event", {
      detail: { event: "planner_whatsapp_share", method: "web_share" }
    })
  );

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

whatsappButton?.addEventListener("click", () => {
  window.dispatchEvent(
    new CustomEvent("sarathi:event", {
      detail: { event: "planner_whatsapp_share", method: "whatsapp_link" }
    })
  );
});

// Reset planner to initial state
resetButton?.addEventListener("click", () => {
  if (form) form.reset();
  syncServiceOptions();
  currentRenderedSpace = "";
  if (sizeGrid) sizeGrid.replaceChildren();
  if (result) result.classList.add("hidden");
  if (form) form.classList.remove("hidden");
  if (progressWrap) progressWrap.classList.remove("hidden");
  if (copyStatus) copyStatus.textContent = "";
  showStep(1);
});

// Accessible FAQ Accordion Handler
function initFaqAccordion() {
  const faqList = document.querySelector("#faqList");
  if (!faqList) return;

  const triggers = [...faqList.querySelectorAll(".faq-trigger")];

  triggers.forEach((trigger, index) => {
    trigger.addEventListener("click", () => {
      const card = trigger.closest(".faq-card");
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";
      const targetId = trigger.getAttribute("aria-controls");
      const panel = targetId
        ? document.getElementById(targetId)
        : card?.querySelector(".faq-content");

      const willExpand = !isExpanded;
      trigger.setAttribute("aria-expanded", String(willExpand));

      if (panel) {
        panel.hidden = !willExpand;
      }

      if (card) {
        card.classList.toggle("is-open", willExpand);
        if (willExpand) {
          card.setAttribute("open", "");
        } else {
          card.removeAttribute("open");
        }
      }
    });

    trigger.addEventListener("keydown", (e) => {
      let targetIndex = null;
      if (e.key === "ArrowDown") {
        targetIndex = (index + 1) % triggers.length;
      } else if (e.key === "ArrowUp") {
        targetIndex = (index - 1 + triggers.length) % triggers.length;
      } else if (e.key === "Home") {
        targetIndex = 0;
      } else if (e.key === "End") {
        targetIndex = triggers.length - 1;
      }

      if (targetIndex !== null) {
        e.preventDefault();
        triggers[targetIndex]?.focus();
      }
    });
  });
}

// Keep duplicate protection in memory only; never persist customer details.
const recentLeadSubmissions = new Map();

function initLeadForms() {
  // Remove records saved by older versions of this website on this device.
  try {
    localStorage.removeItem("sarathi_leads");
  } catch {
    // Forms also work when browser storage is unavailable.
  }

  document.querySelectorAll(".lead-form").forEach((formEl) => {
    const formSource = formEl.dataset.formSource || "website-survey";
    const feedback = formEl.querySelector(".lead-feedback");
    const handoff = formEl.querySelector(".lead-handoff");
    const submitBtn = formEl.querySelector(".lead-submit-btn");
    submitBtn.disabled = false;
    const controls = [...formEl.querySelectorAll("[required]")];
    const errors = new Map();
    controls.forEach((control, index) => {
      const error = element("span", "lead-field-error");
      error.id = `${formSource}-error-${index}`;
      error.hidden = true;
      control.setAttribute("aria-describedby", error.id);
      control.closest("label").append(error);
      errors.set(control, error);
    });

    formEl.addEventListener(
      "focusin",
      () => {
        window.dispatchEvent(
          new CustomEvent("sarathi:event", {
            detail: { event: "form_start", formSource }
          })
        );
      },
      { once: true }
    );

    formEl.addEventListener("input", (event) => {
      const error = errors.get(event.target);
      if (error) {
        error.hidden = true;
        error.textContent = "";
        event.target.removeAttribute("aria-invalid");
      }
      // Do not leave a stale message link after details are edited.
      handoff.replaceChildren();
      handoff.hidden = true;
      feedback.textContent = "";
    });

    formEl.addEventListener("submit", (event) => {
      event.preventDefault();
      if (formEl.dataset.submitting === "true" || formEl.elements.botcheck?.value) return;

      const fields = formEl.elements;
      const name = fields.leadName.value.trim();
      const phone = fields.leadPhone.value.trim();
      const digits = phone.replace(/[\s()+-]/g, "");
      const standardPhone =
        digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
      let firstInvalid;
      controls.forEach((control) => {
        let message = "";
        if (control.name === "leadName" && (name.length < 2 || name.length > 80)) {
          message = "Enter your name using 2–80 characters.";
        } else if (control.name === "leadPhone" && !/^[6-9]\d{9}$/.test(standardPhone)) {
          message = "Enter a 10-digit Indian mobile number starting with 6–9. +91 is optional.";
        } else if (control.name === "leadConsent" && !control.checked) {
          message = "Please agree to be contacted about this enquiry.";
        } else if (control.tagName === "SELECT" && !control.value) {
          message =
            control.name === "leadSpace"
              ? "Choose your property type."
              : "Choose your locality or service.";
        }
        const error = errors.get(control);
        error.textContent = message;
        error.hidden = !message;
        control.setAttribute("aria-invalid", String(Boolean(message)));
        if (message && !firstInvalid) firstInvalid = control;
      });
      if (firstInvalid) {
        feedback.textContent = "Please correct the highlighted fields before opening WhatsApp.";
        feedback.className = "lead-feedback error";
        firstInvalid.focus();
        window.dispatchEvent(
          new CustomEvent("sarathi:event", {
            detail: { event: "form_submission_failure", formSource, reason: "validation_failed" }
          })
        );
        return;
      }

      const service = fields.leadService.value;
      const waMessage = formatLeadWhatsAppMessage({
        name,
        phone: standardPhone,
        locality: fields.leadLocality.value,
        propertyType: fields.leadSpace.value,
        service,
        message: fields.leadRequirement?.value.trim().slice(0, 600) || "",
        formSource
      });
      const waUrl = buildWhatsAppUrl(CONTACT_CONFIG.whatsappNumber, waMessage);
      const link = element("a", "button whatsapp-btn", "Open prepared enquiry in WhatsApp");
      link.href = waUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      handoff.replaceChildren(
        element(
          "p",
          "",
          "If WhatsApp did not open, use this link. Review your details and press Send there."
        ),
        link
      );
      handoff.hidden = false;

      const now = Date.now();
      for (const [key, time] of recentLeadSubmissions) {
        if (now - time >= 60000) recentLeadSubmissions.delete(key);
      }
      // Identical enquiries across both forms do not launch multiple windows.
      const fingerprint = JSON.stringify([
        name,
        standardPhone,
        fields.leadLocality.value,
        fields.leadSpace.value,
        service,
        fields.leadRequirement?.value.trim() || ""
      ]);
      if (recentLeadSubmissions.has(fingerprint)) {
        feedback.textContent =
          "This enquiry is already prepared. Use the WhatsApp link below to continue; your survey is confirmed only after we reply.";
        feedback.className = "lead-feedback success";
        return;
      }

      formEl.dataset.submitting = "true";
      formEl.setAttribute("aria-busy", "true");
      const buttonContent = [...submitBtn.childNodes].map((node) => node.cloneNode(true));
      submitBtn.disabled = true;
      submitBtn.textContent = "Opening WhatsApp…";
      feedback.textContent = "Preparing your WhatsApp enquiry…";
      feedback.className = "lead-feedback loading";
      recentLeadSubmissions.set(fingerprint, now);
      try {
        // Synchronous launch preserves browser user activation; no request is sent by this site.
        window.open(waUrl, "_blank", "noopener,noreferrer");
      } catch {
        // The accessible handoff link remains available for blocked popups.
      }
      feedback.textContent =
        "Your enquiry is ready. Send it in WhatsApp to reach us. Your site survey is not booked until we confirm availability and timing.";
      feedback.className = "lead-feedback success";
      window.dispatchEvent(
        new CustomEvent("sarathi:event", {
          detail: { event: "lead_whatsapp_prepared", formSource, service }
        })
      );
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.replaceChildren(...buttonContent);
        formEl.removeAttribute("aria-busy");
        formEl.dataset.submitting = "false";
      }, 600);
    });
  });
}

// Conversion tracking & analytics hooks
function initAnalytics() {
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.addEventListener("click", () => {
      window.dispatchEvent(
        new CustomEvent("sarathi:event", {
          detail: { event: "phone_cta_click", call_click: true, href: link.href }
        })
      );
    });
  });

  document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
    link.addEventListener("click", () => {
      window.dispatchEvent(
        new CustomEvent("sarathi:event", {
          detail: { event: "whatsapp_cta_click", whatsapp_click: true }
        })
      );
    });
  });

  document
    .querySelectorAll('a[href*="#planner"], a[href*="#survey"], .hero-cta-primary, .nav-cta')
    .forEach((link) => {
      link.addEventListener("click", () => {
        window.dispatchEvent(
          new CustomEvent("sarathi:event", {
            detail: {
              event: "free_survey_cta_click",
              href: link.getAttribute("href"),
              text: link.textContent.trim()
            }
          })
        );
      });
    });

  document.querySelectorAll(".package-cta, .package-card a").forEach((link) => {
    link.addEventListener("click", () => {
      const card = link.closest(".package-card");
      const title = card?.querySelector("h3")?.textContent.trim() || "";
      const price = card?.querySelector(".price-val")?.textContent.trim() || "";
      window.dispatchEvent(
        new CustomEvent("sarathi:event", {
          detail: { event: "package_cta_click", package: title, price, href: link.href }
        })
      );
    });
  });

  document
    .querySelectorAll('a[href*="google.com/maps"], a[href*="g.page"], a[href*="review"]')
    .forEach((link) => {
      link.addEventListener("click", () => {
        window.dispatchEvent(
          new CustomEvent("sarathi:event", {
            detail: { event: "google_review_link_click", href: link.href }
          })
        );
      });
    });
}

// Initialise page
renderCatalogue();
showStep(1, { moveFocus: false });
initFaqAccordion();
initLeadForms();
initAnalytics();
