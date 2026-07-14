/**
 * Every LinkedIn DOM assumption lives here — nothing else in the codebase queries
 * LinkedIn markup. See .claude/skills/linkedin-selectors for the workflow and the
 * live-DOM evidence behind these rules.
 *
 * What the 2026 layout actually gives us (verified against a live profile):
 *  - Class names are hashed per build (`_7347ac35`) — never select on them.
 *  - Section headings are NOT <h2>. On a details page the "Experience" heading is a
 *    plain <div>; the only real <h2>s inside <main> belong to ad units. So heading
 *    *text* is the anchor, at whatever tag it happens to render as.
 *  - Rows are NOT reliably <li>. A company with several roles renders as a <div>
 *    wrapping a <ul> of sub-roles, while a standalone role is a bare <div> sibling.
 *    So rows are found as a sibling *group*, not by tag.
 *  - The entity <a href="/company/…"> / "/school/…" link is the one durable identity
 *    signal, and it survives even when the company name has no text line of its own.
 */

export type SectionKey =
  | "about"
  | "experience"
  | "education"
  | "skills"
  | "languages"
  | "certifications"

/** Heading text as it appears on the profile and on /details/{slug}/. */
export const SECTION_TITLES: Record<SectionKey, string[]> = {
  about: ["About"],
  experience: ["Experience"],
  education: ["Education"],
  skills: ["Skills"],
  languages: ["Languages"],
  certifications: [
    "Licenses & certifications",
    "Licenses and certifications",
    "Certifications",
  ],
}

/** Ad units, footers and helper cards that live inside <main> alongside real content. */
const JUNK_TEXT =
  /^(ad options|more profiles|people you may know|you might like|don.t want to see|questions\?|manage your account|recommendation tr|promoted|feed post|activity)/i

/** A section the member never filled in still renders a page, with placeholder copy
 * ("Nothing to see for now"). Without this, an empty section exports as two entries. */
const EMPTY_STATE = /^(nothing to see|no results)|will appear here\.?$/i

export function isEmptyState(text: string): boolean {
  return EMPTY_STATE.test(text.trim())
}

/** UI chrome that leaks into row text and must never reach the Markdown. */
const NOISE_LINES: RegExp[] = [
  /^show (all|credential)/i,
  /^…?\s*see more$/i,
  /^…\s*more$/i,
  /^endorse$/i,
  /^endorsed by\b/i,
  /^credential id\b/i,
  /^\d[\d,+]*\s+(followers|connections)$/i,
  /^contact info$/i,
  /^(1st|2nd|3rd\+?)( degree connection)?$/i,
  /mutual connections?$/i,
  /^(message|connect|follow|following|more|pending|book an appointment|open to|add profile section|enhance profile|resources|view as|edit|save)$/i,
  /^\(?(he|she|they|ze|xe)\s*\/\s*\w+\)?$/i,
  /^[·•]/,
  /\slogo$/i,
]

export function isNoiseLine(line: string): boolean {
  return NOISE_LINES.some((re) => re.test(line))
}

const norm = (s: string | null | undefined) =>
  (s ?? "").replace(/\s+/g, " ").trim()

/** Tags that end a text line, mirroring how the browser lays the page out.
 * We cannot use `innerText`: jsdom (the test environment) does not implement it. */
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "BR",
  "BUTTON",
  "DIV",
  "DL",
  "DD",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
])

/**
 * Visible text of an element as trimmed, non-empty lines. Also collapses the
 * consecutive duplicate lines produced by the legacy layout's `.visually-hidden`
 * screen-reader copies.
 */
export function textLines(root: Element): string[] {
  const clone = root.cloneNode(true) as Element
  for (const hidden of clone.querySelectorAll(
    // `/overlay/` links are interactive chips LinkedIn hangs off a row (the skills
    // associated with a job, for instance). They are controls, not profile content,
    // and would otherwise land in the row's description.
    '.visually-hidden, [class*="visually-hidden"], a[href*="/overlay/"], script, style',
  )) {
    hidden.remove()
  }

  const lines: string[] = []
  let buffer = ""
  const flush = () => {
    const text = norm(buffer)
    if (text) lines.push(text)
    buffer = ""
  }
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      buffer += node.textContent ?? ""
      return
    }
    if (node.nodeType !== 1) return
    const isBlock = BLOCK_TAGS.has((node as Element).tagName)
    if (isBlock) flush()
    for (const child of node.childNodes) walk(child)
    if (isBlock) flush()
  }
  walk(clone)
  flush()

  return lines.filter((line, i) => line !== lines[i - 1])
}

const elementText = (el: Element) => norm(textLines(el).join(" "))

function isJunk(el: Element): boolean {
  if (["NAV", "ASIDE", "FOOTER", "SCRIPT", "STYLE"].includes(el.tagName))
    return true
  if (el.closest("aside, footer, nav")) return true
  return JUNK_TEXT.test(elementText(el))
}

/** A row is a container: it has at least one child element carrying text. Leaf
 * fields (a title <p>, a date <span>) are not rows, which is what stops the search
 * from descending into an entry and mistaking its fields for siblings. */
const isContainer = (el: Element) =>
  [...el.children].some((child) => elementText(child))

export function hasDateRange(el: Element): boolean {
  const text = elementText(el)
  if (!/\b(19|20)\d{2}\b/.test(text)) return false
  return /[–—-]/.test(text) || /\bpresent\b/i.test(text)
}

/**
 * Does this element look like an entry of this section? Used to score candidate
 * sibling groups, so a group of real rows outranks a group of one row's fields.
 * Skills and languages have no date or entity link, so they fall back to counting
 * containers — their rows are the largest sibling group either way.
 */
const ROW_PREDICATE: Partial<Record<SectionKey, (el: Element) => boolean>> = {
  experience: (el) =>
    hasDateRange(el) || !!el.querySelector('a[href*="/company/"]'),
  education: (el) =>
    hasDateRange(el) || !!el.querySelector('a[href*="/school/"]'),
  certifications: (el) =>
    hasDateRange(el) || !!el.querySelector('a[href*="/company/"]'),
}

/**
 * The element whose entire text is the section heading — at whatever tag LinkedIn
 * used. Matched with equality (plus a trailing count, "Skills (25)") so a heading
 * never swallows the section body.
 */
export function findHeadingBlock(
  doc: Document,
  key: SectionKey,
): Element | null {
  const root = doc.querySelector("main") ?? doc.body
  if (!root) return null

  const titles = SECTION_TITLES[key]
  let heading: Element | null = null
  for (const el of root.querySelectorAll("*")) {
    // LinkedIn's own footer sits inside <main> and links to "About" — a heading is
    // never a link, and never lives in the site chrome.
    if (el.closest("a, nav, footer, aside")) continue

    const text = norm(el.textContent)
    const isTitle = titles.some(
      (title) =>
        text.toLowerCase() === title.toLowerCase() ||
        new RegExp(`^${title}\\s*\\(\\d+\\)$`, "i").test(text),
    )
    // Keep descending: we want the innermost element that holds only the title.
    if (isTitle && (!heading || heading.contains(el))) heading = el
  }
  if (!heading) return null

  // Climb back out to the largest block that still contains nothing but the title —
  // that block is the heading's own sibling slot in the section container.
  let block: Element = heading
  while (
    block.parentElement &&
    norm(block.parentElement.textContent) === norm(heading.textContent)
  ) {
    block = block.parentElement
  }
  return block
}

/**
 * The section's rows: the sibling group near the heading that best matches the
 * section's row predicate (most matching members, shallowest on a tie).
 *
 * A sibling *group* rather than a selector because LinkedIn renders rows as <div>,
 * <li>, or a mix of both in the same section. A filter <nav> can also sit between
 * the heading and the list (skills), so we search the heading's subtree rather than
 * only its immediate siblings.
 */
export function findRows(doc: Document, key: SectionKey): Element[] {
  const block = findHeadingBlock(doc, key)
  if (!block) return []

  const main = doc.querySelector("main") ?? doc.body
  let root: Element = block
  for (
    let i = 0;
    i < 4 && root.parentElement && root.parentElement !== main;
    i++
  ) {
    root = root.parentElement
  }

  const predicate = ROW_PREDICATE[key]
  let best: Element[] = []
  let bestScore = 0
  let bestDepth = Infinity

  const visit = (el: Element, depth: number) => {
    const candidates = [...el.children].filter(
      (child) =>
        child !== block &&
        !child.contains(block) &&
        elementText(child) &&
        !isJunk(child) &&
        isContainer(child),
    )
    if (candidates.length >= 2) {
      const rows = predicate ? candidates.filter(predicate) : candidates
      if (
        rows.length >= 2 &&
        (rows.length > bestScore ||
          (rows.length === bestScore && depth < bestDepth))
      ) {
        best = rows
        bestScore = rows.length
        bestDepth = depth
      }
    }
    for (const child of el.children) {
      if (!isJunk(child)) visit(child, depth + 1)
    }
  }
  visit(root, 0)

  if (best.length === 0) best = singleEntryRows(block)

  // An unfilled section is a page of placeholder copy, not a list of entries.
  return best.filter((row) => !isEmptyState(elementText(row)))
}

/** A section with exactly one entry has no sibling group to find, so walk down the
 * single-child wrappers below the heading until the content branches. */
function singleEntryRows(block: Element): Element[] {
  const container = block.parentElement
  if (!container) return []

  let level = [...container.children].filter(
    (child) => child !== block && elementText(child) && !isJunk(child),
  )
  for (let i = 0; i < 12 && level.length === 1; i++) {
    const kids = [...level[0].children].filter(
      (child) => elementText(child) && !isJunk(child),
    )
    if (kids.length === 0) break
    level = kids
    if (kids.length > 1) break
  }
  return level
}

/** Sub-positions of a grouped row (several roles at one company): the outermost
 * list items inside the row, ignoring anything nested deeper. */
export function nestedRows(row: Element): Element[] {
  return [...row.querySelectorAll('li, [role="listitem"]')].filter((el) => {
    const parentItem = el.parentElement?.closest('li, [role="listitem"]')
    return !parentItem || !row.contains(parentItem)
  })
}

/** A row's own text, ignoring any nested sub-position list. */
export function ownLines(row: Element): string[] {
  const clone = row.cloneNode(true) as Element
  for (const list of clone.querySelectorAll('ul, ol, [role="list"]'))
    list.remove()
  return textLines(clone)
}

export function entityHints(row: Element): {
  companyHref: string | null
  schoolHref: string | null
  imgAlt: string | null
} {
  return {
    companyHref:
      row.querySelector('a[href*="/company/"]')?.getAttribute("href") ?? null,
    schoolHref:
      row.querySelector('a[href*="/school/"]')?.getAttribute("href") ?? null,
    imgAlt: row.querySelector("img")?.getAttribute("alt")?.trim() || null,
  }
}

/**
 * The profile name. LinkedIn dropped the <h1> — on the current layout the name is
 * the first heading inside the top card, and <title> ("Jane Doe | LinkedIn") is the
 * last-resort anchor that has outlived every redesign.
 */
export function findNameElement(doc: Document): Element | null {
  const main = doc.querySelector("main") ?? doc.body
  if (!main) return null

  for (const el of main.querySelectorAll("h1, h2, h3")) {
    const text = norm(el.textContent)
    if (!text || isJunk(el)) continue
    // A section heading is not a name.
    const isSectionTitle = Object.values(SECTION_TITLES)
      .flat()
      .some((title) => text.toLowerCase().startsWith(title.toLowerCase()))
    if (isSectionTitle) continue
    return el
  }
  return null
}

export function nameFromTitle(doc: Document): string {
  const title = norm(doc.title)
  if (!title) return ""
  const name = title.split("|")[0]
  return norm(name.replace(/\(\d+\)\s*/, ""))
}

export function findTopCard(doc: Document): Element | null {
  const name = findNameElement(doc)
  if (!name) return null
  return (
    name.closest("section") ?? name.closest("main > *") ?? name.parentElement
  )
}
