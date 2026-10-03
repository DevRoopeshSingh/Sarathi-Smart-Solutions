#!/usr/bin/env python3
"""
Generate digital-seva-kendra.html from Sarathi_Master_Service_Pricing_Catalogue.xlsx data.
Produces an accessible, high-performance, mobile-optimized experience with Service Finder,
Popular Services, Category Navigation, Service Detail Modals, Document Checklists,
WhatsApp enquiry preparation and staff-assisted status enquiries.
"""

import json
import html
import urllib.parse
import os
import subprocess
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent)

with open('docs/extracted_services.json') as f:
    services_by_cat = json.load(f)

with open('docs/extracted_packages.json') as f:
    packages_raw = json.load(f)

CATEGORY_META = {
    "Government & Citizen Services": {
        "slug": "citizen",
        "short_name": "Citizen & Govt",
        "icon": "citizen",
        "color": "#61d7ff"
    },
    "Business Registration & Compliance": {
        "slug": "business",
        "short_name": "Business & GST",
        "icon": "business",
        "color": "#ffc928"
    },
    "Pharmacy & Healthcare": {
        "slug": "pharmacy",
        "short_name": "Pharmacy & FDA",
        "icon": "pharmacy",
        "color": "#71e5b0"
    },
    "Food, Restaurant & Hospitality": {
        "slug": "food",
        "short_name": "Food & FSSAI",
        "icon": "food",
        "color": "#ff9f43"
    },
    "Property & Real Estate": {
        "slug": "property",
        "short_name": "Property & MahaRERA",
        "icon": "property",
        "color": "#ee5253"
    },
    "E-commerce & Import-Export": {
        "slug": "ecommerce",
        "short_name": "E-commerce & Sellers",
        "icon": "ecommerce",
        "color": "#a29bfe"
    },
    "Student & Career Services": {
        "slug": "student",
        "short_name": "Student & Career",
        "icon": "student",
        "color": "#54a0ff"
    },
    "Design & Business Growth": {
        "slug": "design",
        "short_name": "Design & Branding",
        "icon": "design",
        "color": "#fd79a8"
    },
    "Printing, Photo & Office Services": {
        "slug": "printing",
        "short_name": "Printing & Xerox",
        "icon": "printing",
        "color": "#00d2d3"
    }
}

# Filter out Sarathi Smart Solutions internal installation category
seva_categories = [cat for cat in services_by_cat.keys() if cat in CATEGORY_META]
total_services_count = sum(len(services_by_cat[cat]) for cat in seva_categories)

# Digital Seva Packages (exclude smart solutions labour packages)
seva_packages = []
for p in packages_raw[1:]:
    pkg_name = p[0]
    segment = p[1]
    price = p[2]
    inclusions = p[6]
    conditions = p[7] if len(p) > 7 else ""
    if "Smart Solutions" not in segment and "CCTV" not in pkg_name and "Small Office Connectivity" not in pkg_name:
        seva_packages.append({
            "name": pkg_name,
            "segment": segment,
            "price": price,
            "inclusions": inclusions,
            "conditions": conditions
        })

print(f"Total Digital Seva Services: {total_services_count}")
print(f"Total Digital Seva Packages: {len(seva_packages)}")

# Flattened full services dataset for client-side JavaScript embedding
all_services_data = []
services_by_id = {}

for cat in seva_categories:
    meta = CATEGORY_META[cat]
    for s in services_by_cat[cat]:
        svc_obj = {
            "id": str(s["id"]),
            "name": s["name"],
            "category": cat,
            "category_slug": meta["slug"],
            "category_name": meta["short_name"],
            "charge": s["charge"],
            "price_type": s.get("price_type") or "Fixed",
            "official_fee": s.get("official_fee") or "Extra at actual",
            "turnaround": "Timing confirmed after review" if s.get("turnaround") == "Same day / depends on portal" else (s.get("turnaround") or "Timing confirmed after review"),
            "documents": s.get("documents") or "Standard ID / Address Proof",
            "notes": s.get("notes") or "",
            "source": s.get("source") or ""
        }
        all_services_data.append(svc_obj)
        services_by_id[str(s["id"])] = svc_obj

# WhatsApp SVG path icon
WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.7-4.5A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-2 4 2 8 6 9l2-2-3-2-1 1c-1.5-.7-2.3-1.5-3-3l1-1-2-2Z"/></svg>'

# Curated Popular Services (Top 8 most requested in Mira-Bhayandar)
POPULAR_IDS = ["1", "4", "6", "31", "33", "35", "68", "99"]
popular_cards_html = []
for pid in POPULAR_IDS:
    if pid in services_by_id:
        svc = services_by_id[pid]
        wa_text = f"Hello Sarathi Digital Seva Kendra, I would like to enquire about: {svc['name']} (Estimated charge: ₹{svc['charge']}). What documents are needed?"
        wa_encoded = urllib.parse.quote(wa_text)
        wa_url = f"https://wa.me/918369704457?text={wa_encoded}"
        charge_num = svc['charge'].replace(",", "")

        doc_snippet = html.escape(svc['documents'][:85] + ("..." if len(svc['documents']) > 85 else ""))

        pcard = f"""          <article class="seva-popular-card" data-category="{svc['category_slug']}" data-id="{svc['id']}">
            <div class="seva-popular-badge-row">
              <span class="seva-category-pill seva-pill--{svc['category_slug']}">{html.escape(svc['category_name'])}</span>
              <span class="seva-turnaround-badge">{html.escape(svc['turnaround'])}</span>
            </div>
            <h3 class="seva-popular-title">{html.escape(svc['name'])}</h3>
            <div class="seva-price-box">
              <span class="seva-price-amount">₹{svc['charge']}</span>
              <span class="seva-price-type">({html.escape(svc['price_type'])})</span>
            </div>
            <p class="seva-statutory-note">Government / statutory fee: {html.escape(svc["official_fee"])}</p>
            <div class="seva-docs-box">
              <span class="seva-docs-label">Required:</span>
              <span class="seva-docs-content">{doc_snippet}</span>
            </div>
            <div class="seva-card-actions">
              <button type="button" class="button button--ghost seva-btn-details" data-service-id="{svc['id']}">
                <span>View Checklist</span>
              </button>
              <a class="button seva-card-wa" href="{wa_url}" target="_blank" rel="noopener noreferrer" aria-label="Enquire about {html.escape(svc['name'])} on WhatsApp">
                {WA_SVG}
                <span>Enquire</span>
              </a>
            </div>
          </article>"""
        popular_cards_html.append(pcard)

# Generate master service directory cards HTML
service_cards_html = []
for cat in seva_categories:
    meta = CATEGORY_META[cat]
    for s in services_by_cat[cat]:
        svc_name = s["name"]
        charge = str(s["charge"])
        charge_num = charge.replace(",", "")
        price_type = s.get("price_type") or "Fixed"
        turnaround = services_by_id[str(s["id"])]["turnaround"]
        docs = s.get("documents") or "Standard ID / Address Proof"
        notes = s.get("notes") or ""

        wa_text = f"Hello Sarathi Digital Seva Kendra, I would like to enquire about: {svc_name} (Estimated charge: ₹{charge}). What documents are needed?"
        wa_encoded = urllib.parse.quote(wa_text)
        wa_url = f"https://wa.me/918369704457?text={wa_encoded}"

        charge_display = f"₹{charge}"
        if price_type and price_type.lower() != "fixed":
            price_sub = f"({price_type})"
        else:
            price_sub = "(Assistance fee)"

        doc_snippet = html.escape(docs[:80] + ("..." if len(docs) > 80 else ""))

        card = f"""          <article class="seva-service-card" data-id="{s['id']}" data-category="{meta['slug']}" data-name="{html.escape(svc_name.lower())}" data-charge="{charge_num}" data-turnaround="{html.escape(turnaround.lower())}" data-price-type="{html.escape(price_type.lower())}">
            <div class="seva-card-top">
              <span class="seva-category-pill seva-pill--{meta['slug']}">{html.escape(meta['short_name'])}</span>
              <span class="seva-turnaround-badge">{html.escape(turnaround)}</span>
            </div>
            <h3 class="seva-service-title">{html.escape(svc_name)}</h3>
            <div class="seva-price-box">
              <span class="seva-price-amount">{charge_display}</span>
              <span class="seva-price-type">{price_sub}</span>
            </div>
            <p class="seva-statutory-note">Government / statutory fee: {html.escape(s.get("official_fee") or "Extra at actual")}</p>
            <div class="seva-docs-box">
              <span class="seva-docs-label">Required:</span>
              <span class="seva-docs-content">{doc_snippet}</span>
            </div>
            <div class="seva-card-actions">
              <button type="button" class="button button--ghost seva-btn-details" data-service-id="{s['id']}" aria-label="View requirements and details for {html.escape(svc_name)}">
                <span>View Checklist</span>
              </button>
              <a class="button seva-card-wa" href="{wa_url}" target="_blank" rel="noopener noreferrer" aria-label="Enquire about {html.escape(svc_name)} on WhatsApp">
                {WA_SVG}
                <span>Enquire</span>
              </a>
            </div>
          </article>"""
        service_cards_html.append(card)

# Generate packages HTML
package_cards_html = []
for pkg in seva_packages:
    pkg_name = pkg["name"]
    price = pkg["price"]
    segment = pkg["segment"]
    inclusions = pkg["inclusions"].split("+")
    conditions = pkg["conditions"]

    inclusions_items = "".join(f"<li>{html.escape(item.strip())}</li>" for item in inclusions if item.strip())

    wa_text = f"Hello Sarathi Digital Seva Kendra, I would like to enquire about the package: {pkg_name} (₹{price}). Please share procedure and document checklist."
    wa_encoded = urllib.parse.quote(wa_text)
    wa_url = f"https://wa.me/918369704457?text={wa_encoded}"

    pkg_card = f"""          <article class="seva-package-card">
            <div class="seva-pkg-header">
              <span class="seva-pkg-tag">{html.escape(segment)}</span>
              <h3 class="seva-pkg-title">{html.escape(pkg_name)}</h3>
              <div class="seva-pkg-price-row">
                <span class="seva-pkg-price">₹{price}</span>
                <span class="seva-pkg-note">All-in-one package assistance</span>
              </div>
            </div>
            <div class="seva-pkg-body">
              <p class="seva-pkg-inc-label">Included in this bundle:</p>
              <ul class="seva-pkg-inclusions">
                {inclusions_items}
              </ul>
              {f'<p class="seva-pkg-conditions"><strong>Note:</strong> {html.escape(conditions)}</p>' if conditions else ''}
            </div>
            <div class="seva-pkg-footer">
              <a class="button seva-pkg-btn" href="{wa_url}" target="_blank" rel="noopener noreferrer">
                <span>Enquire This Package</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>
          </article>"""
    package_cards_html.append(pkg_card)

# Generate select options for the Request Service Form
service_select_options_html = []
for cat in seva_categories:
    meta = CATEGORY_META[cat]
    group_options = []
    for s in services_by_cat[cat]:
        group_options.append(f'<option value="{s["id"]}">{html.escape(s["name"])} (₹{s["charge"]})</option>')
    service_select_options_html.append(f'<optgroup label="{html.escape(meta["short_name"])}">{"".join(group_options)}</optgroup>')

# Complete JSON dataset for script tag
json_dataset_str = json.dumps({
    "services": all_services_data,
    "packages": seva_packages
}, separators=(',', ':'))

output_html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07131f" />
    <meta
      name="description"
      content="Official Sarathi Digital Seva Kendra in Bhayander East, Mira-Bhayandar. Fast, transparent assistance for PAN card, Aadhaar guidance, Udyam MSME, Gumasta, GST, FSSAI, MahaRERA, FDA drug licence, student forms, and printing."
    />
    <title>Sarathi Digital Seva Kendra | Government, Business &amp; Citizen Services in Bhayander East</title>

    <link rel="canonical" href="__SITE_URL__/digital-seva-kendra" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="__SITE_URL__/digital-seva-kendra" />
    <meta property="og:title" content="Sarathi Digital Seva Kendra | Bhayander East, Mira-Bhayandar" />
    <meta property="og:description" content="{total_services_count} citizen, business registration, pharmacy, food, student, and print services with clear upfront pricing. Walk-in at RNP Park or WhatsApp online support." />
    <meta property="og:site_name" content="Sarathi Digital Seva Kendra" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:image" content="__SITE_URL__/01_icon_primary.png" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Sarathi Digital Seva Kendra | Bhayander East, Mira-Bhayandar" />
    <meta name="twitter:description" content="Fast, transparent digital facilitation for PAN, GST, Udyam, FSSAI, Drug Licence, MahaRERA &amp; printing in Bhayander East." />
    <meta name="twitter:image" content="__SITE_URL__/01_icon_primary.png" />

    <!-- Favicons -->
    <link rel="icon" type="image/png" sizes="32x32" href="01_icon_primary.png" />
    <link rel="apple-touch-icon" sizes="256x256" href="01_icon_primary.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="styles.css" />

    <!-- Structured Data (JSON-LD) specifically for Sarathi Digital Seva Kendra -->
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "Sarathi Digital Seva Kendra",
        "alternateName": ["Sarathi Seva Kendra", "Sarathi Digital Centre"],
        "description": "Digital facilitation centre in Bhayander East offering PAN, Aadhaar guidance, Udyam MSME, GST, Gumasta Shop Act, FSSAI, MahaRERA, drug licence assistance, student admission forms, and high-speed printing.",
        "image": "__SITE_URL__/01_icon_primary.png",
        "telephone": "+918369704457",
        "email": "sarathidigitalsevakendra@gmail.com",
        "url": "__SITE_URL__/digital-seva-kendra",
        "address": {{
          "@type": "PostalAddress",
          "streetAddress": "RNP Park, Bhayander East",
          "addressLocality": "Mira-Bhayandar, Thane",
          "addressRegion": "Maharashtra",
          "postalCode": "401105",
          "addressCountry": "IN"
        }},
        "geo": {{
          "@type": "GeoCoordinates",
          "latitude": 19.3152633,
          "longitude": 72.8586247
        }},
        "openingHoursSpecification": [
          {{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "opens": "09:30",
            "closes": "20:30"
          }}
        ],
        "priceRange": "₹",
        "areaServed": [
          "Bhayander East",
          "Bhayander West",
          "Mira Road",
          "Thane",
          "Dahisar",
          "Borivali",
          "Mumbai MMR"
        ]
      }}
    </script>
  </head>
  <body class="seva-body">
    <a class="skip-link" href="#services">Skip to services directory</a>

    <!-- Top Notice Banner: Division Cross-Link -->
    <aside class="seva-top-announcement" aria-label="Division notice">
      <div class="seva-announcement-container">
        <span>Part of Sarathi Solutions Network • <strong>Sister division:</strong> Sarathi Smart Solutions</span>
        <a class="seva-announcement-link" href="/">Visit Smart Solutions CCTV &amp; Security &rarr;</a>
      </div>
    </aside>

    <!-- Main Navigation Header (Sticky on Scroll) -->
    <div class="seva-header-sticky">
      <header class="site-header">
        <a class="brand" href="/digital-seva-kendra" aria-label="Sarathi Digital Seva Kendra home">
          <img
            class="brand-logo brand-logo--seva"
            src="01_icon_primary.png"
            alt="Sarathi Digital Seva Kendra emblem"
            width="48"
            height="48"
            fetchpriority="high"
          />
          <span class="brand-copy">
            <strong>Sarathi</strong>
            <small class="seva-brand-tagline">Digital Seva Kendra</small>
          </span>
        </a>
        <span class="division-line">Citizen Services <i></i> Business Compliance <i></i> Digital Growth</span>
        <nav class="header-nav" aria-label="Main navigation">
          <a class="header-link" href="#popular">Popular</a>
          <a class="header-link" href="#services">Services ({total_services_count})</a>
          <a class="header-link" href="#packages">Packages</a>
          <a class="header-link" href="#request-track">Enquiry &amp; Status</a>
          <a class="header-link" href="#reviews">Reviews</a>
          <a class="header-link" href="#contact">Timings &amp; Location</a>
          <a class="header-link" href="#faq">FAQ</a>
          <a class="header-link header-link--division" href="/" title="Switch to Smart Solutions CCTV & Security">CCTV &amp; Security</a>
        </nav>
        <details class="seva-mobile-menu" id="seva-mobile-menu">
          <summary aria-label="Open section navigation">Menu</summary>
          <nav aria-label="Mobile section navigation">
            <a href="#popular">Popular services</a>
            <a href="#services">Services directory</a>
            <a href="#packages">Packages</a>
            <a href="#request-track">Request &amp; status enquiry</a>
            <a href="#reviews">Reviews</a>
            <a href="#contact">Contact</a>
            <a href="#faq">FAQ</a>
            <a href="/">Sarathi Smart Solutions</a>
          </nav>
        </details>
        <div class="header-actions">
          <a class="button button--ghost header-phone-btn" href="tel:+918369704457" aria-label="Call Sarathi Digital Seva Kendra">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>Call</span>
          </a>
          <a class="button button--primary header-cta" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20would%20like%20to%20enquire%20about%20your%20services" target="_blank" rel="noopener noreferrer" aria-label="Chat with Sarathi Digital Seva Kendra on WhatsApp">
            {WA_SVG}
            <span>WhatsApp</span>
          </a>
        </div>
      </header>
    </div>

    <main id="top">
      <!-- Hero Section with Integrated Service Finder -->
      <section class="seva-hero" aria-labelledby="hero-title">
        <div class="hero-glow glow-one" aria-hidden="true"></div>
        <div class="hero-glow glow-two" aria-hidden="true"></div>

        <div class="seva-hero-content">
          <div class="seva-hero-badges">
            <span class="seva-badge seva-badge--status" id="live-centre-status" aria-live="polite">
              <span class="status-dot"></span> Mon–Sat 9:30 AM – 8:30 PM; Sunday by prior appointment
            </span>
            <span class="seva-badge seva-badge--location">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
              RNP Park, Bhayander East
            </span>
            <span class="seva-badge seva-badge--verified">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Transparent Pricing • Zero Hidden Processing Fees
            </span>
          </div>

          <h1 id="hero-title" class="seva-hero-title">
            Fast, Reliable &amp; Transparent <br />
            <span class="seva-hero-accent">Digital &amp; Government Services in Bhayander East</span>
          </h1>

          <p class="seva-hero-desc">
            Your trusted neighbourhood centre for PAN cards, Aadhaar guidance, and student forms to GST, Gumasta, FSSAI, MahaRERA, and FDA drug licence documentation. Professional digital assistance backed by clear upfront pricing.
          </p>

          <!-- Integrated Hero Service Finder Widget -->
          <div class="seva-hero-finder" role="search" aria-label="Service Finder">
            <div class="seva-hero-finder-header">
              <span class="seva-finder-label">Instant Service &amp; Document Finder</span>
              <span class="seva-finder-count">{total_services_count} services with clear rates</span>
            </div>

            <div class="seva-hero-search-wrap">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="seva-search-icon" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search"
                id="hero-seva-search"
                class="seva-hero-search-input"
                placeholder="What service do you need? (e.g. PAN, GST, Gumasta, FSSAI, Drug Licence, Student form)..."
                aria-label="Search all {total_services_count} services"
              />
              <button type="button" id="hero-search-clear" class="seva-search-clear" aria-label="Clear hero search" hidden>&times;</button>
            </div>

            <!-- Quick Service Pills (Instant Jump) -->
            <div class="seva-quick-pills-wrap" aria-label="Popular search shortcuts">
              <span class="seva-pills-title">Quick Search:</span>
              <button type="button" class="seva-quick-pill" data-query="PAN">New PAN</button>
              <button type="button" class="seva-quick-pill" data-query="Aadhaar">Aadhaar Guidance</button>
              <button type="button" class="seva-quick-pill" data-query="Udyam">Udyam MSME</button>
              <button type="button" class="seva-quick-pill" data-query="Gumasta">Gumasta / Shop Act</button>
              <button type="button" class="seva-quick-pill" data-query="GST">GST Registration</button>
              <button type="button" class="seva-quick-pill" data-query="FSSAI">FSSAI Food Licence</button>
              <button type="button" class="seva-quick-pill" data-query="Drug">FDA Drug Licence</button>
              <button type="button" class="seva-quick-pill" data-query="FYJC">FYJC Admission</button>
              <button type="button" class="seva-quick-pill" data-query="MahaRERA">MahaRERA</button>
              <button type="button" class="seva-quick-pill" data-query="Print">PVC / Printing</button>
            </div>

            <div class="seva-hero-finder-actions">
              <a class="button button--primary" href="#services">
                <span>Browse Directory ({total_services_count} Services)</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <a class="button button--ghost" href="#request-track">
                <span>Enquire or Ask for an Update</span>
              </a>
            </div>
          </div>

          <!-- Quick Trust Metrics -->
          <div class="seva-trust-grid">
            <div class="seva-trust-card">
              <span class="seva-trust-num">{total_services_count}</span>
              <span class="seva-trust-lbl">Services in Directory</span>
            </div>
            <div class="seva-trust-card">
              <span class="seva-trust-num">100%</span>
              <span class="seva-trust-lbl">Transparent Fees</span>
            </div>
            <div class="seva-trust-card">
              <span class="seva-trust-num">At Your Pace</span>
              <span class="seva-trust-lbl">Guided Assistance</span>
            </div>
            <div class="seva-trust-card">
              <span class="seva-trust-num">Walk-in</span>
              <span class="seva-trust-lbl">Or WhatsApp Filing</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Transparency & Regulatory Disclaimer Card -->
      <section class="seva-disclaimer-section" aria-label="Transparent pricing principles">
        <div class="seva-disclaimer-card">
          <div class="seva-disclaimer-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <div class="seva-disclaimer-body">
            <h3>Our Transparency Promise: Clean Fees &amp; Responsible Representation</h3>
            <p>
              <strong>1. Service / Assistance Charges Only:</strong> The charges shown on this page represent our professional digital assistance, documentation check, formatting, and portal submission. Government fees, statutory fees, taxes, stamp duty, notary charges, and material charges are extra at actuals unless explicitly included in the selected service. Our desk will confirm the total before proceeding.
            </p>
            <p>
              <strong>2. Regulated Services Disclaimer:</strong> Regulated registrations (Drug Licences, FSSAI, MahaRERA, Passports) are documentation assistance services. Final approvals remain subject to department inspection, eligibility, and statutory verification.
            </p>
            <p>
              <strong>3. Free Portals:</strong> Portals such as Udyam MSME offer free government registration on official sites. Sarathi charges strictly for digital guidance, data validation, and portal submission.
            </p>
          </div>
        </div>
      </section>

      <!-- Popular / Most Requested Services Section -->
      <section id="popular" class="seva-section seva-section--popular" aria-labelledby="popular-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Frequently Requested in Bhayander</span>
            <h2 id="popular-title">Popular Citizen &amp; Business Services</h2>
            <p>Clear upfront rates, document requirements, and express turnaround for our most requested daily services.</p>
          </div>

          <div class="seva-popular-grid">
            {''.join(popular_cards_html)}
          </div>

          <div class="seva-popular-more">
            <p>Looking for a specific licence, registration, or print service?</p>
            <a class="button button--outline" href="#services">
              <span>View All {total_services_count} Services in Master Directory &rarr;</span>
            </a>
          </div>
        </div>
      </section>

      <!-- Startup & Business Bundles -->
      <section id="packages" class="seva-section" aria-labelledby="packages-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">All-in-One Bundles</span>
            <h2 id="packages-title">Startup &amp; Business Packages</h2>
            <p>Complete documentation, branding, and registration packages tailored for new ventures in Mira-Bhayandar.</p>
          </div>

          <div class="seva-packages-grid">
            {''.join(package_cards_html)}
          </div>
        </div>
      </section>

      <!-- Services in Action Showcase Grid -->
      <section id="showcase" class="seva-section seva-section--showcase" aria-labelledby="showcase-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Services in Action</span>
            <h2 id="showcase-title">Real-World Digital Facilitation in Bhayander East</h2>
            <p>From citizen identity and healthcare licensing to corporate tax registration — see our core services in action.</p>
          </div>

          <div class="seva-showcase-grid">
            <article class="seva-showcase-card">
              <div class="seva-showcase-media">
                <img
                  src="assets/images/seva-citizen-services.jpg"
                  alt="Customer verification at Sarathi Digital Seva Kendra service desk in Bhayander East"
                  width="1200"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />
                <span class="seva-showcase-tag">Citizen Identity</span>
              </div>
              <div class="seva-showcase-body">
                <h3 class="seva-showcase-title">Government Facilitation &amp; Citizen Identity</h3>
                <p class="seva-showcase-desc">
                  Assisting residents with PAN Card applications &amp; corrections, Aadhaar appointment guidance, Passport Seva Kendra slots, Ayushman Bharat health cards, and voter ID documentation with full digital verification.
                </p>
                <ul class="seva-showcase-highlights">
                  <li>PAN Card &amp; Aadhaar Biometric Linking</li>
                  <li>Tatkal &amp; Normal Passport Slot Booking</li>
                  <li>Ayushman Bharat Health Card Generation</li>
                </ul>
                <div class="seva-showcase-action">
                  <a class="button seva-card-wa" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20need%20assistance%20with%20Citizen%20Identity%20Services" target="_blank" rel="noopener noreferrer">
                    {WA_SVG}
                    <span>Enquire on WhatsApp</span>
                  </a>
                </div>
              </div>
            </article>

            <article class="seva-showcase-card">
              <div class="seva-showcase-media">
                <img
                  src="assets/images/seva-business-gst.jpg"
                  alt="Business GST and MSME tax compliance consultant workstation in Mumbai"
                  width="1200"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />
                <span class="seva-showcase-tag">Business &amp; GST</span>
              </div>
              <div class="seva-showcase-body">
                <h3 class="seva-showcase-title">MSME, GST &amp; Commercial Licencing</h3>
                <p class="seva-showcase-desc">
                  End-to-end facilitation for new business ventures: GST registration, monthly GSTR filings, Udyam MSME certification, Maharashtra Gumasta Shop Act licence, IEC Import-Export codes, and company setup.
                </p>
                <ul class="seva-showcase-highlights">
                  <li>GST Registration &amp; Monthly GSTR Returns</li>
                  <li>Udyam MSME &amp; Gumasta Shop Act Licence</li>
                  <li>Import Export Code (IEC) &amp; Digital Signatures</li>
                </ul>
                <div class="seva-showcase-action">
                  <a class="button seva-card-wa" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20need%20assistance%20with%20Business%20GST%20Compliance" target="_blank" rel="noopener noreferrer">
                    {WA_SVG}
                    <span>Enquire on WhatsApp</span>
                  </a>
                </div>
              </div>
            </article>

            <article class="seva-showcase-card">
              <div class="seva-showcase-media">
                <img
                  src="assets/images/seva-pharmacy-fda.jpg"
                  alt="Pharmacist reviewing official FDA drug inspection certificate in modern medical store"
                  width="1200"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />
                <span class="seva-showcase-tag">Pharmacy &amp; FDA</span>
              </div>
              <div class="seva-showcase-body">
                <h3 class="seva-showcase-title">Specialized FDA Drug &amp; Healthcare Licencing</h3>
                <p class="seva-showcase-desc">
                  Expert documentation guidance for retail and wholesale medical stores, pharmacist registration updates, FDA Form 20/21 renewals, retention dossiers, and FSSAI food business registration for cloud kitchens and restaurants.
                </p>
                <ul class="seva-showcase-highlights">
                  <li>Retail &amp; Wholesale Pharmacy Drug Licences (Form 20/21)</li>
                  <li>Pharmacist Qualification &amp; Name Change Assistance</li>
                  <li>FDA Periodic Retention &amp; FSSAI Food Compliance</li>
                </ul>
                <div class="seva-showcase-action">
                  <a class="button seva-card-wa" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20need%20assistance%20with%20Pharmacy%20FDA%20Licences" target="_blank" rel="noopener noreferrer">
                    {WA_SVG}
                    <span>Enquire on WhatsApp</span>
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- Interactive Master Service Directory -->
      <section id="services" class="seva-section seva-section--services" aria-labelledby="services-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Master Directory</span>
            <h2 id="services-title">Browse {total_services_count} Services with Transparent Rates</h2>
            <p>Filter by vertical, search by keyword, view required document checklists, and enquire directly.</p>
          </div>

          <!-- Sticky Search & Filter Controls -->
          <div class="seva-filter-controls" id="directory-controls">
            <!-- Search Input -->
            <div class="seva-search-wrap">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="seva-search-icon" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search"
                id="seva-search"
                class="seva-search-input"
                placeholder="Search by service name, documents, or fee (e.g. PAN, GST, FSSAI, Drug Licence, Udyam, Resume, Xerox)..."
                aria-label="Search directory"
              />
              <button type="button" id="seva-search-clear" class="seva-search-clear" aria-label="Clear search" hidden>&times;</button>
            </div>

            <!-- Category Filter Tabs -->
            <div class="seva-tabs-wrapper" role="group" aria-label="Service categories">
              <button type="button" class="seva-tab active" data-filter="all" aria-pressed="true">
                All Services ({total_services_count})
              </button>
              <button type="button" class="seva-tab" data-filter="citizen" aria-pressed="false">Citizen &amp; Govt</button>
              <button type="button" class="seva-tab" data-filter="business" aria-pressed="false">Business &amp; GST</button>
              <button type="button" class="seva-tab" data-filter="pharmacy" aria-pressed="false">Pharmacy &amp; FDA</button>
              <button type="button" class="seva-tab" data-filter="food" aria-pressed="false">Food &amp; FSSAI</button>
              <button type="button" class="seva-tab" data-filter="property" aria-pressed="false">Property &amp; MahaRERA</button>
              <button type="button" class="seva-tab" data-filter="ecommerce" aria-pressed="false">E-commerce</button>
              <button type="button" class="seva-tab" data-filter="student" aria-pressed="false">Student &amp; Career</button>
              <button type="button" class="seva-tab" data-filter="design" aria-pressed="false">Design &amp; Growth</button>
              <button type="button" class="seva-tab" data-filter="printing" aria-pressed="false">Printing &amp; Xerox</button>
            </div>

            <!-- Secondary Toolbar: Quick Filters & Sorting -->
            <div class="seva-filter-secondary">
              <div class="seva-quick-chips" aria-label="Quick filters">
                <button type="button" class="seva-chip active" aria-pressed="true" data-chip="all">All</button>
                <button type="button" class="seva-chip" aria-pressed="false" data-chip="printing">Printing &amp; Photo</button>
                <button type="button" class="seva-chip" aria-pressed="false" data-chip="business">🏢 Business Licences</button>
                <button type="button" class="seva-chip" aria-pressed="false" data-chip="under300">🏷️ Under ₹300</button>
              </div>

              <div class="seva-sort-wrap">
                <label for="seva-sort" class="seva-sort-label">Sort:</label>
                <select id="seva-sort" class="seva-sort-select" aria-label="Sort services">
                  <option value="default">Recommended</option>
                  <option value="price-asc">Fee: Low to High</option>
                  <option value="price-desc">Fee: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                </select>
              </div>
            </div>

            <div class="seva-filter-status" id="filter-status" aria-live="polite">
              Showing <strong id="filter-visible-count">16</strong> of <span id="filter-total-count">{total_services_count}</span> services
            </div>
          </div>

          <!-- Services Grid -->
          <div class="seva-services-grid" id="services-grid">
            {''.join(service_cards_html)}
          </div>

          <!-- Progressive Disclosure / Pagination Controls -->
          <div class="seva-pagination-wrap" id="seva-pagination">
            <div class="seva-progress-indicator">
              <span id="pagination-status-text">Showing 16 of {total_services_count} services</span>
              <div class="seva-progress-bar"><div class="seva-progress-fill" id="pagination-progress-fill" style="width: 10%;"></div></div>
            </div>
            <div class="seva-pagination-actions">
              <button type="button" id="load-more-btn" class="button button--primary seva-load-more">
                <span>Load More Services (+16)</span>
              </button>
              <button type="button" id="show-all-btn" class="button button--ghost seva-show-all">
                <span>Show All ({total_services_count})</span>
              </button>
            </div>
          </div>

          <div id="no-services-found" class="seva-no-results" hidden>
            <p>No services matched your search query. Try another keyword or message our desk directly on WhatsApp.</p>
            <a class="button button--primary" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20cannot%20find%20the%20service%20I%20need.%20Can%20you%20help?" target="_blank" rel="noopener noreferrer">Ask on WhatsApp</a>
          </div>
        </div>
      </section>

      <!-- Online Service Request Flow & Status Tracker -->
      <section id="request-track" class="seva-section seva-section--request" aria-labelledby="request-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Digital Desk</span>
            <h2 id="request-title">Request Assistance &amp; Ask for an Update</h2>
            <p>Prepare an enquiry to send on WhatsApp, or ask our desk about an existing application. Your request is confirmed only when our team replies.</p>
          </div>

          <div class="seva-request-panel-wrap">
            <!-- Mode Switcher Tabs -->
            <div class="seva-tab-nav" role="tablist" aria-label="Request or track">
              <button type="button" class="seva-subtab active" id="tab-btn-request" role="tab" aria-selected="true" aria-controls="panel-request">
                📝 Request Assistance
              </button>
              <button type="button" class="seva-subtab" id="tab-btn-track" role="tab" aria-selected="false" tabindex="-1" aria-controls="panel-track">
                🔍 Ask About Application Status
              </button>
            </div>

            <!-- Panel 1: Online Request Form -->
            <div class="seva-subpanel active" id="panel-request" role="tabpanel" aria-labelledby="tab-btn-request">
              <div class="seva-form-box">
                <form id="seva-request-form" class="seva-form" novalidate>
                  <p id="request-error" class="seva-form-error" role="alert" hidden></p>
                  <div class="seva-form-grid">
                    <div class="form-group full-width">
                      <label for="request-service-select">Select Service Needed <span class="req">*</span></label>
                      <select id="request-service-select" class="form-input" aria-describedby="request-error" required>
                        <option value="">-- Choose from {total_services_count} services --</option>
                        {''.join(service_select_options_html)}
                      </select>
                    </div>

                    <div class="form-group">
                      <label for="request-name">Your Full Name <span class="req">*</span></label>
                      <input type="text" id="request-name" class="form-input" maxlength="100" aria-describedby="request-error" placeholder="e.g. Ramesh Patel" required autocomplete="name" />
                    </div>

                    <div class="form-group">
                      <label for="request-phone">WhatsApp Mobile Number <span class="req">*</span></label>
                      <input type="tel" id="request-phone" class="form-input" inputmode="tel" maxlength="20" aria-describedby="request-error" placeholder="10-digit mobile or +91 followed by 10 digits" required autocomplete="tel" />
                    </div>

                    <div class="form-group full-width">
                      <label class="form-label">Preferred Mode of Assistance <span class="req">*</span></label>
                      <div class="seva-radio-group">
                        <label class="seva-radio-label">
                          <input type="radio" name="service-mode" value="walk-in" checked />
                          <span>🏢 Walk-in at RNP Park Centre (Bhayander East)</span>
                        </label>
                        <label class="seva-radio-label">
                          <input type="radio" name="service-mode" value="online-wa" />
                          <span>📱 Digital Online Filing via WhatsApp</span>
                        </label>
                      </div>
                    </div>

                    <div class="form-group full-width">
                      <label for="request-notes">Notes or Documents Status (Optional)</label>
                      <input type="text" id="request-notes" class="form-input" maxlength="1000" placeholder="e.g. I have Aadhaar and PAN card ready; need guidance on electricity bill" />
                    </div>
                  </div>

                  <div class="seva-form-actions">
                    <button type="submit" class="button button--primary seva-submit-btn" disabled>
                      <span>Prepare WhatsApp Enquiry</span>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                    <p class="seva-form-note">Nothing is sent until you press Send in WhatsApp. Please do not include passwords, OTPs, or identity document numbers in this form.</p>
                  </div>
                </form>

                <noscript><p>To request assistance, <a href="https://wa.me/918369704457" target="_blank" rel="noopener noreferrer">contact us on WhatsApp</a> or call <a href="tel:+918369704457">+91 83697 04457</a>.</p></noscript>
                <!-- Prepared WhatsApp handoff; no server registration -->
                <div id="request-confirmation" class="seva-confirmation-card" tabindex="-1" hidden>
                  <div class="seva-confirm-header">
                    <div class="seva-confirm-icon" aria-hidden="true">✓</div>
                    <div>
                      <h3>Your WhatsApp Enquiry Is Ready</h3>
                      <p class="seva-confirm-sub">Open WhatsApp and press Send. This is not a booking confirmation; our team will reply with availability, charges, and next steps.</p>
                    </div>
                  </div>
                  <div class="seva-confirm-body">
                    <ul class="seva-confirm-details">
                      <li><strong>Service:</strong> <span id="confirm-service-name">-</span></li>
                      <li><strong>Customer:</strong> <span id="confirm-customer-name">-</span></li>
                      <li><strong>Mode:</strong> <span id="confirm-service-mode">-</span></li>
                      <li><strong>Assistance fee:</strong> <span id="confirm-service-price">-</span></li>
                    </ul>
                  </div>
                  <div class="seva-confirm-actions">
                    <a id="confirm-wa-btn" class="button button--primary" href="#" target="_blank" rel="noopener noreferrer">
                      {WA_SVG}
                      <span>Open WhatsApp to Send</span>
                    </a>
                    <button type="button" id="edit-enquiry-btn" class="button button--outline">
                      <span>Edit Enquiry</span>
                    </button>
                    <button type="button" id="new-enquiry-btn" class="button button--ghost">Start New Enquiry</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Panel 2: Status enquiry via staff -->
            <div class="seva-subpanel" id="panel-track" role="tabpanel" aria-labelledby="tab-btn-track" hidden>
              <div class="seva-tracker-box">
                <p>For the latest status, send the reference from your receipt or earlier conversation to our desk. This website does not look up applications or verify their progress.</p>
                <form id="seva-status-form" novalidate>
                  <label for="track-id-input">Application / enquiry reference</label>
                  <p id="track-error" class="seva-form-error" role="alert" hidden></p>
                  <div class="seva-tracker-search-row">
                    <input type="text" id="track-id-input" class="form-input seva-track-input" placeholder="Enter the reference shared with you" maxlength="80" required aria-describedby="track-error" />
                    <button type="submit" id="track-submit-btn" class="button button--primary" disabled>Prepare Status Enquiry</button>
                  </div>
                </form>
                <p id="tracker-display" class="seva-tracker-note-box" tabindex="-1" hidden>
                  Your status enquiry is ready. Open WhatsApp and press Send; our team will check the reference and reply.
                  <a id="tracker-wa-help" class="button button--primary" href="https://wa.me/918369704457" target="_blank" rel="noopener noreferrer">Ask Staff on WhatsApp</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Customer Reviews & Local Trust Signals -->
      <section id="reviews" class="seva-section seva-section--reviews" aria-labelledby="reviews-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Customer Feedback</span>
            <h2 id="reviews-title">Share Your Experience</h2>
            <p>Visited our centre or used our assistance? Tell us what went well and what we can improve.</p>
            <a class="button button--outline" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra%2C%20I%20would%20like%20to%20share%20feedback%20about%20my%20experience." target="_blank" rel="noopener noreferrer">Share Feedback on WhatsApp</a>
          </div>

          <!-- Trust Pillars -->
          <div class="seva-trust-pillars-grid">
            <div class="seva-pillar-item">
              <span class="seva-pillar-icon" aria-hidden="true">🏢</span>
              <h4>Physical Centre in RNP Park</h4>
              <p>Walk in anytime during operating hours for physical document check and instant printing.</p>
            </div>
            <div class="seva-pillar-item">
              <span class="seva-pillar-icon" aria-hidden="true">🔒</span>
              <h4>Careful Document Handling</h4>
              <p>Ask our desk which documents are needed before sharing copies. Never share passwords or OTPs.</p>
            </div>
            <div class="seva-pillar-item">
              <span class="seva-pillar-icon" aria-hidden="true">⚖️</span>
              <h4>Clean Fee Transparency</h4>
              <p>Our assistance charges are clearly stated. Official government portal fees are charged at actuals.</p>
            </div>
            <div class="seva-pillar-item">
              <span class="seva-pillar-icon" aria-hidden="true">✓</span>
              <h4>Document Pre-check</h4>
              <p>Every application undergoes pre-submission validation to avoid rejection or delay.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section id="how-it-works" class="seva-section" aria-labelledby="how-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Simple Workflow</span>
            <h2 id="how-title">How Digital Assistance Works at Sarathi</h2>
            <p>Getting your documents and licences in order is fast and hassle-free.</p>
          </div>

          <div class="seva-steps-grid">
            <div class="seva-step-card">
              <span class="seva-step-number">01</span>
              <h3>Enquire &amp; Document Review</h3>
              <p>Send your document photos or PDFs on WhatsApp, or visit our centre at RNP Park Bhayander East. We inspect your papers for eligibility, missing details, and exact statutory fees.</p>
            </div>
            <div class="seva-step-card">
              <span class="seva-step-number">02</span>
              <h3>Digital Processing &amp; Filing</h3>
              <p>We perform accurate data entry, image formatting, document resizing, and submission on authorized government or compliance portals after checking the details with you.</p>
            </div>
            <div class="seva-step-card">
              <span class="seva-step-number">03</span>
              <h3>Receipt &amp; Tracking Handover</h3>
              <p>You receive instant government acknowledgment slips, application reference numbers, tracking links, and physical printed certificates or cards upon delivery.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Location, Hours & Direct Contact -->
      <section id="contact" class="seva-section" aria-labelledby="contact-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Visit Us in Bhayander East</span>
            <h2 id="contact-title">Timings, Location &amp; Contact Details</h2>
            <p>Conveniently located at RNP Park with fast walk-in support and dedicated WhatsApp assistance.</p>
          </div>

          <div class="seva-contact-grid">
            <!-- Details Card -->
            <div class="seva-contact-info-card">
              <h3>Sarathi Digital Seva Kendra</h3>
              <p class="seva-contact-sub">Sister division of Sarathi Smart Solutions</p>

              <div class="seva-contact-item">
                <div class="seva-contact-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
                </div>
                <div>
                  <strong>Address &amp; Landmark</strong>
                  <address>RNP Park, Bhayander East, Mira-Bhayandar, Thane, Maharashtra - 401105</address>
                  <p class="seva-landmark-note">📍 7 mins walk from Bhayander Railway Station (East exit). Easily accessible by auto from Station Road or Golden Nest Flyover.</p>
                </div>
              </div>

              <div class="seva-contact-item">
                <div class="seva-contact-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <strong>Operating Hours</strong>
                  <p>Monday to Saturday: 9:30 AM – 8:30 PM<br /><small class="text-muted">Sunday: Closed / Prior appointment</small></p>
                </div>
              </div>

              <div class="seva-contact-item">
                <div class="seva-contact-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <strong>Phone &amp; WhatsApp</strong>
                  <p><a href="tel:+918369704457">+91 83697 04457</a></p>
                </div>
              </div>

              <div class="seva-contact-item">
                <div class="seva-contact-item-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <div>
                  <strong>Official Email</strong>
                  <p><a href="mailto:sarathidigitalsevakendra@gmail.com">sarathidigitalsevakendra@gmail.com</a></p>
                </div>
              </div>

              <div class="seva-contact-actions">
                <a class="button button--primary" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20would%20like%20to%20visit%20or%20enquire" target="_blank" rel="noopener noreferrer">
                  {WA_SVG}
                  <span>Chat on WhatsApp</span>
                </a>
                <a class="button button--ghost" href="tel:+918369704457">
                  <span>Call 83697 04457</span>
                </a>
                <a class="button button--outline" href="https://www.google.com/maps/search/?api=1&query=19.3152633,72.8586247" target="_blank" rel="noopener noreferrer">
                  <span>Open in Google Maps &rarr;</span>
                </a>
              </div>
            </div>

            <!-- Sister Division Spotlight Card -->
            <div class="seva-sister-division-card">
              <span class="seva-pkg-tag">Security &amp; Connectivity Division</span>
              <h3>Sarathi Smart Solutions</h3>
              <p>Planning CCTV security cameras, commercial Wi-Fi networking, biometric attendance, or smart automation for your shop, clinic, or home?</p>

              <ul class="seva-sister-features">
                <li>Turnkey HD &amp; IP CCTV camera setups with night vision</li>
                <li>Commercial Wi-Fi mesh routers &amp; structured LAN cabling</li>
                <li>Digital smart door locks &amp; video door phones</li>
                <li>Free site survey in Mira-Bhayandar with itemized quotations</li>
              </ul>

              <a class="button button--primary" href="/">Explore CCTV &amp; Security Division &rarr;</a>
            </div>
          </div>
        </div>
      </section>

      <!-- Frequently Asked Questions -->
      <section id="faq" class="seva-section" aria-labelledby="faq-title">
        <div class="seva-container">
          <div class="section-heading">
            <span class="tag-core">Help &amp; Clarity</span>
            <h2 id="faq-title">Frequently Asked Questions</h2>
            <p>Everything you need to know about our services, pricing, and document workflows.</p>
          </div>

          <div class="seva-faq-accordion">
            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>What is Sarathi Digital Seva Kendra and what services do you provide?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>Sarathi Digital Seva Kendra is a digital facilitation centre based in RNP Park, Bhayander East. We assist citizens, students, and businesses with online government applications (PAN, Aadhaar appointment guidance, Voter ID), business compliance (Udyam MSME, Gumasta, GST, FSSAI), healthcare and property documentation (FDA drug licences, MahaRERA), resume drafting, online admissions, and high-quality printing, scanning, and lamination.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>Are government or portal fees included in the prices shown?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>No. Our displayed rates are strictly for our professional digital assistance, verification, document formatting, and submission. Government statutory fees (such as PAN official fees, GST challans, FoSCoS portal fees, MahaRERA statutory fees, and stamp duties) are charged extra at exact actuals, with official receipts provided.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>Can I submit documents via WhatsApp without visiting in person?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>Yes. For most services (PAN applications, GST amendments, Udyam registration, resume creation, print jobs, and online college forms), you can send clear photos or PDF documents directly to our verified WhatsApp number (+91 83697 04457). We process your application and send you the acknowledgement slip digitally.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>Is government Udyam registration free? Why do you charge?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>Yes, the Ministry of MSME portal (udyamregistration.gov.in) provides free registration. We do not charge for the government certificate itself. Our fee of ₹300 is solely for guided digital assistance: validating business NIC codes, organizing Aadhaar/PAN details, formatting enterprise information, and checking details before portal submission.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>Do you guarantee approval for FDA drug licences or FSSAI licences?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>No agency can legally guarantee approval. We provide comprehensive documentation preparation, checklist verification, and portal application assistance. The statutory authority (such as Maharashtra FDA or FoSCoS) conducts verification and inspection to determine eligibility and grant approval.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>What is the turnaround time for PAN card applications?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>Timing depends on document readiness, portal availability, and processing by the issuing authority. Our desk will explain the expected steps after reviewing your documents. Please use the official acknowledgment to check progress after submission.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>What documents do I need for student admission forms (FYJC / Mumbai University)?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>You typically need your 10th/12th marksheet, School/College Leaving Certificate (LC), passport-size photo, signature scan, Aadhaar card, and caste/category certificate (if applicable). We also assist in generating your mandatory Academic Bank of Credits (ABC) ID.</p>
              </div>
            </details>

            <details class="seva-faq-item">
              <summary class="seva-faq-question">
                <span>Do you provide high-speed printing, xerox, and PVC card printing?</span>
                <span class="seva-faq-toggle" aria-hidden="true">+</span>
              </summary>
              <div class="seva-faq-answer">
                <p>Yes. We offer crisp black &amp; white (₹3/page) and full-colour (₹10/page) laser printing, high-speed photocopying, document scanning, A4/A3 heat lamination, and PVC-style ID card printing with immediate same-day delivery.</p>
              </div>
            </details>
          </div>
        </div>
      </section>
    </main>

    <!-- Interactive Service Detail & Document Requirements Modal -->
    <dialog id="seva-detail-modal" class="seva-modal" aria-labelledby="modal-service-title" aria-modal="true">
      <div class="seva-modal-content">
        <div class="seva-modal-header">
          <div class="seva-modal-badges">
            <span class="seva-category-pill" id="modal-category-pill">Category</span>
            <span class="seva-turnaround-badge" id="modal-turnaround-badge">Turnaround</span>
          </div>
          <button type="button" class="seva-modal-close" id="modal-close-btn" aria-label="Close dialog">&times;</button>
        </div>

        <h2 id="modal-service-title" class="seva-modal-title">Service Details</h2>

        <div class="seva-modal-pricing-box">
          <div class="seva-modal-price-col">
            <span class="seva-price-lbl">Professional Assistance Fee</span>
            <strong class="seva-modal-price" id="modal-service-price">₹0</strong>
            <small class="seva-modal-pricetype" id="modal-service-pricetype">(Assistance Fee)</small>
          </div>
          <div class="seva-modal-fee-col">
            <span class="seva-price-lbl">Government / Statutory Fee</span>
            <strong class="seva-modal-officialfee" id="modal-official-fee">Extra at actual</strong>
            <small class="text-muted">Official receipts provided</small>
          </div>
        </div>

        <div class="seva-modal-section">
          <div class="seva-checklist-header">
            <h3>Required Documents Checklist</h3>
            <span class="seva-checklist-counter" id="checklist-counter">0 of 0 ready</span>
          </div>
          <p class="seva-modal-tip">Check off the documents you have ready. We will include this status in your WhatsApp message!</p>
          <div class="seva-checklist-wrap" id="modal-checklist-wrap">
            <!-- Dynamically populated with interactive checkboxes -->
          </div>
        </div>

        <div class="seva-modal-section">
          <h3>Standard Application Milestones</h3>
          <ol class="seva-milestones-list">
            <li><strong>Initial Eligibility &amp; Review:</strong> Document check and requirement validation at our desk.</li>
            <li><strong>Digital Submission:</strong> Accurate entry and portal submission with instant acknowledgment slip.</li>
            <li><strong>Department Verification:</strong> Official authority review, biometric slot or inspection if applicable.</li>
            <li><strong>Handover:</strong> Digital certificate, e-card or physical post tracking handover.</li>
          </ol>
        </div>

        <div class="seva-modal-notes" id="modal-notes-box" hidden>
          <strong>Important Note:</strong>
          <p id="modal-notes-text"></p>
        </div>

        <div class="seva-modal-footer">
          <a id="modal-wa-btn" class="button button--primary seva-modal-wa" href="#" target="_blank" rel="noopener noreferrer">
            {WA_SVG}
            <span>Enquire on WhatsApp with Checklist</span>
          </a>
          <button type="button" id="modal-book-btn" class="button button--outline">
            <span>Enquire About This Service</span>
          </button>
        </div>
      </div>
    </dialog>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-wrap">
        <div class="footer-main">
          <div class="footer-brand">
            <a class="brand" href="/digital-seva-kendra" aria-label="Sarathi Digital Seva Kendra home">
              <img
                class="brand-logo brand-logo--seva"
                src="01_icon_primary.png"
                alt="Sarathi Digital Seva Kendra emblem"
                width="56"
                height="56"
              />
              <span class="brand-copy">
                <strong>Sarathi</strong>
                <small class="seva-brand-tagline">Digital Seva Kendra</small>
              </span>
            </a>
            <p class="footer-summary">
              Digital facilitation centre in Bhayander East. Empowering citizens, students, and businesses with clear guidance for government documentation, compliance filing, and digital services.
            </p>
            <div class="footer-contacts">
              <a href="tel:+918369704457">+91 83697 04457</a>
              <span>•</span>
              <a href="mailto:sarathidigitalsevakendra@gmail.com">sarathidigitalsevakendra@gmail.com</a>
              <span>•</span>
              <span>RNP Park, Bhayander East</span>
            </div>
          </div>

          <div class="footer-col">
            <h4>Quick Links</h4>
            <ul class="footer-links">
              <li><a href="#popular">Popular Services</a></li>
              <li><a href="#services">{total_services_count} Master Directory</a></li>
              <li><a href="#packages">Startup Packages</a></li>
              <li><a href="#request-track">Enquiry &amp; Status</a></li>
              <li><a href="#reviews">Customer Reviews</a></li>
              <li><a href="#contact">Timings &amp; Map</a></li>
              <li><a href="#faq">Frequently Asked Questions</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h4>Sister Divisions</h4>
            <ul class="footer-links">
              <li><a href="/#packages">CCTV Installation Packages</a></li>
              <li><a href="/#planner">Custom Security Planner</a></li>
              <li><a href="/#services">Wi-Fi &amp; Networking</a></li>
              <li><a href="/#survey-form">Book Free CCTV Site Survey</a></li>
            </ul>
          </div>

          <div class="footer-col">
            <h4>Policies &amp; Legal</h4>
            <ul class="footer-links">
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/cancellation-refund">Cancellation &amp; Refunds</a></li>
              <li><a href="/warranty-policy">Warranty Policy</a></li>
              <li><a href="/amc-policy">AMC Policy</a></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&copy; 2026 Sarathi Smart Solutions &amp; Sarathi Digital Seva Kendra. All rights reserved. Bhayander East, Mira-Bhayandar, Thane - 401105.</p>
          <p class="footer-note">All government logos and portal names are trademarks of their respective authorities. Regulated filings are documentation assistance only.</p>
        </div>
      </div>
    </footer>

    <!-- Mobile Sticky Bottom Action Bar (Screens <= 768px) -->
    <nav class="seva-mobile-bar" aria-label="Quick mobile actions">
      <a class="seva-mbar-action" href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20would%20like%20to%20enquire%20about%20your%20services" target="_blank" rel="noopener noreferrer">
        {WA_SVG}
        <span>WhatsApp</span>
      </a>
      <a class="seva-mbar-action" href="tel:+918369704457">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>Call Desk</span>
      </a>
      <a class="seva-mbar-action" href="https://www.google.com/maps/search/?api=1&query=19.3152633,72.8586247" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
        <span>Directions</span>
      </a>
      <a class="seva-mbar-action" href="#request-track">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></svg>
        <span>Enquire / Status</span>
      </a>
    </nav>

    <!-- Floating WhatsApp Action Button (FAB for Desktop / Large Viewports) -->
    <aside class="seva-fab-wrap" aria-label="Quick WhatsApp Contact">
      <a
        class="seva-fab"
        href="https://wa.me/918369704457?text=Hello%20Sarathi%20Digital%20Seva%20Kendra,%20I%20would%20like%20to%20enquire%20about%20your%20services"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Sarathi Digital Seva Kendra on WhatsApp"
        id="seva-whatsapp-fab"
      >
        {WA_SVG}
        <span class="seva-fab-text">WhatsApp Support</span>
      </a>
    </aside>

    <!-- Embedded Dataset for High-Speed Client Interactivity -->
    <script id="seva-data" type="application/json">
{json_dataset_str}
    </script>

    <!-- Interactive script for Service Finder, Modal, Tabs, Pagination & Tracker -->
    <script src="digital-seva-kendra.js" type="module"></script>
  </body>
</html>
"""

# Generated HTML is checked in; Cloudflare builds require Node only, not Python.
Path("digital-seva-kendra.html").write_text(output_html, encoding="utf-8")
subprocess.run([
    "node", "node_modules/prettier/bin/prettier.cjs", "--write",
    "digital-seva-kendra.html", "digital-seva-kendra.js", "styles.css"
], check=True)
if Path("operations/public").is_dir():
    for filename in ("digital-seva-kendra.html", "digital-seva-kendra.js", "styles.css"):
        Path("operations/public", filename).write_bytes(Path(filename).read_bytes())
    print("✓ Synced Seva HTML, JavaScript and shared CSS to operations/public")
print("✓ Generated digital-seva-kendra.html")
