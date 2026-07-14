<div align="center">

<img src="public/icons/icon128.png" width="72" alt="" />

# LinkedIn → Markdown

**Turn a LinkedIn profile into clean Markdown. Copy it, or download it as a `.md` file.**

A Chrome extension. No account, no server, no tracking — everything happens in your browser.

[![CI](https://github.com/mehradamiri/linkedin-md/actions/workflows/ci.yml/badge.svg)](https://github.com/mehradamiri/linkedin-md/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

> [!WARNING]
> **Early scaffold.** The extension builds, loads, and the whole popup → capture → copy/download
> flow works — but the scraper currently returns **placeholder data** instead of reading the real
> page. Implementing `scrapeProfile()` is the next step, and a great first contribution. See
> [`.claude/skills/linkedin-selectors`](.claude/skills/linkedin-selectors/SKILL.md).

## Why

Profiles are worth keeping in plain text: for your own notes, an Obsidian vault, a CV you keep in
git, a candidate summary you paste into a doc. Copy-pasting from LinkedIn gives you a mess of
duplicated lines and broken spacing. This gives you Markdown.

## Install

Not on the Chrome Web Store yet. To run it now:

```bash
git clone https://github.com/mehradamiri/linkedin-md
cd linkedin-md
pnpm install
pnpm build
```

Then open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**,
and select the `dist/` folder.

Open any LinkedIn profile (`linkedin.com/in/…`) and click the extension icon.

## Privacy

The extension reads the profile page you are looking at, in your browser, when you click it.
That's the whole story:

- **No network requests.** Nothing is uploaded anywhere. There is no server.
- **No analytics, no telemetry, no remote code.**
- **No stored data.** The Markdown lives in the popup until you copy or download it.
- **`activeTab` only** — it can only see a tab you explicitly opened it on, and never runs in the
  background. It cannot read your feed, your messages, or any other tab.

Details in [PRIVACY.md](PRIVACY.md).

## Scope

**In scope for v1:** profile pages (`/in/…`) — name, headline, location, about, experience,
education, skills.

**Out of scope:** posts, jobs, company pages, bulk export, and anything that talks to LinkedIn's
private APIs or automates browsing on your behalf. This is a "read the page in front of you"
tool, and stays one.

## Contributing

Contributions welcome — especially selector fixes when LinkedIn redesigns something. Start with
[CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm install
pnpm build      # -> dist/, load unpacked in chrome://extensions
pnpm test       # vitest
pnpm typecheck
pnpm lint
```

Working with Claude Code? [`CLAUDE.md`](CLAUDE.md) has the architecture and conventions, and
[`.claude/skills/linkedin-selectors`](.claude/skills/linkedin-selectors/SKILL.md) is a skill for
writing and repairing the scraping layer.

## Tech

Vite · React · TypeScript · Tailwind v4 · [shadcn/ui](https://ui.shadcn.com) · Manifest V3

## License

[MIT](LICENSE)

---

Not affiliated with, endorsed by, or connected to LinkedIn Corporation.
