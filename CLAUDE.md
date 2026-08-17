# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Manifest V3 Chrome extension that turns a LinkedIn **profile** page into clean Markdown,
which the user can copy to the clipboard or download as a `.md` file. Open source, MIT.

**Status: working**, verified against live profiles. Extraction covers the header (name,
headline, location, external links), About, experience (including several roles grouped under
one company), education, skills, languages and certifications, plus publications, projects,
volunteering, honors, courses, patents and organizations as generic entries in
`Profile.extras`. The DOM rules and the evidence behind them live in
`.claude/skills/linkedin-selectors` — read it before touching the scraping layer.

## Stack

Vite 8 · React 19 · TypeScript (strict) · Tailwind v4 · shadcn/ui (radix-nova, `neutral` base)
· Vitest · oxlint · pnpm.

## Architecture

The extension has exactly two runtime surfaces. Keep it that way — no background service
worker unless something genuinely needs one.

```
src/
  popup/        React UI (Popup.tsx, use-profile-capture.ts) — the toolbar popup
  content/      injected into the LinkedIn tab; reads the DOM, replies with a Profile
  lib/          shared, framework-free logic
    types.ts    Profile — the contract between content script and popup
    selectors.ts every LinkedIn DOM assumption (heading text, row groups, junk filters)
    scrape.ts   Document -> Profile / entries   (pure — works on any LinkedIn document)
    markdown.ts Profile  -> string
    messages.ts the typed request/response pair, plus per-section progress
  components/ui shadcn components (generated — edit via the CLI, not by hand)
```

Data flow: popup opens → `chrome.scripting.executeScript` injects `content.js` into the active
tab → popup sends `SCRAPE_REQUEST` → the content script reads the header and About from the
page, then renders each `/in/{handle}/details/{section}/` page in a **hidden same-origin
iframe** and reads it with the same extractor → it reports progress per section → the popup
renders Markdown and offers copy/download.

### Load-bearing decisions

- **Two builds.** MV3 content scripts cannot be ES modules, so the popup is built by
  `vite.config.ts` and the content script separately as IIFE by `vite.content.config.ts`.
  `pnpm build` runs both; only the first empties `dist/`.
- **`activeTab` + `scripting`, no `host_permissions`.** The extension can only touch a page
  the user explicitly opened the popup on. This keeps the install prompt quiet and the
  privacy story honest — do not add `host_permissions` or a declarative `content_scripts`
  block without a real reason.
- **Detail pages are read in a hidden same-origin iframe.** The profile page no longer contains
  experience/education/skills at all — they live only on `/details/{section}/`, and that markup
  exists only after React hydrates (fetching the HTML returns an empty shell). Framing LinkedIn
  inside LinkedIn is same-origin, so it needs no extra permission and no background worker.
  Do not "fix" this with `fetch()`, `host_permissions`, or a service worker.
- **The extractors take a `Document`, not `window`.** `scrapeSection`/`scrapeMainProfile` stay
  pure so they can run against saved fixtures with no browser — and so the same code reads the
  profile page and each detail page.
- **An unfilled section must be detected, not waited out.** Most members have none of the
  optional sections, and a section with no rows is indistinguishable from one that has not
  hydrated. `isEmptySection` reads LinkedIn's placeholder copy so the reader stops immediately;
  without it every unfilled section costs the full polling budget, and reading twelve sections
  becomes minutes. Sections are read `CONCURRENCY` at a time for the same reason.
- **The capture outlives the popup.** The popup closes on any click outside it, so the content
  script owns the run: a reopened popup joins the in-flight capture or is handed the finished
  one. Never move that state into the popup, and never restart a capture that is already
  running — each restart is another dozen LinkedIn page loads.
- **A section that failed is not a section that is empty.** `readSection` distinguishes `ok` /
  `empty` / `unreadable`, and anything unreadable lands in `Profile.warnings` and is named in
  the Markdown. Silently omitting it produces an export that looks complete and is not.
- **Everything is local, except where the user explicitly sends it.** No network calls, no
  analytics, no remote code, no backend. The one outbound path is the "Send to AI" button, which
  acts on a click, on a destination the user picked. Anything that moves profile data without
  that click does not belong in this project — and `PRIVACY.md` has to keep matching the code.
- **The AI handoff is clipboard-first.** Typing into ChatGPT or Claude for the user would need
  `host_permissions` for those sites plus a composer selector per service, maintained against
  someone else's redesign schedule. Instead the Markdown always goes to the clipboard, and rides
  in the URL where the service reads an opening prompt from one and the profile fits under
  `MAX_PROMPT_URL`. A profile too long for the URL is handed over by clipboard rather than sent
  truncated — the popup says which will happen before the click.

## Commands

```bash
pnpm dev        # popup in a normal browser tab (chrome.* APIs are absent — the UI states are still exercisable)
pnpm build      # -> dist/, loadable via chrome://extensions -> Load unpacked
pnpm test       # vitest
pnpm typecheck  # tsc -b --noEmit
pnpm lint       # oxlint
pnpm zip        # build + package dist/ for the Chrome Web Store
```

## Conventions

- **UI: use shadcn components, don't hand-roll markup.** `Alert` for callouts, `Empty` for
  empty states, `Skeleton` for loading, `Badge` for chips, `sonner` for toasts. Semantic
  color tokens only (`bg-primary`, `text-muted-foreground`) — never raw colors like
  `bg-blue-500`. `gap-*` over `space-y-*`, `size-*` over `w-4 h-4`. Add components with
  `pnpm dlx shadcn@latest add <name>` rather than writing them from scratch.
- **Every LinkedIn DOM assumption goes in one selectors module** with ordered fallbacks —
  never inline a `querySelector(".pvs-entity__path")` in feature code. LinkedIn's class names
  are obfuscated and rotate; isolating them is what makes a break a one-file fix.
- **Scraping changes need a fixture and a test.** See `.claude/skills/linkedin-selectors`.
- Comments explain constraints, not narration. The MV3/IIFE and `activeTab` notes above are
  the kind of thing worth a comment; `// loop over roles` is not.

## Gotchas

Almost every intuition about this DOM is wrong; the skill has the full table and the evidence.
The ones that bite hardest:

- **There is no `<h1>`.** The name is an `<h2>`. Section headings are plain `<div>`s — the only
  real `<h2>`s inside `<main>` are ad units. Anchor on heading *text*, never on a tag or class.
- **Rows are not `<li>`.** They are a sibling group of `<div>`s; a company with several roles
  wraps a `<ul>` of sub-roles while a standalone role is a bare `<div>` next to it.
- **Hydration is slow.** Poll for rows; a fixed delay reads an empty section and looks exactly
  like a broken selector.
- **An empty section still renders a page** ("Nothing to see for now") and will happily scrape
  as two entries if you let it — see `isEmptyState`.
- The popup can inject `content.js` into the same tab repeatedly; the content script guards
  with `window.__linkedinMdReady` so it doesn't register its listener twice.
- **The top card's company/school chips sit exactly where the location does.** With several
  chips LinkedIn renders them once combined ("Acme · Example University") and again standing
  alone; with a *single* chip it renders that one chip twice. Both patterns have to be matched
  — handling only the first exported "Gates Foundation" as Bill Gates's location, on the
  commonest profile shape there is, while the two-chip fixture went on passing.
- **A short line is not a location.** "Led the platform team" is four words with no full stop.
  `looksLikeLocation` needs a positive signal (a comma, a work mode, a geographic word, or
  title case), never just a word count.
- Fixtures encode the assumptions of whoever wrote the selectors. **Verify against a live
  profile**, not just `pnpm test` — every bug listed above passed the unit tests first.
- Never commit real scraped profiles as fixtures — anonymize them (see the skill).
