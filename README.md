# SubAudit

> **You think you spend $86/mo on subscriptions. You spend $219.**

A private, **local-only** subscription auditor. See what your subscriptions *really* cost — per month, per year, and what to cut. Your financial data never leaves your device.

**Live:** https://subaudit.pages.dev/

![local](https://img.shields.io/badge/data-100%25_on--device-2dd4bf) ![backend](https://img.shields.io/badge/backend-none-2dd4bf) ![tests](https://img.shields.io/badge/engine_tests-126_passing-2dd4bf)

## Why

[41% of people](https://www.globenewswire.com/news-release/2026/02/27/3246721/0/en/Brothers-Launch-True-North-Budgeting-Privacy-First-Desktop-App-Offers-Calm-Alternative-as-Subscription-Fatigue-Grows.html) have subscription fatigue and spend ~**$219/month** on subscriptions while guessing ~$86. The money leaks because nothing shows the true total. SubAudit adds it up — and because your subscriptions are *financial data*, everything stays in your browser. No account, no cloud, no upload. Works offline.

The irony of paying a monthly fee to track monthly fees ends here: SubAudit is free and local — **no subscription to audit your subscriptions.**

## Features

- Add / edit / pause / delete subscriptions
- Normalizes any billing cycle (weekly · monthly · quarterly · yearly · every-2-years) to a true monthly & yearly figure
- Multi-currency with live display-currency switch (USD/CNY/EUR/GBP/JPY/UAH/HKD/CAD/AUD)
- **Your true yearly spend** front and center, plus biggest drain & category breakdown
- Upcoming renewals (next 30 days), color-coded
- Export / import JSON & CSV (your backup, your device)
- **Trilingual**: English / 中文 / Українська, auto-selected by browser
- Everything persists in `localStorage` — nothing is uploaded, ever

## Architecture

Pure static site. Two layers:
- **`engine.js`** — dependency-free pure-logic engine (cycle normalization, currency conversion, renewal-date math incl. month-end & leap-year handling, category breakdown, CSV/JSON round-trip). Built test-first; **126 assertions** in `test.mjs`.
- **`app.js`** — UI + i18n wired to the engine; `localStorage` only.

```bash
npm run check     # run the engine test suite (node, zero deps)
python -m http.server 8017   # serve locally
```

Built with a Claude × Codex workflow: Codex authored the engine + full test suite against `SPEC_ENGINE.md`; the UI, i18n, and integration were built and verified against that contract.

## Note on currency rates

Display-currency conversion uses approximate static FX rates (for relative comparison, not accounting). Amounts you enter are stored in their original currency untouched.

## License

MIT
