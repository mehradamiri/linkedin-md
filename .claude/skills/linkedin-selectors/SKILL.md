---
name: linkedin-selectors
description: Use when writing or repairing the LinkedIn DOM scraping in this extension — implementing scrapeProfile, adding a new profile section (certifications, languages), or fixing extraction that broke after a LinkedIn redesign. Covers capturing an anonymized HTML fixture, structuring selectors with fallbacks, and proving the fix with a test.
---

# Scraping LinkedIn without the scraper rotting

LinkedIn ships obfuscated, frequently-rotated class names (`.pvs-entity__path`,
`.artdeco-list__item`) and A/B-tests layouts. Any scraper written against it _will_ break.
The goal is not a scraper that never breaks — it is one where a break is a **one-file,
one-fixture, one-test fix** that a drive-by contributor can make in twenty minutes.

Three rules make that true:

1. Every DOM assumption lives in `src/lib/selectors.ts`. Nothing else in the codebase calls
   `querySelector` on LinkedIn markup.
2. Every selector is a **list of candidates tried in order**, so a new layout can be added
   ahead of the old one without breaking users on the old one.
3. Every extraction rule is pinned by a test against a saved fixture, so the next person can
   change selectors fearlessly.

## Workflow

### 1. Capture a fixture

Never guess at the markup from memory — LinkedIn's real DOM is stranger than you expect.

On a **real profile page you have the right to view** (your own is ideal), open DevTools and run:

```js
copy(document.querySelector("main").outerHTML)
```

Paste into `src/test/fixtures/profile-<layout-date>.html`, e.g. `profile-2026-07.html`.

### 2. Anonymize it before it touches git

Fixtures are committed to a public repo. Scrub them:

- Replace real names, headlines, employers, schools, and locations with obvious fakes
  (`Jane Doe`, `Acme Corp`, `Example University`).
- Strip `src`/`srcset` on images (LinkedIn media URLs carry member IDs), `href`s to real
  profiles, `data-*` attributes holding URNs (`urn:li:fsd_profile:ACoAA…`), and any tracking IDs.
- Keep the _structure_ — tag nesting, class names, `aria-hidden` duplication. That is the
  only thing the test cares about.

If a fixture cannot be safely anonymized, do not commit it; write the test against a hand-built
minimal DOM instead.

### 3. Write selectors as ordered candidates

```ts
export const SELECTORS = {
  name: ["h1.text-heading-xlarge", "main h1", "h1"],
  listItem: [
    "li.artdeco-list__item",
    "ul > li.pvs-list__paged-list-item",
    "ul > li",
  ],
} as const
```

Order them **most specific first, most generic last**. The generic fallback (`h1`) is what
keeps the extension limping along rather than hard-failing on a redesign.

Anchor sections by their stable `id`, not by heading text or position — LinkedIn keeps
`<div id="experience">` / `#education` / `#skills` anchors inside each profile card even as
the surrounding classes churn:

```ts
const section = doc.querySelector("div#experience")?.closest("section")
```

### 4. Know the two traps

**Doubled text.** LinkedIn renders most strings twice — once visibly with `aria-hidden="true"`,
once inside `.visually-hidden` for screen readers. Naive `textContent` yields
`"Staff EngineerStaff Engineer"`. Always read the `aria-hidden` copy:

```ts
el.querySelector('span[aria-hidden="true"]')?.textContent
```

**Lazy sections.** Experience/skills lists render as the user scrolls, and long lists are
truncated behind "Show all 24 experiences" (a separate `/details/experience` page). Decide
deliberately: scrape what is on the page, or navigate the details pages. Whatever you choose,
say so in the README — silently capturing only the first 5 roles is worse than saying you do.

### 5. Prove it

Load the fixture in a Vitest test with jsdom and assert on parsed output, not on selectors:

```ts
const doc = new DOMParser().parseFromString(html, "text/html")
const profile = scrapeProfile(doc, "https://www.linkedin.com/in/jane-doe")
expect(profile.experience[0]).toMatchObject({
  title: "Staff Engineer",
  company: "Acme Corp",
})
```

Assert on the _shape and content_ of the `Profile`. A test that asserts a class name exists is
a test that fails for the right reason but tells you nothing.

### 6. Fail loudly, in the user's words

When the page cannot be read, surface a message a non-technical user can act on —
"Open a LinkedIn profile and let it finish loading" — not `TypeError: null is not an object`.
A redesign should produce a clear error and a bug report, not a silently empty Markdown file.

## When a redesign lands

1. Capture a fresh fixture (steps 1–2) and commit it _alongside_ the old one — do not delete
   the old fixture; users on the old layout still exist and both must pass.
2. Add the new selectors **ahead** of the existing candidates in the list.
3. Run `pnpm test`. Green against both fixtures = ship it.
