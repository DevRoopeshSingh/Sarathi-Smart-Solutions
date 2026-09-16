/**
 * Sarathi Smart Solutions - Business Configuration & Recommendation Engine
 *
 * Encapsulates service definitions, size matrices, bundle calculations,
 * and enquiry message formatting for the interactive solution planner.
 */

/**
 * Official verified contact details for Sarathi Smart Solutions.
 */
export const CONTACT_CONFIG = Object.freeze({
  phone: "+918369704457",
  phoneDisplay: "+91 83697 04457",
  whatsappNumber: "918369704457",
  email: "sarathismartsolutions@gmail.com",
  address: "Bhayander East, Mira-Bhayandar, Thane - 401105",
  serviceAreas: "Mira Road, Bhayandar, Thane, Dahisar, Borivali & Mumbai MMR",
  disclaimer:
    "Final recommendation and pricing depend on site survey, equipment selection, cable length, installation conditions, and customer requirements."
});

/** Build immutable catalogue entries shared by the UI and recommendation engine. */
function service(label, description, icon, details, fields, meta = {}) {
  return Object.freeze({
    label,
    description,
    icon,
    details: Object.freeze(
      Object.fromEntries(["Compact", "Standard", "Large"].map((size, i) => [size, details[i]]))
    ),
    fields: Object.freeze(fields.map((field) => Object.freeze(field))),
    category: meta.category || "core",
    ctaLabel: meta.ctaLabel || "Enquire about this service →"
  });
}

function choice(id, label, options) {
  return { id, label, type: "select", options: Object.freeze(options) };
}

function quantity(label) {
  return { id: "quantity", label, type: "number", min: 1, max: 999 };
}

function note(label, placeholder) {
  return { id: "notes", label, type: "text", maxLength: 300, placeholder };
}

/**
 * Single source for service cards, planner choices, enquiry fields and recommendations.
 * Keep stable IDs when changing display text; appliance preserves existing AC/refrigerator support.
 * Enquiry fields are optional so customers can request advice without technical specifications.
 */
export const SERVICE_CATALOGUE = Object.freeze({
  cctv: service(
    "CCTV surveillance & mobile viewing",
    "Indoor and outdoor cameras, recording and secure remote viewing.",
    "M4 8h11a2 2 0 0 1 2 2v6H4zM17 11l4-2v7l-4-2",
    [
      "2–3 camera starting layout, recording and secure mobile viewing (Packages from ₹13,900)",
      "4–6 camera starting layout, recording and secure mobile viewing (4-camera package from ₹17,900; additional cameras quoted after survey)",
      "8+ camera multi-zone layout, recording and secure mobile viewing (Packages from ₹30,900)"
    ],
    [
      choice("work", "CCTV requirement", [
        "New installation",
        "Repair / troubleshooting",
        "Upgrade existing cameras",
        "Maintenance / AMC"
      ]),
      quantity("Number of cameras"),
      note("Camera locations or issue", "Indoor/outdoor areas, recording or mobile viewing issue")
    ],
    { category: "core", ctaLabel: "Get CCTV Quote →" }
  ),
  network: service(
    "Wi‑Fi & networking",
    "Routers, access points, LAN, structured cabling and coverage troubleshooting.",
    "M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 17a3 3 0 0 1 4 0",
    [
      "Router placement and Wi‑Fi coverage check",
      "Mesh or access-point planning with essential LAN cabling",
      "Multi-access-point network and structured cabling plan"
    ],
    [
      choice("work", "Networking requirement", [
        "Wi‑Fi setup / coverage",
        "LAN / structured cabling",
        "Router / access point setup",
        "Connection troubleshooting"
      ]),
      quantity("Number of network points"),
      note("Network details", "Coverage areas, current router or connection issue")
    ],
    { category: "core", ctaLabel: "Fix My Wi‑Fi Coverage →" }
  ),
  biometric: service(
    "Biometric attendance / access control",
    "Attendance, entry control and smarter workplace access.",
    "M7 3h10v6H7zM5 21v-5h14v5M12 9v7",
    [
      "Single-point biometric attendance or controlled entry",
      "Attendance and access setup for a growing team",
      "Multi-door or multi-zone access planning with central oversight"
    ],
    [
      choice("work", "Access requirement", [
        "Attendance system",
        "Door access control",
        "Repair / configuration",
        "Maintenance / AMC"
      ]),
      quantity("Number of users"),
      note("Access details", "Doors, shifts or existing system")
    ],
    { category: "core", ctaLabel: "Get Attendance System Quote →" }
  ),
  intercom: service(
    "Video doorbell / intercom",
    "Visitor communication, video doorbells and intercom installation.",
    "M6 3h12v18H6zM9 7h6M12 17h.01",
    [
      "Single-entry video doorbell or intercom",
      "Main-entry video intercom with convenient indoor access",
      "Multi-point visitor communication and entry planning"
    ],
    [
      choice("work", "Intercom requirement", [
        "Video doorbell installation",
        "Intercom installation",
        "Repair / upgrade"
      ]),
      quantity("Number of entry points"),
      note("Intercom details", "Existing wiring or indoor stations needed")
    ],
    { category: "core", ctaLabel: "Plan Door Access Setup →" }
  ),
  locks: service(
    "Smart locks",
    "PIN, card, fingerprint and app-enabled locking options.",
    "M8 11V7a4 4 0 0 1 8 0v4M6 11h12v10H6z",
    [
      "One smart lock with suitable PIN, card, fingerprint or app access",
      "Smart access for key doors with user setup",
      "Multi-door smart locking plan with managed credentials"
    ],
    [
      choice("work", "Smart lock requirement", [
        "New installation",
        "Replace existing lock",
        "Configuration / troubleshooting"
      ]),
      quantity("Number of locks"),
      note("Door and lock details", "Door material, existing lock or preferred access method")
    ],
    { category: "core", ctaLabel: "Book Smart Lock Demo →" }
  ),
  automation: service(
    "Home / business automation",
    "Lighting, power, sensors, smart routines and preventive maintenance / AMC.",
    "m13 2-8 11h6l-1 9 9-12h-6z",
    [
      "Starter automation for selected lights, power points or sensors",
      "Room or zone-based control for everyday routines",
      "Multi-zone automation plan for lighting, power and sensors"
    ],
    [
      choice("work", "Automation requirement", [
        "Lighting / smart switches",
        "Sensors / smart routines",
        "Device integration",
        "Maintenance / AMC"
      ]),
      quantity("Number of rooms or zones"),
      note("Automation details", "Devices, preferred ecosystem or routines")
    ],
    { category: "core", ctaLabel: "Automate My Home →" }
  ),
  amc: service(
    "CCTV AMC & maintenance",
    "Preventive inspections, recording checks, camera cleaning and local maintenance support.",
    "M3 12a9 9 0 1 0 3-7M3 3v5h5M12 7v5l3 2",
    [
      "Existing home CCTV inspection with maintenance scope and parts exclusions confirmed in writing",
      "Office or shop CCTV health check with scheduled maintenance and support scope confirmed in writing",
      "Society or warehouse multi-zone CCTV audit with a tailored maintenance schedule and written support terms"
    ],
    [
      choice("work", "Maintenance requirement", [
        "New AMC quotation",
        "Existing system health check",
        "Recording / mobile viewing problem"
      ]),
      quantity("Number of existing cameras"),
      note("Current system or issue", "Brand, age of system and any recording or camera faults")
    ],
    { category: "core", ctaLabel: "Get CCTV AMC Quote →" }
  ),
  electrical: service(
    "Electrical & smart wiring",
    "Wiring repairs, switches, lighting, earthing and power distribution.",
    "m13 2-8 11h6l-1 9 9-12h-6z",
    [
      "Switchboard checks, essential wiring repairs and appliance power point setup",
      "Full-premises wiring inspection, power distribution, earthing and lighting cabling",
      "Multi-zone commercial/residential cabling, distribution board planning and high-load wiring"
    ],
    [
      choice("work", "Electrical requirement", [
        "Wiring / rewiring",
        "Switches / sockets / lighting",
        "Fault diagnosis / repair",
        "Earthing / distribution board",
        "Appliance power point"
      ]),
      quantity("Number of points or fittings"),
      note("Electrical work details", "Affected area, appliance load or symptoms")
    ],
    { category: "additional", ctaLabel: "Request Electrical Visit →" }
  ),
  appliance: service(
    "AC & refrigerator services",
    "AC installation, servicing, deep cleaning, cooling diagnostics and refrigerator support.",
    "M3 4h18v8H3zM6 8h12M7 15v5m5-5v6m5-6v5",
    [
      "Single AC or refrigerator installation, inspection, gas check or servicing",
      "Multi-unit AC installation, preventive deep cleaning, gas refill and cooling diagnostics",
      "Complete cooling maintenance, multi-split/cassette AC setup and commercial refrigeration check"
    ],
    [
      choice("work", "AC / cooling requirement", [
        "Installation / relocation",
        "Servicing / deep cleaning",
        "Not cooling / repair",
        "Gas check / refill",
        "Preventive maintenance / AMC"
      ]),
      choice("equipment", "Equipment type", [
        "Split AC",
        "Window AC",
        "Cassette / multi-split AC",
        "Refrigerator"
      ]),
      quantity("Number of cooling units"),
      note("AC or refrigerator details", "Brand, capacity / tonnage and symptoms, if known")
    ],
    { category: "additional", ctaLabel: "Book AC Service →" }
  ),
  it: service(
    "IT support & computer services",
    "Computer diagnostics, software setup, printers, backups and business IT support.",
    "M3 3h18v13H3zM8 21h8m-4-5v5",
    [
      "Computer or laptop diagnostics, software setup, printer configuration and backup guidance",
      "Multi-device office IT setup, shared printers, data backup and workstation support",
      "Business workstation, server and backup assessment with ongoing IT support planning"
    ],
    [
      choice("work", "IT requirement", [
        "Computer / laptop troubleshooting",
        "OS / software setup",
        "Printer / peripheral setup",
        "Backup / data migration",
        "Server / business IT support",
        "Ongoing IT maintenance"
      ]),
      quantity("Number of computers or devices"),
      note("IT equipment and issue", "Device model, operating system, software or support needs")
    ],
    { category: "additional", ctaLabel: "Get IT Support Quote →" }
  ),
  tv: service(
    "TV & device installation",
    "TV wall mounting, smart TV setup, streaming devices and home audio connections.",
    "M3 5h18v13H3zM8 22h8m-4-4v4M8 1l4 4 4-4",
    [
      "Single TV or device installation assessment, suitable mounting and connection setup",
      "TV mounting with streaming devices, soundbar connections and cable arrangement",
      "Multi-display or business device installation planning with mounting and connectivity review"
    ],
    [
      choice("work", "TV / device requirement", [
        "TV wall mounting",
        "TV unmounting / relocation",
        "Smart TV / streaming device setup",
        "Soundbar / home audio setup",
        "Other device installation"
      ]),
      choice("wall", "Mounting surface", [
        "Concrete / brick",
        "Partition / drywall",
        "Wood panel",
        "Tabletop / no wall mounting",
        "Not sure"
      ]),
      quantity("Number of TVs or devices"),
      note("TV or device details", "Screen size, model, bracket availability or device type")
    ],
    { category: "additional", ctaLabel: "Book TV Mounting →" }
  ),
  ev: service(
    "EV charging & electrical technology",
    "EV charger installation enquiries, site assessment, power readiness and charger support.",
    "M7 2h10v20H7zM10 5h4v4h-4zM17 10h2l2 3v5h-2v-5M10 15h4",
    [
      "Single parking-space charger assessment, electrical capacity and earthing review before installation",
      "Home or business charging setup assessment with dedicated circuit and cable-route planning",
      "Society or commercial multi-charger assessment, load planning and installation scope review"
    ],
    [
      choice("work", "EV requirement", [
        "New charger installation",
        "Electrical readiness / site survey",
        "Charger troubleshooting",
        "Charger relocation / upgrade"
      ]),
      choice("parking", "Parking location", [
        "Private home parking",
        "Housing society parking",
        "Office / commercial parking"
      ]),
      quantity("Number of charging points"),
      note(
        "Vehicle and charger details",
        "Vehicle model, charger rating, existing supply or permissions, if known"
      )
    ],
    { category: "additional", ctaLabel: "Check EV Charger Feasibility →" }
  )
});

/** Backward-compatible labels derived from the catalogue. */
export const NEED_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(SERVICE_CATALOGUE).map(([id, entry]) => [id, entry.label]))
);

/** Setup size choices per space category. */
export const SIZE_OPTIONS = Object.freeze({
  Home: Object.freeze([
    { value: "Compact", title: "Compact", description: "1–2 rooms / small flat" },
    { value: "Standard", title: "Standard", description: "2–3 BHK / medium home" },
    { value: "Large", title: "Large", description: "Large flat / bungalow" }
  ]),
  Business: Object.freeze([
    { value: "Compact", title: "Compact", description: "Small shop / cabin" },
    { value: "Standard", title: "Standard", description: "Office / showroom" },
    { value: "Large", title: "Large", description: "Multi-zone / warehouse" }
  ])
});

/** Validate selected services only; stale answers from deselected services are excluded. */
export function describeEnquiryOptions(needs, enquiryOptions = {}) {
  if (!enquiryOptions || typeof enquiryOptions !== "object" || Array.isArray(enquiryOptions)) {
    throw new Error("Invalid enquiry options.");
  }
  return Object.fromEntries(
    needs.map((need) => {
      if (!Object.hasOwn(SERVICE_CATALOGUE, need)) throw new Error(`Unknown need: ${need}`);
      const values = Object.hasOwn(enquiryOptions, need) ? enquiryOptions[need] : {};
      if (!values || typeof values !== "object" || Array.isArray(values))
        throw new Error(`Invalid options for ${need}.`);
      const fields = SERVICE_CATALOGUE[need].fields;
      if (Object.keys(values).some((key) => !fields.some((field) => field.id === key))) {
        throw new Error(`Unknown enquiry field for ${need}.`);
      }
      const answers = fields.flatMap((field) => {
        const raw = Object.hasOwn(values, field.id) ? values[field.id] : "";
        if (typeof raw !== "string" && typeof raw !== "number")
          throw new Error(`Invalid ${field.label}.`);
        const value = String(raw).trim();
        if (!value) return [];
        if (field.type === "select" && !field.options.includes(value))
          throw new Error(`Invalid ${field.label}.`);
        if (
          field.type === "number" &&
          (!/^\d+$/.test(value) || Number(value) < field.min || Number(value) > field.max)
        ) {
          throw new Error(
            `${field.label} must be a whole number from ${field.min} to ${field.max}.`
          );
        }
        if (field.type === "text" && value.length > field.maxLength)
          throw new Error(`${field.label} must be ${field.maxLength} characters or fewer.`);
        return [`${field.label}: ${value.replace(/[\r\n\t]+/g, " ")}`];
      });
      return [need, answers];
    })
  );
}

/**
 * Formats a clean, professional enquiry text for sharing or WhatsApp.
 *
 * @param {Object} params
 * @param {string} params.space - 'Home' or 'Business'
 * @param {string[]} params.needs - Array of need keys
 * @param {string} params.size - 'Compact', 'Standard', or 'Large'
 * @param {string} params.title - Calculated bundle title
 * @returns {string} Clean multi-line enquiry text
 */
export function formatEnquiryMessage({ space, needs, size, title, enquiryOptions = {} }) {
  const answers = describeEnquiryOptions(needs, enquiryOptions);
  const selectedNeeds = needs.map((need) => NEED_LABELS[need] || need).join(", ");
  return [
    "SARATHI SMART SOLUTIONS — ENQUIRY",
    `Space: ${space}`,
    `Approx. size: ${size}`,
    `Needs: ${selectedNeeds}`,
    `Recommended starting bundle: ${title}`,
    ...needs.flatMap((need) =>
      answers[need].length ? [`${NEED_LABELS[need]} — ${answers[need].join("; ")}`] : []
    ),
    "Please advise a suitable solution and quotation after confirming site requirements."
  ].join("\n");
}

/**
 * Constructs a safely-encoded WhatsApp Click-to-Chat URL.
 * Sanitises the destination phone number and safely URL-encodes message text.
 *
 * @param {string} phoneNumber - Destination phone number with country code
 * @param {string} messageText - Unencoded enquiry message
 * @returns {string} Secure https://wa.me URL
 */
export function buildWhatsAppUrl(phoneNumber, messageText) {
  const cleanNumber = String(phoneNumber).replace(/\D/g, "");
  const encodedText = encodeURIComponent(String(messageText || "").trim());
  return `https://wa.me/${cleanNumber}?text=${encodedText}`;
}

/**
 * Formats a consistent, structured lead enquiry for WhatsApp.
 * Follows the standard customer site-survey request format.
 */
export function formatLeadWhatsAppMessage({
  name,
  phone,
  locality,
  propertyType,
  service,
  message,
  formSource
}) {
  const lines = [
    "Hello Sarathi Smart Solutions, I would like a site survey / quotation.",
    `Name: ${String(name || "").trim()}`,
    `Mobile: ${String(phone || "").trim()}`,
    `Locality: ${String(locality || "").trim()}`,
    `Property: ${String(propertyType || "").trim()}`,
    `Service: ${String(service || "").trim()}`,
    `Requirement: ${String(message || "Site survey and quotation").trim()}`,
    `Source: ${String(formSource || "website-survey").trim()}`,
    "Please contact me with the next steps."
  ];
  return lines.join("\n");
}

/**
 * Formats an honest, transparent package enquiry message preserving starting price and survey disclaimer.
 */
export function formatPackageWhatsAppMessage({ packageName, startingPrice }) {
  const lines = [
    "Hello Sarathi Smart Solutions, I would like to enquire about your CCTV package.",
    `Interested package: ${String(packageName || "").trim()}`,
    `Displayed starting price: ₹${String(startingPrice || "").trim()}`,
    "Note: I understand the final recommendation and price depend on site survey, cable length, and installation conditions.",
    "Please arrange a site survey / quotation discussion."
  ];
  return lines.join("\n");
}

/**
 * Evaluates user selections and returns a coordinated service recommendation bundle.
 *
 * @param {Object} input
 * @param {string} input.space - 'Home' or 'Business'
 * @param {string[]} input.needs - Array of chosen service need keys
 * @param {string} input.size - 'Compact', 'Standard', or 'Large'
 * @returns {{ title: string, intro: string, items: Array<{ key: string, title: string, detail: string }>, summary: string }}
 * @throws {Error} if any parameter is missing, invalid, or unknown
 */
export function buildRecommendation({ space, needs, size, enquiryOptions = {} }) {
  if (!space || !["Home", "Business"].includes(space)) {
    throw new Error("Choose a valid space.");
  }
  if (!Array.isArray(needs) || needs.length === 0) {
    throw new Error("Choose at least one need.");
  }
  if (!size || !["Compact", "Standard", "Large"].includes(size)) {
    throw new Error("Choose a valid size.");
  }
  const unknownIndex = needs.findIndex(
    (need) => typeof need !== "string" || !Object.hasOwn(SERVICE_CATALOGUE, need)
  );
  if (unknownIndex !== -1) {
    throw new Error(`Unknown need: ${needs[unknownIndex]}`);
  }

  needs = [...new Set(needs)];
  const answers = describeEnquiryOptions(needs, enquiryOptions);

  // Calculate bundle complexity based on service count and installation scale
  const complexity = needs.length + (size === "Standard" ? 1 : size === "Large" ? 2 : 0);
  const includesCareService = needs.some((need) =>
    ["electrical", "appliance", "it", "tv", "ev"].includes(need)
  );
  const title = includesCareService
    ? needs.length === 1
      ? `${NEED_LABELS[needs[0]]} Plan`
      : "Home & Business Service Plan"
    : complexity >= 6
      ? "Smart Site 360 Bundle"
      : complexity >= 3
        ? "Connected Control Bundle"
        : "Secure Start Bundle";

  const items = needs.map((need) => ({
    key: need,
    title: NEED_LABELS[need],
    detail: [SERVICE_CATALOGUE[need].details[size], ...answers[need]].join(" · ")
  }));

  items.push({
    key: "setup",
    title: includesCareService
      ? "Assessment, service & handover"
      : "Planning, installation & handover",
    detail:
      "Confirm the requested work and site conditions, agree a quotation, then complete the service and handover"
  });

  const summary = formatEnquiryMessage({ space, needs, size, title, enquiryOptions });

  return {
    title,
    intro: `A coordinated ${space.toLowerCase()} solution for a ${size.toLowerCase()} setup, designed around the priorities you selected.`,
    items,
    summary
  };
}
