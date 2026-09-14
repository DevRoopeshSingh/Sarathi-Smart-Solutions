# Security Policy

Sarathi Smart Solutions takes the safety, integrity, and privacy of our website and customer communications seriously.

---

## Architecture and Scope

The Sarathi Smart Solutions official website is a static-first web application:

- **No server-side application layer**: Static assets are hosted directly via static web servers or CDNs.
- **Zero dynamic database backends**: Solution recommendations run strictly client-side within the prospect's browser.
- **No sensitive storage**: Customer details, enquiry summaries, and form values are never logged or stored on our servers. WhatsApp messages and enquiries are dispatched directly through standard device protocols (Click-to-Chat / Web Share).

---

## Reporting a Vulnerability

If you discover a potential security flaw, vulnerability, or misconfiguration in this repository or on the live website:

1. **Email us directly**: Send an email to **[sarathismartsolutions@gmail.com](mailto:sarathismartsolutions@gmail.com)** with the subject line:
   `SECURITY DISCLOSURE: [Brief description]`
2. **Provide detailed information**:
   - Description of the vulnerability or risk.
   - Steps to reproduce or proof-of-concept.
   - Affected browser, operating system, or environment.
3. **Responsible Disclosure**:
   - Please allow up to **48 hours** for an initial response before taking any public action.
   - We ask that you do not disclose the issue publicly until we have reviewed and addressed it.

---

## Security Practices Followed

- **Strict DOM Safety**: Direct use of `innerHTML` is strictly avoided across browser scripts; dynamic elements are built with native DOM methods (`document.createElement()`, `textContent`, `setAttribute()`, and `replaceChildren()`) to eliminate Cross-Site Scripting (XSS).
- **Sanitised Communication Channels**: Phone numbers, enquiry parameters, and links are normalised and encoded using `encodeURIComponent()` to avoid protocol injection.
- **No Committed Secrets**: The repository strictly forbids committing `.env` files, API keys, credentials, or private keys.
