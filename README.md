# Sarathi Smart Solutions — Website Source Code

Editable source for the private Sarathi Smart Solutions website.

Security • Connectivity • Automation

Smart Technology for Homes & Businesses.

## What is included

- `index.html`: page content, service descriptions, inline SVG graphics and planner controls.
- `styles.css`: navy, blue and amber styling, responsive layouts and interaction states.
- `app.js`: three-step planner, validation, recommendation display, copy and manual sharing.
- `recommendation.mjs`: service labels, size choices and rule-based bundle recommendations.
- `tests/recommendation.test.mjs`: five tests for recommendation scenarios and input validation.
- `package.json`: optional build and test commands; no npm dependencies.

The original application files are unchanged from source commit `f9ebcf19b415b9af83b8b753b85c38177ec49589`. This README was added for the downloadable copy. Git history, access tokens and temporary deployment archives are not included.

## Run locally

1. Extract the ZIP and open the `Sarathi_Smart_Solutions` folder in your editor.
2. Serve this folder using a local HTTP server. With Python 3 installed:

   ```bash
   python3 -m http.server 8000 --bind 127.0.0.1
   ```

   On Windows, use `py -m http.server 8000 --bind 127.0.0.1` if your Python installation uses the `py` launcher.

3. Open `http://127.0.0.1:8000` in your browser. Press Ctrl+C in the terminal to stop the server.

An editor's local web-server extension is another option. Do not simply double-click `index.html`: the planner uses JavaScript modules, which require HTTP serving rather than a `file://` URL.

Google Fonts is the only external page resource. If unavailable, the system-font fallback is used.

## Optional tests and build

With a Node.js version supporting the built-in test runner installed:

```bash
npm test
```

On macOS, Linux or a compatible Bash environment:

```bash
npm run build
```

The build recreates the generated `dist` folder and copies the four public application files into it. It does not publish the website. No dependency installation is required.

## Edit the website

- Change page wording in `index.html`.
- Change colours, type sizes and spacing in `styles.css`.
- Change bundle names, size descriptions and recommendation rules in `recommendation.mjs`.
- Change navigation, validation, copying or sharing in `app.js`.

Recommendations are broad starting points, not equipment guarantees or quotations. Equipment quantities, compatibility and pricing require site-specific confirmation.

## Privacy and hosting

The planner operates in the browser, without a backend database, lead submission or automatic customer messages. Copying requires a button click; manual sharing uses the device share sheet when supported, with a clipboard fallback.

Clipboard and native sharing depend on browser permissions and support; HTTPS or localhost is normally required. Recommendations and selections are not saved across a refresh.

Owner-only access is enforced by the existing Sites hosting service, not by the exported HTML or JavaScript. If you host this source elsewhere, configure access restrictions there before uploading it; the code alone does not make another host private.

This export does not change the live website or its current access settings.
