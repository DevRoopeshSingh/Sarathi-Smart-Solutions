import { buildRecommendation, SIZE_OPTIONS } from "./recommendation.mjs";

// Official contact details for Sarathi Smart Solutions
export const CONTACT_CONFIG = {
  phone: "+918369704457",
  phoneDisplay: "+91 83697 04457",
  whatsappNumber: "918369704457",
  email: "sarathismartsolutions@gmail.com",
  address: "Bhayander East, Mira-Bhayandar, Thane - 401105"
};

const form = document.querySelector("#solutionForm");
const steps = [...document.querySelectorAll(".form-step")];
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const stepLabel = document.querySelector("#stepLabel");
const stepName = document.querySelector("#stepName");
const progressBar = document.querySelector("#progressBar");
const sizeGrid = document.querySelector("#sizeGrid");
const result = document.querySelector("#result");
const whatsappButton = document.querySelector("#whatsappButton");
const stepNames = ["Your space", "Your needs", "Setup size"];
let currentStep = 1;

function checkedValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
}

function checkedValues(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function setError(message = "") {
  steps[currentStep - 1].querySelector(".form-error").textContent = message;
}

function renderSizes(space) {
  sizeGrid.replaceChildren(...SIZE_OPTIONS[space].map((option) => {
    const label = document.createElement("label");
    label.className = "size-card";
    label.innerHTML = `
      <input type="radio" name="size" value="${option.value}" />
      <span class="choice-check" aria-hidden="true"></span>
      <strong>${option.title}</strong>
      <small>${option.description}</small>`;
    return label;
  }));
}

function showStep(step) {
  currentStep = step;
  steps.forEach((panel, index) => panel.classList.toggle("active", index === step - 1));
  stepLabel.textContent = `Step ${step} of 3`;
  stepName.textContent = stepNames[step - 1];
  progressBar.style.width = `${step * 33.333}%`;
  backButton.classList.toggle("hidden", step === 1);
  nextButton.innerHTML = step === 3 ? "See my recommendation <span aria-hidden=\"true\">→</span>" : "Continue <span aria-hidden=\"true\">→</span>";
  setError();
  steps[step - 1].querySelector("legend").focus?.();
}

function validateCurrentStep() {
  if (currentStep === 1 && !checkedValue("space")) {
    setError("Please choose Home or Business to continue.");
    return false;
  }
  if (currentStep === 2 && checkedValues("needs").length === 0) {
    setError("Please select at least one service need.");
    return false;
  }
  if (currentStep === 3 && !checkedValue("size")) {
    setError("Please choose an approximate setup size.");
    return false;
  }
  setError();
  return true;
}

function renderResult() {
  const recommendation = buildRecommendation({
    space: checkedValue("space"),
    needs: checkedValues("needs"),
    size: checkedValue("size")
  });

  document.querySelector("#result-title").textContent = recommendation.title;
  document.querySelector("#resultIntro").textContent = recommendation.intro;
  document.querySelector("#summaryText").textContent = recommendation.summary;
  const list = document.querySelector("#recommendationList");
  list.replaceChildren(...recommendation.items.map((item, index) => {
    const row = document.createElement("div");
    row.className = "recommendation-item";
    row.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><div><strong>${item.title}</strong><small>${item.detail}</small></div>`;
    return row;
  }));

  if (whatsappButton) {
    const encoded = encodeURIComponent(recommendation.summary);
    whatsappButton.href = `https://wa.me/${CONTACT_CONFIG.whatsappNumber}?text=${encoded}`;
  }

  form.classList.add("hidden");
  document.querySelector(".progress-wrap").classList.add("hidden");
  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

nextButton.addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  if (currentStep === 1) renderSizes(checkedValue("space"));
  if (currentStep < 3) showStep(currentStep + 1);
  else renderResult();
});

backButton.addEventListener("click", () => {
  if (currentStep > 1) showStep(currentStep - 1);
});

form.addEventListener("change", () => setError());

document.querySelector("#copyButton").addEventListener("click", async () => {
  const summary = document.querySelector("#summaryText").textContent;
  const status = document.querySelector("#copyStatus");
  try {
    await navigator.clipboard.writeText(summary);
    status.textContent = "Enquiry summary copied. You can paste it into WhatsApp, SMS or email.";
  } catch {
    status.textContent = "Select the enquiry summary above and copy it manually.";
  }
});

document.querySelector("#shareButton").addEventListener("click", async () => {
  const summary = document.querySelector("#summaryText").textContent;
  const status = document.querySelector("#copyStatus");
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(summary);
      status.textContent = "Sharing is unavailable here, so the summary was copied instead.";
    } catch {
      status.textContent = "Sharing is unavailable here. Please copy the summary manually.";
    }
    return;
  }
  try {
    await navigator.share({ title: "Sarathi Smart Solutions enquiry", text: summary });
    status.textContent = "Share sheet opened—nothing is sent until you choose and confirm.";
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = "Unable to open sharing. Please use Copy enquiry summary.";
  }
});

document.querySelector("#resetButton").addEventListener("click", () => {
  form.reset();
  result.classList.add("hidden");
  form.classList.remove("hidden");
  document.querySelector(".progress-wrap").classList.remove("hidden");
  document.querySelector("#copyStatus").textContent = "";
  showStep(1);
});

showStep(1);
