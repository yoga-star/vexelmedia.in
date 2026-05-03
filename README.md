# Vexel Media — Website

Design-first creative & marketing studio in Bengaluru.
Live at [vexelmedia.in](https://vexelmedia.in) (once deployed).

## Stack

Static HTML / CSS / vanilla JS — no build step.
- **Bricolage Grotesque** + **Manrope** + **JetBrains Mono** (Google Fonts)
- **Lenis** for smooth scroll (CDN)
- Custom cursor, magnetic CTAs, 3D tilt, sticky scrubber, drag rail, animated counters

## Files

```
index.html       Home — hero, services, packages, stats, CTA
contact.html     Project brief form + WhatsApp / phone / email cards
styles.css       All styles (single sheet)
script.js        All interactions (loader, cursor, Lenis, etc.)
vercel.json      Clean URLs + caching headers
```

## Local preview

Any static server works. Pick one:

```sh
# Python
python3 -m http.server 3000

# Node
npx serve -l 3000

# PHP
php -S localhost:3000
```

Then open `http://localhost:3000`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. On vercel.com → **New Project** → import the repo.
3. Framework preset: **Other** (it's plain HTML).
4. Build / output settings: leave empty.
5. Click **Deploy**.

Vercel auto-deploys every push to `main`. Custom domain: add it in Project → Settings → Domains.

## Wire the contact form to a real backend

The form in `contact.html` currently opens the user's email client (`mailto:`) on submit. To collect submissions properly:

**Option A — Formspree** (simplest)
1. Sign up at [formspree.io](https://formspree.io), create a form, copy the endpoint.
2. In `contact.html`, replace the `<form id="briefForm" novalidate>` line with:
   ```html
   <form id="briefForm" action="https://formspree.io/f/YOUR_ID" method="POST">
   ```
3. Delete the `<script>` block at the bottom of `contact.html` (or remove the submit handler) so the form posts natively.

**Option B — Web3Forms / Getform / Tally** — same pattern.

**Option C — Vercel Functions** — add `/api/contact.js` and POST the form there.

## Phone / WhatsApp

Currently set to **+91 78168 16963** (`tel:+917816816963`, `wa.me/917816816963`). Search-replace these in both HTML files if it changes.

## Re-enable the Work section

`index.html` has the case-study section commented as `hidden`. To bring it back:
1. Find `<section class="work" id="work" hidden>` and remove the `hidden` attribute.
2. Add `<a href="#work">/work</a>` back to nav and footer.

---

© 2026 Vexel Media · Bengaluru, India
