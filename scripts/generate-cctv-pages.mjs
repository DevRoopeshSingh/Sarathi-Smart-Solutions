/** Generate distinct, crawlable pages from confirmed CCTV service offerings. */
import { writeFile } from "node:fs/promises";

const pages = [
  {
    slug: "cctv-installation-mira-bhayandar",
    title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "CCTV installation in Mira Road and Bhayandar for homes, shops and offices. Compare camera packages, mobile viewing and wiring. Request a free local survey.",
    heading: "CCTV installation in Mira Road & Bhayandar",
    intro:
      "Know what is happening at your entrance, counter, or workplace. We plan camera positions, install the equipment, and help you view and replay footage on your phone.",
    action: "Request My Free CCTV Survey",
    sections: [
      {
        title: "Choose coverage around your property",
        text: "A flat may need coverage at the entrance and another priority area. A shop may need an entrance view and a separate counter view. Offices often need several access points covered. We check lighting, blind spots, and practical cable routes before recommending a camera count.",
        items: [
          "Homes and flats: entrances and customer-selected areas",
          "Shops: entry, exit, billing counter, and stock areas",
          "Offices and galas: access points and priority work areas"
        ]
      },
      {
        title: "Camera packages with a clear quotation",
        text: "The listed HD DVR packages start at ₹13,900 for 2 cameras, ₹15,900 for 3, ₹17,900 for 4, and ₹30,900 for 8. They include the listed equipment, standard cable allowance, installation, and mobile setup. IP upgrades are quoted separately after checking your site.",
        items: [
          "Compare 2MP Analog HD and 4MP IP options before choosing",
          "Confirm recorder channels, storage, and expected recording duration",
          "GST, UPS, monitor, extra cable, and civil work are quoted separately"
        ],
        link: ["/#packages", "Compare CCTV packages & camera options →"]
      },
      {
        title: "Installation and handover",
        text: "We agree the layout, route cables with protective casing where specified, fit the cameras and recorder, and check live view and recording. At handover, we explain playback and authorised mobile access. Internet is needed for remote viewing; local recording requires working equipment and power.",
        items: [
          "Written equipment and installation scope",
          "Mobile viewing setup and playback guidance",
          "Manufacturer warranty documentation where applicable"
        ]
      },
      {
        title: "Local survey and ongoing support",
        text: "Initial surveys in Mira Road and Bhayandar are free, subject to appointment availability. For Thane, Dahisar, Borivali, or other Mumbai MMR locations, confirm availability and any travel charge. Installation timing depends on cable routes, property access, permissions, and the agreed equipment.",
        link: ["/cctv-repair-amc-mira-bhayandar", "Explore CCTV maintenance & repair →"]
      }
    ]
  },
  {
    slug: "cctv-repair-amc-mira-bhayandar",
    title: "CCTV Repair & AMC in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "CCTV repair and AMC in Mira Road and Bhayandar. Get help with recording faults, offline cameras and mobile viewing. Scope, parts and visit timing confirmed upfront.",
    heading: "CCTV repair & AMC in Mira-Bhayandar",
    intro:
      "A camera feed is useful only when the system also records. Tell us what has stopped working so we can assess the cameras, recorder, storage, connections, and mobile viewing setup.",
    action: "Discuss My CCTV Problem",
    sections: [
      {
        title: "Help with common CCTV problems",
        text: "We assess the fault before recommending repair or replacement. Camera and recorder compatibility, cable condition, power, storage, and network access can all affect the result.",
        items: [
          "Offline cameras, intermittent video, or unclear images",
          "Recording gaps, playback issues, and hard-drive warnings",
          "Mobile viewing that stops working after a router or internet change"
        ]
      },
      {
        title: "What a standard non-comprehensive AMC covers",
        text: "Preventive maintenance helps identify issues before you need a recording. Visit frequency, property coverage, and response terms are written into your agreement.",
        items: [
          "Lens cleaning, camera alignment, and scheduled inspection",
          "Recording, hard-drive, connector, and power checks",
          "Mobile-viewing troubleshooting and agreed service visits"
        ],
        link: ["/amc-policy", "Read the CCTV AMC policy →"]
      },
      {
        title: "Parts and service charges, explained",
        text: "Replacement equipment, damaged cables, and other parts are billed separately under a non-comprehensive AMC. A comprehensive agreement must explicitly list covered replacements. Repair charges and equipment costs are confirmed after assessment.",
        items: [
          "Confirm assessment or visit charges before scheduling",
          "Approve replacement parts and additional work first",
          "Check the written warranty terms for existing equipment"
        ]
      },
      {
        title: "What to share when enquiring",
        text: "Tell us your locality, camera count, recorder brand or model if known, the fault, and when it started. Mention whether local playback still works and whether your internet or router recently changed. Never send passwords or security codes in your enquiry.",
        link: ["/#survey-form", "Send a CCTV maintenance enquiry →"]
      }
    ]
  },
  {
    slug: "housing-society-cctv-mira-bhayandar",
    title: "Housing Society CCTV in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "Plan CCTV for housing societies in Mira Road and Bhayandar. Assess gates, lobbies and parking, storage, authorised access and maintenance after a site survey.",
    heading: "CCTV planning for Mira-Bhayandar housing societies",
    intro:
      "Give your committee a clear coverage plan and itemized proposal. Start with the gates, lobbies, and parking areas that matter to your society, then agree recording and access requirements.",
    action: "Request a Society CCTV Survey",
    sections: [
      {
        title: "Plan coverage across common areas",
        text: "Walk through the property with the committee or authorised representative. Entrances, common lobbies, parking lanes, and the perimeter need different views. Camera positions and recording expectations are confirmed after checking lighting, distance, obstructions, and access to wiring routes.",
        items: [
          "Gate: distinguish entry and exit coverage requirements",
          "Lobby: cover agreed access points and common circulation areas",
          "Parking: assess lighting, vehicle routes, and blind spots"
        ]
      },
      {
        title: "Recorder, storage, and power planning",
        text: "The required camera count determines recorder channel capacity and cabling scope. Recording retention depends on resolution, frame rate, compression, activity, and hard-drive size. Ask for the expected duration in the proposal. Backup power can be quoted for power interruptions.",
        items: [
          "Compare HD DVR and IP/NVR options for the site",
          "Specify storage and future camera capacity",
          "Plan the equipment location, network, and optional UPS"
        ]
      },
      {
        title: "Agree access and handover",
        text: "The society should designate who may view, replay, or export recordings. At handover, we explain the agreed mobile access and playback setup. Committee decisions about placement, permissions, and access should be settled before installation.",
        items: [
          "Confirm installation access and any required society permissions",
          "Identify authorised users and the handover contact",
          "Record equipment, warranty terms, and support contact details"
        ]
      },
      {
        title: "Maintenance for a shared system",
        text: "Include lens cleaning, camera alignment, recording checks, and troubleshooting in your maintenance plan. Ask for visit frequency, response terms, parts exclusions, and equipment coverage in writing. We confirm scheduling based on the property and agreed scope.",
        link: ["/cctv-repair-amc-mira-bhayandar", "Review maintenance & AMC options →"]
      }
    ]
  }
];

const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const logo = `<a class="brand" href="/" aria-label="Sarathi Smart Solutions home"><img class="brand-logo" src="/assets/brand/sarathi-cctv-logo-pack/sarathi-logo-dark.svg" alt="Sarathi Smart Solutions — CCTV and security" width="48" height="48" /><span class="brand-copy"><strong>Sarathi</strong><small>Smart Solutions</small></span></a>`;
for (const page of pages) {
  const whatsapp = `https://wa.me/918369704457?text=${encodeURIComponent(`Hello Sarathi Smart Solutions, I would like to enquire about ${page.heading}. Please confirm availability and any applicable visit charges.`)}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.heading,
      serviceType: page.heading,
      url: `__SITE_URL__/${page.slug}`,
      areaServed: ["Mira Road", "Bhayandar East", "Bhayandar West"],
      provider: {
        "@type": "HomeAndConstructionBusiness",
        "@id": "__SITE_URL__/#business",
        name: "Sarathi Smart Solutions",
        url: "__SITE_URL__/",
        telephone: "+918369704457",
        address: {
          "@type": "PostalAddress",
          streetAddress: "RNP Park, Bhayander East",
          addressLocality: "Mira-Bhayandar, Thane",
          addressRegion: "Maharashtra",
          postalCode: "401105",
          addressCountry: "IN"
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "__SITE_URL__/" },
        { "@type": "ListItem", position: 2, name: page.heading, item: `__SITE_URL__/${page.slug}` }
      ]
    }
  ];
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><meta name="theme-color" content="#07131f" />
<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}" /><meta name="robots" content="index, follow" />
<link rel="canonical" href="__SITE_URL__/${page.slug}" />
<meta property="og:type" content="website" /><meta property="og:title" content="${escape(page.title)}" /><meta property="og:description" content="${escape(page.description)}" /><meta property="og:url" content="__SITE_URL__/${page.slug}" /><meta property="og:site_name" content="Sarathi Smart Solutions" /><meta property="og:locale" content="en_IN" /><meta property="og:image" content="__SITE_URL__/assets/brand/sarathi-cctv-logo-pack/sarathi-logo-light-2048.png" />
<meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${escape(page.title)}" /><meta name="twitter:description" content="${escape(page.description)}" /><meta name="twitter:image" content="__SITE_URL__/assets/brand/sarathi-cctv-logo-pack/sarathi-logo-light-2048.png" />
<link rel="icon" type="image/png" href="/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-32.png" /><link rel="stylesheet" href="/styles.css" />
<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>
</head><body class="seo-page">
<a class="skip-link" href="#service-content">Skip to service details</a>
<header class="site-header">${logo}<a class="header-phone" href="tel:+918369704457">83697 04457</a></header>
<main id="service-content" class="seo-content" tabindex="-1">
<nav class="seo-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true"> / </span><span>${escape(page.heading)}</span></nav>
<section class="seo-service-hero" aria-labelledby="service-title"><span class="kicker">Local CCTV &amp; security support</span><h1 id="service-title">${escape(page.heading)}</h1><p>${escape(page.intro)}</p><div class="seo-actions"><a class="button primary" href="${whatsapp}" target="_blank" rel="noopener noreferrer">${page.action}</a><a class="button ghost" href="tel:+918369704457">Talk to a CCTV Expert</a></div><p class="seo-note">Review and send your enquiry in WhatsApp. Our team confirms availability, visit charges where applicable, and timing.</p></section>
<div class="seo-detail-grid">${page.sections.map((section) => `<section class="seo-detail-card"><h2>${escape(section.title)}</h2><p>${escape(section.text)}</p>${section.items ? `<ul>${section.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}${section.link ? `<a class="text-link" href="${section.link[0]}">${escape(section.link[1])}</a>` : ""}</section>`).join("")}</div>
<section class="seo-related" aria-labelledby="related-title"><h2 id="related-title">More CCTV services</h2><nav class="seo-related-links" aria-label="Related CCTV services">${pages
    .filter((other) => other.slug !== page.slug)
    .map((other) => `<a href="/${other.slug}">${escape(other.heading)} →</a>`)
    .join("")}<a href="/#packages">View camera packages →</a></nav></section>
<section class="seo-local-contact"><h2>Speak to our local team</h2><p>Based at RNP Park, Bhayander East, Mira-Bhayandar, Thane — 401105. Call ahead to confirm availability or arrange a visit to your property.</p><a class="text-link" href="tel:+918369704457">Call +91 83697 04457</a><a class="text-link" href="/#survey-form">Request a site discussion →</a></section>
</main><footer class="seo-footer"><p>© Sarathi Smart Solutions</p><nav aria-label="Policies"><a href="/privacy">Privacy</a><a href="/warranty-policy">Warranty</a><a href="/amc-policy">AMC policy</a><a href="/terms">Terms</a></nav></footer>
</body></html>`;
  await writeFile(new URL(`../${page.slug}.html`, import.meta.url), html);
}
console.log(`Generated ${pages.length} CCTV service pages.`);
