/**
 * Generate distinct, crawlable, and rich service landing pages for Sarathi Smart Solutions.
 * Covers CCTV Installation, CCTV Repair/AMC, Housing Society CCTV, Wi-Fi Networking, and Smart Home Automation.
 */
import { writeFile } from "node:fs/promises";

const pages = [
  {
    slug: "cctv-installation-mira-bhayandar",
    image: "camera-mounting-1200.webp",
    imageAlt: "Weatherproof dome CCTV camera mounted on wall with sealed conduit",
    imageBadge: "Weatherproof Dome Mounting · Mira-Bhayandar",
    title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "Professional CCTV installation in Mira Road & Bhayandar for homes, shops and offices. Compare HD & IP camera packages, mobile setup and neat wiring. Get a free survey.",
    kicker: "Security & Surveillance in Mira-Bhayandar",
    heading: "CCTV Installation in Mira Road & Bhayandar",
    intro:
      "Protect your home, retail store, or workplace with high-definition surveillance. We assess camera angles, install tamper-resistant cabling, and set up live mobile viewing on your smartphone.",
    action: "Request Free CCTV Survey",
    whatsappMessage:
      "Hello Sarathi Smart Solutions, I am interested in CCTV installation. Please share available packages and arrange a site survey.",
    sections: [
      {
        title: "Coverage Planning for Homes, Shops & Offices",
        text: "Every property requires strategic camera placement rather than guesswork. A residence needs entry and balcony monitoring; a retail shop requires cash counter and customer entry coverage; offices need attendance and server area security. We inspect lighting, blind spots, and cable pathways before suggesting an ideal camera count.",
        items: [
          "Homes & flats: main door, passage, and priority balcony points",
          "Retail shops: billing counter, display rows, stockroom, and shutter entrances",
          "Offices & commercial galas: reception, workstation corridors, and server enclosures"
        ]
      },
      {
        title: "Transparent HD & IP Camera Package Options",
        text: "Our HD DVR setups start from ₹13,900 for 2 cameras, ₹15,900 for 3, ₹17,900 for 4, and ₹30,900 for 8 cameras. Packages include night-vision cameras, DVR, 1TB surveillance hard drive, power supply, surface casing, and complete mobile configuration. Upgrades to 4K IP systems with PoE are quoted after a site survey.",
        items: [
          "Compare 2MP Full HD Analog and 4MP/5MP IP camera systems",
          "Dedicated surveillance hard drives designed for 24/7 continuous recording",
          "Itemized quotations detailing hardware models, wiring, and site extras"
        ],
        link: ["/#packages", "Compare all CCTV package prices & inclusions →"]
      },
      {
        title: "Tidy Surface Conduit & Concealed Wiring",
        text: "Loose, drooping wiring creates safety risks and ruins interior aesthetics. We route all video and power cables inside durable PVC electrical surface casing with clean 90-degree corner mitres, or route through concealed conduits where available. Outdoor junction boxes are sealed against heavy monsoon rain.",
        items: [
          "Surface-mounted PVC casing or concealed conduit pulling",
          "Weatherproof sealed junction boxes preventing water damage",
          "Pre-tested copper cabling with zero signal degradation"
        ]
      },
      {
        title: "Mobile App Setup, Video Playback & Warranty Support",
        text: "Before handover, our technician configures authorized mobile viewing on your Android or iOS devices and demonstrates how to search, playback, and export recorded video clips. You receive OEM manufacturer hardware warranties (per manufacturer terms) plus installation workmanship support.",
        items: [
          "Remote smartphone live streaming and instant video playback",
          "Multi-user authorized access with password protection",
          "Local on-site service support from Bhayander East"
        ],
        link: ["/cctv-repair-amc-mira-bhayandar", "Explore CCTV repair & AMC maintenance →"]
      }
    ],
    faqs: [
      {
        q: "Is the CCTV site survey really free in Mira-Bhayandar?",
        a: "Yes. Initial site surveys across Mira Road and Bhayandar are completely free with zero booking commitment. We inspect your layout, identify blind spots, and provide a clear written estimate."
      },
      {
        q: "Can I view camera footage on my phone when away from home?",
        a: "Yes. Every system includes remote mobile viewing setup on your Android or iPhone. As long as your recorder is connected to home broadband, you can stream live footage and review recordings from anywhere."
      },
      {
        q: "What warranty coverage is provided with the installation?",
        a: "All CCTV packages include OEM hardware warranties (as per manufacturer terms) and installation workmanship support covering cabling and camera alignment."
      },
      {
        q: "How long does a typical installation take?",
        a: "A standard 2 to 4 camera setup in a flat or retail shop is completed within 4 to 6 hours with tidy surface casing and mobile app handover on the same day."
      }
    ]
  },
  {
    slug: "cctv-repair-amc-mira-bhayandar",
    image: "dvr-nvr-rack-1200.webp",
    imageAlt: "6U network server rack housing NVR, PoE switch, and organized patch panel",
    imageBadge: "Protected Recorder Enclosure · Mira-Bhayandar",
    title: "CCTV Repair & AMC in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "CCTV repair and AMC in Mira Road and Bhayandar. Resolve offline cameras, recording faults, hard-disk errors and mobile viewing drops. Scope and parts confirmed upfront.",
    kicker: "CCTV Maintenance & Fault Troubleshooting",
    heading: "CCTV Repair & AMC in Mira-Bhayandar",
    intro:
      "A security system is only valuable when it records reliably. If your cameras show a black screen, video loss, recording gaps, or mobile app disconnections, our local technicians diagnose and resolve the fault promptly.",
    action: "Discuss My CCTV Problem",
    whatsappMessage:
      "Hello Sarathi Smart Solutions, I need CCTV repair or maintenance support. Please contact me.",
    sections: [
      {
        title: "Fast Diagnosis for Offline Cameras & Video Loss",
        text: "We identify whether video faults stem from faulty SMPS power supplies, corroded BNC/DC connectors, severed cables, or camera sensor degradation. We test each line individually to avoid replacing working hardware unnecessarily.",
        items: [
          "Offline camera channels, night-vision IR failure, and flickering video",
          "Burnt power supply units (SMPS) and blown DC adapters",
          "Intermittent video signals caused by loose or oxidised connections"
        ]
      },
      {
        title: "Hard Drive & Video Playback Fault Rectification",
        text: "One of the most dangerous CCTV failures is a recorder that displays live video but fails to store footage. We test hard drive sectors, DVR motherboard ports, and firmware settings to ensure continuous 24/7 video recording without gaps.",
        items: [
          "Beeping DVR alerts indicating hard disk read/write failures",
          "Playback timestamp freezing and corrupted recording segments",
          "Firmware updates and forgotten admin password recovery"
        ]
      },
      {
        title: "Structured Preventive AMC Maintenance Contracts",
        text: "Preventive maintenance stops security blind spots before an incident occurs. Our annual maintenance contracts cover regular camera cleaning, lens refocusing, power output verification, recording health audits, and prioritized emergency visits.",
        items: [
          "Scheduled quarterly maintenance visits and lens cleaning",
          "Recording retention audit and hard disk health checks",
          "Fixed priority response window for emergency fault calls"
        ],
        link: ["/amc-policy", "Read standard CCTV AMC inclusions & terms →"]
      },
      {
        title: "Transparent Part Replacement & Service Pricing",
        text: "Under standard non-comprehensive agreements, replacement parts, damaged cables, and new hardware are quoted and approved before installation. We provide transparent billing with no surprise hidden fees.",
        items: [
          "Written fault diagnosis and repair estimate before starting work",
          "Genuine OEM replacement components with manufacturer warranty",
          "Support for existing systems installed by third-party contractors"
        ],
        link: ["/#survey-form", "Send a CCTV maintenance enquiry →"]
      }
    ],
    faqs: [
      {
        q: "Why did my CCTV mobile app stop connecting?",
        a: "Mobile viewing commonly disconnects when the broadband router restarts with a new IP address, LAN cables become loose, or recorder P2P cloud services need re-binding. We reconfigure mobile access quickly."
      },
      {
        q: "Do you repair CCTV systems installed by other vendors?",
        a: "Yes. We diagnose and service CCTV systems from all major brands (Hikvision, CP Plus, Dahua, UNV) regardless of who originally installed them."
      },
      {
        q: "What is the difference between comprehensive and non-comprehensive AMC?",
        a: "A standard non-comprehensive AMC covers regular preventive service visits, labor, and diagnostic inspections. Any hardware replacements (like a new power supply or hard disk) are billed at item rates."
      },
      {
        q: "How quickly can a technician visit my property in Mira-Bhayandar?",
        a: "Because our team is based directly in Bhayander East, service visits are scheduled promptly subject to appointment availability."
      }
    ]
  },
  {
    slug: "housing-society-cctv-mira-bhayandar",
    image: "camera-mounting-1200.webp",
    imageAlt: "Exterior CCTV camera setup protecting society main entrance gate",
    imageBadge: "Housing Society Entrance Surveillance",
    title: "Housing Society CCTV in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "Plan CCTV for residential housing societies in Mira Road and Bhayandar. Cover main gates, lobbies, lifts, and parking with long-retention NVR storage. Request committee survey.",
    kicker: "Multi-Zone Surveillance for Residential Complexes",
    heading: "CCTV Planning for Mira-Bhayandar Housing Societies",
    intro:
      "Deliver safety, accountability, and peace of mind for your residential building. We assist managing committees with professional site assessments, multi-zone camera layouts, long-retention NVR storage, and transparent AGM proposals.",
    action: "Request Society CCTV Survey",
    whatsappMessage:
      "Hello Sarathi Smart Solutions, I would like to plan CCTV for our housing society. Please share quotation details and arrange a site survey.",
    sections: [
      {
        title: "Comprehensive Gate, Lobby & Parking Layouts",
        text: "Shared residential premises require specialized multi-point coverage. We plan high-resolution camera angles covering entry gates with vehicle number plate clarity, exit barriers, ground floor lobbies, lift passages, and underground or stilt parking areas.",
        items: [
          "Main entry & exit gates: vehicle movement and visitor entry capture",
          "Ground floor lobbies & letterbox zones: resident and delivery tracking",
          "Parking bays & perimeter boundaries: nighttime lighting and blind spot coverage"
        ]
      },
      {
        title: "Long-Term Retention Storage & NVR Sizing",
        text: "Society committees often require 15 to 30 days of continuous recording retention. We calculate appropriate hard drive capacities based on camera resolution, H.265+ smart compression, and frame rates to guarantee the expected playback duration.",
        items: [
          "Centralized 8, 16, or 32-channel IP NVR recorders with PoE switching",
          "Dual hard-drive RAID or enterprise surveillance drives for 30-day retention",
          "Optional UPS power backup ensuring recording continues during power outages"
        ]
      },
      {
        title: "Security Cabin Monitoring & Committee Access",
        text: "We install dedicated LED monitor displays in the security guard cabin for real-time monitoring, while configuring password-protected remote smartphone viewing for authorized committee office bearers.",
        items: [
          "Security guard cabin monitor installation with multi-split screen",
          "Role-based remote access for secretary and chairman smartphones",
          "Encrypted video export protocols preventing unauthorized footage leaks"
        ]
      },
      {
        title: "Transparent Society Proposals Ready for AGM Approval",
        text: "We provide itemized, formal written proposals complete with camera location schematics, hardware specifications, warranty documentation, and payment milestone structures to simplify committee review and AGM approvals.",
        items: [
          "Itemized quotations detailing camera models, cabling lengths, and casing",
          "Presentation-ready layout summaries for managing committee meetings",
          "Long-term society AMC maintenance support contracts"
        ],
        link: ["/cctv-repair-amc-mira-bhayandar", "Review housing society AMC contracts →"]
      }
    ],
    faqs: [
      {
        q: "How does Sarathi Smart Solutions assist our society committee during planning?",
        a: "We conduct a complete property walkthrough with committee members, identify critical coverage zones, calculate storage requirements, and provide a formal written quotation ready for committee review."
      },
      {
        q: "How many days of video recording can our society maintain?",
        a: "We size storage based on your requirements. Most housing societies opt for 15 to 30 days of continuous recording using enterprise surveillance drives and smart H.265+ compression."
      },
      {
        q: "How is outdoor cabling protected against monsoons and rodents?",
        a: "We use heavy-duty UV-stabilized PVC conduits, galvanized steel clamps, and weatherproof IP66 junction boxes along external shafts and parking areas."
      },
      {
        q: "Can multiple committee members view the cameras on their phones?",
        a: "Yes. We configure multi-user remote access with separate secure credentials so designated committee members can monitor premises simultaneously."
      }
    ]
  },
  {
    slug: "wifi-networking-mira-bhayandar",
    image: "wifi-ap-installation-1200.webp",
    imageAlt: "Enterprise ceiling-mounted Wi-Fi access point with concealed PoE Ethernet feed",
    imageBadge: "Ceiling Access Point Installation · Mira-Bhayandar",
    title: "Wi-Fi Installation & Mesh Networking in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "Professional Wi-Fi installation, mesh networking, and Cat6 LAN cabling in Mira Road & Bhayandar. Eliminate dead zones for homes and offices. Request a free site survey.",
    kicker: "Connectivity • High-Speed Networking • Zero Deadzones",
    heading: "Wi-Fi Installation, Mesh Networking & LAN Cabling in Mira-Bhayandar",
    intro:
      "Eliminate internet dead zones, video call buffering, and slow download speeds. We design and install high-performance whole-home mesh Wi-Fi, structured Cat6 gigabit Ethernet cabling, and commercial network switches across Mira-Bhayandar.",
    action: "Request Free Wi-Fi Survey",
    whatsappMessage:
      "Hello Sarathi Smart Solutions, I need Wi-Fi/networking installation. Please contact me regarding the available solutions.",
    sections: [
      {
        title: "Whole-Home Mesh Wi-Fi & Dead Zone Elimination",
        text: "Thick RCC concrete walls and structural pillars in Mira-Bhayandar flats frequently choke standard ISP router signals. Our dual-band and tri-band Wi-Fi 6 mesh systems broadcast a single, seamless network across every bedroom, kitchen, and balcony with zero signal drops.",
        items: [
          "Seamless roaming with a single Wi-Fi name and password across the entire flat",
          "Coverage across 1BHK, 2BHK, 3BHK, duplexes, row houses, and offices",
          "High-performance hardware from TP-Link Deco, Netgear, and Ubiquiti UniFi"
        ]
      },
      {
        title: "Cat6 Structured LAN Cabling & Patch Panels",
        text: "Wi-Fi cannot beat the zero-latency reliability of pure copper gigabit Ethernet for smart 4K TVs, gaming consoles, desktop workstations, and CCTV NVRs. We install high-grade Cat6 cabling inside neat PVC surface casing or through existing concealed conduits.",
        items: [
          "100% pure copper Cat6 UTP cables supporting speeds up to 1 Gbps",
          "Surface-mounted PVC electrical casing with clean 90-degree mitred corners",
          "Wall faceplates, keystone jacks, and patch panel termination with fluked testing"
        ]
      },
      {
        title: "PoE Access Points & Gigabit Network Switches",
        text: "For commercial offices, clinics, retail showrooms, and multi-floor bungalows, ceiling-mounted Power-over-Ethernet (PoE) access points provide robust enterprise coverage without messy wall adapters or dangling wires.",
        items: [
          "Ceiling and wall-mount enterprise access points with centralized cloud control",
          "Unmanaged and smart managed PoE gigabit switches (8, 16, 24 ports)",
          "Structured 6U/9U network rack installation with clean cable lacing"
        ]
      },
      {
        title: "Network Troubleshooting & Speed Diagnostics",
        text: "Paying for a 300 Mbps broadband connection but only getting 25 Mbps in your bedroom? We analyze Wi-Fi channel congestion, router placement, RF interference, and faulty RJ45 terminations to restore full ISP speeds throughout your premises.",
        items: [
          "Wi-Fi signal strength mapping and frequency band balancing (2.4 GHz vs 5 GHz)",
          "Re-crimping oxidized RJ45 connectors and replacing damaged patch cords",
          "Router relocation and primary gateway optimization for work-from-home setups"
        ],
        link: ["/#survey-form", "Schedule a local network assessment →"]
      }
    ],
    faqs: [
      {
        q: "What is the difference between a Wi-Fi range extender and a Mesh system?",
        a: "Range extenders repeat a degraded signal, cut bandwidth by 50%, and create separate confusing network names. A Mesh system uses intelligent interconnected nodes that broadcast a single unified network with full gigabit speeds and seamless handoff."
      },
      {
        q: "Can you run Ethernet cables without damaging my interior decor?",
        a: "Yes. We use slim, color-matched surface PVC electrical casing routed neatly along skirting boards, door frames, and cornices, or pull cables through existing concealed conduits without wall chipping."
      },
      {
        q: "Which Wi-Fi router and networking brands do you install?",
        a: "We supply, configure, and support industry leaders including TP-Link (Deco & Omada), Ubiquiti UniFi, D-Link, and Netgear, selecting models suited to your property layout and ISP bandwidth."
      },
      {
        q: "Can you optimize networking for work-from-home video calls and gaming?",
        a: "Yes. We set up Quality of Service (QoS) bandwidth priority and dedicated hardwired Cat6 Ethernet drops for work laptops, gaming PCs, and smart TVs to eliminate lag and buffering."
      }
    ]
  },
  {
    slug: "smart-home-automation-mira-bhayandar",
    image: "cable-management-after-1200.webp",
    imageAlt: "Precision structured patch panel and smart automation hardware enclosure",
    imageBadge: "Smart Hardware Integration & Precision Dressing",
    title: "Smart Home Automation & Digital Locks in Mira-Bhayandar | Sarathi Smart Solutions",
    description:
      "Smart home automation, biometric digital locks, and video door phones in Mira Road & Bhayandar. Control lighting, access, and security from your smartphone. Get a free quote.",
    kicker: "Smart Living • Keyless Access • Remote Control",
    heading: "Smart Home Automation, Biometric Locks & Video Intercoms in Mira-Bhayandar",
    intro:
      "Upgrade your living space with intelligent keyless security and effortless smartphone control. We install biometric smart door locks, video door phones, and smart switch modules configured directly for your smartphone.",
    action: "Explore Smart Home Options",
    whatsappMessage:
      "Hello Sarathi Smart Solutions, I am interested in smart home automation. Please share the available options.",
    sections: [
      {
        title: "Biometric Smart Door Locks & Keyless Access",
        text: "Upgrade your main door or safety grill with fingerprint recognition, RFID card tap, digital PIN codes, and smartphone remote unlocking. Never worry about forgotten keys, locked-out family members, or unauthorized key duplication again.",
        items: [
          "5-way unlocking: 360° optical fingerprint, PIN keypad, RFID card, app & mechanical key",
          "Anti-tamper alarm, fake PIN security code protection, and auto-locking deadbolts",
          "Compatible with Yale, Godrej, and Tuya digital mortise locks for wooden and metal doors"
        ]
      },
      {
        title: "HD Video Door Phones & Smart Intercoms",
        text: "See and speak to visitors at your doorstep from an indoor touch screen monitor or directly on your phone from anywhere in the world. Essential security and convenience for families, working professionals, and senior citizens.",
        items: [
          "High-definition night-vision doorbell camera with 130° wide-angle view",
          "Two-way clear audio communication with visitor snapshot and clip recording",
          "Electronic lock integration allowing one-touch main gate unlocking from inside"
        ]
      },
      {
        title: "Retrofit Smart Switches & App Lighting Control",
        text: "Automate lights, fans, geysers, and air conditioners without changing your existing designer switchboards. Compact smart modules fit discreetly behind existing switch plates, retaining manual wall switch functionality while adding phone and voice control.",
        items: [
          "Wi-Fi and Zigbee micro-modules installed behind existing switchboard plates",
          "Voice assistant integration with Amazon Alexa and Google Assistant",
          "Automated smart schedules, countdown timers, and custom scenes (Morning, Away, Night)"
        ]
      },
      {
        title: "IoT Sensors, Climate & Curtain Automation",
        text: "Connect motorized smart curtains, infrared (IR) blasters for AC/TV control, motion sensors, and water tank overflow detectors to create an intelligent home ecosystem that responds automatically to your daily routine.",
        items: [
          "Smart IR controllers replacing all television, AC, and set-top box remote controls",
          "Motorized curtain tracks scheduled to open at sunrise and close at sunset",
          "Motion sensors and smart water level automation preventing tank overflows"
        ],
        link: ["/#survey-form", "Request a smart home consultation →"]
      }
    ],
    faqs: [
      {
        q: "Can a digital smart lock be installed on my existing wooden door or safety grill?",
        a: "Yes. Most digital mortise locks install cleanly on standard wooden doors (minimum 35mm thickness). We also supply specialized slim-backset smart locks designed specifically for metal safety grill doors."
      },
      {
        q: "What happens if the smart lock battery drains completely?",
        a: "Smart locks provide low-battery voice alerts weeks in advance. If batteries drain completely, every lock includes emergency manual keys and an external USB port for instant power-bank jump-starting."
      },
      {
        q: "Do I need to redo my house wiring to install smart automation?",
        a: "No rewiring or wall chipping is needed. Our retrofit smart switch modules sit directly behind your current switchboard plates, leaving your existing switches, tiles, and interior paint untouched."
      },
      {
        q: "Can I control my smart devices while travelling outside India?",
        a: "Yes. As long as your home Wi-Fi is online and your smartphone has an active internet connection, you can monitor door locks, operate lights, and receive security notifications worldwide."
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

const serviceAreas = [
  "Bhayandar East",
  "Bhayandar West",
  "Mira Road",
  "Mira-Bhayandar",
  "Dahisar",
  "Borivali",
  "Naigaon",
  "Vasai",
  "Thane"
];

for (const page of pages) {
  const whatsappUrl = `https://wa.me/918369704457?text=${encodeURIComponent(page.whatsappMessage || `Hello Sarathi Smart Solutions, I would like to enquire about ${page.heading}. Please confirm availability and any applicable visit charges.`)}`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.heading,
      serviceType: page.heading,
      url: `__SITE_URL__/${page.slug}`,
      mainEntityOfPage: `__SITE_URL__/${page.slug}`,
      image: `__SITE_URL__/assets/images/${page.image}`,
      areaServed: serviceAreas,
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
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 19.3152633,
          longitude: 72.8586247
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
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a
        }
      }))
    }
  ];

  const imageBase = page.image.replace(/-\d+\.webp$/, "");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#07131f" />
<title>${escape(page.title)}</title>
<meta name="description" content="${escape(page.description)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="__SITE_URL__/${page.slug}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escape(page.title)}" />
<meta property="og:description" content="${escape(page.description)}" />
<meta property="og:url" content="__SITE_URL__/${page.slug}" />
<meta property="og:site_name" content="Sarathi Smart Solutions" />
<meta property="og:locale" content="en_IN" />
<meta property="og:image" content="__SITE_URL__/assets/images/${page.image}" />
<meta property="og:image:type" content="image/webp" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="896" />
<meta property="og:image:alt" content="${escape(page.imageAlt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(page.title)}" />
<meta name="twitter:description" content="${escape(page.description)}" />
<meta name="twitter:image" content="__SITE_URL__/assets/images/${page.image}" />
<meta name="twitter:image:alt" content="${escape(page.imageAlt)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-32.png" />
<link rel="icon" type="image/png" sizes="128x128" href="/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-128.png" />
<link rel="stylesheet" href="/styles.css" />
<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>
</head>
<body class="seo-page">
<a class="skip-link" href="#service-content">Skip to service details</a>

<header class="site-header">
  ${logo}
  <div class="header-actions">
    <a class="header-phone" href="tel:+918369704457" aria-label="Call +91 83697 04457">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>83697 04457</span>
    </a>
  </div>
</header>

<main id="service-content" class="seo-content" tabindex="-1">
  <nav class="seo-breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span aria-hidden="true"> / </span>
    <span>${escape(page.heading)}</span>
  </nav>

  <section class="seo-service-hero" aria-labelledby="service-title">
    <div class="seo-hero-layout">
      <div>
        <span class="kicker">${escape(page.kicker)}</span>
        <h1 id="service-title">${escape(page.heading)}</h1>
        <p>${escape(page.intro)}</p>
        <div class="seo-actions">
          <a class="button primary" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${page.action}</a>
          <a class="button ghost" href="tel:+918369704457">Call Now: +91 83697 04457</a>
        </div>
        <p class="seo-note">
          Chat directly on WhatsApp. Our local team confirms requirements, availability, and scheduling.
        </p>
      </div>

      <div class="seo-media-card">
        <img
          src="/assets/images/${imageBase}-1200.webp"
          srcset="
            /assets/images/${imageBase}-480.webp 480w,
            /assets/images/${imageBase}-960.webp 960w,
            /assets/images/${imageBase}-1200.webp 1200w
          "
          sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 900px) calc(50vw - 40px), 480px"
          alt="${escape(page.imageAlt)}"
          width="1200"
          height="896"
          loading="lazy"
          decoding="async"
        />
        <div class="seo-media-badge">${escape(page.imageBadge)}</div>
      </div>
    </div>
  </section>

  <div class="seo-detail-grid">
    ${page.sections
      .map(
        (section) => `
    <section class="seo-detail-card">
      <h2>${escape(section.title)}</h2>
      <p>${escape(section.text)}</p>
      ${section.items ? `<ul>${section.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
      ${section.link ? `<a class="text-link" href="${section.link[0]}">${escape(section.link[1])}</a>` : ""}
    </section>`
      )
      .join("")}
  </div>

  <section class="seo-faq-section" aria-labelledby="faq-section-title">
    <h2 id="faq-section-title">Frequently Asked Questions</h2>
    <p>Everything you need to know about our service standards, pricing structure, warranties, and local support in Mira-Bhayandar.</p>
    <div class="seo-faq-grid">
      ${page.faqs
        .map(
          (faq) => `
      <article class="seo-faq-card">
        <h3>${escape(faq.q)}</h3>
        <p>${escape(faq.a)}</p>
      </article>`
        )
        .join("")}
    </div>
  </section>

  <section class="seo-areas-card" aria-labelledby="areas-title">
    <h3 id="areas-title">Local Service Areas in Mira-Bhayandar &amp; Beyond</h3>
    <p>We provide prompt on-site surveys, installation, and support across the following localities:</p>
    <div class="seo-areas-list">
      ${serviceAreas.map((area) => `<span class="seo-area-pill">${escape(area)}</span>`).join("")}
    </div>
  </section>

  <section class="seo-related" aria-labelledby="related-title">
    <h2 id="related-title">Explore More Technology Services</h2>
    <nav class="seo-related-links" aria-label="Related technology services">
      ${pages
        .filter((other) => other.slug !== page.slug)
        .map((other) => `<a href="/${other.slug}">${escape(other.heading)} →</a>`)
        .join("")}
      <a href="/#packages">View CCTV starting packages →</a>
      <a href="/digital-seva-kendra">Sarathi Digital Seva Kendra →</a>
    </nav>
  </section>

  <section class="seo-local-contact">
    <h2>Speak to Our Local Team</h2>
    <p>
      Based at RNP Park, Bhayander East, Mira-Bhayandar, Thane — 401105. Contact our team to confirm availability, request a free site survey, or discuss your technical requirements.
    </p>
    <a class="text-link" href="tel:+918369704457">Call +91 83697 04457</a>
    <a class="text-link" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp →</a>
    <a class="text-link" href="/#survey-form">Request a site discussion →</a>
  </section>
</main>

<aside class="floating-contact cctv-contact" aria-label="Quick contact">
  <a class="contact-pill call-pill" href="tel:+918369704457" aria-label="Call Sarathi Smart Solutions on +91 83697 04457">
    <span class="pill-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    </span>
    <span class="pill-text">Call now</span>
  </a>
  <a class="contact-pill wa-pill" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Sarathi Smart Solutions on WhatsApp">
    <span class="pill-icon wa-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2s-.8 1-.9 1.2c-.2.2-.3.2-.6.1s-1.3-.5-2.4-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.2-1.2 2.8c0 1.7 1.2 3.3 1.4 3.5.2.3 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .8.8.3 1.6.2 2.2.1.7-.1 2.1-.8 2.4-1.7.3-.8.3-1.6.2-1.7-.1-.2-.3-.3-.6-.5zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3.3.9.9-3.2-.2-.4A8.2 8.2 0 1 1 12 20.2z"/></svg>
    </span>
    <span class="pill-text contact-desktop-label">Chat on WhatsApp</span>
    <span class="pill-text contact-mobile-label">WhatsApp</span>
  </a>
</aside>

<footer class="seo-footer">
  <p>© 2026 Sarathi Smart Solutions. All rights reserved.</p>
  <nav aria-label="Policies">
    <a href="/privacy">Privacy</a>
    <a href="/warranty-policy">Warranty</a>
    <a href="/amc-policy">AMC policy</a>
    <a href="/terms">Terms</a>
    <a href="/cancellation-refund">Cancellation</a>
  </nav>
</footer>
</body>
</html>`;

  await writeFile(new URL(`../${page.slug}.html`, import.meta.url), html);
}
console.log(`Generated ${pages.length} service landing pages.`);
