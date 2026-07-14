---
name: linkedin-selectors
description: Use when writing or repairing the LinkedIn DOM scraping in this extension — implementing or fixing scrapeSection/scrapeMainProfile, adding a profile section, or repairing extraction that broke after a LinkedIn redesign. Covers what the live DOM actually looks like (no h1, div headings, rows that are not list items), the hidden-iframe detail-page architecture, capturing an anonymized fixture, and proving the fix with a test.
---

# Scraping LinkedIn without the scraper rotting

LinkedIn actively defends against scraping. Any scraper written against it _will_ break. The
goal is not one that never breaks — it is one where a break is a **one-file, one-fixture,
one-test fix**.

Three rules make that true:

1. Every DOM assumption lives in `src/lib/selectors.ts`. Nothing else in the codebase calls
   `querySelector` on LinkedIn markup.
2. Anchors are **ordered candidates**, so a new layout can be added ahead of the old one
   without breaking users still on the old one.
3. Every extraction rule is pinned by a test against a saved fixture.

## What the live DOM actually is (verified 2026-07 against a real profile)

Most of what you would assume from a tutorial is **false here**. Each of these was confirmed
by inspecting the rendered page, and several were bugs caught only by running against it:

| Assumption | Reality |
|---|---|
| The name is in `<h1>` | **There is no `<h1>` on the page at all.** The name is an `<h2>`. `<title>` ("Jane Doe \| LinkedIn") is the last-resort anchor. |
| Sections are `<section>` with an `<h2>` | The section heading is a plain **`<div>`**. The only real `<h2>`s inside `<main>` belong to **ad units**. Anchor on heading *text*, at whatever tag it renders as. |
| Rows are `<li>` | Rows are a **sibling group of `<div>`s**. A company with several roles is a `<div>` wrapping a `<ul>` of sub-roles, while a standalone role is a bare `<div>` sibling — no list selector finds both. |
| Class names can be selected | Hashed per build (`_7347ac35`). Selecting on them guarantees a break. |
| The profile page contains the profile | **It does not.** Experience, education, skills, languages and certifications render **only** on `/in/{handle}/details/{section}/`. The profile page carries the top card, About, Featured and Activity — nothing else. |
| Text is duplicated for screen readers | Gone on the current layout (it existed on the legacy one). `textLines()` still strips `.visually-hidden` so both layouts work. |
| `fetch()` + `DOMParser` can read a detail page | **Dead end.** The response has zero sections/list items — structure only exists after React hydrates. Render it, then read it. |

Two more traps that only show up on real data:

- **Empty sections still render a page.** A member with no certifications gets
  "Nothing to see for now" — which will happily scrape as two entries. `isEmptyState()`
  drops it. Always test a section the member does *not* have.
- **Skill chips hang off experience rows** as `<a href=".../overlay/…">` links and land in
  the role's description. `textLines()` strips `/overlay/` links for this reason.
- **The top card's company/school chips have no link, no logo alt, nothing to select on.**
  They are told apart from the location only by rendering *twice*: once as a combined
  "Acme Corp · Example University" line and again as standalone lines. `scrapeHeader` uses
  that duplication.

## Architecture that follows from this

`scrapeSection(doc, key)` and `scrapeMainProfile(doc, url)` are **pure over a `Document`** —
they do not care which page it came from. The content script renders each
`/details/{section}/` page in a **hidden same-origin iframe**, waits for hydration, scrolls it
(long lists render lazily), and runs the same extractor on `iframe.contentDocument`.

Same-origin framing needs **no new permissions** and no background worker: the page is already
allowed to frame its own URLs, and nothing leaves the tab. Do not replace this with
`host_permissions`, a background service worker, or `fetch()`.

Readiness is not optional. Sections hydrate seconds after `load`, so **poll for rows** rather
than waiting a fixed delay — an impatient read returns an empty section and looks exactly like
a broken selector.

## How rows are found

`findRows(doc, key)` locates the section heading by text, then picks the **sibling group that
best matches the section's row predicate** (most matching members; shallowest on a tie):

- `experience` / `education` / `certifications`: a row contains a date range or an entity link
  (`/company/`, `/school/`). The predicate is what stops the search from descending *into* a
  row and mistaking its fields for a list of rows.
- `skills` / `languages`: no date, no entity link — the rows are simply the largest sibling
  group of container elements. (A filter `<nav>` sits between the skills heading and its list,
  so rows are not always siblings of the heading.)

If you add a section, add its titles to `SECTION_TITLES`, a scraper to `SECTION_SCRAPERS`, and
a predicate to `ROW_PREDICATE` **only if** its rows carry a date or an entity link.

## Workflow

### 1. Capture a fixture

Never guess the markup from memory — it is stranger than you expect. On a profile you have the
right to view, open the **details page** you care about
(`linkedin.com/in/{you}/details/experience/`), let it finish rendering, then:

```js
copy(document.querySelector("main").outerHTML)
```

Save as `src/test/fixtures/details-{section}-{layout-date}.html`.

### 2. Anonymize it before it touches git

Fixtures are committed to a public repo:

- Replace real names, employers, schools and locations with obvious fakes.
- Strip `src`/`srcset` on images (LinkedIn media URLs carry member IDs), `href`s to real
  profiles, `data-*` attributes holding URNs (`urn:li:fsd_profile:ACoAA…`), and tracking IDs.
- Keep the *structure*: tag nesting, the div-not-li rows, the heading-as-div, the ad units
  inside `<main>`. That structure is the whole point of the fixture.

If it cannot be safely anonymized, hand-build a minimal DOM that mirrors the shape instead —
the existing fixtures do exactly this, and they are small enough to read.

### 3. Fix it in `selectors.ts`, never in feature code

Add new anchors **ahead** of the existing candidates; do not delete the old ones while the old
layout still exists in the wild.

### 4. Prove it

```ts
import experienceHtml from "@/test/fixtures/details-experience-2026-07.html?raw"

const doc = new DOMParser().parseFromString(experienceHtml, "text/html")
expect(scrapeSection(doc, "experience")[0]).toMatchObject({
  title: "Principal Software Engineer",
  company: "Acme Corp",
})
```

Assert on the *shape and content* of the parsed entries, not on selectors. A test that asserts
a class name exists fails for the right reason but tells you nothing.

**Then run it against a real profile.** The fixtures are written by the same person who wrote
the selectors, so they encode the same assumptions; every bug listed in the table above
survived the unit tests and was caught only by running the real code against the live page.

### 5. Fail loudly, in the user's words

No name found → "Open a LinkedIn profile and let it finish loading". Name but no sections →
"LinkedIn may have changed its layout", which is the signal to run this workflow. A redesign
should produce a clear error and a bug report, never a silently empty Markdown file.

## When a redesign lands

1. Capture a fresh fixture (steps 1–2) and commit it *alongside* the old one — both must pass.
2. Add the new anchors **ahead** of the existing candidates.
3. `pnpm test`, then re-verify on a live profile.
