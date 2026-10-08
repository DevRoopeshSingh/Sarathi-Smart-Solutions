import type { Metadata } from "next";
import "./public.css";

const siteUrl = process.env.PUBLIC_SITE_URL || "https://sarathismartsolutions.in";
const description =
  "CCTV installation and AMC in Mira Road and Bhayandar. Camera packages, mobile viewing and local support for homes, shops and societies. Request a free survey.";

export const metadata: Metadata = {
  title: "CCTV Installation in Mira-Bhayandar | Sarathi Smart Solutions",
  description,
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
  publisher: { "@id": `${siteUrl}/#business` }
};

const businessJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: "Sarathi Smart Solutions",
  description:
    "Turnkey CCTV camera installation, structured Wi‑Fi networking, and smart security systems for homes, shops, offices, and housing societies in Mira-Bhayandar, Thane, and Mumbai MMR.",
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
  sameAs: ["https://share.google/yKDsOqWwMYGzaVRIh"],
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
