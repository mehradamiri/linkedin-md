# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Manifest V3 Chrome extension that turns a LinkedIn **profile** page into clean Markdown,
which the user can copy to the clipboard or download as a `.md` file. Open source, MIT.

**Status: scaffold.** The pipeline (popup → inject → message → render → copy/download) works
end to end, but `scrapeProfile()` returns placeholder data and `profileToMarkdown()` is a
minimal serializer. Those two are the next things to build.

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
    scrape.ts   Document -> Profile   (TODO: real DOM extraction)
    markdown.ts Profile  -> string    (TODO: full serializer)
    messages.ts the typed request/response pair
  components/ui shadcn components (generated — edit via the CLI, not by hand)
```

Data flow: popup opens → `chrome.scripting.executeScript` injects `content.js` into the
active tab → popup sends `SCRAPE_REQUEST` → content script runs `scrapeProfile(document, href)`
→ popup renders Markdown and offers copy/download.

### Load-bearing decisions

- **Two builds.** MV3 content scripts cannot be ES modules, so the popup is built by
  `vite.config.ts` and the content script separately as IIFE by `vite.content.config.ts`.
  `pnpm build` runs both; only the first empties `dist/`.
- **`activeTab` + `scripting`, no `host_permissions`.** The extension can only touch a page
  the user explicitly opened the popup on. This keeps the install prompt quiet and the
  privacy story honest — do not add `host_permissions` or a declarative `content_scripts`
  block without a real reason.
- **`scrapeProfile` takes a `Document`, not `window`.** It stays pure so it can be tested
  against saved HTML fixtures with no browser.
- **Everything is local.** No network calls, no analytics, no remote code. If a change would
  send profile data anywhere, it does not belong in this project.

## Commands

```bash
pnpm dev        # popup in a normal browser tab (chrome.* APIs are absent — the UI states are still exercisable)
pnpm build      # -> dist/, loadable via chrome://extensions -> Load unpacked
pnpm test       # vitest
pnpm typecheck  # tsc -b --noEmit
pnpm lint       # oxlint
pnpm icons      # regenerate public/icons/*.png from scripts/generate-icons.mjs
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

- LinkedIn renders most strings twice — once visible with `aria-hidden="true"`, once inside
  `.visually-hidden` for screen readers. Reading `textContent` naively gives you every value
  doubled. Read the `aria-hidden` copy.
- The popup can inject `content.js` into the same tab repeatedly; the content script guards
  with `window.__linkedinMdReady` so it doesn't register its listener twice.
- Never commit real scraped profiles as fixtures — anonymize them (see the skill).
