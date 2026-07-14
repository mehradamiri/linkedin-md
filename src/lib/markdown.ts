import type { Profile } from "@/lib/types"

/**
 * Serializes a Profile into résumé-style Markdown. Tolerant by design: a section
 * is emitted only when it produced records, and no field is ever required.
 */
export function profileToMarkdown(profile: Profile): string {
  const lines: string[] = [`# ${profile.name}`, ""]

  if (profile.headline) lines.push(`> ${profile.headline}`, "")
  if (profile.location) lines.push(profile.location, "")

  if (profile.about) {
    lines.push("## About", "", profile.about, "")
  }

  if (profile.experience.length > 0) {
    lines.push("## Experience", "")
    for (const role of profile.experience) {
      lines.push(
        role.company
          ? `### ${role.title} — ${role.company}`
          : `### ${role.title}`,
        "",
      )
      const meta = [role.dateRange, role.location].filter(Boolean).join(" · ")
      if (meta) lines.push(meta, "")
      if (role.description) lines.push(role.description, "")
    }
  }

  if (profile.education.length > 0) {
    lines.push("## Education", "")
    for (const school of profile.education) {
      lines.push(`### ${school.school}`, "")
      const meta = [school.degree, school.dateRange].filter(Boolean).join(" · ")
      if (meta) lines.push(meta, "")
    }
  }

  if (profile.skills.length > 0) {
    lines.push("## Skills", "")
    for (const skill of profile.skills) {
      lines.push(
        skill.endorsements
          ? `- ${skill.name} · ${skill.endorsements} endorsements`
          : `- ${skill.name}`,
      )
    }
    lines.push("")
  }

  if (profile.languages.length > 0) {
    lines.push("## Languages", "")
    for (const language of profile.languages) {
      lines.push(
        language.proficiency
          ? `- ${language.name} — ${language.proficiency}`
          : `- ${language.name}`,
      )
    }
    lines.push("")
  }

  if (profile.certifications.length > 0) {
    lines.push("## Certifications", "")
    for (const cert of profile.certifications) {
      const meta = [cert.issuer, cert.dateRange].filter(Boolean).join(" · ")
      lines.push(meta ? `- ${cert.title} — ${meta}` : `- ${cert.title}`)
    }
    lines.push("")
  }

  lines.push(
    "---",
    "",
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
