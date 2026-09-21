import type { Metadata } from "next";
import "./public.css";

const siteUrl = process.env.PUBLIC_SITE_URL || "https://sarathi-smart-solutions.pages.dev";

export const metadata: Metadata = {
  title: "CCTV Installation in Mira-Bhayandar | Wi‑Fi & Smart Security",
  description:
    "CCTV camera installation, Wi‑Fi networking, smart locks, access control, and AMC for homes, shops, offices, and societies in Mira-Bhayandar and Thane. Free site survey and transparent quotations.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    title: "CCTV Installation in Mira-Bhayandar | Wi‑Fi & Smart Security",
    description:
      "CCTV camera installation, Wi‑Fi networking, smart locks, access control, and AMC for homes, shops, offices, and societies in Mira-Bhayandar and Thane. Free site survey and transparent quotations.",
    url: siteUrl,
    siteName: "Sarathi Smart Solutions",
    locale: "en_IN",
    images: [
      {
        url: "/01_icon_primary.png",
        width: 192,
        height: 192,
        alt: "Sarathi Smart Solutions Logo"
      }
    ]
  },
  twitter: {
    card: "summary",
    title: "CCTV Installation in Mira-Bhayandar | Wi‑Fi & Smart Security",
    description:
      "CCTV camera installation, Wi‑Fi networking, smart locks, access control, and AMC for homes, shops, offices, and societies in Mira-Bhayandar and Thane. Free site survey and transparent quotations.",
    images: ["/01_icon_primary.png"]
  }
};

const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: "Sarathi Smart Solutions",
  description:
    "Turnkey CCTV camera installation, structured Wi‑Fi networking, and smart security systems for homes, shops, offices, and housing societies in Mira-Bhayandar, Thane, and Mumbai MMR.",
  image: `${siteUrl}/01_icon_primary.png`,
  telephone: "+918369704457",
  email: "sarathismartsolutions@gmail.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Bhayander East",
    addressLocality: "Mira-Bhayandar, Thane",
    addressRegion: "Maharashtra",
    postalCode: "401105",
    addressCountry: "IN"
  },
  areaServed: [
    "Mira Road",
    "Bhayandar East",
    "Bhayandar West",
    "Thane",
    "Dahisar",
    "Borivali",
    "Mumbai MMR"
  ],
  priceRange: "₹₹",
  "@id": `${siteUrl}/#business`,
  url: `${siteUrl}/`
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "CCTV installation",
  provider: {
    "@id": `${siteUrl}/#business`
  },
  areaServed: [
    "Mira Road",
    "Bhayandar East",
    "Bhayandar West",
    "Thane",
    "Dahisar",
    "Borivali",
    "Mumbai MMR"
  ],
  description:
    "Professional turnkey CCTV camera installation, Wi‑Fi networking, smart locks, biometric access control, video intercoms, and smart automation in Mira-Bhayandar and Mumbai MMR.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "13900",
    offerCount: "4"
  },
  url: `${siteUrl}/#packages`
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
      name: "Can CCTV and security systems work during power cuts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The system requires electricity. A UPS or backup-power solution can be added to keep the cameras and recorder operating during short power interruptions."
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
      name: "Do you provide concealed wiring and tidy casing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Standard installations include neat surface casing or conduit routing. Concealed wiring, wall grooving, civil work, and other structural changes depend on site conditions and are quoted separately where required."
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
      name: "How long does a standard installation take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A standard home installation may take one working day. The actual duration depends on the number of cameras, cable routes, civil work, permissions, and site access."
      }
    },
    {
      "@type": "Question",
      name: "Do you provide official tax invoices and manufacturer warranties?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tax invoices and manufacturer warranty documentation are provided where applicable. Applicable taxes and billing details are shown clearly in the quotation."
      }
    },
    {
      "@type": "Question",
      name: "Do you install at homes, offices, warehouses, and housing societies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Installations can be planned for homes, shops, offices, warehouses, galas, and housing societies after a site assessment."
      }
    },
    {
      "@type": "Question",
      name: "What does a CCTV AMC maintenance contract include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A standard non-comprehensive CCTV AMC includes scheduled inspections, lens cleaning, camera alignment, recording and hard-drive checks, connector and power checks, and mobile-viewing troubleshooting. Replacement parts and damaged cables are billed separately unless covered by a written comprehensive agreement. Visit frequency and response terms are confirmed in your AMC."
      }
    },
    {
      "@type": "Question",
      name: "Which localities do you serve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sarathi Smart Solutions serves Mira Road, Bhayandar East, Bhayandar West, Thane, Dahisar, Borivali, and selected areas across Mumbai MMR. Service availability is confirmed based on the property location."
      }
    },
    {
      "@type": "Question",
      name: "Can multiple family members or staff access CCTV on their phones?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Multi-user access may be configured for family members or authorised staff, depending on the recorder, camera system, mobile application, and security settings."
      }
    },
    {
      "@type": "Question",
      name: "Do you provide colour night vision and two-way audio cameras?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Colour night vision and two-way audio are available with compatible camera models. Availability and pricing depend on the selected brand, model, lighting conditions, and installation requirements."
      }
    },
    {
      "@type": "Question",
      name: "What are your payment terms and milestones?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Unless agreed otherwise in writing, our terms specify 50% advance for materials, 30% after cabling and mounting, and 20% after testing, mobile setup and sign-off. Confirm milestones, taxes and any additional work in your written quotation before installation."
      }
    }
  ]
};

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
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
