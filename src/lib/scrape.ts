import {
  dropLogoLines,
  entityHints,
  externalLinks,
  findRows,
  findTopCard,
  findHeadingBlock,
  findNameElement,
  isNoiseLine,
  nameFromTitle,
  nestedRows,
  normalizeLine,
  overlayLines,
  ownLines,
  SECTION_TITLES,
  textLines,
  type SectionKey,
} from "@/lib/selectors"
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  GenericEntry,
  LanguageEntry,
  Profile,
  SkillEntry,
} from "@/lib/types"

export function isProfileUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    // Exact host, not a suffix: "evil-linkedin.com".endsWith("linkedin.com") is true.
    const isLinkedIn =
      hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
    return isLinkedIn && /^\/in\/[^/]+/.test(pathname)
  } catch {
    return false
  }
}

/** "https://www.linkedin.com/in/jane-doe/details/skills/" -> "jane-doe" */
export function profileHandle(url: string): string | null {
  try {
    const match = /^\/in\/([^/]+)/.exec(new URL(url).pathname)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/** "Mar 2024 - Present · 2 yrs 5 mos", "2009 – 2014", "Issued Mar 2020",
 * "Expires Mar 2023". */
export function isDateRangeLine(line: string): boolean {
  if (!/\b(19|20)\d{2}\b/.test(line)) return false
  return (
    /[–—-]/.test(line) ||
    /\bpresent\b/i.test(line) ||
    /^(issued|expires?|expired)\b/i.test(line)
  )
}

const clean = (lines: string[]) =>
  dropLogoLines(
    lines
      .map(normalizeLine)
      .filter(Boolean)
      .filter((line) => !isNoiseLine(line)),
  )

const EMPLOYMENT_TYPE =
  /^(full[- ]time|part[- ]time|self[- ]employed|freelance|contract|internship|apprenticeship|seasonal|temporary|permanent)$/i

const segments = (line: string) =>
  line
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)

/**
 * A location is short, unpunctuated, and either explicitly geographic or a
 * title-cased place name. The old rule accepted any line of four words or fewer,
 * which quietly promoted a description's opening clause ("Led the platform team")
 * into the location field.
 */
const looksLikeLocation = (line: string) => {
  if (line.length > 90 || /[.!?]$/.test(line) || line.startsWith("- "))
    return false
  if (/\b(on-site|remote|hybrid)\b/i.test(line)) return true
  if (/,/.test(line)) return true
  if (/\b(area|region|province|county|metropolitan|greater)\b/i.test(line))
    return true

  const words = line.split(" ")
  const isTitleCased = words.every(
    (word) => /^[A-Z(]/.test(word) || /^(of|the|and|de|du|da|la|le|el)$/i.test(word),
  )
  return words.length <= 4 && isTitleCased
}

function parseRole(
  lines: string[],
  fallbackCompany?: string,
): ExperienceEntry | null {
  if (lines.length === 0) return null

  const [title, ...rest] = lines
  const entry: ExperienceEntry = { title }

  const dateIdx = rest.findIndex(isDateRangeLine)
  // Everything between the title and the dates identifies the employer. A standalone
  // role puts "Acme Corp · Full-time" there; a grouped sub-role puts only the
  // employment type, and inherits the company from its group header — reading that
  // line as the company is what used to export roles filed under "Full-time".
  const head = dateIdx >= 0 ? rest.slice(0, dateIdx) : rest.slice(0, 1)
  for (const segment of head.flatMap(segments)) {
    if (EMPLOYMENT_TYPE.test(segment)) entry.employmentType ??= segment
    else entry.company ??= segment
  }
  if (!entry.company && fallbackCompany) entry.company = fallbackCompany

  let cursor = dateIdx >= 0 ? dateIdx : head.length
  if (dateIdx >= 0) {
    entry.dateRange = rest[dateIdx]
    cursor = dateIdx + 1
  }
  if (rest[cursor] && looksLikeLocation(rest[cursor])) {
    entry.location = rest[cursor]
    cursor += 1
  }
  const description = rest.slice(cursor).join("\n").trim()
  if (description) entry.description = description

  return entry
}

function scrapeExperience(doc: Document): ExperienceEntry[] {
  const entries: ExperienceEntry[] = []

  for (const row of findRows(doc, "experience")) {
    const subRows = nestedRows(row)

    if (subRows.length > 0) {
      // Several roles at one company: the row's own text is the company header
      // ("NVIDIA / Full-time · 6 yrs 7 mos"), each nested item is a role.
      const header = clean(ownLines(row))
      // The header renders as "Acme Corp / Full-time / 6 yrs 7 mos" across several
      // lines or joined by separators, depending on the layout — so scan all of it.
      const headerParts = header.flatMap(segments)
      const company =
        headerParts.find((part) => !EMPLOYMENT_TYPE.test(part)) ??
        entityHints(row).imgAlt ??
        undefined
      const employmentType = headerParts.find((part) =>
        EMPLOYMENT_TYPE.test(part),
      )
      for (const subRow of subRows) {
        const entry = parseRole(clean(textLines(subRow)), company)
        if (!entry) continue
        if (employmentType) entry.employmentType ??= employmentType
        entries.push(entry)
      }
      continue
    }

    const entry = parseRole(clean(textLines(row)))
    if (entry) entries.push(entry)
  }

  return entries
}

/**
 * A single date rather than a range. Publications, patents, awards and courses are
 * stamped with one ("Mar 2021", "2019"), which no range rule matches — leaving the
 * date to be mistaken for the entry's prose.
 */
export function isDateLine(line: string): boolean {
  return (
    isDateRangeLine(line) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}$/i.test(
      line,
    ) ||
    /^(19|20)\d{2}$/.test(line)
  )
}

/** Splits a row's lines below its title into the date lines and everything else.
 * Keeping *all* of both is what stops a row's third, fourth and fifth lines — field
 * of study, grade, activities, an expiry date — from being silently discarded. */
function partition(rest: string[], isDate = isDateRangeLine) {
  return {
    dates: rest.filter(isDate),
    text: rest.filter((line) => !isDate(line)),
  }
}

function scrapeEducation(doc: Document): EducationEntry[] {
  const entries: EducationEntry[] = []

  for (const row of findRows(doc, "education")) {
    const lines = clean(textLines(row))
    if (lines.length === 0) continue

    const [school, ...rest] = lines
    const entry: EducationEntry = { school }
    const { dates, text } = partition(rest)
    if (dates.length > 0) entry.dateRange = dates.join(" · ")
    if (text[0]) entry.degree = text[0]
    const description = text.slice(1).join("\n").trim()
    if (description) entry.description = description
    entries.push(entry)
  }

  return entries
}

function scrapeSkills(doc: Document): SkillEntry[] {
  const entries: SkillEntry[] = []
  const seen = new Set<string>()

  for (const row of findRows(doc, "skills")) {
    const lines = clean(textLines(row))
    const name = lines[0]
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())

    const entry: SkillEntry = { name }
    // "15 endorsements", and "99+ endorsements" once LinkedIn stops counting. The
    // count renders as an /overlay/ chip, which `textLines` strips — so the row's
    // overlay text has to be read back in, or every count goes missing.
    const endorsements = [...lines, ...overlayLines(row)]
      .map((line) => /^(\d[\d,]*\+?)\s+endorsements?$/i.exec(line))
      .find(Boolean)
    if (endorsements) entry.endorsements = endorsements[1]
    entries.push(entry)
  }

  return entries
}

function scrapeLanguages(doc: Document): LanguageEntry[] {
  const entries: LanguageEntry[] = []

  for (const row of findRows(doc, "languages")) {
    const lines = clean(textLines(row))
    if (lines.length === 0) continue
    const entry: LanguageEntry = { name: lines[0] }
    if (lines[1]) entry.proficiency = lines[1]
    entries.push(entry)
  }

  return entries
}

function scrapeCertifications(doc: Document): CertificationEntry[] {
  const entries: CertificationEntry[] = []

  for (const row of findRows(doc, "certifications")) {
    const raw = textLines(row).map(normalizeLine).filter(Boolean)
    const lines = clean(textLines(row))
    if (lines.length === 0) continue

    const [title, ...rest] = lines
    const entry: CertificationEntry = { title }
    const { dates, text } = partition(rest)
    if (dates.length > 0) entry.dateRange = dates.join(" · ")
    if (text[0]) entry.issuer = text[0]
    const description = text.slice(1).join("\n").trim()
    if (description) entry.description = description
    // The credential ID is filtered as noise before it reaches `lines`, so it is
    // recovered from the row's raw text rather than left out of the export.
    const credential = raw
      .map((line) => /^credential id\s*[:·-]?\s*(.+)$/i.exec(line))
      .find(Boolean)
    if (credential) entry.credentialId = credential[1].trim()
    entries.push(entry)
  }

  return entries
}

/** Publications, projects, volunteering, honors, courses, patents, organizations —
 * all render as title / subtitle / dates / prose, so one parser covers them. */
function scrapeGeneric(doc: Document, key: SectionKey): GenericEntry[] {
  const entries: GenericEntry[] = []

  for (const row of findRows(doc, key)) {
    const lines = clean(textLines(row))
    if (lines.length === 0) continue

    const [title, ...rest] = lines
    const entry: GenericEntry = { title }
    const { dates, text } = partition(rest, isDateLine)
    if (dates.length > 0) entry.dateRange = dates.join(" · ")
    if (text[0]) entry.subtitle = text[0]
    const description = text.slice(1).join("\n").trim()
    if (description) entry.description = description
    entries.push(entry)
  }

  return entries
}

function scrapeAbout(doc: Document): string | undefined {
  const block = findHeadingBlock(doc, "about")
  if (!block) return undefined

  const container = block.parentElement
  if (!container) return undefined

  const lines: string[] = []
  for (const child of container.children) {
    if (child === block || child.contains(block)) continue
    // Site chrome (LinkedIn's own footer nav) must never be mistaken for prose.
    if (
      child.closest("nav, footer, aside") ||
      child.querySelector("nav, footer")
    )
      continue
    lines.push(...clean(textLines(child)))
  }
  const text = lines.join("\n").trim()
  return text || undefined
}

/** Strips LinkedIn's click-tracking so the same site does not appear twice, once as
 * link text and once as an instrumented href. */
export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of ["trk", "trkInfo", "originalSubdomain", "original_referer"])
      parsed.searchParams.delete(key)
    const search = parsed.searchParams.toString()
    const path = parsed.pathname.replace(/\/$/, "")
    return `${parsed.origin}${path}${search ? `?${search}` : ""}${parsed.hash}`
  } catch {
    return url.replace(/\/$/, "")
  }
}

/** The location line in a top card: geographic, unpunctuated, and never a URL. */
const looksLikeProfileLocation = (line: string) =>
  !/^https?:\/\//i.test(line) &&
  line.length <= 90 &&
  !/[.!?]$/.test(line) &&
  (/,/.test(line) ||
    /\b(area|region|province|county|metropolitan|greater)\b/i.test(line))

export function scrapeHeader(
  doc: Document,
): Pick<Profile, "name" | "websites"> &
  Partial<Pick<Profile, "headline" | "location">> {
  const nameEl = findNameElement(doc)
  const name = (nameEl ? textLines(nameEl)[0] : "") || nameFromTitle(doc)
  const topCard = findTopCard(doc)
  if (!topCard) return { name, websites: [] }

  const rawLines = textLines(topCard)

  // The top card shows the current company and school as chips, which sit right where
  // the location does and carry no link or class to select on. Two things give them
  // away, and both are needed: a card with several chips renders them once combined
  // ("Acme Corp · Example University") and again standing alone, while a card with a
  // single chip renders that one chip *twice*. Matching only the first pattern is
  // what used to export "Gates Foundation" as Bill Gates's location.
  const occurrences = new Map<string, number>()
  for (const line of rawLines)
    occurrences.set(line, (occurrences.get(line) ?? 0) + 1)

  const chipNames = new Set<string>()
  for (const line of rawLines) {
    const parts = segments(line)
    if (parts.length >= 2) {
      const everySegmentStandsAlone = parts.every((segment) =>
        rawLines.some((other) => other !== line && other === segment),
      )
      if (everySegmentStandsAlone) for (const part of parts) chipNames.add(part)
    }
    // A repeated line is a chip — unless it reads as a place, since losing a real
    // location is worse than leaving a duplicate company name in the card.
    if (
      (occurrences.get(line) ?? 0) > 1 &&
      line !== name &&
      !looksLikeProfileLocation(line)
    ) {
      chipNames.add(line)
    }
  }
  const isChip = (line: string) =>
    chipNames.size > 0 && segments(line).every((part) => chipNames.has(part))

  const usable = (line: string) =>
    !line.startsWith(name) && !isChip(line) && !/contact info/i.test(line)

  // Headline first, then the location: the first line under it that reads like a
  // place, falling back to simple order when nothing does (a bare "London" carries
  // no geographic marker of its own).
  const nameIdx = rawLines.findIndex((line) => line.startsWith(name))
  const below = clean(rawLines.slice(nameIdx + 1)).filter(usable)
  const trimSeparators = (line?: string) =>
    line?.replace(/^[·•\s]+|[·•\s]+$/g, "") || undefined

  const beneathHeadline = below.slice(1)
  const location =
    beneathHeadline.find(looksLikeProfileLocation) ?? beneathHeadline[0]

  const websites = new Set<string>()
  for (const href of externalLinks(topCard)) websites.add(canonicalUrl(href))
  for (const line of rawLines)
    if (/^https?:\/\/\S+$/i.test(line)) websites.add(canonicalUrl(line))

  return {
    name,
    headline: trimSeparators(below[0]),
    location: trimSeparators(location),
    websites: [...websites],
  }
}

/** Sections with a bespoke shape on the Profile. */
export const CORE_SECTIONS = [
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
] as const

/** Sections that land in `Profile.extras` as generic entries. Most members have none
 * of these, which is exactly why reading them has to be cheap — see `isEmptySection`. */
export const EXTRA_SECTIONS = [
  "publications",
  "projects",
  "volunteering",
  "honors",
  "courses",
  "patents",
  "organizations",
] as const

/** Sections that live on their own /details/{slug}/ page. */
export const DETAIL_SECTIONS = [...CORE_SECTIONS, ...EXTRA_SECTIONS] as const

export type CoreSection = (typeof CORE_SECTIONS)[number]
export type ExtraSectionKey = (typeof EXTRA_SECTIONS)[number]
export type DetailSection = (typeof DETAIL_SECTIONS)[number]

const SECTION_SCRAPERS: Record<DetailSection, (doc: Document) => unknown[]> = {
  experience: scrapeExperience,
  education: scrapeEducation,
  skills: scrapeSkills,
  languages: scrapeLanguages,
  certifications: scrapeCertifications,
  ...Object.fromEntries(
    EXTRA_SECTIONS.map((key) => [
      key,
      (doc: Document) => scrapeGeneric(doc, key),
    ]),
  ),
} as Record<DetailSection, (doc: Document) => unknown[]>

/** The heading a generic section gets in the Markdown. */
export function sectionTitle(key: DetailSection): string {
  return SECTION_TITLES[key][0]
}

/**
 * Reads one section out of whatever document it is given — the main profile for
 * layouts that still render sections inline, or the section's own /details/ page.
 * Pure over the Document so it can be tested against saved fixtures.
 */
export function scrapeSection<K extends CoreSection>(
  doc: Document,
  key: K,
): Profile[K]
export function scrapeSection(
  doc: Document,
  key: ExtraSectionKey,
): GenericEntry[]
export function scrapeSection(doc: Document, key: DetailSection): unknown[] {
  return SECTION_SCRAPERS[key](doc)
}

/** Untyped access for callers that loop over every section and sort the results out
 * afterwards — the content script does exactly that. */
export function scrapeAnySection(doc: Document, key: DetailSection): unknown[] {
  return SECTION_SCRAPERS[key](doc)
}

/** The header and About, which only ever exist on the main profile page. */
export function scrapeMainProfile(doc: Document, url: string): Profile {
  return {
    url,
    ...scrapeHeader(doc),
    about: scrapeAbout(doc),
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    extras: [],
    warnings: [],
    scrapedAt: new Date().toISOString(),
  }
}

export function hasContent(profile: Profile): boolean {
  return Boolean(
    profile.about ||
    profile.experience.length ||
    profile.education.length ||
    profile.skills.length ||
    profile.languages.length ||
    profile.certifications.length ||
    profile.extras.some((section) => section.entries.length),
  )
}
