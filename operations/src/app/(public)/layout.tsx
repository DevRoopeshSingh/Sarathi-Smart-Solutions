import type { Metadata } from "next";
import "./public.css";

const siteUrl = process.env.PUBLIC_SITE_URL || "https://sarathismartsolutions.in";
const description =
  "CCTV installation and AMC in Mira Road and Bhayandar. Camera packages, mobile viewing and local support for homes, shops and societies. Request a free survey.";

export const metadata: Metadata = {
  title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
  description,
  keywords: [
    "CCTV installation Mira Road",
    "CCTV installation Bhayandar",
    "CCTV setup Naigaon",
    "CCTV camera Vasai",
    "CCTV AMC Mira Bhayandar",
    "smart home automation",
    "Wi-Fi networking solutions",
    "biometric attendance system",
    "video door phone",
    "smart TV mounting",
    "IT computer support",
    "website development Bhayandar",
    "security systems Thane Mumbai MMR"
  ],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
    description,
    url: siteUrl,
    siteName: "Sarathi Smart Solutions",
    locale: "en_IN",
    images: [
      {
        url: "/assets/images/camera-mounting-1200.webp",
        type: "image/webp",
        width: 1200,
        height: 896,
        alt: "Illustrative CCTV camera setup with protected cabling"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
    description,
    images: [
      {
        url: "/assets/images/camera-mounting-1200.webp",
        alt: "Illustrative CCTV camera setup with protected cabling"
      }
    ]
  }
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  url: `${siteUrl}/`,
  name: "Sarathi Smart Solutions",
  alternateName: ["Sarathi Smart Solutions", "Sarathi CCTV & Smart Solutions"],
  publisher: { "@id": `${siteUrl}/#business` }
};

const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: "Sarathi Smart Solutions",
  alternateName: ["Sarathi Smart Solutions", "Sarathi CCTV & Smart Solutions"],
  description:
    "Turnkey CCTV camera installation, Wi-Fi networking, smart-home automation, biometric access control, video intercoms, IT support, website development, and electrical/AC services for homes, shops, offices, and housing societies in Mira Road, Bhayandar, Naigaon, Vasai, Thane, and Mumbai MMR.",
  image: `${siteUrl}/assets/images/camera-mounting-1200.webp`,
  logo: `${siteUrl}/assets/brand/sarathi-cctv-logo-pack/sarathi-logo-light-2048.png`,
  telephone: "+918369704457",
  email: "sarathismartsolutions@gmail.com",
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
  },
  hasMap: "https://share.google/yKDsOqWwMYGzaVRIh",
  sameAs: ["https://share.google/yKDsOqWwMYGzaVRIh"],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "09:00",
      closes: "21:00"
    }
  ],
  priceRange: "₹₹",
  paymentAccepted: "Cash, UPI, Credit Card, Debit Card, Net Banking",
  currenciesAccepted: "INR",
  serviceType: [
    "CCTV Surveillance & Security Systems",
    "Wi-Fi, LAN & Structured Networking Solutions",
    "Smart-Home Automation & Connected Devices",
    "Video Doorbells, Intercoms & Access Control",
    "Biometric Attendance Systems",
    "Smart TV & Home Entertainment Setup",
    "Computer, Printer & IT Support",
    "Electrical & AC Services",
    "Website Development & Digital Business Solutions",
    "CCTV Repair, Maintenance & AMC Contracts"
  ],
  areaServed: [
    "Mira Road",
    "Bhayandar East",
    "Bhayandar West",
    "Naigaon",
    "Vasai",
    "Thane",
    "Dahisar",
    "Borivali",
    "Mumbai MMR"
  ],
  knowsAbout: [
    "CCTV Surveillance and Security Cameras",
    "Wi-Fi, LAN and Structured Cabling",
    "Smart Home Automation and IoT Systems",
    "Video Door Phones and Intercom Solutions",
    "Biometric Time Attendance and Access Control",
    "Smart TV Installation and Audio Setup",
    "Computer, Printer and IT Support",
    "Electrical Wiring and Air Conditioning Servicing",
    "Website Development and Digital Solutions",
    "CCTV AMC and Preventive Maintenance"
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Sarathi Smart Solutions Service Offerings",
    itemListElement: [
      {
        "@type": "OfferCatalog",
        name: "Security & Surveillance Systems",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "CCTV Surveillance & Security Systems",
              description:
                "High-definition indoor/outdoor CCTV cameras, digital/network video recorders, night vision, and remote mobile viewing."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Video Doorbells, Intercoms & Access Control",
              description:
                "Smart video door phones, multi-apartment intercoms, and digital door access control."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Biometric Attendance Systems",
              description:
                "Fingerprint and facial recognition biometric attendance systems for offices and commercial establishments."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "CCTV Repair, Maintenance & AMC Contracts",
              description:
                "Comprehensive and non-comprehensive Annual Maintenance Contracts (AMC), camera alignment, cable troubleshooting, and power supply repair."
            }
          }
        ]
      },
      {
        "@type": "OfferCatalog",
        name: "Networking & Smart Automation",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Wi-Fi, LAN & Networking Solutions",
              description:
                "High-speed mesh Wi-Fi, structured Ethernet cabling, routers, switches, and network rack setup."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Smart-Home Automation & Connected Devices",
              description:
                "Smart switches, voice assistant integration (Alexa/Google), sensor automation, and app control."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Smart TV & Home Entertainment Setup",
              description:
                "Professional TV wall mounting, concealed wiring, soundbar setup, and streaming device integration."
            }
          }
        ]
      },
      {
        "@type": "OfferCatalog",
        name: "IT, Digital & Support Services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Computer, Printer & IT Support",
              description:
                "Desktop/laptop diagnostics, OS installation, network printer configuration, data backup, and technical troubleshooting."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Website Development & Digital Business Solutions",
              description:
                "Responsive modern business websites, local SEO setup, Google Business Profile optimization, and digital tools."
            }
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Electrical & AC Services",
              description:
                "Electrical wiring, earthing, switchboards, and split/window AC installation and maintenance through qualified technicians."
            }
          }
        ]
      }
    ]
  },
  "@id": `${siteUrl}/#business`,
  url: `${siteUrl}/`
};

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${siteUrl}/#webpage`,
  url: `${siteUrl}/`,
  name: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
  isPartOf: { "@id": `${siteUrl}/#website` },
  mainEntity: { "@id": `${siteUrl}/#business` },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/assets/images/camera-mounting-1200.webp`,
    contentUrl: `${siteUrl}/assets/images/camera-mounting-1200.webp`,
    width: 1200,
    height: 896,
    caption: "Illustrative CCTV camera setup with protected cabling"
  }
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "CCTV & Smart Technology Installation Services",
  serviceType: "CCTV installation, security systems, networking, smart automation and IT support",
  provider: {
    "@id": `${siteUrl}/#business`
  },
  areaServed: [
    "Mira Road",
    "Bhayandar East",
    "Bhayandar West",
    "Naigaon",
    "Vasai",
    "Thane",
    "Dahisar",
    "Borivali",
    "Mumbai MMR"
  ],
  description:
    "Professional turnkey CCTV camera installation, Wi‑Fi networking, smart locks, biometric access control, video intercoms, smart automation, website development, and IT support in Mira-Bhayandar, Naigaon, Vasai and Mumbai MMR.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "13900",
    offerCount: "4"
  },
  "@id": `${siteUrl}/#security-services`,
  url: `${siteUrl}/#services`
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is included in a CCTV installation package?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Package inclusions depend on the selected equipment and site conditions. The quotation clearly lists cameras, recorder, storage, cabling, installation, mobile setup, warranty terms, and any additional work."
      }
    },
    {
      "@type": "Question",
      name: "How many days of recording will I get?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Recording duration depends on the number of cameras, resolution, frame rate, motion activity, compression settings, and hard-drive capacity. The expected recording duration should be confirmed in the quotation for the selected setup."
      }
    },
    {
      "@type": "Question",
      name: "Is Wi‑Fi or internet required for remote mobile viewing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Internet is required for viewing cameras remotely from outside the property. Local recording can continue without internet if the recorder and power supply are working."
      }
    },
    {
      "@type": "Question",
      name: "Can I use my existing cameras or old wiring?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Existing cameras or wiring may be reusable after inspection. Compatibility, cable condition, connectors, image quality, and recorder support must be checked before confirming reuse."
      }
    },
    {
      "@type": "Question",
      name: "Is the site survey free or chargeable?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Initial site surveys are free in Mira Road and Bhayandar, subject to appointment availability. For Thane, Dahisar, Borivali and other Mumbai MMR locations, confirm availability and any travel or survey charge before booking."
      }
    },
    {
      "@type": "Question",
      name: "What does a CCTV AMC maintenance contract include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A standard non-comprehensive CCTV AMC includes scheduled inspections, lens cleaning, camera alignment, recording and hard-drive checks, connector and power checks, and mobile-viewing troubleshooting. Replacement parts and damaged cables are billed separately unless covered by a written comprehensive agreement. Visit frequency and response terms are confirmed in your AMC."
      }
    }
  ]
};

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
