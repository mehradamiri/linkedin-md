import type { GenericEntry, Profile } from "@/lib/types"

/**
 * Markdown-escapes a value that goes into a heading, a list item or the headline —
 * places where a stray `#`, `*`, `[` or backtick changes the document's structure
 * rather than just its emphasis. Prose blocks (About, descriptions) are left verbatim:
 * escaping every asterisk in a paragraph hurts the reader far more than an accidental
 * italic, and the bullets we normalize in `scrape.ts` are meant to survive as Markdown.
 */
function escapeInline(text: string): string {
  return text
    .replace(/([\\`*_[\]<>])/g, "\\$1")
    .replace(/^(\s*)([#>-])/, "$1\\$2")
}

/**
 * A description arrives as one line per rendered block. Markdown joins single-newline
 * lines into one paragraph, so blocks are separated by a blank line — except between
 * consecutive bullets, where a blank line would break the list apart.
 */
function blocks(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const out: string[] = []
  lines.forEach((line, i) => {
    const previous = lines[i - 1]
    const bothBullets = previous?.startsWith("- ") && line.startsWith("- ")
    if (i > 0 && !bothBullets) out.push("")
    out.push(line)
  })
  return out
}

const meta = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(" · ")

function renderGeneric(entries: GenericEntry[], heading: string): string[] {
  const lines: string[] = [`## ${heading}`, ""]
  for (const entry of entries) {
    lines.push(`### ${escapeInline(entry.title)}`, "")
    const subtitle = meta(entry.subtitle, entry.dateRange)
    if (subtitle) lines.push(subtitle, "")
    if (entry.description) lines.push(...blocks(entry.description), "")
  }
  return lines
}

/**
 * Serializes a Profile into résumé-style Markdown. Tolerant by design: a section
 * is emitted only when it produced records, and no field is ever required.
 */
export function profileToMarkdown(profile: Profile): string {
  const lines: string[] = [`# ${escapeInline(profile.name)}`, ""]

  if (profile.headline) lines.push(`> ${escapeInline(profile.headline)}`, "")
  if (profile.location) lines.push(escapeInline(profile.location), "")

  const websites = profile.websites ?? []
  if (websites.length > 0) {
    for (const site of websites) lines.push(`- ${site}`)
    lines.push("")
  }

  if (profile.about) {
    lines.push("## About", "", ...blocks(profile.about), "")
  }

  if (profile.experience.length > 0) {
    lines.push("## Experience", "")
    for (const role of profile.experience) {
      lines.push(
        role.company
          ? `### ${escapeInline(role.title)} — ${escapeInline(role.company)}`
          : `### ${escapeInline(role.title)}`,
        "",
      )
      const line = meta(role.employmentType, role.dateRange, role.location)
      if (line) lines.push(line, "")
      if (role.description) lines.push(...blocks(role.description), "")
    }
  }

  if (profile.education.length > 0) {
    lines.push("## Education", "")
    for (const school of profile.education) {
      lines.push(`### ${escapeInline(school.school)}`, "")
      const line = meta(school.degree, school.dateRange)
      if (line) lines.push(line, "")
      if (school.description) lines.push(...blocks(school.description), "")
    }
  }

  if (profile.skills.length > 0) {
    lines.push("## Skills", "")
    for (const skill of profile.skills) {
      lines.push(
        skill.endorsements
          ? `- ${escapeInline(skill.name)} · ${skill.endorsements} endorsements`
          : `- ${escapeInline(skill.name)}`,
      )
    }
    lines.push("")
  }

  if (profile.languages.length > 0) {
    lines.push("## Languages", "")
    for (const language of profile.languages) {
      lines.push(
        language.proficiency
          ? `- ${escapeInline(language.name)} — ${escapeInline(language.proficiency)}`
          : `- ${escapeInline(language.name)}`,
      )
    }
    lines.push("")
  }

  if (profile.certifications.length > 0) {
    lines.push("## Certifications", "")
    for (const cert of profile.certifications) {
      const line = meta(
        cert.issuer,
        cert.dateRange,
        cert.credentialId && `Credential ID ${cert.credentialId}`,
      )
      lines.push(
        line
          ? `- ${escapeInline(cert.title)} — ${line}`
          : `- ${escapeInline(cert.title)}`,
      )
      // Indented continuation keeps the note attached to its list item.
      if (cert.description)
        for (const block of blocks(cert.description))
          lines.push(block ? `  ${block}` : "")
    }
    lines.push("")
  }

  for (const section of profile.extras ?? []) {
    if (section.entries.length === 0) continue
    lines.push(...renderGeneric(section.entries, section.title))
  }

  lines.push("---", "")

  // A section that failed to load and a section the member never filled in look
  // identical in the output, so the ones that failed are named explicitly.
  const warnings = profile.warnings ?? []
  if (warnings.length > 0) {
    lines.push(
      `**Incomplete capture.** These sections could not be read: ${warnings.join(", ")}.`,
      "",
    )
  }

  lines.push(
    `Source: [${profile.url}](${profile.url}) · captured ${profile.scrapedAt.slice(0, 10)}`,
    "",
  )

  return `${lines.join("\n").trim()}\n`
}

/** jane-doe-2026-07-14.md */
export function markdownFilename(profile: Profile): string {
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${slug || "linkedin-profile"}-${profile.scrapedAt.slice(0, 10)}.md`
}
