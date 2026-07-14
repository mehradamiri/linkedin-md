import {
  entityHints,
  findRows,
  findTopCard,
  findHeadingBlock,
  findNameElement,
  isNoiseLine,
  nameFromTitle,
  nestedRows,
  ownLines,
  textLines,
} from "@/lib/selectors"
import type {
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  Profile,
  SkillEntry,
} from "@/lib/types"

export function isProfileUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    return hostname.endsWith("linkedin.com") && /^\/in\/[^/]+/.test(pathname)
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

/** "Mar 2024 - Present · 2 yrs 5 mos", "2009 – 2014", "Issued Mar 2020". */
export function isDateRangeLine(line: string): boolean {
  if (!/\b(19|20)\d{2}\b/.test(line)) return false
  return (
    /[–—-]/.test(line) || /\bpresent\b/i.test(line) || /^issued\b/i.test(line)
  )
}

const clean = (lines: string[]) => lines.filter((line) => !isNoiseLine(line))

/** "NVIDIA · Full-time" -> "NVIDIA" */
const companyName = (line: string) => line.split("·")[0].trim()

/** The line after the dates: "On-site", "San Jose, California, United States". */
const looksLikeLocation = (line: string) =>
  line.length <= 90 &&
  !/[.!?]$/.test(line) &&
  (/\b(on-site|remote|hybrid)\b/i.test(line) ||
    /,/.test(line) ||
    line.split(" ").length <= 4)

function parseRole(
  lines: string[],
  fallbackCompany?: string,
): ExperienceEntry | null {
  if (lines.length === 0) return null

  const [title, ...rest] = lines
  const entry: ExperienceEntry = { title }

  const dateIdx = rest.findIndex(isDateRangeLine)
  // A standalone role carries its company between the title and the dates
  // ("CEO / Parabricks / May 2016 – …"); a grouped sub-role has no company line
  // of its own and inherits the group's.
  if (dateIdx > 0) entry.company = companyName(rest[0])
  else if (fallbackCompany) entry.company = fallbackCompany

  if (dateIdx >= 0) {
    entry.dateRange = rest[dateIdx]
    let descStart = dateIdx + 1
    if (rest[descStart] && looksLikeLocation(rest[descStart])) {
      entry.location = rest[descStart]
      descStart += 1
    }
    const description = rest.slice(descStart).join("\n").trim()
    if (description) entry.description = description
  } else if (!entry.company && rest.length > 0) {
    entry.company = companyName(rest[0])
  }

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
      const company = header[0]
        ? companyName(header[0])
        : (entityHints(row).imgAlt ?? undefined)
      for (const subRow of subRows) {
        const entry = parseRole(clean(textLines(subRow)), company)
        if (entry) entries.push(entry)
      }
      continue
    }

    const entry = parseRole(clean(textLines(row)))
    if (entry) entries.push(entry)
  }

  return entries
}

function scrapeEducation(doc: Document): EducationEntry[] {
  const entries: EducationEntry[] = []

  for (const row of findRows(doc, "education")) {
    const lines = clean(textLines(row))
    if (lines.length === 0) continue

    const [school, ...rest] = lines
    const entry: EducationEntry = { school }
    const dateIdx = rest.findIndex(isDateRangeLine)
    if (dateIdx >= 0) entry.dateRange = rest[dateIdx]
    const degree = rest.filter((_, i) => i !== dateIdx)[0]
    if (degree) entry.degree = degree
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
    // "15 endorsements", and "99+ endorsements" once LinkedIn stops counting.
    const endorsements = lines
      .map((line) => /^(\d+\+?)\s+endorsements?$/i.exec(line))
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
    const lines = clean(textLines(row))
    if (lines.length === 0) continue

    const [title, ...rest] = lines
    const entry: CertificationEntry = { title }
    const dateIdx = rest.findIndex(isDateRangeLine)
    if (dateIdx >= 0) entry.dateRange = rest[dateIdx]
    const issuer = rest.filter((_, i) => i !== dateIdx)[0]
    if (issuer) entry.issuer = issuer
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

export function scrapeHeader(
  doc: Document,
): Pick<Profile, "name"> & Partial<Pick<Profile, "headline" | "location">> {
  const nameEl = findNameElement(doc)
  const name = (nameEl ? textLines(nameEl)[0] : "") || nameFromTitle(doc)
  const topCard = findTopCard(doc)
  if (!topCard) return { name }

  const rawLines = textLines(topCard)

  // The top card also shows the current company and school as chips, and they sit
  // between the headline and the location. They carry no link, no logo alt, nothing
  // to select on — but they are the only thing on the card rendered *twice*: once as
  // a combined "Acme Corp · Example University" line and again as standalone lines.
  // That duplication is what tells a chip apart from a location.
  const parts = (line: string) =>
    line
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean)
  const chipNames = new Set<string>()
  for (const line of rawLines) {
    const segments = parts(line)
    if (segments.length < 2) continue
    const everySegmentStandsAlone = segments.every((segment) =>
      rawLines.some((other) => other !== line && other === segment),
    )
    if (everySegmentStandsAlone)
      for (const segment of segments) chipNames.add(segment)
  }
  const isChip = (line: string) =>
    chipNames.size > 0 && parts(line).every((part) => chipNames.has(part))

  const usable = (line: string) =>
    !line.startsWith(name) && !isChip(line) && !/contact info/i.test(line)

  // Headline first, then the location: the next real line under it. Everything else
  // in the card — degree badge, follower counts, action buttons — is noise.
  const nameIdx = rawLines.findIndex((line) => line.startsWith(name))
  const below = clean(rawLines.slice(nameIdx + 1)).filter(usable)
  // A dangling "·" separator often shares the line with the location.
  const trimSeparators = (line?: string) =>
    line?.replace(/^[·•\s]+|[·•\s]+$/g, "") || undefined

  return {
    name,
    headline: trimSeparators(below[0]),
    location: trimSeparators(below[1]),
  }
}

/** Sections that live on their own /details/{slug}/ page. */
export const DETAIL_SECTIONS = [
  "experience",
  "education",
  "skills",
  "languages",
  "certifications",
] as const

export type DetailSection = (typeof DETAIL_SECTIONS)[number]

const SECTION_SCRAPERS = {
  experience: scrapeExperience,
  education: scrapeEducation,
  skills: scrapeSkills,
  languages: scrapeLanguages,
  certifications: scrapeCertifications,
} as const

/**
 * Reads one section out of whatever document it is given — the main profile for
 * layouts that still render sections inline, or the section's own /details/ page.
 * Pure over the Document so it can be tested against saved fixtures.
 */
export function scrapeSection<K extends DetailSection>(
  doc: Document,
  key: K,
): Profile[K] {
  return SECTION_SCRAPERS[key](doc) as Profile[K]
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
    profile.certifications.length,
  )
}
