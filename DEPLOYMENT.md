# Cloudflare Pages Production Deployment Runbook

This document provides a step-by-step, zero-cost production deployment guide for **Sarathi Smart Solutions** using **Cloudflare Pages**.

---

## 1. Why Cloudflare Pages?

- **100% Free Hosting**: Unlimited bandwidth, no request caps on the free tier, and no surprise charges.
- **Ultra-Fast Performance Across India**: Cloudflare routes traffic through edge data centers in Mumbai, Delhi, Bengaluru, Chennai, and Kolkata, delivering sub-300ms page loads on local mobile networks.
- **Automated CI/CD**: Every `git push` to `main` automatically triggers a fresh build and live deployment.
- **Built-in Security**: Automatic SSL/TLS certificates, DDoS mitigation, and HTTP/2 + HTTP/3 support.
- **Native Static Architecture**: Zero server maintenance, zero database vulnerabilities.

---

## 2. Prerequisites

1. **Cloudflare Account**: Sign up for free at [dash.cloudflare.com](https://dash.cloudflare.com/) (no credit card required).
2. **GitHub Account**: Access to the [DevRoopeshSingh/Sarathi-Smart-Solutions](https://github.com/DevRoopeshSingh/Sarathi-Smart-Solutions) repository.
3. **Domain Name** (Optional for day 1):
   - You can launch immediately using Cloudflare's free subdomain: `https://sarathi-smart-solutions.pages.dev`.
   - When ready for a custom domain (e.g. `sarathismartsolutions.in`), follow [Section 5](#5-custom-domain-setup) below.

---

## 3. Step-by-Step Initial Deployment

### Step 1: Connect GitHub to Cloudflare Pages

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left-hand sidebar, navigate to **Compute (Workers & Pages)** > **Create application**.
3. Select the **Pages** tab and click **Connect to Git**.
4. Authorize Cloudflare to access your GitHub account and select repository:
   ```text
   DevRoopeshSingh/Sarathi-Smart-Solutions
   ```
5. Click **Begin setup**.

### Step 2: Configure Build Settings

Fill in the project configuration fields exactly as follows:

| Field                      | Value                     | Notes                                                                 |
| :------------------------- | :------------------------ | :-------------------------------------------------------------------- |
| **Project name**           | `sarathi-smart-solutions` | Determines your free URL: `https://sarathi-smart-solutions.pages.dev` |
| **Production branch**      | `main`                    | Automatically builds whenever code is merged to `main`                |
| **Framework preset**       | `None` / `Custom`         | Static Node build script                                              |
| **Build command**          | `npm run build`           | Executes `scripts/build.mjs`                                          |
| **Build output directory** | `dist`                    | Destination folder containing production assets                       |
| **Root directory**         | _(Leave blank)_           | Uses root of repository                                               |

### Step 3: Configure Environment Variables

Under **Environment variables (advanced)**, add:

| Variable Name  | Value                                       | Purpose                                                                      |
| :------------- | :------------------------------------------ | :--------------------------------------------------------------------------- |
| `NODE_VERSION` | `22`                                        | Matches repository Node version (.nvmrc)                                     |
| `SITE_URL`     | `https://sarathi-smart-solutions.pages.dev` | Required by build script to generate canonical tags, sitemap, and SEO schema |

> [!IMPORTANT]
> `SITE_URL` must start with `https://` and must **not** have a trailing slash. If you already have your final custom domain ready (e.g. `https://www.sarathismartsolutions.in`), enter that instead.

### Step 4: Deploy

1. Click **Save and Deploy**.
2. Cloudflare will clone your repository, run `npm run build`, and deploy the 21 static files to its edge network.
3. Once completed (usually 30–60 seconds), Cloudflare will display a success screen with your live site URL:
   ```text
   https://sarathi-smart-solutions.pages.dev
   ```

---

## 4. Edge Security and Caching (Included Automatically)

This repository includes custom Cloudflare Pages configuration files that are automatically bundled into `dist/`:

1. **`_headers`**:
   - **HSTS** (`Strict-Transport-Security`): Forces all browsers to use HTTPS.
   - **Clickjacking Protection**: `X-Frame-Options: SAMEORIGIN`.
   - **MIME-Type Sniffing Protection**: `X-Content-Type-Options: nosniff`.
   - **Referrer Privacy**: `Referrer-Policy: strict-origin-when-cross-origin`.
   - **Asset Caching**: Images (`/assets/*`, `.png`, `.jpg`) are cached immutably for 1 year (`max-age=31536000`), while HTML is set to `must-revalidate` so visitors always see updates immediately.

2. **`_redirects`**:
   - Automatically redirects `/index.html` to `/` (301 Permanent Redirect) for SEO URL canonicalization.

---

## 5. Custom Domain Setup

When you are ready to link your own domain (e.g. `sarathismartsolutions.in`):

### Step 1: Add Custom Domain in Cloudflare Pages

1. In Cloudflare Pages, select your `sarathi-smart-solutions` project.
2. Go to the **Custom domains** tab and click **Set up a custom domain**.
3. Enter your domain:
   - For apex domain: `sarathismartsolutions.in`
   - For subdomain / www: `www.sarathismartsolutions.in`
4. Follow Cloudflare's prompts:
   - **If your domain's DNS is managed on Cloudflare**: Cloudflare automatically configures the CNAME records with CNAME flattening.
   - **If your domain is at an external registrar (GoDaddy, Namecheap, BigRock)**:
     - Add a **CNAME** record:
       - Name: `www` (or `@` if supported by registrar)
       - Target: `sarathi-smart-solutions.pages.dev`
     - _Recommended alternative_: Switch your domain's nameservers to Cloudflare to get free DDoS protection, DNS management, and Cloudflare Email Routing.

### Step 2: Update `SITE_URL` and Trigger Rebuild

Whenever you switch to a custom domain:

1. Go to **Settings** > **Environment variables** in your Cloudflare Pages project.
2. Edit `SITE_URL` to your production domain:
   ```text
   SITE_URL=https://www.sarathismartsolutions.in
   ```
3. Go to the **Deployments** tab, click the three dots on the latest deployment, and click **Retry deployment** (or push a new commit to GitHub).
4. The build script will re-render `index.html`, `sitemap.xml`, and `robots.txt` with your new domain.

---

## 6. Free Professional Business Email Forwarding (₹0)

Instead of paying Google Workspace or Microsoft 365 monthly fees:

1. In Cloudflare Dashboard, select your domain and click **Email Routing**.
2. Click **Add routing rule**:
   - Custom address: `contact@sarathismartsolutions.in` (or `info@...`)
   - Destination address: Your personal Gmail address (e.g. `youremail@gmail.com`).
3. Verify your personal Gmail through the confirmation email sent by Cloudflare.
4. All business enquiries sent to your custom domain will forward to your personal Gmail inbox for free.

---

## 7. Post-Launch Verification Checklist

After deploying your site:

### Functionality & Mobile Checks

- [ ] Open the site on an Android smartphone and an iPhone.
- [ ] Tap the sticky **Call** button (`+91 83697 04457`) and ensure the dialer opens.
- [ ] Tap the sticky **WhatsApp** button and confirm WhatsApp opens with the pre-filled message.
- [ ] Fill out the **Quick Site Survey** form and test the **Quotation Planner**; submit to verify WhatsApp draft generation.
- [ ] Confirm image gallery under `#work-gallery` loads crisp images on 4G/5G connections.
- [ ] Navigate to policy pages: `/privacy.html`, `/terms.html`, `/warranty-policy.html`, `/amc-policy.html`, `/cancellation-refund.html`.

### SEO & Search Engines

- [ ] Check `https://<yourdomain>/robots.txt` — ensure it points to the correct `sitemap.xml` URL.
- [ ] Check `https://<yourdomain>/sitemap.xml` — ensure all URLs reflect the live domain.
- [ ] Sign in to [Google Search Console](https://search.google.com/search-console).
- [ ] Add your domain property and submit your sitemap URL: `https://<yourdomain>/sitemap.xml`.
- [ ] Update your **Google Business Profile** website link to point to your new HTTPS address.

---

## 8. Continuous Updates Workflow

Whenever you make improvements to the website:

```bash
# 1. Test your changes locally
npm test
npm run lint

# 2. Commit and push to GitHub
git add .
git commit -m "feat: your update description"
git push origin main
```

Cloudflare Pages will detect the push to `main`, run `npm run build`, and deploy the update live within 60 seconds.
