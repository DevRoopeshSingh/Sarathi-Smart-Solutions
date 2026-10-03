/**
 * Sarathi Digital Seva Kendra - Frontend Architecture & Interactivity
 *
 * Implements:
 * - Live Centre Operating Hours status badge (IST calculation)
 * - Two-way synced instant Service Finder (hero + directory)
 * - Category filters and quick chips (Printing, Business, Under ₹300), and sorting
 * - Progressive disclosure / Pagination (Load More / Show All)
 * - Service Detail Modal with interactive document checklist and dynamic WhatsApp enquiry
 * - Private, in-memory WhatsApp enquiry preparation
 * - Staff-assisted status enquiries without simulated tracking
 * - Accessible focus management, keyboard navigation (Escape, Enter), and ARIA attributes
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Parse Embedded Data
  const dataScript = document.getElementById("seva-data");
  let sevaData = { services: [], packages: [] };
  if (dataScript) {
    try {
      sevaData = JSON.parse(dataScript.textContent);
    } catch (e) {
      console.error("Could not parse embedded seva-data:", e);
    }
  }

  const ALL_SERVICES = sevaData.services || [];
  const SERVICES_BY_ID = new Map(ALL_SERVICES.map((s) => [String(s.id), s]));

  // 2. Initialize Operating Hours Status Badge
  initOperatingHoursStatus();

  // 3. Initialize Service Finder & Directory (Search, Filter, Sort, Pagination)
  initServiceFinderAndDirectory(ALL_SERVICES);

  // 4. Initialize Service Detail Modal
  initServiceDetailModal(SERVICES_BY_ID);

  // 5. Initialize WhatsApp enquiry and status-question handoffs
  initServiceEnquiries(SERVICES_BY_ID);

  // 6. Initialize FAQ Accordion
  initFaqAccordion();
  initMobileNavigation();
});

/**
 * Calculates current time in Indian Standard Time (IST) and updates live open/closed indicator
 */
function initOperatingHoursStatus() {
  const badge = document.getElementById("live-centre-status");
  if (!badge) return;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  });
  function updateStatus() {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map(({ type, value }) => [type, value])
    );
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const open = parts.weekday !== "Sun" && minutes >= 570 && minutes < 1230;
    let message;
    if (open) message = "Open Now • Closes 8:30 PM";
    else if (parts.weekday === "Sun" || (parts.weekday === "Sat" && minutes >= 1230)) {
      message = "Closed • Opens Monday 9:30 AM • Sunday by prior appointment";
    } else if (minutes < 570) message = "Opens Today at 9:30 AM";
    else message = "Closed for Today • Opens Tomorrow 9:30 AM";
    const dot = document.createElement("span");
    dot.className = `status-dot status-dot--${open ? "open" : "closed"}`;
    dot.setAttribute("aria-hidden", "true");
    badge.replaceChildren(dot, document.createTextNode(` ${message}`));
    badge.classList.toggle("seva-badge--open", open);
    badge.classList.toggle("seva-badge--closed", !open);
  }
  updateStatus();
  setInterval(updateStatus, 60000);
}

/**
 * Manages the unified search, category tabs, filter chips, sorting, and pagination
 */
function initServiceFinderAndDirectory(allServices) {
  const heroSearchInput = document.getElementById("hero-seva-search");
  const heroSearchClear = document.getElementById("hero-search-clear");
  const dirSearchInput = document.getElementById("seva-search");
  const dirSearchClear = document.getElementById("seva-search-clear");
  const quickPills = document.querySelectorAll(".seva-quick-pill");

  const filterTabs = document.querySelectorAll(".seva-tab");
  const quickChips = document.querySelectorAll(".seva-chip");
  const sortSelect = document.getElementById("seva-sort");
  const serviceCards = Array.from(document.querySelectorAll("#services-grid .seva-service-card"));

  const visibleCountEl = document.getElementById("filter-visible-count");
  const totalCountEl = document.getElementById("filter-total-count");
  const noResults = document.getElementById("no-services-found");
  const paginationWrap = document.getElementById("seva-pagination");
  const paginationStatusText = document.getElementById("pagination-status-text");
  const paginationProgressFill = document.getElementById("pagination-progress-fill");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const showAllBtn = document.getElementById("show-all-btn");

  const searchableServices = new Map(
    allServices.map((s) => [String(s.id), `${s.name} ${s.category} ${s.documents}`.toLowerCase()])
  );
  const PAGE_SIZE = 16;
  let currentCategory = "all";
  let currentQuery = "";
  let currentChip = "all";
  let currentSort = "default";
  let visibleLimit = PAGE_SIZE;

  function applyFilter() {
    const query = currentQuery.trim().toLowerCase();

    // 1. Identify all matching cards
    const matchingCards = [];

    serviceCards.forEach((card) => {
      const cardCategory = card.getAttribute("data-category") || "";
      const cardName = card.getAttribute("data-name") || "";
      const cardCharge = parseFloat(card.getAttribute("data-charge") || "0");
      const cardText = card.textContent.toLowerCase();

      // Check category match
      const matchesCategory = currentCategory === "all" || cardCategory === currentCategory;

      // Check query match (name, text, category, or documents)
      const matchesSearch =
        !query ||
        cardName.includes(query) ||
        cardText.includes(query) ||
        (searchableServices.get(card.dataset.id) || "").includes(query);

      // Check quick chip match
      let matchesChip = true;
      if (currentChip === "printing") {
        matchesChip = cardCategory === "printing";
      } else if (currentChip === "business") {
        matchesChip = ["business", "pharmacy", "food", "property", "ecommerce"].includes(
          cardCategory
        );
      } else if (currentChip === "under300") {
        matchesChip = cardCharge > 0 && cardCharge <= 300;
      }

      if (matchesCategory && matchesSearch && matchesChip) {
        matchingCards.push({ card, charge: cardCharge, name: cardName });
      } else {
        card.setAttribute("hidden", "");
      }
    });

    const totalMatches = matchingCards.length;

    // 2. Sort matching cards if requested
    if (currentSort === "price-asc") {
      matchingCards.sort((a, b) => a.charge - b.charge);
    } else if (currentSort === "price-desc") {
      matchingCards.sort((a, b) => b.charge - a.charge);
    } else if (currentSort === "name-asc") {
      matchingCards.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 3. Progressive disclosure: Render visible batch
    const gridContainer = document.getElementById("services-grid");
    const countToShow = Math.min(totalMatches, visibleLimit);

    matchingCards.forEach((item, index) => {
      if (gridContainer) gridContainer.appendChild(item.card);
      if (index < countToShow) {
        item.card.removeAttribute("hidden");
      } else {
        item.card.setAttribute("hidden", "");
      }
    });

    // 4. Update count displays
    if (visibleCountEl) visibleCountEl.textContent = countToShow;
    if (totalCountEl) totalCountEl.textContent = totalMatches;

    // 5. Update pagination status
    if (paginationStatusText) {
      paginationStatusText.textContent = `Showing ${countToShow} of ${totalMatches} services`;
    }

    if (paginationProgressFill) {
      const pct = totalMatches > 0 ? Math.round((countToShow / totalMatches) * 100) : 0;
      paginationProgressFill.style.width = `${pct}%`;
    }

    if (paginationWrap) {
      if (totalMatches <= PAGE_SIZE || countToShow >= totalMatches) {
        paginationWrap.classList.add("all-loaded");
        if (loadMoreBtn) loadMoreBtn.hidden = true;
        if (showAllBtn) showAllBtn.hidden = true;
      } else {
        paginationWrap.classList.remove("all-loaded");
        if (loadMoreBtn) {
          loadMoreBtn.hidden = false;
          const remaining = totalMatches - countToShow;
          const nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreBtn.querySelector("span").textContent = `Load More Services (+${nextBatch})`;
        }
        if (showAllBtn) {
          showAllBtn.hidden = false;
          showAllBtn.querySelector("span").textContent = `Show All (${totalMatches})`;
        }
      }
    }

    // 6. Toggle No Results state
    if (noResults) {
      noResults.hidden = totalMatches > 0;
    }
  }

  // Load More button click
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      visibleLimit += PAGE_SIZE;
      applyFilter();
    });
  }

  // Show All button click
  if (showAllBtn) {
    showAllBtn.addEventListener("click", () => {
      visibleLimit = 9999;
      applyFilter();
    });
  }

  // Category Tabs Click
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-pressed", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-pressed", "true");

      currentCategory = tab.getAttribute("data-filter") || "all";
      visibleLimit = PAGE_SIZE; // reset pagination on category switch
      applyFilter();
    });
  });

  // Quick Filter Chips Click
  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      quickChips.forEach((c) => {
        c.classList.remove("active");
        c.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");

      currentChip = chip.getAttribute("data-chip") || "all";
      visibleLimit = PAGE_SIZE;
      applyFilter();
    });
  });

  // Sort Dropdown Change
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      applyFilter();
    });
  }

  // Two-way Synced Search Handling with Debounce
  let searchDebounce;
  function handleSearchInput(query, sourceInput) {
    currentQuery = query;

    // Synchronize both search inputs
    if (sourceInput === heroSearchInput && dirSearchInput) {
      dirSearchInput.value = query;
      if (dirSearchClear) dirSearchClear.hidden = !query;
    } else if (sourceInput === dirSearchInput && heroSearchInput) {
      heroSearchInput.value = query;
      if (heroSearchClear) heroSearchClear.hidden = !query;
    }

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      visibleLimit = PAGE_SIZE;
      applyFilter();
    }, 90);
  }

  // Hero Search Input
  if (heroSearchInput) {
    heroSearchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (heroSearchClear) heroSearchClear.hidden = !val;
      handleSearchInput(val, heroSearchInput);
    });

    heroSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const servicesSection = document.getElementById("services");
        if (servicesSection) {
          servicesSection.scrollIntoView({ behavior: "smooth" });
        }
      }
    });

    if (heroSearchClear) {
      heroSearchClear.addEventListener("click", () => {
        heroSearchInput.value = "";
        heroSearchClear.hidden = true;
        handleSearchInput("", heroSearchInput);
        heroSearchInput.focus();
      });
    }
  }

  // Directory Search Input
  if (dirSearchInput) {
    dirSearchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      if (dirSearchClear) dirSearchClear.hidden = !val;
      handleSearchInput(val, dirSearchInput);
    });

    if (dirSearchClear) {
      dirSearchClear.addEventListener("click", () => {
        dirSearchInput.value = "";
        dirSearchClear.hidden = true;
        handleSearchInput("", dirSearchInput);
        dirSearchInput.focus();
      });
    }
  }

  // Quick Service Shortcut Pills Click in Hero
  quickPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const q = pill.getAttribute("data-query") || "";
      if (heroSearchInput) {
        heroSearchInput.value = q;
        if (heroSearchClear) heroSearchClear.hidden = !q;
      }
      if (dirSearchInput) {
        dirSearchInput.value = q;
        if (dirSearchClear) dirSearchClear.hidden = !q;
      }

      // Switch category tab to all
      filterTabs.forEach((t) => {
        const isAll = t.getAttribute("data-filter") === "all";
        t.classList.toggle("active", isAll);
        t.setAttribute("aria-pressed", isAll ? "true" : "false");
      });
      currentCategory = "all";
      currentChip = "all";
      currentSort = "default";
      if (sortSelect) sortSelect.value = "default";
      quickChips.forEach((c) => {
        const active = c.dataset.chip === "all";
        c.classList.toggle("active", active);
        c.setAttribute("aria-pressed", String(active));
      });

      currentQuery = q;
      visibleLimit = PAGE_SIZE;
      applyFilter();

      // Smooth scroll directly to the directory
      const directorySection = document.getElementById("services");
      if (directorySection) {
        directorySection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Initial Filter Run
  applyFilter();
}

/**
 * Controls the Service Detail Modal Dialog with interactive document checkboxes
 */
function initServiceDetailModal(servicesById) {
  const modal = document.getElementById("seva-detail-modal");
  if (!modal) return;

  const closeBtn = document.getElementById("modal-close-btn");
  const modalCategoryPill = document.getElementById("modal-category-pill");
  const modalTurnaroundBadge = document.getElementById("modal-turnaround-badge");
  const modalServiceTitle = document.getElementById("modal-service-title");
  const modalServicePrice = document.getElementById("modal-service-price");
  const modalServicePriceType = document.getElementById("modal-service-pricetype");
  const modalOfficialFee = document.getElementById("modal-official-fee");
  const modalChecklistWrap = document.getElementById("modal-checklist-wrap");
  const checklistCounter = document.getElementById("checklist-counter");
  const modalNotesBox = document.getElementById("modal-notes-box");
  const modalNotesText = document.getElementById("modal-notes-text");
  const modalWaBtn = document.getElementById("modal-wa-btn");
  const modalBookBtn = document.getElementById("modal-book-btn");

  let activeService = null;
  let activeChecklistItems = [];

  function openModal(serviceId) {
    const service = servicesById.get(String(serviceId));
    if (!service) return;

    activeService = service;

    // Populate Category & Badges
    if (modalCategoryPill) {
      modalCategoryPill.textContent = service.category_name;
      modalCategoryPill.className = `seva-category-pill seva-pill--${service.category_slug}`;
    }
    if (modalTurnaroundBadge) {
      modalTurnaroundBadge.textContent = service.turnaround;
    }
    if (modalServiceTitle) {
      modalServiceTitle.textContent = service.name;
    }
    if (modalServicePrice) {
      modalServicePrice.textContent = `₹${service.charge}`;
    }
    if (modalServicePriceType) {
      modalServicePriceType.textContent = `(${service.price_type || "Assistance fee"})`;
    }
    if (modalOfficialFee) {
      modalOfficialFee.textContent = service.official_fee || "Extra at actual";
    }

    // Populate Document Checklist
    if (modalChecklistWrap) {
      modalChecklistWrap.replaceChildren();
      const rawDocs = service.documents || "Standard ID / Address Proof";
      // Split into clean checklist items
      activeChecklistItems = rawDocs
        .split(/[+,;]|\band\b/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (activeChecklistItems.length === 0) {
        activeChecklistItems = [rawDocs];
      }

      activeChecklistItems.forEach((docItem, idx) => {
        const itemWrap = document.createElement("label");
        itemWrap.className = "seva-checklist-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "seva-doc-cb";
        cb.value = docItem;
        cb.id = `doc-cb-${idx}`;

        const span = document.createElement("span");
        span.textContent = docItem;

        cb.addEventListener("change", updateChecklistState);

        itemWrap.appendChild(cb);
        itemWrap.appendChild(span);
        modalChecklistWrap.appendChild(itemWrap);
      });

      updateChecklistState();
    }

    // Notes Box
    if (modalNotesBox && modalNotesText) {
      if (service.notes) {
        modalNotesText.textContent = service.notes;
        modalNotesBox.hidden = false;
      } else {
        modalNotesBox.hidden = true;
      }
    }

    // Modal Book Button
    if (modalBookBtn) {
      modalBookBtn.onclick = () => {
        closeModal();
        const requestSection = document.getElementById("request-track");
        const selectEl = document.getElementById("request-service-select");
        const reqTabBtn = document.getElementById("tab-btn-request");
        const nameInput = document.getElementById("request-name");

        if (reqTabBtn) reqTabBtn.click();
        if (selectEl) {
          selectEl.value = service.id;
          selectEl.dispatchEvent(new Event("change"));
        }
        if (requestSection) {
          requestSection.scrollIntoView({ behavior: "smooth" });
          setTimeout(() => {
            if (nameInput) nameInput.focus();
          }, 450);
        }
      };
    }

    // Open native dialog modal
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }

  function updateChecklistState() {
    if (!activeService) return;

    const checkboxes = modalChecklistWrap.querySelectorAll(".seva-doc-cb");
    const checked = Array.from(checkboxes).filter((cb) => cb.checked);
    const total = checkboxes.length;

    if (checklistCounter) {
      checklistCounter.textContent = `${checked.length} of ${total} documents ready`;
    }

    // Dynamically update WhatsApp URL
    if (modalWaBtn) {
      let waMessage = "";
      if (checked.length > 0) {
        const checkedNames = checked.map((cb) => cb.value).join(", ");
        waMessage = `Hello Sarathi Digital Seva Kendra, I would like to apply for: ${activeService.name} (Estimated fee: ₹${activeService.charge}). I have ${checked.length} of ${total} documents ready: (${checkedNames}). How should I proceed?`;
      } else {
        waMessage = `Hello Sarathi Digital Seva Kendra, I would like to enquire about: ${activeService.name} (Estimated fee: ₹${activeService.charge}). What is the next step and what documents are required?`;
      }

      modalWaBtn.href = `https://wa.me/918369704457?text=${encodeURIComponent(waMessage)}`;
    }
  }

  function closeModal() {
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  // Click on dialog backdrop closes modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Event Delegation for "View Checklist / Requirements" buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".seva-btn-details");
    if (btn) {
      const id = btn.getAttribute("data-service-id");
      if (id) {
        openModal(id);
      }
    }
  });
}

/** Prepare WhatsApp enquiries without storing personal data or claiming submission. */
function initServiceEnquiries(servicesById) {
  // Remove the obsolete local-only record so shared devices do not retain old customer details.
  try {
    localStorage.removeItem("sarathi_seva_last_request");
  } catch {
    /* Storage may be disabled. */
  }

  const tabs = [...document.querySelectorAll(".seva-subtab")];
  const form = document.getElementById("seva-request-form");
  const confirmation = document.getElementById("request-confirmation");
  const error = document.getElementById("request-error");
  const serviceInput = document.getElementById("request-service-select");
  const nameInput = document.getElementById("request-name");
  const phoneInput = document.getElementById("request-phone");
  const notesInput = document.getElementById("request-notes");
  const statusForm = document.getElementById("seva-status-form");
  const trackInput = document.getElementById("track-id-input");
  const trackError = document.getElementById("track-error");
  const trackerDisplay = document.getElementById("tracker-display");
  const whatsapp = (message) => `https://wa.me/918369704457?text=${encodeURIComponent(message)}`;

  function selectTab(tab) {
    tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !active;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      let next;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") next = tabs[(index + 1) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        selectTab(next);
        next.focus();
      }
    });
  });

  function showError(node, field, message) {
    node.textContent = message;
    node.hidden = false;
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
  function editEnquiry() {
    confirmation.hidden = true;
    form.hidden = false;
  }
  // The form remains usable when a checklist selects another service after an enquiry was prepared.
  serviceInput.addEventListener("change", editEnquiry);
  document.getElementById("edit-enquiry-btn").addEventListener("click", () => {
    editEnquiry();
    nameInput.focus();
  });
  document.getElementById("new-enquiry-btn").addEventListener("click", () => {
    form.reset();
    editEnquiry();
    error.hidden = true;
    serviceInput.focus();
  });
  form.querySelector('[type="submit"]').disabled = false;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    error.hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const service = servicesById.get(serviceInput.value);
    if (!service) return showError(error, serviceInput, "Please choose a service.");
    const name = nameInput.value.trim();
    if (!name || name.length > 100)
      return showError(error, nameInput, "Please enter your full name (up to 100 characters).");
    // Accept Indian mobile numbers with optional +91/91 and conventional separators only.
    const raw = phoneInput.value.trim();
    const compact = raw.replace(/[ ()-]/g, "");
    const match = /^(?:\+?91)?([6-9]\d{9})$/.exec(compact);
    if (!match)
      return showError(
        error,
        phoneInput,
        "Enter a valid 10-digit Indian mobile number, optionally prefixed with +91."
      );
    const phone = match[1];
    const mode =
      form.querySelector('input[name="service-mode"]:checked')?.value === "online-wa"
        ? "Online assistance via WhatsApp"
        : "Walk-in at RNP Park Centre (Bhayander East)";
    const notes = notesInput.value.trim();
    if (notes.length > 1000)
      return showError(error, notesInput, "Keep notes within 1,000 characters.");
    const price = `₹${service.charge} (${service.price_type})`;
    const message = [
      "Hello Sarathi Digital Seva Kendra, I would like assistance with:",
      `${service.name} — ${price}`,
      `Government / statutory fee: ${service.official_fee || "Extra at actual"}`,
      "Other applicable charges will be confirmed by your desk.",
      `Name: ${name}`,
      `Phone: +91${phone}`,
      `Preferred mode: ${mode}`,
      ...(notes ? [`Notes: ${notes}`] : []),
      "Please confirm availability, total charges, and next steps."
    ].join("\n");
    document.getElementById("confirm-service-name").textContent = service.name;
    document.getElementById("confirm-customer-name").textContent = name;
    document.getElementById("confirm-service-mode").textContent = mode;
    document.getElementById("confirm-service-price").textContent = price;
    document.getElementById("confirm-wa-btn").href = whatsapp(message);
    form.hidden = true;
    confirmation.hidden = false;
    confirmation.focus();
  });

  statusForm.querySelector('[type="submit"]').disabled = false;
  trackInput.addEventListener("input", () => {
    trackerDisplay.hidden = true;
  });
  statusForm.addEventListener("submit", (e) => {
    e.preventDefault();
    trackError.hidden = true;
    trackInput.removeAttribute("aria-invalid");
    const reference = trackInput.value.trim();
    if (
      !reference ||
      reference.length > 80 ||
      [...reference].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ) {
      return showError(
        trackError,
        trackInput,
        "Enter the reference from your receipt or conversation (up to 80 characters)."
      );
    }
    document.getElementById("tracker-wa-help").href = whatsapp(
      `Hello Sarathi Digital Seva Kendra, please check the latest status for reference: ${reference}. Please let me know if you need further details.`
    );
    trackerDisplay.hidden = false;
    trackerDisplay.focus();
  });
}

function initMobileNavigation() {
  const menu = document.getElementById("seva-mobile-menu");
  if (!menu) return;
  menu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      menu.open = false;
    })
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
}

/**
 * FAQ Accordion toggle indicator enhancement
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".seva-faq-item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      const toggle = item.querySelector(".seva-faq-toggle");
      if (toggle) {
        toggle.textContent = item.open ? "−" : "+";
      }
    });
  });
}
