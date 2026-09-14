# Contributing to Sarathi Smart Solutions

Thank you for contributing to the Sarathi Smart Solutions website codebase. This guide outlines development practices, code standards, and verification steps.

---

## Development Principles

1. **Static-First & Lightweight**:
   - Keep the codebase pure HTML5, modern CSS, vanilla JavaScript (ES modules), and native Node.js built-ins.
   - Do not introduce heavy frontend frameworks (React, Vue, Angular, Next.js) or runtime external libraries without explicit approval.
2. **Business Accuracy**:
   - Do not fabricate testimonials, certifications, pricing claims, or warranty terms.
   - Retain verified contact details: phone, WhatsApp, email, and Thane / Mira-Bhayandar physical address.
3. **Accessibility & Security First**:
   - Target WCAG 2.2 AA standards.
   - Never use `innerHTML` for dynamic content or rendering user choices.
   - Ensure all interactive elements have strong visible focus indicators and accessible names.

---

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/DevRoopeshSingh/Sarathi-Smart-Solutions.git
   cd Sarathi-Smart-Solutions
   ```

2. **Install development dependencies**:

   ```bash
   npm install
   ```

3. **Run local preview server**:
   ```bash
   npm run serve
   ```
   Open `http://127.0.0.1:8080/` in your browser.

---

## Verification & Quality Commands

Before submitting pull requests or pushing changes, run all quality checks:

```bash
# Check code formatting with Prettier
npm run format:check

# Auto-format codebase
npm run format

# Run ESLint
npm run lint

# Run Node.js unit tests for recommendation rules
npm test

# Run cross-platform production build
npm run build

# Run Playwright browser end-to-end tests
npm run test:e2e
```

---

## Git Conventions

- **Branch Naming**:
  - `feature/short-description`
  - `fix/short-description`
  - `docs/short-description`
- **Commit Messages**:
  - Use clear, descriptive commit messages in the imperative mood (e.g. `feat: add accessibility landmarks to solution planner`).
