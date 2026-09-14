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

/**
 * Available service requirements and their human-readable labels.
 */
export const NEED_LABELS = Object.freeze({
  cctv: "CCTV surveillance & mobile viewing",
  network: "Wi-Fi & networking",
  biometric: "Biometric attendance / access control",
  intercom: "Video doorbell / intercom",
  locks: "Smart locks",
  automation: "Home / business automation"
});

/**
 * Setup size choices per space category.
 */
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

/**
 * Specific scope items for each service category and setup size.
 */
const NEED_DETAILS = Object.freeze({
  cctv: Object.freeze({
    Compact:
      "2–3 camera starting layout, recording and secure mobile viewing (Packages from ₹13,900)",
    Standard:
      "4–6 camera starting layout, recording and secure mobile viewing (Packages from ₹15,900–₹17,900)",
    Large:
      "8+ camera multi-zone layout, recording and secure mobile viewing (Packages from ₹30,900)"
  }),
  network: Object.freeze({
    Compact: "Router placement and Wi-Fi coverage check",
    Standard: "Mesh or access-point planning with essential LAN cabling",
    Large: "Multi-access-point network and structured cabling plan"
  }),
  biometric: Object.freeze({
    Compact: "Single-point biometric attendance or controlled entry",
    Standard: "Attendance and access setup for a growing team",
    Large: "Multi-door or multi-zone access planning with central oversight"
  }),
  intercom: Object.freeze({
    Compact: "Single-entry video doorbell or intercom",
    Standard: "Main-entry video intercom with convenient indoor access",
    Large: "Multi-point visitor communication and entry planning"
  }),
  locks: Object.freeze({
    Compact: "One smart lock with suitable PIN, card, fingerprint or app access",
    Standard: "Smart access for key doors with user setup",
    Large: "Multi-door smart locking plan with managed credentials"
  }),
  automation: Object.freeze({
    Compact: "Starter automation for selected lights, power points or sensors",
    Standard: "Room or zone-based control for everyday routines",
    Large: "Multi-zone automation plan for lighting, power and sensors"
  })
});

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
export function formatEnquiryMessage({ space, needs, size, title }) {
  const selectedNeeds = needs.map((need) => NEED_LABELS[need] || need).join(", ");
  return [
    "SARATHI SMART SOLUTIONS — ENQUIRY",
    `Space: ${space}`,
    `Approx. size: ${size}`,
    `Needs: ${selectedNeeds}`,
    `Recommended starting bundle: ${title}`,
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
 * Evaluates user selections and returns a coordinated service recommendation bundle.
 *
 * @param {Object} input
 * @param {string} input.space - 'Home' or 'Business'
 * @param {string[]} input.needs - Array of chosen service need keys
 * @param {string} input.size - 'Compact', 'Standard', or 'Large'
 * @returns {{ title: string, intro: string, items: Array<{ key: string, title: string, detail: string }>, summary: string }}
 * @throws {Error} if any parameter is missing, invalid, or unknown
 */
export function buildRecommendation({ space, needs, size }) {
  if (!space || !["Home", "Business"].includes(space)) {
    throw new Error("Choose a valid space.");
  }
  if (!Array.isArray(needs) || needs.length === 0) {
    throw new Error("Choose at least one need.");
  }
  if (!size || !["Compact", "Standard", "Large"].includes(size)) {
    throw new Error("Choose a valid size.");
  }
  const unknown = needs.find((need) => !NEED_LABELS[need]);
  if (unknown) {
    throw new Error(`Unknown need: ${unknown}`);
  }

  // Calculate bundle complexity based on service count and installation scale
  const complexity = needs.length + (size === "Standard" ? 1 : size === "Large" ? 2 : 0);
  const title =
    complexity >= 6
      ? "Smart Site 360 Bundle"
      : complexity >= 3
        ? "Connected Control Bundle"
        : "Secure Start Bundle";

  const items = needs.map((need) => ({
    key: need,
    title: NEED_LABELS[need],
    detail: NEED_DETAILS[need][size]
  }));

  items.push({
    key: "setup",
    title: "Planning, installation & handover",
    detail: "Placement review, clean installation, configuration and basic usage guidance"
  });

  const summary = formatEnquiryMessage({ space, needs, size, title });

  return {
    title,
    intro: `A coordinated ${space.toLowerCase()} solution for a ${size.toLowerCase()} setup, designed around the priorities you selected.`,
    items,
    summary
  };
}
