export const NEED_LABELS = {
  cctv: "CCTV surveillance & mobile viewing",
  network: "Wi-Fi & networking",
  biometric: "Biometric attendance / access control",
  intercom: "Video doorbell / intercom",
  locks: "Smart locks",
  automation: "Home / business automation"
};

export const SIZE_OPTIONS = {
  Home: [
    { value: "Compact", title: "Compact", description: "1–2 rooms / small flat" },
    { value: "Standard", title: "Standard", description: "2–3 BHK / medium home" },
    { value: "Large", title: "Large", description: "Large flat / bungalow" }
  ],
  Business: [
    { value: "Compact", title: "Compact", description: "Small shop / cabin" },
    { value: "Standard", title: "Standard", description: "Office / showroom" },
    { value: "Large", title: "Large", description: "Multi-zone / warehouse" }
  ]
};

const details = {
  cctv: {
    Compact: "2–3 camera starting layout, recording and secure mobile viewing (Packages from ₹13,900)",
    Standard: "4–6 camera starting layout, recording and secure mobile viewing (Packages from ₹15,900–₹17,900)",
    Large: "8+ camera multi-zone layout, recording and secure mobile viewing (Packages from ₹30,900)"
  },
  network: {
    Compact: "Router placement and Wi-Fi coverage check",
    Standard: "Mesh or access-point planning with essential LAN cabling",
    Large: "Multi-access-point network and structured cabling plan"
  },
  biometric: {
    Compact: "Single-point biometric attendance or controlled entry",
    Standard: "Attendance and access setup for a growing team",
    Large: "Multi-door or multi-zone access planning with central oversight"
  },
  intercom: {
    Compact: "Single-entry video doorbell or intercom",
    Standard: "Main-entry video intercom with convenient indoor access",
    Large: "Multi-point visitor communication and entry planning"
  },
  locks: {
    Compact: "One smart lock with suitable PIN, card, fingerprint or app access",
    Standard: "Smart access for key doors with user setup",
    Large: "Multi-door smart locking plan with managed credentials"
  },
  automation: {
    Compact: "Starter automation for selected lights, power points or sensors",
    Standard: "Room or zone-based control for everyday routines",
    Large: "Multi-zone automation plan for lighting, power and sensors"
  }
};

export function buildRecommendation({ space, needs, size }) {
  if (!space || !["Home", "Business"].includes(space)) throw new Error("Choose a valid space.");
  if (!Array.isArray(needs) || needs.length === 0) throw new Error("Choose at least one need.");
  if (!size || !["Compact", "Standard", "Large"].includes(size)) throw new Error("Choose a valid size.");
  const unknown = needs.find((need) => !NEED_LABELS[need]);
  if (unknown) throw new Error(`Unknown need: ${unknown}`);

  const complexity = needs.length + (size === "Standard" ? 1 : size === "Large" ? 2 : 0);
  const title = complexity >= 6
    ? "Smart Site 360 Bundle"
    : complexity >= 3
      ? "Connected Control Bundle"
      : "Secure Start Bundle";

  const items = needs.map((need) => ({
    key: need,
    title: NEED_LABELS[need],
    detail: details[need][size]
  }));

  items.push({
    key: "setup",
    title: "Planning, installation & handover",
    detail: "Placement review, clean installation, configuration and basic usage guidance"
  });

  const selected = needs.map((need) => NEED_LABELS[need]).join(", ");
  const summary = [
    "SARATHI SMART SOLUTIONS — ENQUIRY",
    `Space: ${space}`,
    `Approx. size: ${size}`,
    `Needs: ${selected}`,
    `Recommended starting bundle: ${title}`,
    "Please advise a suitable solution and quotation after confirming site requirements."
  ].join("\n");

  return {
    title,
    intro: `A coordinated ${space.toLowerCase()} solution for a ${size.toLowerCase()} setup, designed around the priorities you selected.`,
    items,
    summary
  };
}
